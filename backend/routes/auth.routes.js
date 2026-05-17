const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const { sendOtpEmail } = require('../config/resendService');
const { protect, signAccessToken, signRefreshToken } = require('../middlewares/auth.middleware');

const router = express.Router();

const OTP_EXPIRES_MINUTES = Number(process.env.OTP_EXPIRES_MINUTES || 10);
const OTP_RESEND_COOLDOWN_SECONDS = Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || 60);
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5);

const sanitizeString = (value, max = 2000) => String(value || '').trim().slice(0, max);
const normalizeEmail = (value) => sanitizeString(value, 120).toLowerCase();
const googleOAuthClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const getGoogleAudiences = () => [
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_WEB_CLIENT_ID,
  process.env.GOOGLE_ANDROID_CLIENT_ID,
  process.env.GOOGLE_IOS_CLIENT_ID,
  ...String(process.env.GOOGLE_CLIENT_IDS || '').split(',')
].map((value) => String(value || '').trim()).filter(Boolean);

const publicUser = (user) => user.getAuthProfile ? user.getAuthProfile() : {
  id: user._id.toString(),
  username: user.username,
  email: user.email,
  displayName: user.displayName,
  avatar: user.avatar,
  isEmailVerified: Boolean(user.isEmailVerified)
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
  } catch {
    return res.status(500).json({ success: false, message: 'Could not create session' });
  }
};

const generateOtp = () => crypto.randomInt(100000, 1000000).toString();

const hashOtp = (email, otp) => crypto
  .createHash('sha256')
  .update(`${normalizeEmail(email)}:${otp}:${process.env.OTP_SECRET || process.env.JWT_SECRET}`)
  .digest('hex');

const canSendOtp = (user) => {
  if (!user.emailVerificationOtpLastSentAt) return true;
  const elapsedMs = Date.now() - new Date(user.emailVerificationOtpLastSentAt).getTime();
  return elapsedMs >= OTP_RESEND_COOLDOWN_SECONDS * 1000;
};

const secondsUntilResend = (user) => {
  if (!user.emailVerificationOtpLastSentAt) return 0;
  const elapsed = Math.floor((Date.now() - new Date(user.emailVerificationOtpLastSentAt).getTime()) / 1000);
  return Math.max(0, OTP_RESEND_COOLDOWN_SECONDS - elapsed);
};

const createAndSendOtp = async (user, { enforceCooldown = true } = {}) => {
  if (enforceCooldown && !canSendOtp(user)) {
    const waitSeconds = secondsUntilResend(user);
    const error = new Error(`Please wait ${waitSeconds}s before requesting another code.`);
    error.status = 429;
    error.waitSeconds = waitSeconds;
    throw error;
  }

  const otp = generateOtp();
  user.emailVerificationOtpHash = hashOtp(user.email, otp);
  user.emailVerificationOtpExpiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000);
  user.emailVerificationOtpLastSentAt = new Date();
  user.emailVerificationOtpAttempts = 0;
  await user.save();

  await sendOtpEmail({
    to: user.email,
    name: user.displayName || user.username,
    otp,
    expiresInMinutes: OTP_EXPIRES_MINUTES
  });
};

const verificationResponse = (user, message = 'Verification code sent to your email.') => ({
  success: true,
  message,
  requiresVerification: true,
  email: user.email,
  data: {
    requiresVerification: true,
    email: user.email,
    resendAfterSeconds: secondsUntilResend(user),
    expiresInMinutes: OTP_EXPIRES_MINUTES
  }
});

router.post('/register', async (req, res) => {
  try {
    const username = sanitizeString(req.body.username, 30);
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');
    const displayName = sanitizeString(req.body.displayName || username, 50);
    const language = ['en', 'hi', 'both'].includes(req.body.language) ? req.body.language : 'both';

    const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(password);
    if (!/^[a-zA-Z0-9_.]{3,30}$/.test(username) || !/^\S+@\S+\.\S+$/.test(email) || !strongPassword) {
      return res.status(400).json({
        success: false,
        message: 'Username, valid email, and a strong 8+ character password are required'
      });
    }

    const exists = await User.findOne({ $or: [{ email }, { username }] })
      .select('+emailVerificationOtpLastSentAt')
      .lean();
    if (exists) return res.status(409).json({ success: false, message: 'User already exists' });

    const user = await User.create({
      username,
      email,
      password,
      displayName,
      language,
      authProvider: 'local',
      isEmailVerified: false
    });

    try {
      await createAndSendOtp(user, { enforceCooldown: false });
    } catch (emailError) {
      console.error('[Auth] OTP email failed:', emailError.message);
      return res.status(502).json({
        success: false,
        message: 'Account created, but verification email could not be sent. Please use resend OTP.',
        requiresVerification: true,
        email,
        data: { requiresVerification: true, email }
      });
    }

    return res.status(201).json(verificationResponse(user, 'Account created. Please verify your email to continue.'));
  } catch (error) {
    const status = error?.code === 11000 ? 409 : 500;
    return res.status(status).json({ success: false, message: status === 409 ? 'User already exists' : error.message });
  }
});

router.post('/verify-email', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || '').replace(/\D/g, '').slice(0, 6);

    if (!email || otp.length !== 6) {
      return res.status(400).json({ success: false, message: 'Valid email and 6-digit OTP are required' });
    }

    const user = await User.findOne({ email })
      .select('+emailVerificationOtpHash +emailVerificationOtpExpiresAt +emailVerificationOtpAttempts +emailVerificationOtpLastSentAt +refreshTokenHash');

    if (!user) return res.status(404).json({ success: false, message: 'Account not found' });
    if (user.isEmailVerified) return sendSession(res, user);

    if (!user.emailVerificationOtpHash || !user.emailVerificationOtpExpiresAt) {
      return res.status(400).json({ success: false, message: 'No active verification code. Please resend OTP.' });
    }

    if (new Date(user.emailVerificationOtpExpiresAt).getTime() < Date.now()) {
      return res.status(400).json({ success: false, message: 'OTP expired. Please request a new code.' });
    }

    if (Number(user.emailVerificationOtpAttempts || 0) >= OTP_MAX_ATTEMPTS) {
      return res.status(429).json({ success: false, message: 'Too many incorrect attempts. Please resend OTP.' });
    }

    if (user.emailVerificationOtpHash !== hashOtp(email, otp)) {
      user.emailVerificationOtpAttempts = Number(user.emailVerificationOtpAttempts || 0) + 1;
      await user.save();
      return res.status(400).json({
        success: false,
        message: `Invalid OTP. ${Math.max(0, OTP_MAX_ATTEMPTS - user.emailVerificationOtpAttempts)} attempts left.`
      });
    }

    user.isEmailVerified = true;
    user.emailVerifiedAt = new Date();
    user.emailVerificationOtpHash = undefined;
    user.emailVerificationOtpExpiresAt = undefined;
    user.emailVerificationOtpLastSentAt = undefined;
    user.emailVerificationOtpAttempts = 0;
    await user.save();

    return sendSession(res, user);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Email verification failed' });
  }
});

router.post('/resend-otp', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const user = await User.findOne({ email })
      .select('+emailVerificationOtpHash +emailVerificationOtpExpiresAt +emailVerificationOtpAttempts +emailVerificationOtpLastSentAt');

    if (!user) return res.status(404).json({ success: false, message: 'Account not found' });
    if (user.isEmailVerified) {
      return res.json({ success: true, message: 'Email is already verified.', data: { alreadyVerified: true } });
    }

    await createAndSendOtp(user, { enforceCooldown: true });
    return res.json(verificationResponse(user, 'A fresh OTP has been sent.'));
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Could not resend OTP',
      data: error.waitSeconds ? { resendAfterSeconds: error.waitSeconds } : undefined
    });
  }
});

router.post('/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');
    const user = await User.findOne({ email }).select('+password +refreshTokenHash +emailVerificationOtpLastSentAt');

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account is deactivated. Please contact support.' });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email before logging in.',
        requiresVerification: true,
        email: user.email,
        data: {
          requiresVerification: true,
          email: user.email,
          resendAfterSeconds: secondsUntilResend(user)
        }
      });
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
      user.isEmailVerified = true;
      user.emailVerifiedAt = user.emailVerifiedAt || new Date();
      await user.save();
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

    const audiences = getGoogleAudiences();
    if (audiences.length === 0) {
      return res.status(500).json({ success: false, message: 'Google login is not configured on the server' });
    }

    const ticket = await googleOAuthClient.verifyIdToken({
      idToken: credential,
      audience: audiences
    });
    const payload = ticket.getPayload();
    const email = payload?.email?.toLowerCase();
    const googleId = payload?.sub;

    if (!email || !googleId || payload.email_verified === false) {
      return res.status(400).json({ success: false, message: 'Google account did not return a verified email' });
    }

    let user = await User.findOne({ $or: [{ googleId }, { email }] }).select('+refreshTokenHash');
    if (user) {
      user.googleId = user.googleId || googleId;
      user.authProvider = user.authProvider || 'google';
      user.displayName = user.displayName || payload.name || email.split('@')[0];
      user.avatar = user.avatar || payload.picture || '';
      user.isEmailVerified = true;
      user.emailVerifiedAt = user.emailVerifiedAt || new Date();
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
      isEmailVerified: true,
      emailVerifiedAt: new Date()
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

    const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
    const decoded = jwt.verify(refreshToken, refreshSecret);
    const user = await User.findById(decoded.id);

    if (!user || !user.isActive || !user.isEmailVerified) {
      return res.status(401).json({ success: false, message: 'Session could not be refreshed' });
    }

    return sendSession(res, user);
  } catch {
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
