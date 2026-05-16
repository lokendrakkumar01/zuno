const mongoose = require('mongoose');

const scheduledMessageSchema = new mongoose.Schema({
  body: { type: String, required: true, trim: true, maxlength: 2000 },
  scheduledAt: { type: Date, required: true },
  sentAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

const broadcastChannelSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  description: { type: String, trim: true, maxlength: 500, default: '' },
  subscribers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  scheduledMessages: [scheduledMessageSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

broadcastChannelSchema.index({ isActive: 1, updatedAt: -1 });
broadcastChannelSchema.index({ subscribers: 1 });

module.exports = mongoose.model('BroadcastChannel', broadcastChannelSchema);
