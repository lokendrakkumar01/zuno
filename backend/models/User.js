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
  isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  interests: [{ type: String, trim: true, maxlength: 40 }],
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
    isVerified: this.isVerified,
    interests: this.interests || [],
    followersCount: this.followers?.length || 0,
    followingCount: this.following?.length || 0,
    profileSong: this.profileSong || null,
    createdAt: this.createdAt
  };
};

userSchema.methods.getAuthProfile = function getAuthProfile() {
  return {
    ...this.getPublicProfile(),
    email: this.email,
    following: this.following || [],
    blockedUsers: this.blockedUsers || []
  };
};

module.exports = mongoose.model('User', userSchema);
