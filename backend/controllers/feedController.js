const Content = require('../models/Content');
const User = require('../models/User');
const { decorateContentsForViewer } = require('../utils/contentPresentation');

// Simple in-memory cache for public feed (expires every 2 minutes)
let feedCache = {
      data: null,
      lastUpdated: 0,
      ttl: 3 * 60 * 1000 // 3 minutes — fewer cold DB hits for anonymous home
};

const FEED_CONTENT_SELECT = [
      'creator',
      'contentType',
      'title',
      'body',
      'media',
      'purpose',
      'topics',
      'qualityScore',
      'createdAt',
      'updatedAt',
      'expiresAt',
      'silentMode',
      'metrics.helpfulCount',
      'metrics.notUsefulCount',
      'metrics.viewCount',
      'metrics.saveCount',
      'metrics.shareCount',
      'metrics.commentCount',
      'music',
      'backgroundColor',
      'fontStyle',
      'textAlign',
      'liveData'
].join(' ');

const buildCreatorSummary = (creator) => ({
      _id: creator._id,
      id: creator._id,
      username: creator.username,
      displayName: creator.displayName || creator.username,
      avatar: creator.avatar || '',
      bio: creator.bio || '',
      role: creator.role,
      interests: creator.interests || [],
      isVerified: Boolean(creator.isVerified),
      verificationRequest: creator.verificationRequest
            ? {
                  status: creator.verificationRequest.status,
                  requestedAt: creator.verificationRequest.requestedAt
            }
            : null,
      followersCount: Array.isArray(creator.followers) ? creator.followers.length : 0,
      followingCount: Array.isArray(creator.following) ? creator.following.length : 0,
      profileSong: creator.profileSong || null,
      stats: creator.stats || {},
      createdAt: creator.createdAt
});

const toPositiveInt = (value, fallback) => {
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

// @desc    Get feed based on mode
// @route   GET /api/feed
// @access  Public/Private
const getFeed = async (req, res) => {
      try {
            const {
                  mode = 'all',
                  page = 1,
                  limit = 10,
                  contentType,
                  topic
            } = req.query;
            const pageNum = toPositiveInt(page, 1);
            const limitNum = toPositiveInt(limit, 10);

            // Use cache for public 'all' mode on first page
            const isPublicFirstPage = !req.user && mode === 'all' && pageNum === 1 && !contentType && !topic;
            if (isPublicFirstPage && feedCache.data && (Date.now() - feedCache.lastUpdated < feedCache.ttl)) {
                  return res.json(feedCache.data);
            }

            // Build query based on mode
            let query = {
                  status: 'published',
                  visibility: 'public',
                  isApproved: true
            };

            // Mode-specific filtering
            switch (mode) {
                  case 'all':
                        query.contentType = { $nin: ['story', 'status', 'text-status'] };
                        break;
                  case 'learning':
                        query.contentType = { $nin: ['story', 'status', 'text-status'] };
                        query.purpose = { $in: ['skill', 'explain', 'learning', 'solution'] };
                        break;
                  case 'calm':
                        query.contentType = { $nin: ['story', 'status', 'text-status'] };
                        query.purpose = { $in: ['inspiration', 'story', 'idea'] };
                        break;
                  case 'video':
                        query.contentType = { $in: ['short-video', 'long-video'] };
                        break;
                  case 'reading':
                        query.contentType = 'post';
                        break;
                  case 'problem-solving':
                        query.contentType = { $nin: ['story', 'status', 'text-status'] };
                        query.purpose = { $in: ['question', 'discussion', 'solution'] };
                        break;
                  default:
                        query.contentType = { $nin: ['story', 'status', 'text-status'] };
            }

            // Additional filters
            if (contentType) query.contentType = contentType;
            if (topic) query.topics = topic;

            // If user is logged in, personalized filtering (including blocks)
            if (req.user) {
                  const [currentUser, whoBlockedMe] = await Promise.all([
                        User.findById(req.user.id).select('blockedUsers').lean(),
                        User.find({ blockedUsers: req.user.id }).select('_id').lean()
                  ]);

                  if (currentUser) {
                        const blockedByMe = currentUser.blockedUsers || [];
                        const blockedMeIds = whoBlockedMe.map(u => u._id);

                        const allBlockedIds = [...new Set([...blockedByMe, ...blockedMeIds])];

                        if (allBlockedIds.length > 0) {
                              query.creator = { $nin: allBlockedIds };
                        }
                  }
            }

            // Sort options
            let sortOptions = { createdAt: -1, qualityScore: -1 };

            // Fetch content and pagination data together so the first screen returns sooner.
            const [contents, total] = await Promise.all([
                  Content.find(query)
                        .populate('creator', 'username displayName avatar role')
                        .select(FEED_CONTENT_SELECT)
                        .sort(sortOptions)
                        .skip((pageNum - 1) * limitNum)
                        .limit(limitNum)
                        .lean(),
                  Content.countDocuments(query)
            ]);
            const decoratedContents = await decorateContentsForViewer(contents, req.user?.id);

            // Process content (silentMode check)
            const processedContents = decoratedContents.map(c => {
                  if (c.silentMode) {
                        const { metrics, ...rest } = c;
                        return rest;
                  }
                  return c;
            });

            const responseData = {
                  success: true,
                  data: {
                        contents: processedContents,
                        mode,
                        pagination: {
                              page: pageNum,
                              limit: limitNum,
                              total,
                              pages: Math.ceil(total / limitNum),
                              hasMore: pageNum * limitNum < total
                        }
                  }
            };

            // Update cache if applicable
            if (isPublicFirstPage) {
                  feedCache = {
                        data: responseData,
                        lastUpdated: Date.now(),
                        ttl: 3 * 60 * 1000
                  };
            }

            // Standard caching for browser
            res.setHeader('Cache-Control', req.user ? 'private, max-age=45' : 'public, max-age=90');

            res.json(responseData);
      } catch (error) {
            console.error('[FeedController] Error:', error);
            res.status(500).json({
                  success: false,
                  message: 'Failed to get feed',
                  error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
      }
};

// @desc    Get feed by topic
// @route   GET /api/feed/topic/:topic
// @access  Public
const getFeedByTopic = async (req, res) => {
      try {
            const { topic } = req.params;
            const { page = 1, limit = 10 } = req.query;
            const pageNum = toPositiveInt(page, 1);
            const limitNum = toPositiveInt(limit, 10);

            const query = {
                  status: 'published',
                  visibility: 'public',
                  isApproved: true,
                  topics: topic,
                  contentType: { $nin: ['story', 'status', 'text-status'] }
            };

            const [contents, total] = await Promise.all([
                  Content.find(query)
                        .populate('creator', 'username displayName avatar role')
                        .select(FEED_CONTENT_SELECT)
                        .sort({ qualityScore: -1, createdAt: -1 })
                        .skip((pageNum - 1) * limitNum)
                        .limit(limitNum)
                        .lean(),
                  Content.countDocuments(query)
            ]);
            const decoratedContents = await decorateContentsForViewer(contents, req.user?.id);

            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');

            res.json({
                  success: true,
                  data: {
                        contents: decoratedContents,
                        topic,
                        pagination: {
                              page: pageNum,
                              limit: limitNum,
                              total,
                              pages: Math.ceil(total / limitNum)
                        }
                  }
            });
      } catch (error) {
            res.status(500).json({
                  success: false,
                  message: 'Failed to get topic feed',
                  error: error.message
            });
      }
};

// @desc    Get creator's public content
// @route   GET /api/feed/creator/:username
// @access  Public
const getCreatorFeed = async (req, res) => {
      try {
            const { username } = req.params;
            const { page = 1, limit = 10 } = req.query;
            const pageNum = toPositiveInt(page, 1);
            const limitNum = toPositiveInt(limit, 10);

            const creator = await User.findOne({ username })
                  .select([
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
                  ].join(' '))
                  .lean();
            if (!creator) {
                  return res.status(404).json({
                        success: false,
                        message: 'Creator not found'
                  });
            }

            // Check if blocked (either direction)
            if (req.user) {
                  const blockedByMe = req.user.blockedUsers || [];
                  const isBlockedByMe = blockedByMe.some((id) => id?.toString() === creator._id.toString());
                  const hasBlockedMe = (creator.blockedUsers || []).some((id) => id?.toString() === req.user.id.toString());

                  if (isBlockedByMe || hasBlockedMe) {
                        return res.status(404).json({
                              success: false,
                              message: 'User not found'
                        });
                  }
            }

            let query = {
                  creator: creator._id,
                  isApproved: true,
                  contentType: { $nin: ['story', 'status', 'text-status'] }
            };

            // Only show public/published content if viewer is NOT the creator
            if (!req.user || req.user._id?.toString() !== creator._id.toString()) {
                  query.visibility = 'public';
                  query.status = 'published';
            }

            const [contents, total] = await Promise.all([
                  Content.find(query)
                        .populate('creator', 'username displayName avatar role')
                        .select(FEED_CONTENT_SELECT)
                        .sort({ createdAt: -1 })
                        .skip((pageNum - 1) * limitNum)
                        .limit(limitNum)
                        .lean(),
                  Content.countDocuments(query)
            ]);
            const decoratedContents = await decorateContentsForViewer(contents, req.user?.id);

            // No debug logs in production

            const isOwnProfile = Boolean(req.user?._id && req.user._id.toString() === creator._id.toString());
            res.setHeader('Cache-Control', isOwnProfile ? 'private, no-store' : 'public, max-age=30');

            res.json({
                  success: true,
                  data: {
                        creator: buildCreatorSummary(creator),
                        contents: decoratedContents,
                        pagination: {
                              page: pageNum,
                              limit: limitNum,
                              total,
                              pages: Math.ceil(total / limitNum)
                        }
                  }
            });
      } catch (error) {
            res.status(500).json({
                  success: false,
                  message: 'Failed to get creator feed',
                  error: error.message
            });
      }
};

// @desc    Search content
// @route   GET /api/feed/search
// @access  Public
const searchContent = async (req, res) => {
      try {
            const { q, page = 1, limit = 10 } = req.query;
            const pageNum = toPositiveInt(page, 1);
            const limitNum = toPositiveInt(limit, 10);

            if (!q || q.trim().length < 2) {
                  return res.status(400).json({
                        success: false,
                        message: 'Search query must be at least 2 characters'
                  });
            }

            const query = {
                  status: 'published',
                  visibility: 'public',
                  isApproved: true,
                  contentType: { $nin: ['story', 'status', 'text-status'] },
                  $or: [
                        { title: { $regex: q, $options: 'i' } },
                        { body: { $regex: q, $options: 'i' } },
                        { tags: { $regex: q, $options: 'i' } }
                  ]
            };

            const [contents, total] = await Promise.all([
                  Content.find(query)
                        .populate('creator', 'username displayName avatar role')
                        .select(FEED_CONTENT_SELECT)
                        .sort({ qualityScore: -1, createdAt: -1 })
                        .skip((pageNum - 1) * limitNum)
                        .limit(limitNum)
                        .lean(),
                  Content.countDocuments(query)
            ]);
            const decoratedContents = await decorateContentsForViewer(contents, req.user?.id);

            res.json({
                  success: true,
                  data: {
                        contents: decoratedContents,
                        query: q,
                        pagination: {
                              page: pageNum,
                              limit: limitNum,
                              total,
                              pages: Math.ceil(total / limitNum)
                        }
                  }
            });
      } catch (error) {
            res.status(500).json({
                  success: false,
                  message: 'Search failed',
                  error: error.message
            });
      }
};

// @desc    Get active stories
// @route   GET /api/feed/stories
// @access  Public
const getActiveStories = async (req, res) => {
      try {
            const stories = await Content.find({
                  contentType: { $in: ['story', 'text-status'] },
                  expiresAt: { $gt: new Date() },
                  status: 'published',
                  visibility: 'public' // Respect privacy? For now public.
            })
                  .populate('creator', 'username displayName avatar isPrivate blockedUsers')
                  .sort({ createdAt: 1 })
                  .lean();

            // Filter out stories from blocked users
            let filteredStories = stories;
            if (req.user) {
                  const currentUser = await User.findById(req.user.id).select('blockedUsers');
                  const myBlocked = currentUser.blockedUsers.map(id => id.toString());

                  filteredStories = stories.filter(story => {
                        const creatorId = story.creator._id.toString();
                        const creatorBlockedMe = story.creator.blockedUsers && story.creator.blockedUsers.some(id => id.toString() === req.user.id);
                        return !myBlocked.includes(creatorId) && !creatorBlockedMe;
                  });
            }

            // Group by creator
            const groupedStories = {};
            for (const story of filteredStories) {
                  const creatorId = story.creator._id.toString();
                  if (!groupedStories[creatorId]) {
                        groupedStories[creatorId] = {
                              creator: story.creator,
                              stories: []
                        };
                  }

                  // If owner, populate viewedBy details
                  if (req.user && creatorId === req.user.id) {
                        // We need to re-fetch or populate manually since .lean() was used
                        // For simplicity, let's just make sure viewedBy is populated if it exists
                        // But since we used .lean(), we have to handle it carefully.
                        // Actually, let's just use .populate() in the initial query or here.
                  }
                  
                  groupedStories[creatorId].stories.push(story);
            }

            // After grouping, if req.user exists, batch-populate viewedBy for their own stories
            if (req.user) {
                  for (const group of Object.values(groupedStories)) {
                        if (group.creator._id.toString() === req.user.id) {
                              // Batch fetch all own stories with viewedBy populated in ONE query
                              const ownStoryIds = group.stories.map(s => s._id);
                              if (ownStoryIds.length > 0) {
                                    const populatedStories = await Content.find({ _id: { $in: ownStoryIds } })
                                          .populate('metrics.viewedBy', 'username displayName avatar')
                                          .lean();
                                    // Replace stories with populated versions
                                    const populatedMap = new Map(populatedStories.map(s => [s._id.toString(), s]));
                                    for (let i = 0; i < group.stories.length; i++) {
                                          const populated = populatedMap.get(group.stories[i]._id.toString());
                                          if (populated) group.stories[i] = populated;
                                    }
                              }
                        }
                  }
            }

            const groupedStoryList = Object.values(groupedStories).sort((left, right) => {
                  const leftLatest = left.stories[left.stories.length - 1]?.createdAt || 0;
                  const rightLatest = right.stories[right.stories.length - 1]?.createdAt || 0;
                  return new Date(rightLatest) - new Date(leftLatest);
            });

            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');

            res.json({
                  success: true,
                  data: groupedStoryList
            });
      } catch (error) {
            res.status(500).json({
                  success: false,
                  message: 'Failed to get stories',
                  error: error.message
            });
      }
};

module.exports = {
      getFeed,
      getFeedByTopic,
      getCreatorFeed,
      searchContent,
      getActiveStories
};
