const User = require('../models/User');
const { getReceiverSocketId, io } = require('../socket/socket');
const { sendProfileUpdateEmail } = require('../config/emailService');

const PUBLIC_PROFILE_SELECT = [
      'username',
      'displayName',
      'avatar',
      'bio',
      'role',
      'interests',
      'isVerified',
      'verificationRequest',
      'followers',
      'following',
      'profileSong',
      'stats',
      'createdAt',
      'blockedUsers'
].join(' ');

const PRIVATE_PROFILE_SELECT = [
      PUBLIC_PROFILE_SELECT,
      'email',
      'preferredFeedMode',
      'focusModeEnabled',
      'dailyUsageLimit',
      'language',
      'notificationSettings',
      'preferredContentTypes',
      'isPrivate',
      'profileVisibility'
].join(' ');

const buildPublicProfilePayload = (user) => {
      if (!user) return null;

      return {
            _id: user._id,
            id: user._id,
            username: user.username,
            displayName: user.displayName || user.username,
            avatar: user.avatar || '',
            bio: user.bio || '',
            role: user.role,
            interests: user.interests || [],
            isVerified: Boolean(user.isVerified),
            verificationRequest: user.verificationRequest
                  ? {
                        status: user.verificationRequest.status,
                        requestedAt: user.verificationRequest.requestedAt
                  }
                  : null,
            followersCount: Array.isArray(user.followers) ? user.followers.length : 0,
            followingCount: Array.isArray(user.following) ? user.following.length : 0,
            profileSong: user.profileSong || null,
            stats: user.stats || {},
            createdAt: user.createdAt
      };
};

const buildAuthProfilePayload = (user) => ({
      ...buildPublicProfilePayload(user),
      email: user.email,
      preferredFeedMode: user.preferredFeedMode,
      focusModeEnabled: user.focusModeEnabled,
      dailyUsageLimit: user.dailyUsageLimit,
      language: user.language,
      following: user.following || [],
      notificationSettings: user.notificationSettings || {},
      blockedUsers: user.blockedUsers || [],
      preferredContentTypes: user.preferredContentTypes || [],
      isPrivate: Boolean(user.isPrivate),
      profileVisibility: user.profileVisibility
});

const buildUploadedFileUrl = (file) => {
      if (!file) return '';
      if (file.path && /^https?:\/\//i.test(file.path)) return file.path;
      if (file.filename) return `/uploads/${file.filename}`;
      return '';
};

// @desc    Get user profile by MongoDB ID
// @route   GET /api/users/id/:id
// @access  Private
const getUserById = async (req, res) => {
      try {
            const user = await User.findById(req.params.id).select('username displayName avatar bio isVerified');
            if (!user) {
                  return res.status(404).json({ success: false, message: 'User not found' });
            }
            res.json({ success: true, data: { user } });
      } catch (error) {
            res.status(500).json({ success: false, message: 'Failed to get user', error: error.message });
      }
};

// @desc    Get user profile (public info)
// @route   GET /api/users/:username
// @access  Public
const getUserProfile = async (req, res) => {
      try {
            const user = await User.findOne({ username: req.params.username })
                  .select(req.user ? PRIVATE_PROFILE_SELECT : PUBLIC_PROFILE_SELECT)
                  .lean();

            if (!user) {
                  return res.status(404).json({
                        success: false,
                        message: 'User not found'
                  });
            }

            const isOwnProfile = Boolean(
                  req.user?._id && user._id && req.user._id.toString() === user._id.toString()
            );

            if (!isOwnProfile && req.user) {
                  const blockedByMe = req.user.blockedUsers || [];
                  const isBlockedByMe = blockedByMe.some((id) => id?.toString() === user._id.toString());
                  const hasBlockedMe = (user.blockedUsers || []).some((id) => id?.toString() === req.user.id.toString());

                  if (isBlockedByMe || hasBlockedMe) {
                        return res.status(404).json({
                              success: false,
                              message: 'User not found'
                        });
                  }
            }

            const responseUser = isOwnProfile
                  ? buildAuthProfilePayload(user)
                  : buildPublicProfilePayload(user);

            res.setHeader('Vary', 'Authorization');
            res.setHeader(
                  'Cache-Control',
                  isOwnProfile ? 'private, no-store' : 'public, max-age=60'
            );

            res.json({
                  success: true,
                  data: {
                        user: responseUser
                  }
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
                  'profileVisibility', 'isPrivate', 'notificationSettings',
                  'profileSong'
            ];

            const updates = {};
            const changedFields = [];
            for (const key of allowedUpdates) {
                  if (req.body[key] !== undefined) {
                        updates[key] = req.body[key];
                        changedFields.push(key);
                  }
            }

            const user = await User.findByIdAndUpdate(
                  req.user.id,
                  updates,
                  { new: true, runValidators: true }
            );

            // Fetch the full user to get email for notification
            const fullUser = await User.findById(req.user.id).select('email displayName username');

            // Send profile update email (fire-and-forget)
            if (changedFields.length > 0 && fullUser && fullUser.email) {
                  sendProfileUpdateEmail(
                        fullUser.email,
                        fullUser.displayName || fullUser.username,
                        changedFields
                  ).catch((err) => {
                        console.error('[User] Background profile update email failed:', err);
                  });
            }

            res.json({
                  success: true,
                  message: 'Profile updated successfully',
                  data: { user: user.getAuthProfile() }
            });
      } catch (error) {
            res.status(500).json({
                  success: false,
                  message: 'Failed to update profile',
                  error: error.message
            });
      }
};

// @desc    Upload user profile avatar
// @route   POST /api/users/profile/avatar
// @access  Private
const uploadProfileAvatar = async (req, res) => {
      try {
            if (!req.file) {
                  return res.status(400).json({
                        success: false,
                        message: 'Avatar file is required'
                  });
            }

            if (req.file.mimetype && !req.file.mimetype.startsWith('image/')) {
                  return res.status(400).json({
                        success: false,
                        message: 'Only image files are allowed for profile photos'
                  });
            }

            const avatar = buildUploadedFileUrl(req.file);
            if (!avatar) {
                  return res.status(400).json({
                        success: false,
                        message: 'Could not process the uploaded avatar'
                  });
            }

            const user = await User.findByIdAndUpdate(
                  req.user.id,
                  { avatar },
                  { new: true, runValidators: true }
            );

            res.json({
                  success: true,
                  message: 'Profile photo updated successfully',
                  data: { user: user.getAuthProfile() }
            });
      } catch (error) {
            res.status(500).json({
                  success: false,
                  message: 'Failed to upload profile photo',
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
                        ? 'Focus mode enabled. Enjoy peaceful browsing.'
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

                  // Notify the private user about a new follow request
                  const receiverSocketId = getReceiverSocketId(req.params.id);
                  if (receiverSocketId) {
                        io.to(receiverSocketId).emit("newFollowRequest", {
                              sender: {
                                    _id: req.user.id,
                                    username: currentUser.username,
                                    displayName: currentUser.displayName,
                                    avatar: currentUser.avatar
                              }
                        });
                  }

                  return res.json({
                        success: true,
                        message: "Follow request sent",
                        status: "requested",
                        data: {
                              isFollowing: false,
                              isRequested: true,
                              followersCount: userToFollow.followers.length,
                              followingCount: currentUser.following.length
                        }
                  });
            } else {
                  await Promise.all([
                        currentUser.updateOne({ $push: { following: req.params.id } }),
                        userToFollow.updateOne({ $push: { followers: req.user.id } })
                  ]);

                  // Notify the user about a new follower
                  const receiverSocketId = getReceiverSocketId(req.params.id);
                  if (receiverSocketId) {
                        io.to(receiverSocketId).emit("newFollow", {
                              sender: {
                                    _id: req.user.id,
                                    username: currentUser.username,
                                    displayName: currentUser.displayName,
                                    avatar: currentUser.avatar
                              }
                        });
                  }

                  return res.json({
                        success: true,
                        message: "User followed",
                        status: "following",
                        data: {
                              isFollowing: true,
                              isRequested: false,
                              followersCount: userToFollow.followers.length + 1,
                              followingCount: currentUser.following.length + 1
                        }
                  });
            }
      } catch (error) {
            console.error('followUser error:', error.message, error.stack);
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
                  await Promise.all([
                        currentUser.updateOne({ $pull: { following: req.params.id } }),
                        userToUnfollow.updateOne({ $pull: { followers: req.user.id } })
                  ]);
                  res.json({
                        success: true,
                        message: "User unfollowed",
                        data: {
                              isFollowing: false,
                              isRequested: false,
                              followersCount: Math.max(0, userToUnfollow.followers.length - 1),
                              followingCount: Math.max(0, currentUser.following.length - 1)
                        }
                  });
            } else if (userToUnfollow.followRequests.includes(req.user.id)) {
                  // Check if there was a pending request and remove it
                  await userToUnfollow.updateOne({ $pull: { followRequests: req.user.id } });
                  res.json({
                        success: true,
                        message: "Follow request cancelled",
                        data: {
                              isFollowing: false,
                              isRequested: false,
                              followersCount: userToUnfollow.followers.length,
                              followingCount: currentUser.following.length
                        }
                  });
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

            // Notify user that their request was accepted
            const { getReceiverSocketId, io } = require('../socket/socket');
            const receiverSocketId = getReceiverSocketId(req.params.id);
            if (receiverSocketId) {
                  io.to(receiverSocketId).emit("followAccepted", {
                        sender: {
                              _id: req.user.id,
                              username: currentUser.username,
                              displayName: currentUser.displayName,
                              avatar: currentUser.avatar
                        }
                  });
            }

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

// @desc    Unblock a user
// @route   POST /api/users/:id/unblock
// @access  Private
const unblockUser = async (req, res) => {
      try {
            const userIdToUnblock = req.params.id;
            const currentUser = await User.findById(req.user.id);

            if (!currentUser) {
                  return res.status(404).json({ success: false, message: "Current user not found" });
            }

            if (!currentUser.blockedUsers.includes(userIdToUnblock)) {
                  return res.status(400).json({ success: false, message: "User is not blocked" });
            }

            await currentUser.updateOne({ $pull: { blockedUsers: userIdToUnblock } });

            res.json({ success: true, message: "User unblocked successfully" });
      } catch (error) {
            res.status(500).json({ success: false, message: "Failed to unblock user", error: error.message });
      }
};

// @desc    Get followers list
// @route   GET /api/users/:username/followers
// @access  Public
const getFollowers = async (req, res) => {
      try {
            const user = await User.findOne({ username: req.params.username })
                  .populate('followers', 'username displayName avatar bio isVerified');

            if (!user) {
                  return res.status(404).json({ success: false, message: 'User not found' });
            }

            res.json({
                  success: true,
                  data: {
                        followers: user.followers || [],
                        count: user.followers ? user.followers.length : 0
                  }
            });
      } catch (error) {
            res.status(500).json({ success: false, message: 'Failed to get followers', error: error.message });
      }
};

// @desc    Get following list
// @route   GET /api/users/:username/following
// @access  Public
const getFollowing = async (req, res) => {
      try {
            const user = await User.findOne({ username: req.params.username })
                  .populate('following', 'username displayName avatar bio isVerified');

            if (!user) {
                  return res.status(404).json({ success: false, message: 'User not found' });
            }

            res.json({
                  success: true,
                  data: {
                        following: user.following || [],
                        count: user.following ? user.following.length : 0
                  }
            });
      } catch (error) {
            res.status(500).json({ success: false, message: 'Failed to get following', error: error.message });
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

// @desc    Get close friends list
// @route   GET /api/users/close-friends
// @access  Private
const getCloseFriends = async (req, res) => {
      try {
            const user = await User.findById(req.user.id)
                  .populate('closeFriends', 'username displayName avatar bio isVerified');

            res.json({
                  success: true,
                  data: {
                        closeFriends: user.closeFriends || [],
                        count: user.closeFriends ? user.closeFriends.length : 0
                  }
            });
      } catch (error) {
            res.status(500).json({ success: false, message: 'Failed to get close friends', error: error.message });
      }
};

// @desc    Add a user to close friends
// @route   POST /api/users/close-friends/:id
// @access  Private
const addCloseFriend = async (req, res) => {
      try {
            if (req.user.id === req.params.id) {
                  return res.status(400).json({ success: false, message: "You cannot add yourself as a close friend" });
            }

            const userToAdd = await User.findById(req.params.id);
            const currentUser = await User.findById(req.user.id);

            if (!userToAdd) {
                  return res.status(404).json({ success: false, message: "User not found" });
            }

            if (currentUser.closeFriends && currentUser.closeFriends.includes(req.params.id)) {
                  return res.status(400).json({ success: false, message: "User is already in your close friends" });
            }

            await currentUser.updateOne({ $push: { closeFriends: req.params.id } });

            res.json({
                  success: true,
                  message: "Added to close friends",
                  data: { userId: req.params.id }
            });
      } catch (error) {
            res.status(500).json({ success: false, message: "Failed to add close friend", error: error.message });
      }
};

// @desc    Remove a user from close friends
// @route   DELETE /api/users/close-friends/:id
// @access  Private
const removeCloseFriend = async (req, res) => {
      try {
            const currentUser = await User.findById(req.user.id);

            if (!currentUser.closeFriends || !currentUser.closeFriends.includes(req.params.id)) {
                  return res.status(400).json({ success: false, message: "User is not in your close friends" });
            }

            await currentUser.updateOne({ $pull: { closeFriends: req.params.id } });

            res.json({
                  success: true,
                  message: "Removed from close friends",
                  data: { userId: req.params.id }
            });
      } catch (error) {
            res.status(500).json({ success: false, message: "Failed to remove close friend", error: error.message });
      }
};

// @desc    Search users
// @route   GET /api/users/search
// @access  Private
const searchUsers = async (req, res) => {
      try {
            const { q } = req.query;

            if (!q || q.length < 2) {
                  return res.status(400).json({
                        success: false,
                        message: 'Search query must be at least 2 characters'
                  });
            }

            let users;
            // First attempt to use text search for ultra-fast lookup (if index exists)
            try {
                  users = await User.find({
                        $and: [
                              { _id: { $ne: req.user.id } },
                              { $text: { $search: q } }
                        ]
                  }, { score: { $meta: "textScore" } })
                        .sort({ score: { $meta: "textScore" } })
                        .select('username displayName avatar bio isVerified')
                        .limit(10)
                        .lean();
            } catch (err) {
                  // Fallback to regex if index is not yet built, but optimize by anchoring to start or using faster options
                  users = await User.find({
                        $and: [
                              { _id: { $ne: req.user.id } },
                              {
                                    $or: [
                                          { username: { $regex: q, $options: 'i' } },
                                          { displayName: { $regex: q, $options: 'i' } }
                                    ]
                              }
                        ]
                  })
                        .select('username displayName avatar bio isVerified')
                        .limit(10)
                        .lean();
            }

            res.json({
                  success: true,
                  data: { users }
            });
      } catch (error) {
            res.status(500).json({ success: false, message: 'Search failed', error: error.message });
      }
};

// @desc    Delete user account
// @route   DELETE /api/users/account
// @access  Private
const deleteAccount = async (req, res) => {
      try {
            const Content = require('../models/Content');
            const Comment = require('../models/Comment');

            const userId = req.user.id;

            // Delete user's content (posts/videos)
            await Content.deleteMany({ creator: userId });

            // Delete user's comments
            await Comment.deleteMany({ user: userId });

            // Additionally remove from followers/following of others (optional, robust cleanup)
            await User.updateMany(
                  { $or: [{ followers: userId }, { following: userId }, { closeFriends: userId }] },
                  { $pull: { followers: userId, following: userId, closeFriends: userId } }
            );

            // Finally, delete the user themselves
            await User.findByIdAndDelete(userId);

            res.json({
                  success: true,
                  message: 'Account deleted successfully'
            });
      } catch (error) {
            res.status(500).json({
                  success: false,
                  message: 'Failed to delete account',
                  error: error.message
            });
      }
};

// @desc    Block a user
// @route   POST /api/users/:id/block
// @access  Private
const blockUser = async (req, res) => {
      try {
            const userIdToBlock = req.params.id;
            if (req.user.id === userIdToBlock) {
                  return res.status(400).json({ success: false, message: "You cannot block yourself" });
            }

            const currentUser = await User.findById(req.user.id);
            const userToBlock = await User.findById(userIdToBlock);

            if (!userToBlock) {
                  return res.status(404).json({ success: false, message: "User not found" });
            }

            if (currentUser.blockedUsers.includes(userIdToBlock)) {
                  return res.status(400).json({ success: false, message: "User is already blocked" });
            }

            // Block user and clean up social connections
            await currentUser.updateOne({
                  $push: { blockedUsers: userIdToBlock },
                  $pull: {
                        following: userIdToBlock,
                        followers: userIdToBlock,
                        closeFriends: userIdToBlock
                  }
            });

            // Also remove the blocker from the blocked user's lists
            await userToBlock.updateOne({
                  $pull: {
                        following: req.user.id,
                        followers: req.user.id,
                        closeFriends: req.user.id
                  }
            });

            res.json({ success: true, message: "User blocked successfully" });
      } catch (error) {
            res.status(500).json({ success: false, message: "Failed to block user", error: error.message });
      }
};

// @desc    Get blocked users list
// @route   GET /api/users/blocked
// @access  Private
const getBlockedUsers = async (req, res) => {
      try {
            const user = await User.findById(req.user.id).populate('blockedUsers', 'username displayName avatar bio isVerified');
            res.json({
                  success: true,
                  data: { blockedUsers: user.blockedUsers || [] }
            });
      } catch (error) {
            res.status(500).json({ success: false, message: 'Failed to get blocked users', error: error.message });
      }
};

// @desc    Request blue tick verification
// @route   POST /api/users/request-verification
// @access  Private
const requestVerification = async (req, res) => {
      try {
            const { reason } = req.body;
            const user = await User.findById(req.user.id);
            if (!user) return res.status(404).json({ success: false, message: 'User not found' });
            if (user.isVerified) return res.status(400).json({ success: false, message: 'You are already verified!' });
            if (user.verificationRequest?.status === 'pending') {
                  return res.status(400).json({ success: false, message: 'You already have a pending verification request.' });
            }
            user.verificationRequest = {
                  status: 'pending',
                  reason: reason || '',
                  requestedAt: new Date()
            };
            await user.save();
            res.json({ success: true, message: 'Verification request submitted. Admin will review it soon.' });
      } catch (error) {
            res.status(500).json({ success: false, message: 'Failed to submit request', error: error.message });
      }
};

module.exports = {
      getUserById,
      getUserProfile,
      updateProfile,
      uploadProfileAvatar,
      updateInterests,
      updateFeedPreferences,
      toggleFocusMode,
      followUser,
      unfollowUser,
      acceptFollowRequest,
      rejectFollowRequest,
      getFollowRequests,
      getFollowers,
      getFollowing,
      getCloseFriends,
      addCloseFriend,
      removeCloseFriend,
      searchUsers,
      deleteAccount,
      blockUser,
      unblockUser,
      getBlockedUsers,
      requestVerification
};
