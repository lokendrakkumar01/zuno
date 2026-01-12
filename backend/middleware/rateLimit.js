const rateLimit = require('express-rate-limit');

// General API rate limiter
const apiLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: {
            success: false,
            message: 'Too many requests, please try again later.'
      }
});

// Auth rate limiter (stricter)
const authLimiter = rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 10, // limit each IP to 10 auth attempts per hour
      message: {
            success: false,
            message: 'Too many login attempts, please try again after an hour.'
      }
});

// Upload rate limiter
const uploadLimiter = rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 20, // limit each IP to 20 uploads per hour
      message: {
            success: false,
            message: 'Too many uploads, please try again later.'
      }
});

module.exports = {
      apiLimiter,
      authLimiter,
      uploadLimiter
};
