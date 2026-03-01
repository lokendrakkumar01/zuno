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
                  isApproved: true
            };

            // Mode-specific filtering
            switch (mode) {
                  case 'all':
                        // Show ALL published public content - no purpose/type filter
                        break;
                  case 'learning':
                        query.purpose = { $in: ['skill', 'explain', 'learning', 'solution'] };
                        break;
                  case 'calm':
                        query.purpose = { $in: ['inspiration', 'story', 'idea'] };
                        break;
                  case 'video':
                        query.contentType = { $in: ['short-video', 'long-video'] };
                        break;
                  case 'reading':
                        query.contentType = 'post';
                        break;
                  case 'problem-solving':
                        query.purpose = { $in: ['question', 'discussion', 'solution'] };
                        break;
            }

            // Additional filters
            if (contentType) {
                  query.contentType = contentType;
            }
            if (topic) {
                  query.topics = topic;
            }

            // If user is logged in, personalize based on interests
            let userInterests = [];
            if (req.user) {
                  const user = await User.findById(req.user.id);
                  userInterests = user.interests || [];
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
                  .limit(parseInt(limit));

            // Remove metrics if silentMode is on for each content
            const processedContents = contents.map(c => {
                  const content = c.toObject();
                  if (content.silentMode) {
                        delete content.metrics;
                  }
                  return content;
            });

            const total = await Content.countDocuments(query);

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
                  topics: topic
            };

            const contents = await Content.find(query)
                  .populate('creator', 'username displayName avatar role')
                  .sort({ qualityScore: -1, createdAt: -1 })
                  .skip((page - 1) * limit)
                  .limit(parseInt(limit));

            const total = await Content.countDocuments(query);

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

            const query = {
                  creator: creator._id,
                  status: 'published',
                  visibility: 'public',
                  isApproved: true
            };

            const contents = await Content.find(query)
                  .populate('creator', 'username displayName avatar role')
                  .sort({ createdAt: -1 })
                  .skip((page - 1) * limit)
                  .limit(parseInt(limit));

            const total = await Content.countDocuments(query);

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
                  .limit(parseInt(limit));

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
                  .populate('creator', 'username displayName avatar isPrivate')
                  .sort({ createdAt: 1 });

            // Group by creator
            const groupedStories = {};
            stories.forEach(story => {
                  // If private, only show if following (handled in frontend usually or filtered here)
                  // For simplicity, showing all public stories.
                  const creatorId = story.creator._id.toString();
                  if (!groupedStories[creatorId]) {
                        groupedStories[creatorId] = {
                              creator: story.creator,
                              stories: []
                        };
                  }
                  groupedStories[creatorId].stories.push(story);
            });

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
