const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation' },
  clientMsgId: { type: String, trim: true, index: true },
  text: { type: String, trim: true, maxlength: 2000, default: '' },
  media: {
    url: { type: String, default: '' },
    type: { type: String, enum: ['image', 'video', ''], default: '' }
  },
  status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
  deliveredAt: Date,
  readAt: Date,
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
  reactions: [{
    emoji: String,
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],
  read: { type: Boolean, default: false },
  edited: { type: Boolean, default: false },
  deletedForEveryone: { type: Boolean, default: false },
  deletedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

messageSchema.index({ roomId: 1, createdAt: -1 });
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
messageSchema.index({ receiver: 1, sender: 1, createdAt: -1 });
messageSchema.index({ receiver: 1, read: 1, createdAt: -1 });
messageSchema.index({ sender: 1, receiver: 1, clientMsgId: 1 }, { unique: true, sparse: true });

const conversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  lastMessage: {
    text: { type: String, default: '' },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
  },
  unreadCount: { type: Map, of: Number, default: {} },
  isGroup: { type: Boolean, default: false },
  groupName: { type: String, trim: true },
  groupDescription: { type: String, trim: true },
  groupAvatar: { type: String, default: '' },
  groupAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

conversationSchema.index({ participants: 1, updatedAt: -1 });
conversationSchema.index({ participants: 1, isGroup: 1, updatedAt: -1 });

const Message = mongoose.model('Message', messageSchema);
const Conversation = mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema);

module.exports = { Message, Conversation };
