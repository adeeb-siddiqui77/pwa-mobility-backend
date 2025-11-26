import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  who: { type: String, enum: ['bot','mechanic'], required: true },
  text: String,
  imageUrl: String,
  meta: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const JobChatSessionSchema = new mongoose.Schema({
  ticketId: { type: String, required: true, index: true },
  mechanicId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  flowIndex: { type: Number, default: 0 },
  status: { type: String, enum: ['in_progress','completed','abandoned'], default: 'in_progress' },
  messages: { type: [MessageSchema], default: [] },
  lastUpdatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

JobChatSessionSchema.index({ ticketId: 1, mechanicId: 1 }, { unique: true });

export default mongoose.model('JobChatSession', JobChatSessionSchema);
