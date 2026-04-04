const Content = require('../models/Content');
const User = require('../models/User');

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

            // Build query based on mode
            let query = {
                  status: 'published',
                  visibility: 'public',
                  isApproved: true,
                  // Exclude expired content only if expiresAt is set AND in the past
                  $or: [
                        { expiresAt: null },
                        { expiresAt: { $exists: false } },
                        { expiresAt: { $gt: new Date() } }
                  ]
            };

            // Mode-specific filtering
            switch (mode) {
                  case 'all':
                        // Show ALL published public content - exclude stories/statuses (they go to Status page)
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
                        // Only show video types (already excludes story/status by being explicit)
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
            if (contentType) {
                  query.contentType = contentType;
            }
            if (topic) {
                  query.topics = topic;
            }

            // If user is logged in, personalized filtering (including blocks)
            if (req.user) {
                  const currentUser = await User.findById(req.user.id).select('blockedUsers').lean();
                  if (currentUser) {
                        const blockedByMe = currentUser.blockedUsers || [];
                        
                        // Optimized approach: Combine both directions of blocks into one $nin query
                        // This prevents showing content from people I blocked AND people who blocked me
                        const whoBlockedMe = await User.find({ blockedUsers: req.user.id }).select('_id').lean();
                        const blockedMeIds = whoBlockedMe.map(u => u._id);
                        
                        const allBlockedIds = [...new Set([...blockedByMe, ...blockedMeIds])];
                        
                        if (allBlockedIds.length > 0) {
                              query.creator = { $nin: allBlockedIds };
                        }
                  }
            }

            // Sort by quality score (based on helpfulness, not views/likes)
            let sortOptions = { createdAt: -1, qualityScore: -1 };

            // If user has interests, we could prioritize, but for now show all public content (sabhi user ka content)
            // if (userInterests.length > 0) {
            //       query.topics = { $in: userInterests };
            // }

            const contents = await Content.find(query)
                  .populate('creator', 'username displayName avatar role')
                  .sort(sortOptions)
                  .skip((page - 1) * limit)
                  .limit(parseInt(limit))
                  .lean();

            // Remove metrics if silentMode is on for each content
            const processedContents = contents.map(c => {
                  const content = { ...c };
                  if (content.silentMode) {
                        delete content.metrics;
                  }
                  return content;
            });

            const total = await Content.countDocuments(query);

            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');

            res.json({
                  success: true,
                  data: {
                        contents: processedContents,
                        mode,
                        pagination: {
                              page: parseInt(page),
                              limit: parseInt(limit),
                              total,
                              pages: Math.ceil(total / limit),
                              hasMore: page * limit < total
                        }
                  }
            });
      } catch (error) {
            res.status(500).json({
                  success: false,
                  message: 'Failed to get feed',
                  error: error.message
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

            const query = {
                  status: 'published',
                  visibility: 'public',
                  isApproved: true,
                  topics: topic,
                  contentType: { $nin: ['story', 'status', 'text-status'] },
                  $or: [
                        { expiresAt: null },
                        { expiresAt: { $exists: false } },
                        { expiresAt: { $gt: new Date() } }
                  ]
            };

            const contents = await Content.find(query)
                  .populate('creator', 'username displayName avatar role')
                  .sort({ qualityScore: -1, createdAt: -1 })
                  .skip((page - 1) * limit)
                  .limit(parseInt(limit))
                  .lean();

            const total = await Content.countDocuments(query);

            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');

            res.json({
                  success: true,
                  data: {
                        contents,
                        topic,
                        pagination: {
                              page: parseInt(page),
                              limit: parseInt(limit),
                              total,
                              pages: Math.ceil(total / limit)
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

            const creator = await User.findOne({ username });
            if (!creator) {
                  return res.status(404).json({
                        success: false,
                        message: 'Creator not found'
                  });
            }

            // Check if blocked (either direction)
            if (req.user) {
                  const currentUser = await User.findById(req.user.id).select('blockedUsers');
                  if (currentUser) {
                        const isBlockedByMe = currentUser.blockedUsers.includes(creator._id);
                        const hasBlockedMe = creator.blockedUsers && creator.blockedUsers.includes(req.user.id);

                        if (isBlockedByMe || hasBlockedMe) {
                              return res.status(404).json({
                                    success: false,
                                    message: 'User not found'
                              });
                        }
                  }
            }

            let query = {
                  creator: creator._id,
                  isApproved: true,
                  contentType: { $nin: ['story', 'status', 'text-status'] },
                  $or: [
                        { expiresAt: null },
                        { expiresAt: { $exists: false } },
                        { expiresAt: { $gt: new Date() } }
                  ]
            };

            // Only show public/published content if viewer is NOT the creator
            if (!req.user || req.user._id?.toString() !== creator._id.toString()) {
                  query.visibility = 'public';
                  query.status = 'published';
            }

            const contents = await Content.find(query)
                  .populate('creator', 'username displayName avatar role')
                  .select('creator contentType title body media purpose topics qualityScore createdAt expiresAt silentMode metrics')
                  .sort({ createdAt: -1 })
                  .skip((page - 1) * limit)
                  .limit(parseInt(limit))
                  .lean();

            const total = await Content.countDocuments(query);

            // No debug logs in production

            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');

            res.json({
                  success: true,
                  data: {
                        creator: creator.getPublicProfile(),
                        contents,
                        pagination: {
                              page: parseInt(page),
                              limit: parseInt(limit),
                              total,
                              pages: Math.ceil(total / limit)
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
                  $or: [
                        { title: { $regex: q, $options: 'i' } },
                        { body: { $regex: q, $options: 'i' } },
                        { tags: { $regex: q, $options: 'i' } }
                  ]
            };

            const contents = await Content.find(query)
                  .populate('creator', 'username displayName avatar role')
                  .sort({ qualityScore: -1, createdAt: -1 })
                  .skip((page - 1) * limit)
                  .limit(parseInt(limit))
                  .lean();

            const total = await Content.countDocuments(query);

            res.json({
                  success: true,
                  data: {
                        contents,
                        query: q,
                        pagination: {
                              page: parseInt(page),
                              limit: parseInt(limit),
                              total,
                              pages: Math.ceil(total / limit)
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
                  contentType: 'story',
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

            res.json({
                  success: true,
                  data: Object.values(groupedStories)
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
