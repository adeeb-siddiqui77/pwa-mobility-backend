import express from "express";
import axios from "axios";
import JobAssignment from "../models/JobAssignment.js";
import User from "../models/User.js";
import { startAttempt, getIo } from "../services/socketService.js";
import { sendSimpleMessage } from "../services/waSender.js";

// --- CONFIG ----------------------------------------------------
const CREATE_TICKET_URL =
  process.env.CREATE_TICKET_URL || "http://localhost:5000/api/zoho/create-ticket";
// ^^^ Adjust to the route that hits your existing createTicket controller

const router = express.Router();

/**
 * Utility: format a “too late” or “already handled” reply.
 */
async function safeReplyToMechanic(attempt) {
  // Find the mechanic's phone (not the customer's)
  const mech = await User.findById(attempt.mechanicId, "mobile");
  const to = mech?.mobile;
  if (!to) return;
  try {
    await sendSimpleMessage({
      to,
      text: "Sorry, this job request has expired or was already handled.",
    });
  } catch (e) {
    console.error("sendSimpleMessage failed:", e.response?.data || e.message);
  }
}

/**
 * Utility: call your existing createTicket API (so we don't duplicate logic).
 * NOTE: Ensure your API accepts { mechanicId, ticketData } as JSON body.
 */
async function invokeCreateTicket(mechanicId, ticketData) {
  try {
    const { data } = await axios.post(
      CREATE_TICKET_URL,
      { mechanicId, ticketData },
      { timeout: 20000 }
    );
    return data;
  } catch (e) {
    console.error("invokeCreateTicket error:", e.response?.data || e.message);
    throw e;
  }
}

/**
 * Extract the chosen option and original poll messageId from WaSender webhook.
 * WaSender may deliver as messages.upsert or a poll.results style – we normalize both.
 */
function extractSelectionAndOriginId(body) {
  const data = body?.data || body;

  // Try to read selected option text in multiple ways
  const selected =
    // Poll votes
    data?.message?.pollUpdate?.selectedOptions?.[0]?.text ||
    data?.selectedOption ||
    // Interactive button (some providers map polls as interactive replies)
    data?.message?.interactive?.button_reply?.title ||
    // Plain text fallback (“Accept”, “Reject”)
    data?.message?.conversation ||
    data?.message?.body ||
    '';

  // Try to read the original message id of the poll
  const originId =
    // Poll creation key id
    data?.message?.pollUpdate?.pollCreationMessageKey?.id ||
    data?.pollCreationMessageId ||
    // Context of replied message
    data?.message?.context?.id ||
    // Sometimes in key
    data?.message?.key?.id ||
    null;

  return { selected: (selected || '').trim(), originId };
}



/**
 * MAIN WEBHOOK
 */



router.post("/", async (req, res) => {
  try {
    console.log("===== 📩 REAL WASENDER WEBHOOK HIT =====");
    console.log(JSON.stringify(req.body, null, 2));

    // --- Step 1: Extract selection + original poll message ID ---
    const data = req.body?.data || req.body;

    const selected =
      data?.message?.pollUpdate?.selectedOptions?.[0]?.text ||
      data?.message?.interactive?.button_reply?.title ||
      data?.selectedOption ||
      data?.message?.conversation ||
      data?.message?.body ||
      "";

    const originId =
      data?.message?.pollUpdate?.pollCreationMessageKey?.id ||
      data?.pollCreationMessageId ||
      data?.message?.context?.id ||
      data?.message?.key?.id ||
      null;

    if (!selected) return res.sendStatus(200);

    console.log("Selected:", selected);
    console.log("Origin Poll ID:", originId);

    // --- Step 2: Try to map attempt by pollId first ---
    let job = originId
      ? await JobAssignment.findOne({
          $or: [
            { "attempts.waPollMessageId": originId },
            { "attempts.waMessageId": originId }
          ]
        })
      : null;

    let attempt = job?.attempts?.find(
      (a) => a.waPollMessageId === originId || a.waMessageId === originId
    );

    // --- Step 3: Fallback by mechanic phone if pollId missing ---
    if (!attempt) {
      const from =
        data?.key?.remoteJid ||
        data?.key?.from ||
        data?.message?.from ||
        data?.from ||
        "";
      const digits = from.replace(/\D/g, "");

      if (digits) {
        const mech = await User.findOne({ phone: new RegExp(digits + "$") });
        if (mech) {
          job = await JobAssignment.findOne({
            "attempts.mechanicId": mech._id,
            "attempts.status": "pending"
          }).sort({ createdAt: -1 });

          attempt = job?.attempts?.find(
            (a) =>
              String(a.mechanicId) === String(mech._id) &&
              a.status === "pending"
          );
        }
      }
    }

    // If still not found, ignore
    if (!job || !attempt) {
      console.log("❌ No matching job/attempt found for webhook");
      return res.sendStatus(200);
    }

    const attemptIndex = attempt.index;
    const now = new Date();
    const io = getIo();

    // --- Step 4: SLA + First-Vote-Wins (idempotent) ---
    const choice = selected.toLowerCase();
    const desired = choice.includes("accept")
      ? "accepted"
      : choice.includes("reject")
      ? "rejected"
      : null;

    if (!desired) return res.sendStatus(200);

    const filter = {
      _id: job._id,
      "attempts.index": attemptIndex,
      "attempts.status": "pending",
      "attempts.expiresAt": { $gt: now } // must still be active
    };

    const update = {
      $set: {
        "attempts.$.status": desired,
        "attempts.$.response": desired === "accepted" ? "accept" : "reject",
        "attempts.$.respondedAt": now,
        ...(desired === "accepted" ? { status: "accepted" } : {})
      }
    };

    const updated = await JobAssignment.findOneAndUpdate(filter, update, {
      new: true
    });

    // If update failed → expired or already handled → reply + exit
    if (!updated) {
      await safeReplyToMechanic(attempt);
      return res.sendStatus(200);
    }

    // Re-fetch updated attempt after DB update
    const updatedAttempt = updated.attempts.find(
      (a) => a.index === attemptIndex
    );

    // --- Step 5: Notify PWA via Socket ---
    io.to(`mechanic_${updatedAttempt.mechanicId.toString()}`).emit(
      "job_response_ack",
      {
        jobId: updated._id.toString(),
        attemptIndex,
        action: desired === "accepted" ? "ACCEPT" : "REJECT"
      }
    );

    // --- Step 6: Accept -> createTicket | Reject -> next mechanic ---
    if (desired === "accepted") {
      try {
        // Calls your existing createTicket (DO NOT DUPLICATE ZOHO LOGIC)
        await invokeCreateTicket(updatedAttempt.mechanicId, updated.ticketData);
      } catch (error) {
        console.error("❌ createTicket failed:", error.message);
      }
    } else {
      // If rejected → try next mechanic
      const next = attemptIndex + 1;
      if (next < updated.attempts.length) {
        await startAttempt(updated._id, next);
      } else {
        updated.status = "no_response";
        await updated.save();
      }
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error("❌ WaSender webhook error", err);
    return res.sendStatus(200);
  }
});


export default router;
