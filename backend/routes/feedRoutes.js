const express = require('express');
const router = express.Router();
const {
      getFeed,
      getFeedByTopic,
      getCreatorFeed,
      searchContent,
      getActiveStories
} = require('../controllers/feedController');
const { optionalProtect } = require('../middleware/auth');

// Public routes (with optional personalization if logged in)
router.get('/', optionalProtect, getFeed);
router.get('/stories', optionalProtect, getActiveStories);
router.get('/search', optionalProtect, searchContent);
router.get('/topic/:topic', optionalProtect, getFeedByTopic);
router.get('/creator/:username', optionalProtect, getCreatorFeed);

module.exports = router;
