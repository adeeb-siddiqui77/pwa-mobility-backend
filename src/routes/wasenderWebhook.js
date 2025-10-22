// src/routes/wasenderWebhook.js
import express from "express";
import JobAssignment from "../models/JobAssignment.js";
import { startAttempt, getIo } from "../services/socketService.js";
import { sendSimpleMessage } from "../services/waSender.js";
// import { createTicket } from '../controllers/tickets.js' // wherever your existing createTicket lives

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const body = req.body;

    // 1) Normalize event
    // Prefer dedicated poll webhook if WaSender sends it:
    //  - event === "poll.results", with pollCreationMessageKey / messageId + selectedOptions
    const event = body?.event || body?.type || 'messages.upsert';
    const data = body?.data || body;

    // Extract selection & original poll message id from either payload shape
    const selected =
      data?.message?.pollUpdate?.selectedOptions?.[0]?.text ||   // messages.upsert style
      data?.selectedOption ||                                     // poll.results style
      '';

    const originId =
      data?.message?.pollUpdate?.pollCreationMessageKey?.id ||    // messages.upsert style
      data?.pollCreationMessageId ||                               // poll.results style
      data?.message?.context?.id ||                                // general fallback
      null;

    if (!selected || !originId) {
      return res.sendStatus(200);
    }

    // 2) Map to job attempt via waMessageId
    const job = await JobAssignment.findOne({ "attempts.waMessageId": originId });
    const attempt = job?.attempts?.find(a => a.waMessageId === originId);
    if (!job || !attempt) return res.sendStatus(200);

    const attemptIndex = attempt.index;
    const now = new Date();

    // 3) SLA/Idempotence guard
    if (attempt.status !== "pending" || (attempt.expiresAt && new Date(attempt.expiresAt) <= now)) {
      // SLA expired or already handled → tell mechanic it's too late
      const to = job.ticketData?.phone; // if you store mechanic phone instead, use that
      if (to) {
        await sendSimpleMessage({
          to,
          text: "Sorry, this job request has expired and is no longer available.",
        });
      }
      return res.sendStatus(200);
    }

    const choice = String(selected).toLowerCase();
    const io = getIo();

    if (choice.includes("accept")) {
      // First-come wins
      attempt.status = "accepted";
      attempt.response = "accept";
      attempt.respondedAt = now;
      job.status = "accepted";
      await job.save();

      // emit sync to PWA
      io.to(`mechanic_${attempt.mechanicId}`).emit("job_response_ack", {
        jobId: job._id.toString(),
        attemptIndex,
        action: "ACCEPT",
      });

      // Call your EXISTING ticket creation (don’t duplicate logic)
      // await createTicketForAssignment(job, attempt.mechanicId) // wrapper that calls your createTicket controller internally

    } else if (choice.includes("reject")) {
      attempt.status = "rejected";
      attempt.response = "reject";
      attempt.respondedAt = now;
      await job.save();

      io.to(`mechanic_${attempt.mechanicId}`).emit("job_response_ack", {
        jobId: job._id.toString(),
        attemptIndex,
        action: "REJECT",
      });

      const next = attemptIndex + 1;
      if (next < job.attempts.length) {
        await startAttempt(job._id, next);
      } else {
        job.status = "no_response";
        await job.save();
      }
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error("WaSender webhook error", err);
    return res.sendStatus(200);
  }
});

export default router;
