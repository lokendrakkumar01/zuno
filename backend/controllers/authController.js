/**
 * controllers/authController.js — FIX: BUG 8 (Google OAuth Broken)
 *
 * BUGS FIXED:
 *  - BUG 8: Redirect URI mismatch error from Google Console
 *    Root cause: strict `redirectUri` validation rejected requests with no
 *    matching env var, but Google's SDK sends the redirect_uri on the
 *    Authorization Code flow, not the ID Token flow (One Tap / Sign In With Google).
 *    Fix: Only validate redirectUri when the env var is explicitly set; otherwise
 *    skip the check. One Tap tokens just need audience validation.
 *  - BUG 8: GOOGLE_CLIENT_ID env not being read → "missing on the server"
 *    Fix: detailed log message explains exactly which env var to set on Render.
 *  - BUG 8: No proper error response for OAuth callback failures.
 *    Fix: specific status codes and user-facing messages for each error class.
 *
 * GOOGLE CONSOLE SETUP (add both URLs as Authorized Redirect URIs):
 *   https://zuno-backend-bevi.onrender.com/api/auth/google/callback
 *   http://localhost:5000/api/auth/google/callback
 *
 * RENDER ENV VARS REQUIRED:
 *   GOOGLE_CLIENT_ID        = your OAuth2 Web Client ID
 *   GOOGLE_WEB_CLIENT_ID    = same as above (fallback)
 *   GOOGLE_REDIRECT_URI     = https://zuno-backend-bevi.onrender.com/api/auth/google/callback
 */

'use strict';

const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const User   = require('../models/User');
const { sendLoginEmail } = require('../config/emailService');

// ─── Token config ─────────────────────────────────────────────────────────────

const ACCESS_TOKEN_EXPIRE  = process.env.JWT_ACCESS_EXPIRE  || '30m';
const REFRESH_TOKEN_EXPIRE = process.env.JWT_REFRESH_EXPIRE || '30d';

const getRefreshSecret = () => process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;

const generateAccessToken  = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRE });
const generateRefreshToken = (id) => jwt.sign({ id, type: 'refresh' }, getRefreshSecret(), { expiresIn: REFRESH_TOKEN_EXPIRE });

const hashToken = (value = '') => crypto.createHash('sha256').update(String(value)).digest('hex');

const getRefreshExpiryDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d;
};

// ─── Google helpers ───────────────────────────────────────────────────────────

/**
 * Collect all configured Google client IDs.
 * Render env var: GOOGLE_CLIENT_ID (primary), with optional extras.
 */
const getGoogleClientIds = () =>
  [
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_WEB_CLIENT_ID,
    process.env.GOOGLE_ANDROID_CLIENT_ID,
    process.env.GOOGLE_IOS_CLIENT_ID,
    ...String(process.env.GOOGLE_CLIENT_IDS || '').split(','),
  ]
    .map((v) => String(v || '').trim())
    .filter(Boolean);

/**
 * FIX BUG 8: Verify Google ID token (One Tap / Sign In With Google flow).
 *
 * The redirect_uri check is ONLY relevant for the Authorization Code flow.
 * When using Google One Tap or the Sign In With Google button, the client
 * receives an ID token directly — no redirect is involved on the backend.
 * Strict redirectUri validation against an env var causes false mismatches.
 *
 * Fix: Only validate redirectUri if GOOGLE_REDIRECT_URI is explicitly set
 * AND the caller actually sent a redirectUri. Otherwise, skip the check.
 */
const verifyGoogleCredential = async ({ credential, redirectUri, origin }) => {
  const googleClientIds = getGoogleClientIds();

  // FIX BUG 8: helpful startup error if env var missing
  if (googleClientIds.length === 0) {
    console.error(
      '[Auth] GOOGLE_CLIENT_ID is not set on the server.\n' +
      'Add it in the Render dashboard → Environment → GOOGLE_CLIENT_ID'
    );
    throw new Error('Google login is not configured on the server. Contact support.');
  }

  // FIX BUG 8: Only validate redirectUri when the server has an explicit expected value
  const expectedRedirectUri = (
    process.env.GOOGLE_REDIRECT_URI ||
    process.env.GOOGLE_CALLBACK_URI ||
    process.env.GOOGLE_CALLBACK_URL ||
    ''
  ).trim();

  if (redirectUri && expectedRedirectUri && redirectUri !== expectedRedirectUri) {
    // Log the mismatch so we can debug it without crashing the user
    console.warn(`[Auth] Google redirect URI mismatch: got "${redirectUri}", expected "${expectedRedirectUri}"`);
    throw new Error('Google OAuth redirect URI mismatch. Check your Google Console settings.');
  }

  // FIX BUG 8: Origin validation is also optional — only when explicitly configured
  const allowedOrigins = String(process.env.GOOGLE_ALLOWED_ORIGINS || '')
    .split(',').map((v) => v.trim()).filter(Boolean);

  if (origin && allowedOrigins.length > 0 && !allowedOrigins.includes(origin)) {
    console.warn(`[Auth] Google request from unexpected origin: "${origin}"`);
    // Do NOT throw — origin header can be missing or spoofed; audience check is sufficient
  }

  // Verify the ID token — this is the real security check
  const client = new OAuth2Client(googleClientIds[0]);
  let ticket;
  try {
    ticket = await client.verifyIdToken({
      idToken:  credential,
      audience: googleClientIds,
    });
  } catch (err) {
    console.warn('[Auth] Google token verification failed:', err.message);
    throw new Error('Google sign-in failed. Please try again.');
  }

  const profile = ticket.getPayload();
  if (!profile?.sub || !profile?.email) {
    throw new Error('Google sign-in returned incomplete user data.');
  }

  if (!profile.email_verified) {
    throw new Error('Your Google account email is not verified.');
  }

  return {
    googleId:    profile.sub,
    email:       String(profile.email || '').trim().toLowerCase(),
    displayName: profile.name || profile.email,
    avatar:      profile.picture || '',
  };
};

// ─── Username helper ──────────────────────────────────────────────────────────

const slugifyUsername = (value = '') =>
  String(value || '')
    .trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);

const buildGoogleUsername = async ({ email, name }) => {
  const base = slugifyUsername(name) || slugifyUsername(email.split('@')[0]) || 'zuno_user';
  for (let i = 0; i <= 100; i++) {
    const suffix    = i === 0 ? '' : `_${i}`;
    const candidate = `${base.slice(0, Math.max(3, 24 - suffix.length))}${suffix}`;
    const exists    = await User.findOne({ username: candidate }).select('_id').lean();
    if (!exists) return candidate;
  }
  throw new Error('Could not generate a unique username. Please try again.');
};

// ─── Session tokens ───────────────────────────────────────────────────────────

const issueSessionTokens = async (user) => {
  const accessToken  = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);
  user.refreshTokenHash      = hashToken(refreshToken);
  user.refreshTokenExpiresAt = getRefreshExpiryDate();
  await user.save();
  return { token: accessToken, refreshToken };
};

// ─── Error helpers ────────────────────────────────────────────────────────────

const normalizeEmail = (v = '') => String(v || '').trim().toLowerCase();

const handleAuthError = (res, message, err) => {
  if (process.env.NODE_ENV !== 'production') console.error(`[Auth] ${message}:`, err);
  return res.status(500).json({ success: false, message });
};

// ─── Controllers ──────────────────────────────────────────────────────────────

// POST /api/auth/register
const register = async (req, res) => {
  try {
    const { username, email, password, displayName, language } = req.body;
    const normalizedEmail = normalizeEmail(email);

    const userExists = await User.findOne({ $or: [{ email: normalizedEmail }, { username }] }).lean();
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User with this email or username already exists' });
    }

    const user   = await User.create({ username, email: normalizedEmail, password, displayName: displayName || username, language: language || 'both' });
    const tokens = await issueSessionTokens(user);

    return res.status(201).json({
      success: true,
      message: 'Welcome to ZUNO! 🎉',
      data: { user: user.getAuthProfile(), token: tokens.token, refreshToken: tokens.refreshToken },
    });
  } catch (err) {
    return handleAuthError(res, 'Registration failed', err);
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email: normalizeEmail(email) }).select('+password +refreshTokenHash +refreshTokenExpiresAt');
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account is deactivated. Please contact support.' });
    }

    const tokens = await issueSessionTokens(user);

    // Fire-and-forget login email
    const loginTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
    sendLoginEmail(user.email, user.displayName || user.username, `${loginTime} IST`).catch((e) => {
      console.error('[Auth] Login email error:', e.message);
    });

    return res.json({
      success: true,
      message: 'Welcome back! 👋',
      data: { user: user.getAuthProfile(), token: tokens.token, refreshToken: tokens.refreshToken },
    });
  } catch (err) {
    return handleAuthError(res, 'Login failed', err);
  }
};

// POST /api/auth/google — FIX BUG 8
const googleLogin = async (req, res) => {
  try {
    const credential  = String(req.body?.credential  || '').trim();
    const redirectUri = String(req.body?.redirectUri || '').trim();
    const origin      = String(req.body?.origin      || req.headers?.origin || '').trim();

    if (!credential) {
      return res.status(400).json({ success: false, message: 'Google credential is required' });
    }

    const googleProfile = await verifyGoogleCredential({ credential, redirectUri, origin });

    // Find or create user
    let user = await User.findOne({
      $or: [{ googleId: googleProfile.googleId }, { email: googleProfile.email }],
    });

    if (user) {
      if (!user.isActive) {
        return res.status(401).json({ success: false, message: 'Account is deactivated. Please contact support.' });
      }
      let changed = false;
      if (!user.googleId)                                { user.googleId = googleProfile.googleId;         changed = true; }
      if (!user.avatar      && googleProfile.avatar)     { user.avatar   = googleProfile.avatar;           changed = true; }
      if (!user.displayName && googleProfile.displayName){ user.displayName = googleProfile.displayName;   changed = true; }
      if (changed) await user.save();
    } else {
      const username = await buildGoogleUsername({ email: googleProfile.email, name: googleProfile.displayName });
      try {
        user = await User.create({
          username,
          email:       googleProfile.email,
          displayName: googleProfile.displayName || username,
          avatar:      googleProfile.avatar,
          googleId:    googleProfile.googleId,
          password:    crypto.randomBytes(24).toString('hex'),
          language:    'both',
        });
      } catch (dupErr) {
        if (dupErr?.code !== 11000) throw dupErr;
        // Duplicate key race — fetch the existing user
        user = await User.findOne({ email: googleProfile.email });
        if (!user) throw dupErr;
        if (!user.googleId) { user.googleId = googleProfile.googleId; await user.save(); }
      }
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account is deactivated. Please contact support.' });
    }

    const tokens = await issueSessionTokens(user);

    return res.json({
      success: true,
      message: 'Welcome to ZUNO!',
      data: { user: user.getAuthProfile(), token: tokens.token, refreshToken: tokens.refreshToken },
    });
  } catch (err) {
    const msg = err?.message || 'Google login failed';

    // FIX BUG 8: map error types to correct HTTP status codes
    if (
      msg.includes('credential is required') ||
      msg.includes('not configured') ||
      msg.includes('failed. Please try again') ||
      msg.includes('not verified') ||
      msg.includes('incomplete user data') ||
      msg.includes('redirect URI mismatch')
    ) {
      return res.status(400).json({ success: false, message: msg });
    }

    return handleAuthError(res, 'Google login failed', err);
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.json({ success: true, data: { user: user.getAuthProfile() } });
  } catch (err) {
    return handleAuthError(res, 'Failed to get user data', err);
  }
};

// POST /api/auth/refresh
const refreshSession = async (req, res) => {
  try {
    const refreshToken = String(req.body?.refreshToken || '').trim();
    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'Refresh token is required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, getRefreshSecret());
    } catch {
      return res.status(401).json({ success: false, message: 'Refresh token is invalid or expired' });
    }

    if (decoded?.type !== 'refresh') {
      return res.status(401).json({ success: false, message: 'Refresh token is invalid or expired' });
    }

    const user = await User.findById(decoded.id).select('+refreshTokenHash +refreshTokenExpiresAt');
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Session could not be refreshed' });
    }

    if (!user.refreshTokenHash || user.refreshTokenHash !== hashToken(refreshToken)) {
      return res.status(401).json({ success: false, message: 'Session could not be refreshed' });
    }

    if (!user.refreshTokenExpiresAt || user.refreshTokenExpiresAt <= new Date()) {
      user.refreshTokenHash      = undefined;
      user.refreshTokenExpiresAt = undefined;
      await user.save();
      return res.status(401).json({ success: false, message: 'Refresh token is invalid or expired' });
    }

    const tokens = await issueSessionTokens(user);
    return res.json({ success: true, data: { user: user.getAuthProfile(), token: tokens.token, refreshToken: tokens.refreshToken } });
  } catch (err) {
    return handleAuthError(res, 'Failed to refresh session', err);
  }
};

// POST /api/auth/logout
const logout = async (req, res) => {
  await User.findByIdAndUpdate(req.user.id, {
    $unset: { refreshTokenHash: 1, refreshTokenExpiresAt: 1 },
  }).catch(() => {});
  return res.json({ success: true, message: 'Logged out successfully. Take care! 🙏' });
};

// PUT /api/auth/change-password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Please provide current and new password' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }
    const user = await User.findById(req.user.id).select('+password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Incorrect current password' });
    user.password              = newPassword;
    user.refreshTokenHash      = undefined;
    user.refreshTokenExpiresAt = undefined;
    await user.save();
    return res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    return handleAuthError(res, 'Internal server error', err);
  }
};

// POST /api/auth/reset-password
const resetPassword = async (req, res) => {
  try {
    const { token, userId, newPassword } = req.body;
    if (!token || !userId || !newPassword) {
      return res.status(400).json({ success: false, message: 'Token, userId and newPassword are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      _id: userId,
      passwordResetToken:   hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select('+password +passwordResetToken +passwordResetExpires');
    if (!user) return res.status(400).json({ success: false, message: 'Invalid or expired reset link' });
    user.password             = newPassword;
    user.passwordResetToken   = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    return res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    return handleAuthError(res, 'Reset failed', err);
  }
};

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = { register, login, googleLogin, getMe, refreshSession, logout, changePassword, resetPassword };
