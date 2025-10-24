// src/routes/jobs.js
import express from 'express';
import JobAssignment from '../models/JobAssignment.js';
import { startAttempt } from '../services/socketService.js';

const router = express.Router();

/**
 * POST /api/jobs
 * body: { ticketData, issue, eta, sortedMechanicIds: [id1,id2,...] }
 */
router.post('/', async (req, res) => {
  try {
    const { ticketData, issue, eta, sortedMechanicIds } = req.body;
    if (!sortedMechanicIds || !Array.isArray(sortedMechanicIds) || sortedMechanicIds.length === 0) {
      return res.status(400).json({ ok: false, message: 'sortedMechanicIds required' });
    }

    const attempts = sortedMechanicIds.map((mid, idx) => ({
      index: idx,
      mechanicId: mid,
      status: 'waiting'
    }));

    const job = await JobAssignment.create({
      ticketData,
      issue,
      eta,
      attempts
    });

    // start first attempt
    await startAttempt(job._id, 0);

    const fresh = await JobAssignment.findById(job._id);
    return res.status(201).json({ ok: true, job: fresh });
  } catch (err) {
    console.error('POST /api/jobs error', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
});

/**
 * GET /api/jobs/:id - status & audit
 */
router.get('/:id', async (req, res) => {
  try {
    const job = await JobAssignment.findById(req.params.id);
    if (!job) return res.status(404).json({ ok: false, message: 'not found' });
    return res.json({ ok: true, job });
  } catch (err) {
    console.error('GET /api/jobs/:id error', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
});

export default router;
