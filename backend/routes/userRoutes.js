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
      rejectFollowRequest,
      getFollowers,
      getFollowing,
      getCloseFriends,
      addCloseFriend,
      removeCloseFriend,
      searchUsers
} = require('../controllers/userController');
const { protect } = require('../middleware/auth');

// Search users (must be before /:username to avoid conflict)
router.get('/search', protect, searchUsers);

// Close Friends (must be before /:username to avoid conflict)
router.get('/close-friends/list', protect, getCloseFriends);
router.post('/close-friends/:id', protect, addCloseFriend);
router.delete('/close-friends/:id', protect, removeCloseFriend);

// Protected routes
router.get('/requests/pending', protect, getFollowRequests);
router.put('/profile', protect, updateProfile);
router.put('/interests', protect, updateInterests);
router.put('/feed-preferences', protect, updateFeedPreferences);
router.put('/focus-mode', protect, toggleFocusMode);

// Social
router.post('/:id/follow', protect, followUser);
router.post('/:id/unfollow', protect, unfollowUser);
router.post('/requests/:id/accept', protect, acceptFollowRequest);
router.post('/requests/:id/reject', protect, rejectFollowRequest);

// Public routes (at the end to avoid conflicts with specific routes)
router.get('/:username', getUserProfile);
router.get('/:username/followers', getFollowers);
router.get('/:username/following', getFollowing);

module.exports = router;
