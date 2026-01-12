const express = require('express');
const router = express.Router();
const {
      getUserProfile,
      updateProfile,
      updateInterests,
      updateFeedPreferences,
      toggleFocusMode,
      followUser,
      unfollowUser,
      getFollowRequests,
      acceptFollowRequest,
      rejectFollowRequest
} = require('../controllers/userController');
const { protect } = require('../middleware/auth');

// Public routes
router.get('/:username', getUserProfile);

// Protected routes
// Protected routes
router.get('/requests/pending', protect, getFollowRequests); // Ensure this is before /:username if conflicts arise (here it's fine as main route is /profile usually or distinct)
router.put('/profile', protect, updateProfile);
router.put('/interests', protect, updateInterests);
router.put('/feed-preferences', protect, updateFeedPreferences);
router.put('/focus-mode', protect, toggleFocusMode);

// Social
router.post('/:id/follow', protect, followUser);
router.post('/:id/unfollow', protect, unfollowUser);
router.post('/requests/:id/accept', protect, acceptFollowRequest);
router.post('/requests/:id/reject', protect, rejectFollowRequest);

module.exports = router;
