const jwt = require('jsonwebtoken');
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

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
      try {
            const user = await User.findById(req.user.id);
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
            if (newPassword.length < 6) {
                  return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
            }

            const crypto = require('crypto');
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
      getMe,
      logout,
      changePassword,
      resetPassword
};
