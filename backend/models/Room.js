const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  name: { type: String, trim: true, maxlength: 80 },
  type: { type: String, enum: ['direct', 'group', 'stream'], default: 'direct' },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' }
}, { timestamps: true });

roomSchema.index({ participants: 1, updatedAt: -1 });

module.exports = mongoose.model('Room', roomSchema);
