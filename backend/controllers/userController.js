const mongoose = require('mongoose');
const User = require('../models/User');
const { sendProfileUpdateEmail } = require('../config/emailService');
const { createNotification } = require('../utils/notificationService');
const {
      CONTENT_EXCLUDED_TYPES,
      DEFAULT_PROFILE_LIMIT,
      MAX_PROFILE_LIMIT,
      buildContentEnrichmentStages,
      buildCursorMatch,
      buildUserProfileProjection,
      decodeCursor,
      toObjectId,
      toPositiveInt,
      unpackCursorPage
} = require('../utils/feedAggregation');

const buildPublicProfilePayload = (user) => {
      if (!user) return null;

      return {
            _id: user._id,
            id: user.id || user._id,
            username: user.username,
            displayName: user.displayName || user.username,
            avatar: user.avatar || '',
            bio: user.bio || '',
            role: user.role,
            interests: user.interests || [],
            isVerified: Boolean(user.isVerified),
            verificationRequest: user.verificationRequest || null,
            followersCount: Number(user.followersCount || 0),
            followingCount: Number(user.followingCount || 0),
            profileSong: user.profileSong || null,
            stats: user.stats || {},
            createdAt: user.createdAt,
            isFollowing: Boolean(user.isFollowing)
      };
};

const buildAuthProfilePayload = (user) => ({
      ...buildPublicProfilePayload(user),
      email: user.email,
      preferredFeedMode: user.preferredFeedMode,
      focusModeEnabled: Boolean(user.focusModeEnabled),
      dailyUsageLimit: Number(user.dailyUsageLimit || 0),
      language: user.language,
      following: user.following || [],
      notificationSettings: user.notificationSettings || {},
      blockedUsers: user.blockedUsers || [],
      preferredContentTypes: user.preferredContentTypes || [],
      isPrivate: Boolean(user.isPrivate),
      profileVisibility: user.profileVisibility
});

const getViewerId = (reqUser) => reqUser?._id || reqUser?.id || null;

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
            const userId = toObjectId(req.params.id);
            if (!userId) {
                  return res.status(400).json({ success: false, message: 'Invalid user id' });
            }

            const [user] = await User.aggregate([
                  { $match: { _id: userId } },
                  {
                        $project: {
                              _id: 1,
                              username: 1,
                              displayName: { $ifNull: ['$displayName', '$username'] },
                              avatar: { $ifNull: ['$avatar', ''] },
                              bio: { $ifNull: ['$bio', ''] },
                              isVerified: { $toBool: '$isVerified' }
                        }
                  }
            ]);

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
            const viewerId = getViewerId(req.user);
            const viewerObjectId = toObjectId(viewerId);
            const postsLimit = toPositiveInt(req.query.postsLimit || req.query.limit, DEFAULT_PROFILE_LIMIT, MAX_PROFILE_LIMIT);
            const postsCursor = decodeCursor(req.query.cursor || req.query.postsCursor);
            const viewerBlockedIds = (req.user?.blockedUsers || []).map((value) => toObjectId(value)).filter(Boolean);
            const viewerFollowingIds = req.user?.following || [];
            const viewerIsAdmin = req.user?.role === 'admin';

            const result = await User.aggregate([
                  { $match: { username: req.params.username } },
                  { $limit: 1 },
                  {
                        $addFields: {
                              isOwnProfile: viewerObjectId ? { $eq: ['$_id', viewerObjectId] } : false,
                              isFollower: viewerObjectId
                                    ? { $in: [viewerObjectId, { $ifNull: ['$followers', []] }] }
                                    : false,
                              blockedByViewer: { $in: ['$_id', viewerBlockedIds] },
                              hasBlockedViewer: viewerObjectId
                                    ? { $in: [viewerObjectId, { $ifNull: ['$blockedUsers', []] }] }
                                    : false
                        }
                  },
                  {
                        $match: {
                              blockedByViewer: false,
                              hasBlockedViewer: false
                        }
                  },
                  {
                        $facet: {
                              profile: [
                                    {
                                          $project: {
                                                ...buildUserProfileProjection({
                                                      includePrivate: true,
                                                      viewerFollowingIds
                                                }),
                                                isOwnProfile: '$isOwnProfile'
                                          }
                                    }
                              ],
                              contentPage: [
                                    {
                                          $lookup: {
                                                from: 'contents',
                                                let: {
                                                      profileUserId: '$_id',
                                                      isOwnProfile: '$isOwnProfile',
                                                      isFollower: '$isFollower',
                                                      profileIsPrivate: { $ifNull: ['$isPrivate', false] }
                                                },
                                                pipeline: [
                                                      {
                                                            $match: {
                                                                  $expr: {
                                                                        $and: [
                                                                              { $eq: ['$creator', '$$profileUserId'] },
                                                                              { $eq: ['$isApproved', true] },
                                                                              { $not: [{ $in: ['$contentType', CONTENT_EXCLUDED_TYPES] }] },
                                                                              {
                                                                                    $or: [
                                                                                          '$$isOwnProfile',
                                                                                          viewerIsAdmin,
                                                                                          '$$isFollower',
                                                                                          {
                                                                                                $and: [
                                                                                                      { $eq: ['$$profileIsPrivate', false] },
                                                                                                      { $eq: ['$visibility', 'public'] },
                                                                                                      { $eq: ['$status', 'published'] }
                                                                                                ]
                                                                                          }
                                                                                    ]
                                                                              }
                                                                        ]
                                                                  }
                                                            }
                                                      },
                                                      ...(buildCursorMatch(postsCursor) ? [{ $match: buildCursorMatch(postsCursor) }] : []),
                                                      { $sort: { createdAt: -1, _id: -1 } },
                                                      { $limit: postsLimit + 1 },
                                                      ...buildContentEnrichmentStages({ viewerId })
                                                ],
                                                as: 'contents'
                                          }
                                    },
                                    {
                                          $project: {
                                                contents: '$contents'
                                          }
                                    }
                              ]
                        }
                  }
            ]);

            const profile = result?.[0]?.profile?.[0];
            if (!profile) {
                  return res.status(404).json({
                        success: false,
                        message: 'User not found'
                  });
            }

            const { items, hasMore, nextCursor } = unpackCursorPage(
                  result?.[0]?.contentPage?.[0]?.contents || [],
                  postsLimit
            );

            const isOwnProfile = Boolean(profile.isOwnProfile);
            const responseUser = isOwnProfile
                  ? buildAuthProfilePayload(profile)
                  : buildPublicProfilePayload(profile);

            res.setHeader('Vary', 'Authorization');
            res.setHeader(
                  'Cache-Control',
                  isOwnProfile ? 'private, no-store' : 'public, max-age=60'
            );

            res.json({
                  success: true,
                  data: {
                        user: responseUser,
                        contents: items,
                        pagination: {
                              limit: postsLimit,
                              hasMore,
                              nextCursor
                        }
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

                  await createNotification({
                        recipientId: req.params.id,
                        actor: currentUser,
                        type: 'follow_request',
                        title: 'New follow request',
                        body: `${currentUser.displayName || currentUser.username} wants to follow you.`,
                        entityType: 'request',
                        entityId: currentUser._id,
                        metadata: {
                              username: currentUser.username
                        }
                  });

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

                  await createNotification({
                        recipientId: req.params.id,
                        actor: currentUser,
                        type: 'follow',
                        title: 'New follower',
                        body: `${currentUser.displayName || currentUser.username} started following you.`,
                        entityType: 'user',
                        entityId: currentUser._id,
                        metadata: {
                              username: currentUser.username
                        }
                  });

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

                  await createNotification({
                        recipientId: req.params.id,
                        actor: currentUser,
                        type: 'unfollow',
                        title: 'Follower removed',
                        body: `${currentUser.displayName || currentUser.username} unfollowed you.`,
                        entityType: 'user',
                        entityId: currentUser._id,
                        metadata: {
                              username: currentUser.username
                        }
                  });

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

                  await createNotification({
                        recipientId: req.params.id,
                        actor: currentUser,
                        type: 'unfollow',
                        title: 'Follow request cancelled',
                        body: `${currentUser.displayName || currentUser.username} cancelled the follow request.`,
                        entityType: 'request',
                        entityId: currentUser._id,
                        metadata: {
                              username: currentUser.username
                        }
                  });

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

            await createNotification({
                  recipientId: req.params.id,
                  actor: currentUser,
                  type: 'follow_request_accepted',
                  title: 'Follow request accepted',
                  body: `${currentUser.displayName || currentUser.username} accepted your follow request.`,
                  entityType: 'user',
                  entityId: currentUser._id,
                  metadata: {
                        username: currentUser.username
                  }
            });

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
            const requester = await User.findById(req.params.id).select('username displayName avatar');
            if (!currentUser.followRequests.includes(req.params.id)) {
                  return res.status(400).json({ success: false, message: "No request from this user" });
            }

            await currentUser.updateOne({ $pull: { followRequests: req.params.id } });

            if (requester) {
                  await createNotification({
                        recipientId: requester._id,
                        actor: currentUser,
                        type: 'follow_request_rejected',
                        title: 'Follow request declined',
                        body: `${currentUser.displayName || currentUser.username} declined your follow request.`,
                        entityType: 'user',
                        entityId: currentUser._id,
                        metadata: {
                              username: currentUser.username
                        }
                  });
            }

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

            if (!currentUser.blockedUsers.some((id) => id?.toString() === userIdToUnblock)) {
                  return res.status(400).json({ success: false, message: "User is not blocked" });
            }

            const updatedUser = await User.findByIdAndUpdate(
                  req.user.id,
                  { $pull: { blockedUsers: userIdToUnblock } },
                  { new: true, runValidators: true }
            );

            res.json({
                  success: true,
                  message: "User unblocked successfully",
                  data: { user: updatedUser.getAuthProfile() }
            });
      } catch (error) {
            res.status(500).json({ success: false, message: "Failed to unblock user", error: error.message });
      }
};

const aggregateRelatedUsers = async (username, relationField, responseKey) => {
      const relationPath = `$${relationField}`;
      const [result] = await User.aggregate([
            { $match: { username } },
            {
                  $project: {
                        relatedIds: { $ifNull: [relationPath, []] }
                  }
            },
            {
                  $lookup: {
                        from: 'users',
                        let: { relatedIds: '$relatedIds' },
                        pipeline: [
                              {
                                    $match: {
                                          $expr: { $in: ['$_id', '$$relatedIds'] }
                                    }
                              },
                              {
                                    $project: {
                                          _id: 1,
                                          username: 1,
                                          displayName: { $ifNull: ['$displayName', '$username'] },
                                          avatar: { $ifNull: ['$avatar', ''] },
                                          bio: { $ifNull: ['$bio', ''] },
                                          isVerified: { $toBool: '$isVerified' }
                                    }
                              }
                        ],
                        as: responseKey
                  }
            },
            {
                  $project: {
                        [responseKey]: 1,
                        count: { $size: '$relatedIds' }
                  }
            }
      ]);

      return result || null;
};

// @desc    Get followers list
// @route   GET /api/users/:username/followers
// @access  Public
const getFollowers = async (req, res) => {
      try {
            const result = await aggregateRelatedUsers(req.params.username, 'followers', 'followers');

            if (!result) {
                  return res.status(404).json({ success: false, message: 'User not found' });
            }

            res.json({
                  success: true,
                  data: {
                        followers: result.followers || [],
                        count: result.count || 0
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
            const result = await aggregateRelatedUsers(req.params.username, 'following', 'following');

            if (!result) {
                  return res.status(404).json({ success: false, message: 'User not found' });
            }

            res.json({
                  success: true,
                  data: {
                        following: result.following || [],
                        count: result.count || 0
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
            const [result] = await User.aggregate([
                  { $match: { _id: new mongoose.Types.ObjectId(req.user.id) } },
                  {
                        $project: {
                              followRequests: { $ifNull: ['$followRequests', []] }
                        }
                  },
                  {
                        $lookup: {
                              from: 'users',
                              let: { requestIds: '$followRequests' },
                              pipeline: [
                                    {
                                          $match: {
                                                $expr: { $in: ['$_id', '$$requestIds'] }
                                          }
                                    },
                                    {
                                          $project: {
                                                _id: 1,
                                                username: 1,
                                                displayName: { $ifNull: ['$displayName', '$username'] },
                                                avatar: { $ifNull: ['$avatar', ''] }
                                          }
                                    }
                              ],
                              as: 'requests'
                        }
                  }
            ]);

            res.json({ success: true, data: { requests: result?.requests || [] } });
      } catch (error) {
            res.status(500).json({ success: false, message: "Failed to get requests", error: error.message });
      }
};

// @desc    Get close friends list
// @route   GET /api/users/close-friends
// @access  Private
const getCloseFriends = async (req, res) => {
      try {
            const [result] = await User.aggregate([
                  { $match: { _id: new mongoose.Types.ObjectId(req.user.id) } },
                  {
                        $project: {
                              closeFriends: { $ifNull: ['$closeFriends', []] }
                        }
                  },
                  {
                        $lookup: {
                              from: 'users',
                              let: { closeFriendIds: '$closeFriends' },
                              pipeline: [
                                    {
                                          $match: {
                                                $expr: { $in: ['$_id', '$$closeFriendIds'] }
                                          }
                                    },
                                    {
                                          $project: {
                                                _id: 1,
                                                username: 1,
                                                displayName: { $ifNull: ['$displayName', '$username'] },
                                                avatar: { $ifNull: ['$avatar', ''] },
                                                bio: { $ifNull: ['$bio', ''] },
                                                isVerified: { $toBool: '$isVerified' }
                                          }
                                    }
                              ],
                              as: 'closeFriendsData'
                        }
                  },
                  {
                        $project: {
                              closeFriends: '$closeFriendsData',
                              count: { $size: '$closeFriends' }
                        }
                  }
            ]);

            res.json({
                  success: true,
                  data: {
                        closeFriends: result?.closeFriends || [],
                        count: result?.count || 0
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
            const q = String(req.query.q || '').trim();

            if (q.length < 2) {
                  return res.status(400).json({
                        success: false,
                        message: 'Search query must be at least 2 characters'
                  });
            }

            let users;
            const selfId = new mongoose.Types.ObjectId(req.user.id);

            try {
                  users = await User.aggregate([
                        {
                              $match: {
                                    _id: { $ne: selfId },
                                    $text: { $search: q }
                              }
                        },
                        {
                              $project: {
                                    score: { $meta: 'textScore' },
                                    _id: 1,
                                    username: 1,
                                    displayName: { $ifNull: ['$displayName', '$username'] },
                                    avatar: { $ifNull: ['$avatar', ''] },
                                    bio: { $ifNull: ['$bio', ''] },
                                    isVerified: { $toBool: '$isVerified' }
                              }
                        },
                        { $sort: { score: -1, username: 1 } },
                        { $limit: 10 }
                  ]);
            } catch (err) {
                  users = await User.aggregate([
                        {
                              $match: {
                                    _id: { $ne: selfId },
                                    $or: [
                                          { username: { $regex: q, $options: 'i' } },
                                          { displayName: { $regex: q, $options: 'i' } }
                                    ]
                              }
                        },
                        {
                              $project: {
                                    _id: 1,
                                    username: 1,
                                    displayName: { $ifNull: ['$displayName', '$username'] },
                                    avatar: { $ifNull: ['$avatar', ''] },
                                    bio: { $ifNull: ['$bio', ''] },
                                    isVerified: { $toBool: '$isVerified' }
                              }
                        },
                        { $sort: { username: 1 } },
                        { $limit: 10 }
                  ]);
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

            if (!currentUser) {
                  return res.status(404).json({ success: false, message: "Current user not found" });
            }

            if (!userToBlock) {
                  return res.status(404).json({ success: false, message: "User not found" });
            }

            if (currentUser.blockedUsers.some((id) => id?.toString() === userIdToBlock)) {
                  return res.status(400).json({ success: false, message: "User is already blocked" });
            }

            // Block user and clean up social connections
            const updatedCurrentUserPromise = User.findByIdAndUpdate(req.user.id, {
                  $addToSet: { blockedUsers: userIdToBlock },
                  $pull: {
                        following: userIdToBlock,
                        followers: userIdToBlock,
                        closeFriends: userIdToBlock
                  }
            }, { new: true, runValidators: true });

            // Also remove the blocker from the blocked user's lists
            const updateBlockedUserPromise = userToBlock.updateOne({
                  $pull: {
                        following: req.user.id,
                        followers: req.user.id,
                        closeFriends: req.user.id
                  }
            });

            const [updatedCurrentUser] = await Promise.all([
                  updatedCurrentUserPromise,
                  updateBlockedUserPromise
            ]);

            res.json({
                  success: true,
                  message: "User blocked successfully",
                  data: { user: updatedCurrentUser.getAuthProfile() }
            });
      } catch (error) {
            res.status(500).json({ success: false, message: "Failed to block user", error: error.message });
      }
};

// @desc    Get blocked users list
// @route   GET /api/users/blocked
// @access  Private
const getBlockedUsers = async (req, res) => {
      try {
            const [user] = await User.aggregate([
                  { $match: { _id: new mongoose.Types.ObjectId(req.user.id) } },
                  {
                        $project: {
                              blockedUsers: { $ifNull: ['$blockedUsers', []] }
                        }
                  },
                  {
                        $lookup: {
                              from: 'users',
                              let: { blockedIds: '$blockedUsers' },
                              pipeline: [
                                    {
                                          $match: {
                                                $expr: { $in: ['$_id', '$$blockedIds'] }
                                          }
                                    },
                                    {
                                          $project: {
                                                _id: 1,
                                                username: 1,
                                                displayName: { $ifNull: ['$displayName', '$username'] },
                                                avatar: { $ifNull: ['$avatar', ''] },
                                                bio: { $ifNull: ['$bio', ''] },
                                                isVerified: { $toBool: '$isVerified' }
                                          }
                                    }
                              ],
                              as: 'blockedUsersData'
                        }
                  },
                  {
                        $project: {
                              blockedUsers: '$blockedUsersData'
                        }
                  }
            ]);
            res.json({
                  success: true,
                  data: { blockedUsers: user?.blockedUsers || [] }
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
