const mongoose = require('mongoose');

const contentSchema = new mongoose.Schema({
      // Creator reference
      creator: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
      },

      // Content type - unified for all uploads
      contentType: {
            type: String,
            enum: ['photo', 'post', 'short-video', 'long-video', 'live', 'story'],
            required: true
      },
      expiresAt: {
            type: Date
      },

      // Title (optional for photos, required for videos)
      title: {
            type: String,
            trim: true,
            maxlength: [150, 'Title cannot exceed 150 characters']
      },

      // Main content
      body: {
            type: String, // Text for posts, description for media
            maxlength: [5000, 'Content body cannot exceed 5000 characters']
      },

      // Media files
      media: [{
            url: String,
            type: { type: String, enum: ['image', 'video', 'audio'] },
            duration: Number, // for videos in seconds
            thumbnail: String,
            status: {
                  type: String,
                  enum: ['uploading', 'ready', 'failed'],
                  default: 'ready'
            }
      }],

      // Purpose-based category (ZUNO unique)
      purpose: {
            type: String,
            enum: ['idea', 'skill', 'explain', 'story', 'question', 'discussion', 'learning', 'inspiration', 'solution'],
            required: true
      },

      // Topics/tags for interest-based discovery
      topics: [{
            type: String,
            enum: ['learning', 'technology', 'creativity', 'health', 'business', 'science', 'arts', 'lifestyle', 'problem-solving', 'mentoring']
      }],

      // Custom tags (user-defined)
      tags: [{
            type: String,
            trim: true,
            lowercase: true
      }],

      // Video-specific: chapters for long videos
      chapters: [{
            title: String,
            startTime: Number, // in seconds
            endTime: Number
      }],

      // Downloadable notes (for learning content)
      notes: {
            type: String,
            maxlength: [10000, 'Notes cannot exceed 10000 characters']
      },

      // Privacy control
      visibility: {
            type: String,
            enum: ['public', 'community', 'private'],
            default: 'public'
      },

      // Status
      status: {
            type: String,
            enum: ['draft', 'published', 'archived', 'removed'],
            default: 'published'
      },

      // ZUNO-specific: Quality metrics (not public counts)
      metrics: {
            helpfulCount: { type: Number, default: 0 },
            notUsefulCount: { type: Number, default: 0 },
            viewCount: { type: Number, default: 0 },
            saveCount: { type: Number, default: 0 },
            shareCount: { type: Number, default: 0 }
      },

      // Calculated quality score (for feed ranking)
      qualityScore: {
            type: Number,
            default: 0
      },

      // Language
      language: {
            type: String,
            enum: ['en', 'hi', 'other'],
            default: 'en'
      },

      // Live stream specific
      liveData: {
            isLive: { type: Boolean, default: false },
            scheduledAt: Date,
            endedAt: Date,
            chatEnabled: { type: Boolean, default: true },
            slowModeSeconds: { type: Number, default: 0 }
      },

      // Silent mode - hide all counts from viewers
      silentMode: {
            type: Boolean,
            default: false
      },

      // Moderation
      isApproved: {
            type: Boolean,
            default: true
      },
      moderationNote: String

}, { timestamps: true });

// Index for efficient feed queries
contentSchema.index({ creator: 1, createdAt: -1 });
contentSchema.index({ contentType: 1, status: 1, createdAt: -1 });
contentSchema.index({ topics: 1, status: 1, qualityScore: -1 });
contentSchema.index({ purpose: 1, status: 1 });

// Calculate quality score before save
contentSchema.pre('save', function (next) {
      // Quality = helpfulness ratio + engagement quality (not raw counts)
      const helpful = this.metrics.helpfulCount || 0;
      const notUseful = this.metrics.notUsefulCount || 0;
      const total = helpful + notUseful;

      if (total > 0) {
            const helpfulnessRatio = helpful / total;
            this.qualityScore = helpfulnessRatio * 100;
      }
      next();
});

module.exports = mongoose.model('Content', contentSchema);
