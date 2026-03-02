const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
      sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
      },
      receiver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
      },
      text: {
            type: String,
            required: [true, 'Message text is required'],
            maxlength: [2000, 'Message cannot exceed 2000 characters'],
            trim: true
      },
      read: {
            type: Boolean,
            default: false
      }
}, { timestamps: true });

// Index for efficient queries
messageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
messageSchema.index({ receiver: 1, read: 1 });

const conversationSchema = new mongoose.Schema({
      participants: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
      }],
      lastMessage: {
            text: { type: String, default: '' },
            sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            createdAt: { type: Date, default: Date.now }
      },
      unreadCount: {
            type: Map,
            of: Number,
            default: {}
      }
}, { timestamps: true });

// Index for efficient participant queries
conversationSchema.index({ participants: 1 });

const Message = mongoose.model('Message', messageSchema);
const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = { Message, Conversation };
