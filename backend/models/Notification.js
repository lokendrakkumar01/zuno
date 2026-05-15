const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  actor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  type: {
    type: String,
    enum: [
      'follow',
      'follow_request',
      'follow_request_accepted',
      'follow_request_rejected',
      'unfollow',
      'like',
      'comment',
      'helpful',
      'message',
      'call_incoming',
      'stream_live',
      'mention',
      'system',
      'admin_broadcast'
    ],
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 140
  },
  body: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  entityType: {
    type: String,
    enum: ['user', 'content', 'comment', 'request', 'message', 'stream', 'system'],
    default: 'user'
  },
  entityId: {
    type: String,
    default: ''
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: {
    type: Date,
    default: null
  },
  expiresAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, partialFilterExpression: { expiresAt: { $type: 'date' } } });

module.exports = mongoose.model('Notification', notificationSchema);
