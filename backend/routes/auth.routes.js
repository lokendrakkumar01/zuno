const express = require('express');
const bcrypt = require('bcryptjs');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const { protect, signAccessToken, signRefreshToken } = require('../middlewares/auth.middleware');

const router = express.Router();

const sanitizeString = (value, max = 2000) => String(value || '').trim().slice(0, max);
const googleOAuthClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const publicUser = (user) => user.getAuthProfile ? user.getAuthProfile() : {
  id: user._id.toString(),
  username: user.username,
  email: user.email,
  displayName: user.displayName,
  avatar: user.avatar
};

const compatUser = (user) => {
  const profile = publicUser(user);
  return {
    ...profile,
    _id: profile.id,
    id: profile.id
  };
};

const setRefreshToken = async (user) => {
  const refreshToken = signRefreshToken(user._id);
  user.refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  user.refreshTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await user.save();
  return refreshToken;
};

const makeGoogleUsername = (email, googleId) => {
  const base = email.split('@')[0].replace(/[^a-zA-Z0-9_.]/g, '').slice(0, 20) || 'zuno_user';
  return `${base}_${String(googleId).slice(-6)}`.toLowerCase();
};

const sendSession = async (res, user) => {
  try {
    const [accessToken, refreshToken] = await Promise.all([
      Promise.resolve(signAccessToken(user._id)),
      setRefreshToken(user)
    ]);
    const userPayload = compatUser(user);
    return res.json({
      success: true,
      user: userPayload,
      accessToken,
      refreshToken,
      data: {
        user: userPayload,
        token: accessToken,
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Could not create session' });
  }
};

router.post('/register', async (req, res) => {
  try {
    const username = sanitizeString(req.body.username, 30);
    const email = sanitizeString(req.body.email, 120).toLowerCase();
    const password = String(req.body.password || '');
    const displayName = sanitizeString(req.body.displayName || username, 50);

    if (!username || !email || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Username, valid email, and 6+ character password are required' });
    }

    const exists = await User.findOne({ $or: [{ email }, { username }] }).lean();
    if (exists) return res.status(409).json({ success: false, message: 'User already exists' });

    const user = await User.create({ username, email, password, displayName });
    return sendSession(res, user);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const email = sanitizeString(req.body.email, 120).toLowerCase();
    const password = String(req.body.password || '');
    const user = await User.findOne({ email }).select('+password +refreshTokenHash');

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    return sendSession(res, user);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_CALLBACK_URL) {
    return res.redirect(`${process.env.CLIENT_URL}/login?error=google_oauth_not_configured`);
  }
  return passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false
  })(req, res, next);
});

router.get('/google/callback', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_CALLBACK_URL) {
    return res.redirect(`${process.env.CLIENT_URL}/login?error=google_oauth_not_configured`);
  }
  passport.authenticate('google', { session: false }, async (error, user) => {
    try {
      if (error || !user) {
        const url = `${process.env.CLIENT_URL}/login?error=google_oauth_failed`;
        return res.redirect(url);
      }
      const accessToken = signAccessToken(user._id);
      const refreshToken = await setRefreshToken(user);
      const params = new URLSearchParams({ accessToken, refreshToken });
      return res.redirect(`${process.env.CLIENT_URL}/auth/callback?${params.toString()}`);
    } catch (callbackError) {
      return next(callbackError);
    }
  })(req, res, next);
});

router.post('/google', async (req, res) => {
  try {
    const credential = String(req.body.credential || '');
    if (!credential) {
      return res.status(400).json({ success: false, message: 'Google credential is required' });
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({ success: false, message: 'Google login is not configured on the server' });
    }

    const ticket = await googleOAuthClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    const email = payload?.email?.toLowerCase();
    const googleId = payload?.sub;

    if (!email || !googleId) {
      return res.status(400).json({ success: false, message: 'Google account did not return a verified email' });
    }

    let user = await User.findOne({ $or: [{ googleId }, { email }] }).select('+refreshTokenHash');
    if (user) {
      user.googleId = user.googleId || googleId;
      user.authProvider = user.authProvider || 'google';
      user.displayName = user.displayName || payload.name || email.split('@')[0];
      user.avatar = user.avatar || payload.picture || '';
      user.isVerified = true;
      await user.save();
      return sendSession(res, user);
    }

    user = await User.create({
      googleId,
      authProvider: 'google',
      username: makeGoogleUsername(email, googleId),
      email,
      displayName: payload.name || email.split('@')[0],
      avatar: payload.picture || '',
      isVerified: true
    });

    return sendSession(res, user);
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Google login failed. Please try again.' });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = String(req.body.refreshToken || '');
    if (!refreshToken) return res.status(401).json({ success: false, message: 'Refresh token required' });

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id).select('+refreshTokenHash +refreshTokenExpiresAt');
    if (!user || !user.refreshTokenHash || user.refreshTokenExpiresAt < new Date()) {
      return res.status(401).json({ success: false, message: 'Refresh token expired' });
    }

    const matches = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!matches) return res.status(401).json({ success: false, message: 'Invalid refresh token' });

    return sendSession(res, user);
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid refresh token' });
  }
});

router.get('/me', protect, async (req, res) => {
  try {
    const userPayload = compatUser(req.user);
    return res.json({ success: true, user: userPayload, data: { user: userPayload } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/logout', protect, async (req, res) => {
  try {
    req.user.refreshTokenHash = undefined;
    req.user.refreshTokenExpiresAt = undefined;
    await req.user.save();
    return res.json({ success: true, message: 'Logged out' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
