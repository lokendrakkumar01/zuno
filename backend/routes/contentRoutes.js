const express = require('express');
const router = express.Router();
const {
      createContent,
      getContent,
      updateContent,
      deleteContent,
      markHelpful,
      markNotUseful,
      saveContent,
      getMyContent,
      getSavedContent,
      shareContent
} = require('../controllers/contentController');
const { protect } = require('../middleware/auth');
const { uploadMultiple } = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/rateLimit');

// Public routes
router.get('/:id', getContent);

// Protected routes
router.post('/', protect, uploadLimiter, uploadMultiple.array('media', 10), createContent);
router.put('/:id', protect, updateContent);
router.delete('/:id', protect, deleteContent);

// Interactions (ZUNO-style private feedback)
router.post('/:id/helpful', protect, markHelpful);
router.post('/:id/not-useful', protect, markNotUseful);
router.post('/:id/dislike', protect, markNotUseful);  // Alias for not-useful (dislike)
router.post('/:id/save', protect, saveContent);
// Share is public (can track if logged in, but allowing public for now as per controller - wait controller doesn't use req.user, it is public)
router.post('/:id/share', shareContent);

// User's content
router.get('/user/my', protect, getMyContent);
router.get('/user/saved', protect, getSavedContent);

module.exports = router;
