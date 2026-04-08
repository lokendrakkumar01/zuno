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
      reportContent,
      getMyContent,
      getSavedContent,
      shareContent,
      markAsViewed
} = require('../controllers/contentController');
const { protect } = require('../middleware/auth');
const { uploadMultiple } = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/rateLimit');
const { contentRules } = require('../utils/validationRules');
const { validate } = require('../middleware/validation');

// Public routes
// Keep fixed user-prefixed routes BEFORE dynamic :id to avoid route shadowing.
router.get('/user/my', protect, getMyContent);
router.get('/user/saved', protect, getSavedContent);
router.get('/:id', getContent);

// Multer error handler wrapper
const handleUpload = (req, res, next) => {
      uploadMultiple.array('media', 10)(req, res, (err) => {
            if (err) {
                  console.error('Upload Error Handle:', err);
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
                        message: err.message || 'Media upload failed due to network or format issue. Please try again.'
                  });
            }
            next();
      });
};

// Protected routes
router.post('/', protect, uploadLimiter, handleUpload, contentRules(), validate, createContent);
router.put('/:id', protect, updateContent);
router.delete('/:id', protect, deleteContent);

// Interactions (ZUNO-style private feedback)
router.post('/:id/helpful', protect, markHelpful);
router.post('/:id/not-useful', protect, markNotUseful);
router.post('/:id/dislike', protect, markNotUseful);  // Alias for not-useful (dislike)
router.post('/:id/save', protect, saveContent);
router.post('/:id/report', protect, reportContent);
// Share is public
router.post('/:id/share', shareContent);
router.post('/:id/view', protect, markAsViewed);

module.exports = router;
