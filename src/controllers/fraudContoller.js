// src/controllers/fraudController.js
import { checkFraudAndProcess } from '../services/fraudService.js';

export async function handleFraudCheck(req, res) {

    console.log("hitting fraud check endpoint")
  try {
    const payload = {
      mechanicId: req.body.mechanicId,
      driverPhone: req.body.driverPhone,
      regNumber: req.body.regNumber,
      billAmount: req.body.billAmount,
      startJobTime: req.body.startJobTime ? new Date(req.body.startJobTime) : undefined,
      endJobTime: req.body.endJobTime ? new Date(req.body.endJobTime) : undefined,
      ticketId: req.body.ticketId,
      metadata: req.body.metadata || {},
      data : req.body.data
    };


    console.log("payload , " , payload)

    const result = await checkFraudAndProcess(payload);
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error('handleFraudCheck error', err);
    return res.status(500).json({ success: false, message: err.message || 'Internal error' });
  }
}
