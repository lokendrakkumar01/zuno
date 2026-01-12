const express = require('express');
const router = express.Router();
const {
      getFeed,
      getFeedByTopic,
      getCreatorFeed,
      searchContent,
      getActiveStories
} = require('../controllers/feedController');
const { protect } = require('../middleware/auth');

// Optional auth middleware (works with or without auth)
const optionalAuth = async (req, res, next) => {
      const jwt = require('jsonwebtoken');
      const User = require('../models/User');

      if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            try {
                  const token = req.headers.authorization.split(' ')[1];
                  const decoded = jwt.verify(token, process.env.JWT_SECRET);
                  req.user = await User.findById(decoded.id).select('-password');
            } catch (error) {
                  // Continue without user (public access)
            }
      }
      next();
};

// Public routes (with optional personalization if logged in)
router.get('/', optionalAuth, getFeed);
router.get('/stories', optionalAuth, getActiveStories);
router.get('/search', searchContent);
router.get('/topic/:topic', getFeedByTopic);
router.get('/creator/:username', getCreatorFeed);

module.exports = router;
