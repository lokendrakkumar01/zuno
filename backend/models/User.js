const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
      // Basic Info
      username: {
            type: String,
            required: [true, 'Username is required'],
            unique: true,
            trim: true,
            minlength: [3, 'Username must be at least 3 characters'],
            maxlength: [30, 'Username cannot exceed 30 characters']
      },
      email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide valid email']
      },
      password: {
            type: String,
            required: [true, 'Password is required'],
            minlength: [6, 'Password must be at least 6 characters'],
            select: false
      },
      displayName: {
            type: String,
            trim: true,
            maxlength: [50, 'Display name cannot exceed 50 characters']
      },
      avatar: {
            type: String,
            default: ''
      },
      bio: {
            type: String,
            maxlength: [200, 'Bio cannot exceed 200 characters'],
            default: ''
      },

      // ZUNO Specific - Role & Trust
      role: {
            type: String,
            enum: ['user', 'creator', 'mentor', 'moderator', 'admin'],
            default: 'user'
      },
      trustLevel: {
            type: Number,
            min: 0,
            max: 10,
            default: 1
      },

      // Interest-based subscriptions (not follower-based)
      interests: [{
            type: String,
            enum: ['learning', 'technology', 'creativity', 'health', 'business', 'science', 'arts', 'lifestyle', 'problem-solving', 'mentoring']
      }],

      // Social Graph
      followers: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
      }],
      following: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
      }],
      followRequests: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
      }],
      isPrivate: {
            type: Boolean,
            default: false
      },

      // Preferred content types
      preferredContentTypes: [{
            type: String,
            enum: ['photo', 'post', 'short-video', 'long-video', 'live']
      }],

      // Feed preferences
      preferredFeedMode: {
            type: String,
            enum: ['learning', 'calm', 'video', 'reading', 'problem-solving'],
            default: 'learning'
      },

      // Anti-addiction settings
      focusModeEnabled: {
            type: Boolean,
            default: false
      },
      dailyUsageLimit: {
            type: Number, // in minutes, 0 = unlimited
            default: 0
      },

      // Privacy
      profileVisibility: {
            type: String,
            enum: ['public', 'community', 'private'],
            default: 'community'
      },

      // Stats (private - not shown publicly)
      stats: {
            contentCount: { type: Number, default: 0 },
            helpfulReceived: { type: Number, default: 0 },
            helpfulGiven: { type: Number, default: 0 }
      },

      // Account status
      isActive: {
            type: Boolean,
            default: true
      },
      isVerified: {
            type: Boolean,
            default: false
      },

      // Language preference
      language: {
            type: String,
            enum: ['en', 'hi', 'both'],
            default: 'both'
      }

}, { timestamps: true });

// Pre-save middleware to hash password
userSchema.pre('save', async function (next) {
      if (!this.isModified('password')) {
            return next();
      }
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
      next();
});

// Method to compare password
userSchema.methods.matchPassword = async function (enteredPassword) {
      return await bcrypt.compare(enteredPassword, this.password);
};

// Method to get public profile (hides sensitive data)
userSchema.methods.getPublicProfile = function () {
      return {
            _id: this._id,
            id: this._id,
            username: this.username,
            displayName: this.displayName || this.username,
            avatar: this.avatar,
            bio: this.bio,
            role: this.role,
            interests: this.interests,
            isVerified: this.isVerified,
            followersCount: this.followers ? this.followers.length : 0,
            followingCount: this.following ? this.following.length : 0,
            stats: this.stats,
            createdAt: this.createdAt
      };
};

module.exports = mongoose.model('User', userSchema);
