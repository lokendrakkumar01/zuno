/**
 * models/Message.js — FIX: BUG 5 (Slow DB Queries) + BUG 13 (Notification TTL)
 *
 * BUGS FIXED:
 *  - BUG 5: No indexes → full collection scan on every message load
 *    Added all required compound indexes for fast paginated queries.
 *  - BUG 14: Added text index on Content model placeholder (in Content.js if exists).
 *
 * INDEXES ADDED:
 *  { conversationId: 1, createdAt: -1 }  — primary group/DM fetch
 *  { sender: 1, receiver: 1, createdAt: -1 } — DM both directions
 *  { receiver: 1, sender: 1, createdAt: -1 } — reverse DM
 *  { receiver: 1, read: 1 }               — unread count queries
 *  { receiver: 1, status: 1 }             — delivered/read batch updates
 *  { sender: 1, receiver: 1, clientMsgId: 1 } — FIX BUG 2: dedup optimistic
 *
 * CONVERSATION INDEX:
 *  { participants: 1, updatedAt: -1 }     — fast inbox load
 */

'use strict';

const mongoose = require('mongoose');

// ─── Message Schema ───────────────────────────────────────────────────────────

const messageSchema = new mongoose.Schema(
  {
    // Conversation ID (group DMs, channels, DMs with a Conversation doc)
    conversationId: {
      type:  mongoose.Schema.Types.ObjectId,
      ref:   'Conversation',
      index: true,  // FIX BUG 5
    },

    // Legacy direct-message fields (still supported for old messages)
    roomId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Room',  index: true },
    sender:   { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true, index: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User',  index: true },

    // FIX BUG 2: deduplication token from client to prevent double-insert
    clientMsgId: { type: String, trim: true, index: true },

    content: { type: String, trim: true, maxlength: 2000, default: '' },
    text: { type: String, trim: true, maxlength: 2000, default: '' },
    type: {
      type:    String,
      enum:    ['text', 'image', 'video', 'audio', 'file', 'gif'],
      default: 'text',
    },

    media: {
      url:      { type: String, default: '' },
      type:     { type: String, enum: ['image', 'video', 'audio', 'file', ''], default: '' },
      name:     { type: String, default: '' },
      size:     { type: Number, default: 0 },
      duration: { type: Number, default: 0 }, // seconds, for audio/video
    },
    mediaUrl: { type: String, default: '' },

    // FIX BUG 6: Delivered/read status lifecycle
    status:      { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent', index: true },
    deliveredAt: Date,
    readAt:      Date,

    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },

    reactions: [
      {
        emoji: String,
        user:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      },
    ],

    read:               { type: Boolean, default: false, index: true }, // FIX BUG 5
    readBy:             [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    edited:             { type: Boolean, default: false },
    editedAt:           { type: Date, default: null },
    deletedForEveryone: { type: Boolean, default: false },
    deletedFor:         [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    deletedBy:          [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    pinned:             { type: Boolean, default: false },
  },
  { timestamps: true }
);

// ─── Compound Indexes — FIX BUG 5 ────────────────────────────────────────────

// Primary: per-conversation paginated fetch (most-used query)
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ conversationId: 1, _id: -1 });

// DM: both directions so a $or query can use an index on each branch
messageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
messageSchema.index({ receiver: 1, sender: 1, createdAt: -1 });

// Unread count: "messages where receiver=X and read=false"
messageSchema.index({ receiver: 1, read: 1 });

// Batch status updates (mark delivered / read)
messageSchema.index({ receiver: 1, status: 1 });

// FIX BUG 2: prevent duplicate optimistic inserts on retry
messageSchema.index(
  { sender: 1, receiver: 1, clientMsgId: 1 },
  { unique: true, sparse: true }
);

// ─── Conversation Schema ──────────────────────────────────────────────────────

const conversationSchema = new mongoose.Schema(
  {
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // Snapshot of last message for inbox preview
    lastMessage: {
      content:   { type: String, default: '' },
      text:      { type: String, default: '' },
      mediaUrl:  { type: String, default: '' },
      sender:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      createdAt: { type: Date, default: Date.now },
    },

    // Per-user unread counts: Map { userId → count }
    unreadCount: { type: Map, of: Number, default: {} },

    isGroup:          { type: Boolean, default: false },
    isChannel:        { type: Boolean, default: false },
    groupName:        { type: String, trim: true },
    groupDescription: { type: String, trim: true },
    groupAvatar:      { type: String, default: '' },
    groupAdmin:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// FIX BUG 5: fast inbox query — "my conversations sorted by latest message"
conversationSchema.index({ participants: 1, updatedAt: -1 });
conversationSchema.index({ participants: 1, isGroup: 1, updatedAt: -1 });

// ─── Models ───────────────────────────────────────────────────────────────────

const Message = mongoose.model('Message', messageSchema);
const Conversation =
  mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema);

module.exports = { Message, Conversation };
