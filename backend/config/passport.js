const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

const makeUsername = (profile) => {
  const emailName = profile.emails?.[0]?.value?.split('@')[0] || 'zuno_user';
  return `${emailName.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20)}_${profile.id.slice(-6)}`.toLowerCase();
};

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CALLBACK_URL) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
  }, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails?.[0]?.value?.toLowerCase();
    if (!email) return done(new Error('Google account does not expose an email address'));

    let user = await User.findOne({ $or: [{ googleId: profile.id }, { email }] }).select('+refreshTokenHash');
    if (user) {
      if (!user.googleId) user.googleId = profile.id;
      user.displayName = user.displayName || profile.displayName;
      user.avatar = user.avatar || profile.photos?.[0]?.value || '';
      await user.save();
      return done(null, user);
    }

    user = await User.create({
      googleId: profile.id,
      email,
      username: makeUsername(profile),
      displayName: profile.displayName || email.split('@')[0],
      avatar: profile.photos?.[0]?.value || '',
      isVerified: true,
      authProvider: 'google'
    });

    return done(null, user);
  } catch (error) {
    return done(error);
  }
  }));
}

module.exports = passport;
