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
            required: false // Optional for group messages
      },
      conversationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Conversation',
            required: false // Optional for legacy DM messages
      },
      text: {
            type: String,
            maxlength: [2000, 'Message cannot exceed 2000 characters'],
            trim: true,
            default: ''
      },
      media: {
            url: { type: String, default: '' },
            type: { type: String, enum: ['image', 'video', ''], default: '' }
      },
      replyTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Message',
            default: null
      },
      reactions: [{
            emoji: String,
            user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
      }],
      read: {
            type: Boolean,
            default: false
      },
      edited: {
            type: Boolean,
            default: false
      },
      deletedForEveryone: {
            type: Boolean,
            default: false
      },
      deletedBy: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
      }]
}, { timestamps: true });

// Index for efficient queries
messageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
messageSchema.index({ receiver: 1, sender: 1, createdAt: -1 }); // Added for $or query performance
messageSchema.index({ receiver: 1, read: 1 });
messageSchema.index({ createdAt: -1 });

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
      },
      isGroup: { type: Boolean, default: false },
      isChannel: { type: Boolean, default: false },
      groupName: { type: String, trim: true },
      groupDescription: { type: String, trim: true },
      groupAvatar: { type: String, default: '' },
      groupAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Index for efficient participant and sorting queries
conversationSchema.index({ participants: 1, updatedAt: -1 });

const Message = mongoose.model('Message', messageSchema);
const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = { Message, Conversation };
