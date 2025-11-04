// src/models/JobAssignment.js
import mongoose from 'mongoose';
const { Schema } = mongoose;

const AttemptSchema = new Schema({
  index: { type: Number, required: true },
  mechanicId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['waiting', 'pending', 'accepted', 'rejected', 'expired'], default: 'waiting' },
  startedAt: Date,
  expiresAt: Date,
  respondedAt: Date,
  response: { type: String, enum: ['accept', 'reject', null], default: null },
  waMessageId: { type: String, default: null },
  waStatus: { type: String, enum: ['sent', 'failed', 'unknown', null], default: null },
  waTextMessageId: { type: String, default: null },
  waPollMessageId : { type: String, default: null },
  waMessageId: { type: String, default: null }, // keep for backward compat
  waStatus: { type: String, default: null }



}, { _id: false });

const JobAssignmentSchema = new Schema({
  ticketData: { type: Schema.Types.Mixed },
  issue: String,
  eta: String,
  attempts: [AttemptSchema],
  currentAttemptIndex: { type: Number, default: 0 },
  status: { type: String, enum: ['open', 'accepted', 'no_response', 'failed'], default: 'open' },
  acceptedTicketId: String,
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.JobAssignment || mongoose.model('JobAssignment', JobAssignmentSchema);
