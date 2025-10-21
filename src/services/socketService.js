// src/services/socketService.js
import { Server } from 'socket.io';
import JobAssignment from '../models/JobAssignment.js';
import { createZohoTicketForMechanic } from './zohoService.js';

let ioInstance = null;
const timers = new Map();
const SLA_SECONDS = parseInt(process.env.SLA_SECONDS || '120', 10);

/**
 * initSocket(httpServer)
 */
export function initSocket(httpServer) {
  if (ioInstance) return ioInstance;

  ioInstance = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    path: '/socket.io'
  });

  console.log('Socket.IO initializing...');

  ioInstance.on('connection', (socket) => {
    console.log('Socket connected:', socket.id, 'handshake:', socket.handshake && (socket.handshake.auth || socket.handshake.query));

    // mechanic registers to a room: { mechanicId }
    socket.on('mechanic_register', (data, cb) => {
      try {
        if (!data || !data.mechanicId) {
          if (cb) cb({ ok: false, message: 'mechanicId required' });
          return;
        }
        const room = `mechanic_${data.mechanicId.toString()}`;
        socket.join(room);
        console.log(`Socket ${socket.id} joined room ${room}`);
        if (cb) cb({ ok: true, message: `joined ${room}` });
        socket.emit('registered', { mechanicId: data.mechanicId, socketId: socket.id });
      } catch (err) {
        console.error('mechanic_register error', err);
        if (cb) cb({ ok: false, message: 'internal error' });
      }
    });

    // Mechanic response handler
    socket.on('job_response', async (payload, cb) => {
      try {
        // payload = { jobId, attemptIndex, response: 'accept'|'reject' }
        const { jobId, attemptIndex, response } = payload || {};
        if (!jobId || typeof attemptIndex !== 'number' || !['accept','reject'].includes(response)) {
          if (cb) cb({ ok: false, message: 'invalid payload' });
          return;
        }

        const job = await JobAssignment.findById(jobId);
        if (!job) {
          if (cb) cb({ ok: false, message: 'job not found' });
          return;
        }

        const attempt = job.attempts.find(a => a.index === attemptIndex);
        if (!attempt) {
          if (cb) cb({ ok: false, message: 'attempt not found' });
          return;
        }

        const now = new Date();
        if (attempt.status !== 'pending') {
          if (cb) cb({ ok: false, message: 'attempt not pending' });
          return;
        }
        if (attempt.expiresAt && new Date(attempt.expiresAt) <= now) {
          if (cb) cb({ ok: false, message: 'SLA expired' });
          return;
        }

        // Clear timer
        const timerKey = `${jobId}:${attemptIndex}`;
        const timeoutId = timers.get(timerKey);
        if (timeoutId) {
          clearTimeout(timeoutId);
          timers.delete(timerKey);
        }

        if (response === 'accept') {
          // mark accepted
          attempt.status = 'accepted';
          attempt.response = 'accept';
          attempt.respondedAt = now;
          job.status = 'accepted';
          await job.save();

          // call Zoho helper (reuses your logic)
          try {
            const { zohoTicket, mongoTicket } = await createZohoTicketForMechanic(job.ticketData, attempt.mechanicId);
            job.acceptedTicketId = zohoTicket.id;
            await job.save();

            // ack mechanic
            if (cb) cb({ ok: true, message: 'Accepted and ticket created', ticket: mongoTicket });
            // optionally notify agent / admins here
            ioInstance.to(`mechanic_${attempt.mechanicId.toString()}`).emit('job_response_ack', { ok: true, message: 'Ticket created', ticket: mongoTicket });
            return;
          } catch (err) {
            console.error('Zoho create error', err);
            job.status = 'failed';
            await job.save();
            if (cb) cb({ ok: false, message: 'Accepted but Zoho creation failed', error: err.message });
            return;
          }
        } else {
          // reject -> mark and move to next
          attempt.status = 'rejected';
          attempt.response = 'reject';
          attempt.respondedAt = now;
          await job.save();

          const nextIndex = attemptIndex + 1;
          if (nextIndex < job.attempts.length) {
            await startAttempt(job._id, nextIndex);
            if (cb) cb({ ok: true, message: 'Rejection recorded, moved to next' });
            return;
          } else {
            job.status = 'no_response';
            await job.save();
            if (cb) cb({ ok: true, message: 'Rejection recorded; no mechanics left' });
            return;
          }
        }
      } catch (err) {
        console.error('job_response handler error', err);
        if (cb) cb({ ok: false, message: err.message });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', socket.id, reason);
    });
  });

  console.log('Socket.IO initialized');
  return ioInstance;
}

/**
 * startAttempt(jobId, attemptIndex)
 * Emits job_alert and schedules SLA timeout.
 */
export async function startAttempt(jobId, attemptIndex) {
  const job = await JobAssignment.findById(jobId);
  if (!job) throw new Error('Job not found');
  if (job.status !== 'open') return;

  const attempt = job.attempts.find(a => a.index === attemptIndex);
  if (!attempt) throw new Error('Attempt not found');

  const now = new Date();
  const expiresAt = new Date(now.getTime() + SLA_SECONDS * 1000);

  attempt.status = 'pending';
  attempt.startedAt = now;
  attempt.expiresAt = expiresAt;
  job.currentAttemptIndex = attemptIndex;
  await job.save();

  const payload = {
    jobId: job._id.toString(),
    attemptIndex,
    issue: job.issue,
    eta: job.eta,
    slaSeconds: SLA_SECONDS,
    expiresAt: expiresAt.toISOString(),
    ticketSummary: (job.ticketData && job.ticketData.subject) ? job.ticketData.subject : undefined
  };

  ioInstance.to(`mechanic_${attempt.mechanicId.toString()}`).emit('job_alert', payload);
  console.log('Emitted job_alert to mechanic', attempt.mechanicId.toString(), payload);

  // manage timer
  const timerKey = `${jobId}:${attemptIndex}`;
  if (timers.has(timerKey)) {
    clearTimeout(timers.get(timerKey));
    timers.delete(timerKey);
  }

  const timeoutId = setTimeout(async () => {
    try {
      console.log('Attempt timeout fired for', timerKey);
      timers.delete(timerKey);

      // reload job
      const j = await JobAssignment.findById(jobId);
      if (!j) return;
      const a = j.attempts.find(x => x.index === attemptIndex);
      if (!a) return;

      const now2 = new Date();
      if (a.status === 'pending' && a.expiresAt && new Date(a.expiresAt) <= now2) {
        a.status = 'expired';
        a.respondedAt = now2;
        await j.save();

        ioInstance.to(`mechanic_${a.mechanicId.toString()}`).emit('job_alert_expired', { jobId: j._id.toString(), attemptIndex });
        console.log('Marked attempt expired', jobId, attemptIndex);

        const nextIdx = attemptIndex + 1;
        if (nextIdx < j.attempts.length) {
          await startAttempt(jobId, nextIdx);
        } else {
          j.status = 'no_response';
          await j.save();
          console.log('All attempts exhausted for job', jobId, 'marked no_response');
        }
      } else {
        console.log('Attempt already handled or not expired on timeout check', jobId, attemptIndex);
      }
    } catch (err) {
      console.error('Error in attempt timeout handler', err);
    }
  }, SLA_SECONDS * 1000);

  timers.set(timerKey, timeoutId);
}

/**
 * attachTestRoutes(app)
 * Keep a simple emit endpoint for dev testing
 */
export function attachTestRoutes(app) {
  app.post('/api/test/emit', (req, res) => {
    const { mechanicId, event = 'job_alert', payload = {} } = req.body || {};
    if (!mechanicId) return res.status(400).json({ ok: false, message: 'mechanicId required' });
    if (!ioInstance) return res.status(500).json({ ok: false, message: 'socket not initialized' });

    const msg = { ...payload, testAt: new Date().toISOString() };
    console.log(`Emitting ${event} to mechanic_${mechanicId}`, msg);
    ioInstance.to(`mechanic_${mechanicId}`).emit(event, msg);
    return res.json({ ok: true, message: `Emitted ${event}` });
  });
}

/**
 * getIo()
 */
export function getIo() {
  return ioInstance;
}
