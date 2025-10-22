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

  // Try to read “selected option”
  const selected =
    data?.message?.pollUpdate?.selectedOptions?.[0]?.text ||
    data?.message?.interactive?.button_reply?.title || // if rendered as interactive button
    data?.selectedOption ||
    data?.message?.conversation ||
    data?.message?.body ||
    '';

  // Try to read “original poll message id”
  const originId =
    data?.message?.pollUpdate?.pollCreationMessageKey?.id ||
    data?.pollCreationMessageId ||
    data?.message?.context?.id ||
    data?.message?.key?.id ||
    null;

  return { selected: (selected || '').trim(), originId };
}


/**
 * MAIN WEBHOOK
 */
router.post("/", async (req, res) => {
  try {

    console.log('--- WaSender webhook hit ---');
  console.log('headers:', JSON.stringify(req.headers, null, 2));
  console.log('body:', JSON.stringify(req.body, null, 2));


    const { selected, originId } = extractSelectionAndOriginId(req.body);
    if (!selected || !originId) return res.sendStatus(200);

    // 1) Find the job & attempt using the poll message id we stored when sending
    const job = await JobAssignment.findOne({ "attempts.waMessageId": originId });
    if (!job) return res.sendStatus(200);

    const attempt = job.attempts.find((a) => a.waMessageId === originId);
    if (!attempt) return res.sendStatus(200);

    const attemptIndex = attempt.index;
    const now = new Date();

    // 2) Enforce SLA + first-vote-wins (idempotent)
    if (
      attempt.status !== "pending" ||
      (attempt.expiresAt && new Date(attempt.expiresAt) <= now)
    ) {
      // Too late or already handled → notify mechanic & exit
      await safeReplyToMechanic(attempt);
      return res.sendStatus(200);
    }

    // 3) Atomically flip the state so only the first vote wins under race
    const choice = selected.toLowerCase();
    const desired = choice.includes("accept") ? "accepted" :
                    choice.includes("reject") ? "rejected" : null;

    if (!desired) return res.sendStatus(200);

    const filter = {
      _id: job._id,
      "attempts.index": attemptIndex,
      "attempts.status": "pending",
      "attempts.expiresAt": { $gt: now }, // still within SLA
    };

    const update = {
      $set: {
        "attempts.$.status": desired,
        "attempts.$.response": desired === "accepted" ? "accept" : "reject",
        "attempts.$.respondedAt": now,
        ...(desired === "accepted" ? { status: "accepted" } : {}),
      },
    };

    const updated = await JobAssignment.findOneAndUpdate(filter, update, {
      new: true,
    });

    if (!updated) {
      // Lost the race or expired between reads
      await safeReplyToMechanic(attempt);
      return res.sendStatus(200);
    }

    // Re-pull the attempt after update
    const updatedAttempt = updated.attempts.find((a) => a.index === attemptIndex);
    const io = getIo();

    // 4) Broadcast ack to the PWA room so UI syncs
    io.to(`mechanic_${updatedAttempt.mechanicId.toString()}`).emit(
      "job_response_ack",
      {
        jobId: updated._id.toString(),
        attemptIndex,
        action: desired === "accepted" ? "ACCEPT" : "REJECT",
      }
    );

    // 5) Side-effects per choice
    if (desired === "accepted") {
      // Call your existing createTicket API with original ticketData + mechanicId
      try {
        await invokeCreateTicket(updatedAttempt.mechanicId, updated.ticketData);
      } catch (e) {
        // If Zoho fails here, the attempt is already accepted. You might want to:
        // - mark a flag on the job (e.g., ticketCreationFailed: true)
        // - and alert ops / retry queue. For now, we just log.
        console.error("createTicket failed after accept:", e.message);
      }
    } else {
      // Rejection → move to next attempt or close as no_response
      const nextIdx = attemptIndex + 1;
      if (nextIdx < updated.attempts.length) {
        await startAttempt(updated._id, nextIdx);
      } else {
        updated.status = "no_response";
        await updated.save();
      }
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error("WaSender webhook error", err);
    // Always 200 to prevent webhook retry storms; you can tighten this later if needed.
    return res.sendStatus(200);
  }
});

export default router;
