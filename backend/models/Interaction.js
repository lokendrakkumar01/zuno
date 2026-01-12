const mongoose = require('mongoose');

// Private interaction - "Helpful" or "Not Useful" (never public)
const interactionSchema = new mongoose.Schema({
      user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
      },
      content: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Content',
            required: true
      },

      // Type of interaction
      type: {
            type: String,
            enum: ['helpful', 'not-useful', 'save', 'report'],
            required: true
      },

      // For reports
      reportReason: {
            type: String,
            enum: ['spam', 'inappropriate', 'misleading', 'harmful', 'other']
      },
      reportNote: String

}, { timestamps: true });

// Ensure one interaction type per user per content
interactionSchema.index({ user: 1, content: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('Interaction', interactionSchema);
