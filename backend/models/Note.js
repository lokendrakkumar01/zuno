const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
      user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
      },
      text: {
            type: String,
            required: true,
            maxLength: 60,
            trim: true
      },
      expiresAt: {
            type: Date,
            required: true,
            default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
      }
}, { timestamps: true });

// TTL Index to automatically delete expired notes
noteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Note = mongoose.model('Note', noteSchema);
module.exports = Note;
