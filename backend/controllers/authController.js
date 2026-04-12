const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const { sendLoginEmail } = require('../config/emailService');

// Generate JWT Token
const generateToken = (id) => {
      return jwt.sign({ id }, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRE || '30d'
      });
};

const handleAuthError = (res, message, error) => {
      if (process.env.NODE_ENV !== 'production') {
            console.error(`[Auth] ${message}:`, error);
      }
      return res.status(500).json({
            success: false,
            message
      });
};

const normalizeEmail = (value = '') => String(value || '').trim().toLowerCase();

const slugifyUsername = (value = '') => (
      String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 24)
);

const buildGoogleUsername = async ({ email, name }) => {
      const emailBase = normalizeEmail(email).split('@')[0];
      const preferredBase = slugifyUsername(name) || slugifyUsername(emailBase) || 'zuno_user';
      for (let suffix = 0; suffix <= 100; suffix += 1) {
            const suffixValue = suffix === 0 ? '' : `_${suffix}`;
            const trimmedBase = preferredBase.slice(0, Math.max(3, 24 - suffixValue.length)) || 'zuno_user';
            const candidate = `${trimmedBase}${suffixValue}`;
            const existingUser = await User.findOne({ username: candidate }).select('_id');
            if (!existingUser) {
                  return candidate;
            }
      }

      throw new Error('Could not generate unique username');
};

const verifyGoogleCredential = async (credential) => {
      const googleClientId = process.env.GOOGLE_CLIENT_ID;
      if (!googleClientId) {
            throw new Error('GOOGLE_CLIENT_ID is missing on the server');
      }

      const client = new OAuth2Client(googleClientId);
      let ticket;

      try {
            ticket = await client.verifyIdToken({
                  idToken: credential,
                  audience: googleClientId
            });
      } catch {
            throw new Error('Google token verification failed');
      }

      const profile = ticket.getPayload();
      if (!profile?.sub || !profile?.email) {
            throw new Error('Google token verification failed');
      }

      if (!profile.email_verified) {
            throw new Error('Google account email is not verified');
      }

      return {
            googleId: profile.sub,
            email: normalizeEmail(profile.email),
            displayName: profile.name || profile.email,
            avatar: profile.picture || '',
      };
};

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
      try {
            const { username, email, password, displayName, language } = req.body;

            // Check if user exists
            const userExists = await User.findOne({ $or: [{ email }, { username }] });
            if (userExists) {
                  return res.status(400).json({
                        success: false,
                        message: 'User with this email or username already exists'
                  });
            }

            // Create user
            const user = await User.create({
                  username,
                  email,
                  password,
                  displayName: displayName || username,
                  language: language || 'both'
            });

            // Generate token
            const token = generateToken(user._id);

            res.status(201).json({
                  success: true,
                  message: 'Welcome to ZUNO! 🎉',
                  data: {
                        user: user.getAuthProfile(),
                        token
                  }
            });
      } catch (error) {
            return handleAuthError(res, 'Registration failed', error);
      }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
      try {
            const { email, password } = req.body;

            // Validate
            if (!email || !password) {
                  return res.status(400).json({
                        success: false,
                        message: 'Please provide email and password'
                  });
            }

            // Check user
            const user = await User.findOne({ email }).select('+password');
            if (!user) {
                  return res.status(401).json({
                        success: false,
                        message: 'Invalid credentials'
                  });
            }

            // Check password
            const isMatch = await user.matchPassword(password);
            if (!isMatch) {
                  return res.status(401).json({
                        success: false,
                        message: 'Invalid credentials'
                  });
            }

            // Check if account is active
            if (!user.isActive) {
                  return res.status(401).json({
                        success: false,
                        message: 'Account is deactivated. Please contact support.'
                  });
            }

            // Generate token
            const token = generateToken(user._id);

            // Send login alert email (fire-and-forget, does not affect login speed)
            const loginTime = new Date().toLocaleString('en-IN', {
                  timeZone: 'Asia/Kolkata',
                  dateStyle: 'medium',
                  timeStyle: 'short'
            });
            sendLoginEmail(user.email, user.displayName || user.username, `${loginTime} IST`).catch((err) => {
                  console.error('[Auth] Background login email failed:', err);
            });

            res.json({
                  success: true,
                  message: 'Welcome back! 👋',
                  data: {
                        user: user.getAuthProfile(),
                        token
                  }
            });
      } catch (error) {
            return handleAuthError(res, 'Login failed', error);
      }
};

// @desc    Login/register with Google
// @route   POST /api/auth/google
// @access  Public
const googleLogin = async (req, res) => {
      try {
            const credential = String(req.body?.credential || '').trim();
            if (!credential) {
                  return res.status(400).json({
                        success: false,
                        message: 'Google credential is required'
                  });
            }

            const googleProfile = await verifyGoogleCredential(credential);

            let user = await User.findOne({
                  $or: [
                        { googleId: googleProfile.googleId },
                        { email: googleProfile.email }
                  ]
            });

            if (user) {
                  if (!user.isActive) {
                        return res.status(401).json({
                              success: false,
                              message: 'Account is deactivated. Please contact support.'
                        });
                  }

                  let shouldSave = false;
                  if (!user.googleId) {
                        user.googleId = googleProfile.googleId;
                        shouldSave = true;
                  }
                  if (!user.avatar && googleProfile.avatar) {
                        user.avatar = googleProfile.avatar;
                        shouldSave = true;
                  }
                  if (!user.displayName && googleProfile.displayName) {
                        user.displayName = googleProfile.displayName;
                        shouldSave = true;
                  }

                  if (shouldSave) {
                        await user.save();
                  }
            } else {
                  const username = await buildGoogleUsername({
                        email: googleProfile.email,
                        name: googleProfile.displayName
                  });

                  try {
                        user = await User.create({
                              username,
                              email: googleProfile.email,
                              displayName: googleProfile.displayName || username,
                              avatar: googleProfile.avatar,
                              googleId: googleProfile.googleId,
                              password: crypto.randomBytes(24).toString('hex'),
                              language: 'both'
                        });
                  } catch (error) {
                        if (error?.code !== 11000) {
                              throw error;
                        }

                        user = await User.findOne({ email: googleProfile.email });
                        if (!user) {
                              throw error;
                        }

                        let shouldSave = false;
                        if (!user.googleId) {
                              user.googleId = googleProfile.googleId;
                              shouldSave = true;
                        }
                        if (!user.avatar && googleProfile.avatar) {
                              user.avatar = googleProfile.avatar;
                              shouldSave = true;
                        }
                        if (!user.displayName && googleProfile.displayName) {
                              user.displayName = googleProfile.displayName;
                              shouldSave = true;
                        }

                        if (shouldSave) {
                              await user.save();
                        }
                  }
            }

            if (!user.isActive) {
                  return res.status(401).json({
                        success: false,
                        message: 'Account is deactivated. Please contact support.'
                  });
            }

            const token = generateToken(user._id);
            res.json({
                  success: true,
                  message: 'Welcome to ZUNO!',
                  data: {
                        user: user.getAuthProfile(),
                        token
                  }
            });
      } catch (error) {
            const message = error?.message || 'Google login failed';
            if (
                  message.includes('credential is required')
                  || message.includes('missing on the server')
                  || message.includes('verification failed')
                  || message.includes('client ID mismatch')
                  || message.includes('not verified')
            ) {
                  return res.status(400).json({ success: false, message });
            }

            return handleAuthError(res, 'Google login failed', error);
      }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
      try {
            const user = await User.findById(req.user.id);
            if (!user) {
                  return res.status(404).json({
                        success: false,
                        message: 'User not found'
                  });
            }
            res.json({
                  success: true,
                  data: {
                        user: user.getAuthProfile()
                  }
            });
      } catch (error) {
            return handleAuthError(res, 'Failed to get user data', error);
      }
};

// @desc    Logout user (client-side token removal)
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res) => {
      res.json({
            success: true,
            message: 'Logged out successfully. Take care! 🙏'
      });
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
      try {
            const { currentPassword, newPassword } = req.body;

            // Validate
            if (!currentPassword || !newPassword) {
                  return res.status(400).json({
                        success: false,
                        message: 'Please provide current and new password'
                  });
            }

            if (newPassword.length < 8) {
                  return res.status(400).json({
                        success: false,
                        message: 'Password must be at least 8 characters'
                  });
            }

            // Check user
            const user = await User.findById(req.user.id).select('+password');
            if (!user) {
                  return res.status(404).json({
                        success: false,
                        message: 'User not found'
                  });
            }

            // Check password
            const isMatch = await user.matchPassword(currentPassword);
            if (!isMatch) {
                  return res.status(401).json({
                        success: false,
                        message: 'Incorrect current password'
                  });
            }

            // Update password
            user.password = newPassword;
            await user.save();

            res.json({
                  success: true,
                  message: 'Password changed successfully'
            });
      } catch (error) {
            return handleAuthError(res, 'Internal server error', error);
      }
};

// @desc    Reset password via admin-issued token link
// @route   POST /api/auth/reset-password
// @access  Public (token-gated)
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
                  passwordResetToken: hashedToken,
                  passwordResetExpires: { $gt: Date.now() }
            }).select('+password +passwordResetToken +passwordResetExpires');

            if (!user) {
                  return res.status(400).json({ success: false, message: 'Invalid or expired reset link' });
            }

            user.password = newPassword;
            user.passwordResetToken = undefined;
            user.passwordResetExpires = undefined;
            await user.save();

            res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
      } catch (error) {
            return handleAuthError(res, 'Reset failed', error);
      }
};

module.exports = {
      register,
      login,
      googleLogin,
      getMe,
      logout,
      changePassword,
      resetPassword
};
