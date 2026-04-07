const express = require('express');
const router = express.Router();
const { register, login, getMe, logout, changePassword, resetPassword } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');

// Public routes
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/reset-password', authLimiter, resetPassword); // token-based reset from admin

// Protected routes
router.get('/me', protect, getMe);
router.post('/logout', protect, logout);
router.put('/change-password', protect, changePassword);

module.exports = router;
