const mongoose = require('mongoose');

// Admin configuration - feature flags, app settings
const adminConfigSchema = new mongoose.Schema({
      key: {
            type: String,
            required: true,
            unique: true
      },
      value: {
            type: mongoose.Schema.Types.Mixed,
            required: true
      },
      description: String,
      category: {
            type: String,
            enum: ['feature', 'upload', 'moderation', 'feed', 'system', 'emergency'],
            default: 'feature'
      },
      isActive: {
            type: Boolean,
            default: true
      },
      updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
      }
}, { timestamps: true });

module.exports = mongoose.model('AdminConfig', adminConfigSchema);
