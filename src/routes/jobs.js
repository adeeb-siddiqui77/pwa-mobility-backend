// src/routes/jobs.js
import express from 'express';
import JobAssignment from '../models/JobAssignment.js';
import { startAttempt } from '../services/socketService.js';
import Ticket from '../models/Ticket.js';

const router = express.Router();

/**
 * POST /api/jobs
 * body: { ticketData, issue, eta, sortedMechanicIds: [id1,id2,...] }
 */
router.post('/', async (req, res) => {
  try {
    const { ticketData, issue, eta, sortedMechanicIds, roomName } = req.body;
    if (!sortedMechanicIds || !Array.isArray(sortedMechanicIds) || sortedMechanicIds.length === 0) {
      return res.status(400).json({ ok: false, message: 'sortedMechanicIds required' });
    }


    console.log("---------Sorted Mechanics IDS ------------" , sortedMechanicIds)

    const attempts = sortedMechanicIds.map((mid, idx) => ({
      index: idx,
      mechanicId: mid,
      status: 'waiting'
    }));

    const job = await JobAssignment.create({
      ticketData,
      issue,
      eta,
      roomName,
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

    const cf = await Ticket.findOne({ zohoTicketId: job?.acceptedTicketId });

    // console.log("Returning Job Status --------------->")
    // console.log("job object" , job)
    // console.log("job status ---->", job?.status)
    // console.log("job acceptedTicketId ---->", job?.acceptedTicketId)
    // console.log("job pitstopDetails ---->", cf?.cf?.cf_pitstop_name)

    return res.json({ ok: true, job: job?.status, acceptedTicketId: job?.acceptedTicketId, eta: job?.eta, pitstopDetails: { name: cf?.cf?.cf_pitstop_name, contact: cf?.cf?.cf_pitstop_contact, location: cf?.cf?.cf_pitstop_location, issue: cf?.cf?.cf_issue } });
  } catch (err) {
    console.error('GET /api/jobs/:id error', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
});


router.get('/findExistingTicket/:vehicleNumber', async (req, res) => {
  try {
    const { vehicleNumber } = req.params;

    console.log("inside this ticket")

    const job = await Ticket.findOne({
      "cf.cf_driver_vehicle_number": vehicleNumber
    });

    if (!job) {
      return res.status(404).json({ ok: false, message: 'No Ticket Found' });
    }

    return res.json({
      ok: true,
      job,
      message: "Existing Ticket Found"
    });

  } catch (err) {
    console.error('GET /findExistingTicket error', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
});


export default router;
