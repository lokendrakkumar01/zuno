const express = require('express');
const router = express.Router();
const {
      addComment,
      getComments,
      deleteComment
} = require('../controllers/commentController');
const { protect } = require('../middleware/auth');

// Public routes
router.get('/:contentId', getComments);

// Protected routes
router.post('/:contentId', protect, addComment);
router.delete('/:id', protect, deleteComment);

module.exports = router;
