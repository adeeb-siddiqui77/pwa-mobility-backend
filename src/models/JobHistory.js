// src/models/JobHistory.js
import mongoose from 'mongoose';

const JobHistorySchema = new mongoose.Schema({
  mechanicId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  driverPhone: { type: String, index: true },
  regNumber: { type: String, index: true },
  billAmount: { type: Number, default: 0 },
  startJobTime: { type: Date },
  endJobTime: { type: Date },
  ticketId: { type: String }, // zoho ticket id / reference
  metadata: { type: mongoose.Schema.Types.Mixed }, // optional extra data
  createdAt: { type: Date, default: Date.now }
});

JobHistorySchema.index({ mechanicId: 1, driverPhone: 1, createdAt: 1 });
JobHistorySchema.index({ mechanicId: 1, regNumber: 1, createdAt: 1 });

export default mongoose.model('JobHistory', JobHistorySchema);
