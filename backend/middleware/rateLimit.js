const rateLimit = require('express-rate-limit');

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' }
});

// Auth rate limiter — strict to prevent brute force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // tightened from 50/hr to 10 per 15min
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please wait 15 minutes.' }
});

// Upload rate limiter
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many uploads, please try again later.' }
});

// Message rate limiter — prevent chat spam
const messageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 messages per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Slow down! You are sending messages too fast.' }
});

module.exports = {
  apiLimiter,
  authLimiter,
  uploadLimiter,
  messageLimiter
};

