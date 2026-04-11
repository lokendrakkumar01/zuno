const express = require('express');
const router = express.Router();
const { register, login, googleLogin, getMe, logout, changePassword, resetPassword } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const { registerRules, loginRules } = require('../utils/validationRules');
const { validate } = require('../middleware/validation');

// Public routes
router.post('/register', authLimiter, registerRules(), validate, register);
router.post('/login', authLimiter, loginRules(), validate, login);
router.post('/google', authLimiter, googleLogin);
router.post('/reset-password', authLimiter, resetPassword); // token-based reset from admin

// Protected routes
router.get('/me', protect, getMe);
router.post('/logout', protect, logout);
router.put('/change-password', protect, changePassword);

module.exports = router;
