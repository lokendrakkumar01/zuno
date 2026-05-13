const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    minlength: 6,
    select: false,
    required() {
      return !this.googleId;
    }
  },
  googleId: { type: String, unique: true, sparse: true },
  authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
  displayName: { type: String, trim: true, maxlength: 50 },
  avatar: { type: String, default: '' },
  cloudinaryAvatarId: { type: String, default: '', select: false },
  bio: { type: String, maxlength: 200, default: '' },
  role: { type: String, enum: ['user', 'creator', 'mentor', 'moderator', 'admin'], default: 'user' },
  trustLevel: { type: Number, min: 0, max: 10, default: 1 },
  isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
  verificationRequest: {
    status: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },
    reason: { type: String, default: '' },
    requestedAt: Date,
    reviewedAt: Date
  },
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  followRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  closeFriends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  interests: [{ type: String, trim: true, maxlength: 40 }],
  preferredContentTypes: [{
    type: String,
    enum: ['photo', 'post', 'short-video', 'long-video', 'live']
  }],
  preferredFeedMode: {
    type: String,
    enum: ['learning', 'calm', 'video', 'reading', 'problem-solving'],
    default: 'learning'
  },
  focusModeEnabled: { type: Boolean, default: false },
  dailyUsageLimit: { type: Number, default: 0 },
  isPrivate: { type: Boolean, default: false },
  profileVisibility: { type: String, enum: ['public', 'community', 'private'], default: 'community' },
  language: { type: String, enum: ['en', 'hi', 'both'], default: 'both' },
  notificationSettings: {
    pushNotifications: { type: Boolean, default: true },
    emailNotifications: { type: Boolean, default: true },
    likesNotifications: { type: Boolean, default: true },
    commentsNotifications: { type: Boolean, default: true },
    followsNotifications: { type: Boolean, default: true },
    mentionsNotifications: { type: Boolean, default: true },
    sharesNotifications: { type: Boolean, default: true }
  },
  stats: {
    contentCount: { type: Number, default: 0 },
    helpfulReceived: { type: Number, default: 0 },
    helpfulGiven: { type: Number, default: 0 }
  },
  profileSong: {
    trackId: String,
    name: String,
    artist: String,
    albumArt: String,
    previewUrl: String
  },
  refreshTokenHash: { type: String, select: false },
  refreshTokenExpiresAt: { type: Date, select: false },
  passwordResetToken: { type: String, select: false },
  passwordResetExpires: { type: Date, select: false },
  isOnline: { type: Boolean, default: false },
  offlineStatus: { type: Date }
}, { timestamps: true });

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ username: 'text', displayName: 'text' });
userSchema.index({ blockedUsers: 1 });
userSchema.index({ isActive: 1, createdAt: -1 });
userSchema.index({ role: 1, createdAt: -1 });
userSchema.index({ 'verificationRequest.status': 1, 'verificationRequest.requestedAt': 1 });

userSchema.pre('save', async function hashPassword(next) {
  try {
    if (!this.isModified('password') || !this.password) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    return next();
  } catch (error) {
    return next(error);
  }
});

userSchema.methods.matchPassword = async function matchPassword(enteredPassword) {
  try {
    return bcrypt.compare(enteredPassword, this.password || '');
  } catch {
    return false;
  }
};

userSchema.methods.getPublicProfile = function getPublicProfile() {
  return {
    id: this._id.toString(),
    username: this.username,
    displayName: this.displayName || this.username,
    avatar: this.avatar,
    bio: this.bio,
    role: this.role,
    trustLevel: this.trustLevel,
    isVerified: this.isVerified,
    verificationRequest: this.verificationRequest
      ? { status: this.verificationRequest.status, requestedAt: this.verificationRequest.requestedAt }
      : null,
    interests: this.interests || [],
    followersCount: this.followers?.length || 0,
    followingCount: this.following?.length || 0,
    profileSong: this.profileSong || null,
    stats: this.stats || {},
    createdAt: this.createdAt
  };
};

userSchema.methods.getAuthProfile = function getAuthProfile() {
  return {
    ...this.getPublicProfile(),
    email: this.email,
    following: this.following || [],
    blockedUsers: this.blockedUsers || [],
    preferredFeedMode: this.preferredFeedMode,
    focusModeEnabled: this.focusModeEnabled,
    dailyUsageLimit: this.dailyUsageLimit,
    language: this.language,
    notificationSettings: this.notificationSettings,
    preferredContentTypes: this.preferredContentTypes,
    isPrivate: this.isPrivate,
    profileVisibility: this.profileVisibility,
    closeFriends: this.closeFriends || [],
    followRequests: this.followRequests || []
  };
};

module.exports = mongoose.model('User', userSchema);
