const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Generate JWT Token
const generateToken = (id) => {
      return jwt.sign({ id }, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRE || '30d'
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
                        user: user.getPublicProfile(),
                        token
                  }
            });
      } catch (error) {
            res.status(500).json({
                  success: false,
                  message: 'Registration failed',
                  error: error.message
            });
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

            res.json({
                  success: true,
                  message: 'Welcome back! 👋',
                  data: {
                        user: user.getPublicProfile(),
                        token
                  }
            });
      } catch (error) {
            res.status(500).json({
                  success: false,
                  message: 'Login failed',
                  error: error.message
            });
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
                        user: {
                              ...user.getPublicProfile(),
                              email: user.email,
                              preferredFeedMode: user.preferredFeedMode,
                              focusModeEnabled: user.focusModeEnabled,
                              dailyUsageLimit: user.dailyUsageLimit,
                              language: user.language,
                              stats: user.stats
                        }
                  }
            });
      } catch (error) {
            res.status(500).json({
                  success: false,
                  message: 'Failed to get user data',
                  error: error.message
            });
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

module.exports = {
      register,
      login,
      getMe,
      logout
};
