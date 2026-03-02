const express = require('express');
const router = express.Router();
const multer = require('multer');
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

// Multer error handler wrapper
const handleUpload = (req, res, next) => {
      uploadMultiple.array('media', 10)(req, res, (err) => {
            if (err) {
                  if (err instanceof multer.MulterError) {
                        let message = 'Upload failed.';
                        if (err.code === 'LIMIT_FILE_SIZE') {
                              message = 'File is too large. Max size: 100MB for videos, 10MB for images.';
                        } else if (err.code === 'LIMIT_FILE_COUNT') {
                              message = 'Too many files. Maximum 10 files allowed.';
                        } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
                              message = 'Unexpected file field. Please use the correct upload form.';
                        }
                        return res.status(400).json({ success: false, message });
                  }
                  // Custom file filter error or Cloudinary error
                  return res.status(400).json({
                        success: false,
                        message: err.message || 'File upload failed. Please try again.'
                  });
            }
            next();
      });
};

// Protected routes
router.post('/', protect, uploadLimiter, handleUpload, createContent);
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
