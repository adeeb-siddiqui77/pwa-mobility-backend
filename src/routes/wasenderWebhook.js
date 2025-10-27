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
  const mech = await User.findById(attempt.mechanicId, "mobile");
  if (!mech?.phone) return;
  await sendSimpleMessage({
    to: mech.phone,
    text: "Sorry, this job request has expired or was already handled."
  });
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

  // Most common for WaSender poll updates:
  const selected =
    data?.message?.pollUpdate?.selectedOptions?.[0]?.text ||
    data?.selectedOption ||
    // Fallback: sometimes they flatten to conversation text
    data?.message?.conversation ||
    data?.message?.body ||
    "";

  // Original poll message id – used to map back to the attempt
  const originId =
    data?.message?.pollUpdate?.pollCreationMessageKey?.id ||
    data?.pollCreationMessageId ||
    data?.message?.context?.id ||
    data?.message?.key?.id ||
    null;

  return { selected: (selected || "").trim(), originId };
}




/**
 * MAIN WEBHOOK
 */



router.post("/", async (req, res) => {
  try {
    console.log("===== 📩 REAL WASENDER WEBHOOK =====");
    console.log(JSON.stringify(req.body, null, 2));

    const event = req.body?.event || req.body?.type || "messages.upsert";
    const data = req.body?.data || req.body;

    // messages can be an object or an array depending on WaSender
    const msgsRaw = data?.messages;
    const messages = Array.isArray(msgsRaw) ? msgsRaw : msgsRaw ? [msgsRaw] : [];

    // Helper: extract selection + originId from one message record
    const extractFromMsg = (m) => {
      // 1) Poll vote (messages.update usually, sometimes in upsert)
      //    Look for pollUpdates array or pollUpdate with selectedOptions
      const pollUpd =
        m?.pollUpdates?.[0] ||
        m?.update?.pollUpdates?.[0] ||
        m?.message?.pollUpdate || null;

      const selectedFromPoll =
        pollUpd?.selectedOptions?.[0]?.text ||
        pollUpd?.vote?.[0]?.name ||              // some variants
        pollUpd?.options?.[0]?.optionName ||     // safety
        null;

      // Origin poll message id (the poll that was created earlier)
      const originFromPoll =
        pollUpd?.context?.id ||
        m?.key?.id ||
        m?.message?.pollUpdate?.pollCreationMessageKey?.id ||
        null;

      // 2) Interactive button (if provider sends it this way)
      const selectedFromBtn =
        m?.message?.interactive?.button_reply?.id ||
        m?.message?.interactive?.button_reply?.title ||
        null;

      const originFromBtn =
        m?.message?.context?.id ||
        m?.key?.id ||
        null;

      // 3) Plain text fallback (“Accept” / “Reject”)
      const selectedFromText =
        m?.message?.conversation ||
        m?.message?.body ||
        null;

      // NOTE: For poll creation messages, there is pollCreationMessageV3; we should skip those.
      const isPollCreation = !!m?.message?.pollCreationMessageV3;

      // Decide which one we have
      if (isPollCreation) {
        return { selected: null, originId: null, skip: true };
      }

      // Priority: poll vote > button > text
      if (selectedFromPoll) {
        return { selected: selectedFromPoll, originId: originFromPoll, skip: false };
      }
      if (selectedFromBtn) {
        return { selected: selectedFromBtn, originId: originFromBtn, skip: false };
      }
      if (selectedFromText) {
        // For text we likely won't have origin id; we'll fallback by phone later
        return { selected: selectedFromText, originId: originFromBtn || m?.key?.id || null, skip: false };
      }
      return { selected: null, originId: null, skip: false };
    };

    // Find the first message in this payload that contains a selection
    let selected = null;
    let originId = null;
    let fromPn = null;
    for (const m of messages) {
      const { selected: s, originId: o, skip } = extractFromMsg(m);
      if (skip) {
        // ignore poll creation
        continue;
      }
      if (!fromPn) {
        // normalize sender phone
        const raw = m?.key?.remoteJid || m?.key?.from || m?.senderPn || data?.from || "";
        fromPn = String(raw).replace(/\D/g, "");
      }
      if (s) {
        selected = s;
        originId = o;
        break;
      }
    }

    if (!selected) {
      console.log("⚠️ No selection found in this event; likely a creation or non-vote message.");
      return res.sendStatus(200);
    }

    // Normalize selected
    const sel = String(selected).trim().toLowerCase();
    const desired =
      sel === "accept" || sel === "accepted" ? "accepted" :
      sel === "reject" || sel === "rejected" ? "rejected" :
      // if interactive button id is "ACCEPT"/"REJECT"
      sel === "accept_job" || sel === "accept_request" || sel === "accept" ? "accepted" :
      sel === "reject_job" || sel === "reject_request" || sel === "reject" ? "rejected" :
      null;

    if (!desired) {
      console.log("⚠️ Selection not recognized as accept/reject:", selected);
      return res.sendStatus(200);
    }

    // ----- Map to job/attempt -----
    let job = null;
    let attempt = null;

    // Prefer match by the poll message id we stored
    if (originId) {
      job = await JobAssignment.findOne({
        $or: [
          { "attempts.waPollMessageId": originId },
          { "attempts.waButtonMessageId": originId },
          { "attempts.waMessageId": originId }
        ]
      });
      attempt = job?.attempts?.find(a =>
        a.waPollMessageId === originId ||
        a.waButtonMessageId === originId ||
        a.waMessageId === originId
      );
    }

    // Fallback: match by sender phone to latest pending attempt for that mechanic
    if (!attempt && fromPn) {
      const mech = await User.findOne({ phone: new RegExp(fromPn + "$") });
      if (mech) {
        job = await JobAssignment.findOne({
          "attempts.mechanicId": mech._id,
          "attempts.status": "pending"
        }).sort({ createdAt: -1 });
        attempt = job?.attempts?.find(
          a => String(a.mechanicId) === String(mech._id) && a.status === "pending"
        );
      }
    }

    if (!job || !attempt) {
      console.log("❌ No matching job/attempt found for the vote.");
      return res.sendStatus(200);
    }

    // ----- SLA + first-click-wins (atomic) -----
    const attemptIndex = attempt.index;
    const now = new Date();
    const filter = {
      _id: job._id,
      "attempts.index": attemptIndex,
      "attempts.status": "pending",
      "attempts.expiresAt": { $gt: now }
    };
    const update = {
      $set: {
        "attempts.$.status": desired,
        "attempts.$.response": desired === "accepted" ? "accept" : "reject",
        "attempts.$.respondedAt": now,
        ...(desired === "accepted" ? { status: "accepted" } : {})
      }
    };
    const updated = await JobAssignment.findOneAndUpdate(filter, update, { new: true });

    // If expired or already handled
    if (!updated) {
      // reply to the mechanic to inform
      const mech = await User.findById(attempt.mechanicId, "phone");
      if (mech?.phone) {
        await sendSimpleMessage({
          to: mech.phone,
          text: "Sorry, this job request has expired or was already handled."
        });
      }
      return res.sendStatus(200);
    }

    // ----- PWA sync -----
    const io = getIo();
    io.to(`mechanic_${attempt.mechanicId}`).emit("job_response_ack", {
      jobId: updated._id.toString(),
      attemptIndex,
      action: desired === "accepted" ? "ACCEPT" : "REJECT"
    });

    // ----- Side effects -----
    if (desired === "accepted") {
      try {
        await invokeCreateTicket(attempt.mechanicId, updated.ticketData);
      } catch (e) {
        console.error("❌ createTicket failed:", e?.response?.data || e.message);
      }
    } else {
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
    console.error("❌ WaSender webhook error:", err);
    return res.sendStatus(200);
  }
});



export default router;
