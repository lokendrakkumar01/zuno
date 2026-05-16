/**
 * Message.js — FIX: PROBLEM 4 (DB SLOW)
 *
 * Changes:
 *  - Added compound indexes on (sender, receiver, createdAt) and (conversationId, createdAt)
 *    so getMessages queries use an index scan instead of a full collection scan.
 *  - Added status/read indexes to speed up unread-count queries.
 *  - Conversation model: added index on (participants, updatedAt) for fast inbox loading.
 *  - Kept sparse unique index on clientMsgId to prevent duplicate optimistic inserts.
 */

const mongoose = require('mongoose');

// ─── Message Schema ──────────────────────────────────────────────────────────

const messageSchema = new mongoose.Schema(
  {
    // Which conversation this message belongs to (group or DM)
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      index: true,           // FIX: index for fast per-conversation fetches
    },

    // Legacy DM: still support direct sender/receiver without a Conversation doc
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', index: true },
    sender:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },

    // Dedup token sent from client so optimistic retries don't create duplicates
    clientMsgId: { type: String, trim: true, index: true },

    text:  { type: String, trim: true, maxlength: 2000, default: '' },
    type:  { type: String, enum: ['text', 'image', 'video', 'audio', 'file', 'gif'], default: 'text' },

    media: {
      url:      { type: String, default: '' },
      type:     { type: String, enum: ['image', 'video', 'audio', 'file', ''], default: '' },
      name:     { type: String, default: '' },
      size:     { type: Number, default: 0 },
      duration: { type: Number, default: 0 },
    },

    // FIX: status tracks sent → delivered → read lifecycle
    status:      { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent', index: true },
    deliveredAt: Date,
    readAt:      Date,

    // Thread reply
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },

    reactions: [
      {
        emoji: String,
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      },
    ],

    read:             { type: Boolean, default: false, index: true },  // FIX: indexed for unread queries
    edited:           { type: Boolean, default: false },
    editedAt:         { type: Date, default: null },
    deletedForEveryone: { type: Boolean, default: false },
    deletedBy:        [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    pinned:           { type: Boolean, default: false },
  },
  { timestamps: true }
);

// ─── Indexes — FIX: PROBLEM 4 ────────────────────────────────────────────────

// Primary index: fetch messages in a conversation ordered by time (most-used query)
messageSchema.index({ conversationId: 1, createdAt: -1 });

// DM fallback: both directions so a single $or query benefits from indexes
messageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
messageSchema.index({ receiver: 1, sender: 1, createdAt: -1 });

// Unread count queries: "receiver=X, read=false"
messageSchema.index({ receiver: 1, read: 1, createdAt: -1 });

// Status tracking (delivered/read bulk updates)
messageSchema.index({ receiver: 1, status: 1 });

// Prevent duplicate optimistic-insert from frontend
messageSchema.index({ sender: 1, receiver: 1, clientMsgId: 1 }, { unique: true, sparse: true });

// ─── Conversation Schema ─────────────────────────────────────────────────────

const conversationSchema = new mongoose.Schema(
  {
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // Snapshot of last message for inbox preview (updated in background — FIX: PROBLEM 6)
    lastMessage: {
      text:      { type: String, default: '' },
      sender:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      createdAt: { type: Date, default: Date.now },
    },

    // Per-user unread counts stored as a Map keyed by userId string
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

// FIX: PROBLEM 4 — fast inbox: "conversations where I am a participant, newest first"
conversationSchema.index({ participants: 1, updatedAt: -1 });
conversationSchema.index({ participants: 1, isGroup: 1, updatedAt: -1 });

// ─── Models ─────────────────────────────────────────────────────────────────

const Message = mongoose.model('Message', messageSchema);
const Conversation =
  mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema);

module.exports = { Message, Conversation };
