const User = require('../models/User');

// @desc    Get user profile (public info)
// @route   GET /api/users/:username
// @access  Public
const getUserProfile = async (req, res) => {
      try {
            const user = await User.findOne({ username: req.params.username });

            if (!user) {
                  return res.status(404).json({
                        success: false,
                        message: 'User not found'
                  });
            }

            res.json({
                  success: true,
                  data: { user: user.getPublicProfile() }
            });
      } catch (error) {
            res.status(500).json({
                  success: false,
                  message: 'Failed to get user profile',
                  error: error.message
            });
      }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateProfile = async (req, res) => {
      try {
            const allowedUpdates = [
                  'displayName', 'bio', 'avatar', 'interests',
                  'preferredContentTypes', 'preferredFeedMode',
                  'focusModeEnabled', 'dailyUsageLimit', 'language',
                  'profileVisibility', 'isPrivate'
            ];

            const updates = {};
            for (const key of allowedUpdates) {
                  if (req.body[key] !== undefined) {
                        updates[key] = req.body[key];
                  }
            }

            const user = await User.findByIdAndUpdate(
                  req.user.id,
                  updates,
                  { new: true, runValidators: true }
            );

            res.json({
                  success: true,
                  message: 'Profile updated successfully',
                  data: { user: user.getPublicProfile() }
            });
      } catch (error) {
            res.status(500).json({
                  success: false,
                  message: 'Failed to update profile',
                  error: error.message
            });
      }
};

// @desc    Update user interests (subscriptions)
// @route   PUT /api/users/interests
// @access  Private
const updateInterests = async (req, res) => {
      try {
            const { interests } = req.body;

            const user = await User.findByIdAndUpdate(
                  req.user.id,
                  { interests },
                  { new: true, runValidators: true }
            );

            res.json({
                  success: true,
                  message: 'Interests updated! Your feed will adjust accordingly.',
                  data: { interests: user.interests }
            });
      } catch (error) {
            res.status(500).json({
                  success: false,
                  message: 'Failed to update interests',
                  error: error.message
            });
      }
};

// @desc    Update feed preferences
// @route   PUT /api/users/feed-preferences
// @access  Private
const updateFeedPreferences = async (req, res) => {
      try {
            const { preferredFeedMode, preferredContentTypes } = req.body;

            const updates = {};
            if (preferredFeedMode) updates.preferredFeedMode = preferredFeedMode;
            if (preferredContentTypes) updates.preferredContentTypes = preferredContentTypes;

            const user = await User.findByIdAndUpdate(
                  req.user.id,
                  updates,
                  { new: true, runValidators: true }
            );

            res.json({
                  success: true,
                  message: 'Feed preferences updated!',
                  data: {
                        preferredFeedMode: user.preferredFeedMode,
                        preferredContentTypes: user.preferredContentTypes
                  }
            });
      } catch (error) {
            res.status(500).json({
                  success: false,
                  message: 'Failed to update feed preferences',
                  error: error.message
            });
      }
};

// @desc    Toggle focus mode
// @route   PUT /api/users/focus-mode
// @access  Private
const toggleFocusMode = async (req, res) => {
      try {
            const user = await User.findById(req.user.id);
            user.focusModeEnabled = !user.focusModeEnabled;
            await user.save();

            res.json({
                  success: true,
                  message: user.focusModeEnabled
                        ? 'Focus mode enabled. Enjoy peaceful browsing! 🧘'
                        : 'Focus mode disabled.',
                  data: { focusModeEnabled: user.focusModeEnabled }
            });
      } catch (error) {
            res.status(500).json({
                  success: false,
                  message: 'Failed to toggle focus mode',
                  error: error.message
            });
      }
};

// @desc    Follow a user
// @route   POST /api/users/:id/follow
// @access  Private
const followUser = async (req, res) => {
      try {
            if (req.user.id === req.params.id) {
                  return res.status(400).json({ success: false, message: "You cannot follow yourself" });
            }

            const userToFollow = await User.findById(req.params.id);
            const currentUser = await User.findById(req.user.id);

            if (!userToFollow || !currentUser) {
                  return res.status(404).json({ success: false, message: "User not found" });
            }

            if (currentUser.following.includes(req.params.id)) {
                  return res.status(400).json({ success: false, message: "You already follow this user" });
            }

            if (userToFollow.followRequests.includes(req.user.id)) {
                  return res.status(400).json({ success: false, message: "Follow request already sent" });
            }

            if (userToFollow.isPrivate) {
                  await userToFollow.updateOne({ $push: { followRequests: req.user.id } });
                  return res.json({ success: true, message: "Follow request sent", status: "requested" });
            } else {
                  await currentUser.updateOne({ $push: { following: req.params.id } });
                  await userToFollow.updateOne({ $push: { followers: req.user.id } });
                  return res.json({ success: true, message: "User followed", status: "following" });
            }
      } catch (error) {
            res.status(500).json({ success: false, message: "Failed to follow user", error: error.message });
      }
};

// @desc    Unfollow a user
// @route   POST /api/users/:id/unfollow
// @access  Private
const unfollowUser = async (req, res) => {
      try {
            if (req.user.id === req.params.id) {
                  return res.status(400).json({ success: false, message: "You cannot unfollow yourself" });
            }

            const userToUnfollow = await User.findById(req.params.id);
            const currentUser = await User.findById(req.user.id);

            if (!userToUnfollow || !currentUser) {
                  return res.status(404).json({ success: false, message: "User not found" });
            }

            if (currentUser.following.includes(req.params.id)) {
                  await currentUser.updateOne({ $pull: { following: req.params.id } });
                  await userToUnfollow.updateOne({ $pull: { followers: req.user.id } });
                  res.json({ success: true, message: "User unfollowed" });
            } else if (userToUnfollow.followRequests.includes(req.user.id)) {
                  // Check if there was a pending request and remove it
                  await userToUnfollow.updateOne({ $pull: { followRequests: req.user.id } });
                  res.json({ success: true, message: "Follow request cancelled" });
            } else {
                  res.status(400).json({ success: false, message: "You do not follow this user" });
            }
      } catch (error) {
            res.status(500).json({ success: false, message: "Failed to unfollow user", error: error.message });
      }
};

// @desc    Accept follow request
// @route   POST /api/users/requests/:id/accept
// @access  Private
const acceptFollowRequest = async (req, res) => {
      try {
            const userToAccept = await User.findById(req.params.id);
            const currentUser = await User.findById(req.user.id);

            if (!userToAccept) {
                  return res.status(404).json({ success: false, message: "User not found" });
            }

            if (!currentUser.followRequests.includes(req.params.id)) {
                  return res.status(400).json({ success: false, message: "No request from this user" });
            }

            // Add to followers/following logic
            await currentUser.updateOne({
                  $pull: { followRequests: req.params.id },
                  $push: { followers: req.params.id }
            });
            await userToAccept.updateOne({ $push: { following: req.user.id } });

            res.json({ success: true, message: "Request accepted" });
      } catch (error) {
            res.status(500).json({ success: false, message: "Failed to accept request", error: error.message });
      }
};

// @desc    Reject follow request
// @route   POST /api/users/requests/:id/reject
// @access  Private
const rejectFollowRequest = async (req, res) => {
      try {
            const currentUser = await User.findById(req.user.id);

            if (!currentUser.followRequests.includes(req.params.id)) {
                  return res.status(400).json({ success: false, message: "No request from this user" });
            }

            await currentUser.updateOne({ $pull: { followRequests: req.params.id } });

            res.json({ success: true, message: "Request rejected" });
      } catch (error) {
            res.status(500).json({ success: false, message: "Failed to reject request", error: error.message });
      }
};

// @desc    Get follow requests
// @route   GET /api/users/requests
// @access  Private
const getFollowRequests = async (req, res) => {
      try {
            const user = await User.findById(req.user.id).populate('followRequests', 'username displayName avatar');
            res.json({ success: true, data: { requests: user.followRequests } });
      } catch (error) {
            res.status(500).json({ success: false, message: "Failed to get requests", error: error.message });
      }
};

module.exports = {
      getUserProfile,
      updateProfile,
      updateInterests,
      updateFeedPreferences,
      toggleFocusMode,
      followUser,
      unfollowUser,
      acceptFollowRequest,
      rejectFollowRequest,
      getFollowRequests
};
