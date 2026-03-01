const Content = require('../models/Content');
const Interaction = require('../models/Interaction');
const User = require('../models/User');

// @desc    Create new content (photo, post, video, live)
// @route   POST /api/content
// @access  Private
const createContent = async (req, res) => {
      try {
            const {
                  contentType, title, body, purpose, topics, tags,
                  visibility, chapters, notes, silentMode, language
            } = req.body;

            // Build media array from uploaded files 
            // Cloudinary returns URL in file.path, local storage uses /uploads/filename
            let media = [];
            if (req.files && req.files.length > 0) {
                  media = req.files.map(file => ({
                        // Cloudinary puts full URL in file.path, local uses /uploads/filename
                        url: file.path || `/uploads/${file.filename}`,
                        type: file.mimetype.startsWith('image') ? 'image' : 'video',
                        status: 'ready',
                        // Store public_id for Cloudinary (useful for deletion)
                        publicId: file.filename || null
                  }));
            } else if (req.file) {
                  media = [{
                        url: req.file.path || `/uploads/${req.file.filename}`,
                        type: req.file.mimetype.startsWith('image') ? 'image' : 'video',
                        status: 'ready',
                        publicId: req.file.filename || null
                  }];
            }


            const content = await Content.create({
                  creator: req.user.id,
                  isApproved: true,
                  contentType,
                  title,
                  body,
                  media,
                  purpose,
                  topics: topics ? (Array.isArray(topics) ? topics : [topics]) : [],
                  tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : [],
                  visibility: visibility || 'public',
                  chapters: chapters || [],
                  notes,
                  silentMode: silentMode || false,
                  language: language || 'en',
            });

            // Update user stats
            await User.findByIdAndUpdate(req.user.id, {
                  $inc: { 'stats.contentCount': 1 }
            });

            // Populate creator info before sending response
            await content.populate('creator', 'username displayName avatar role');

            res.status(201).json({
                  success: true,
                  message: 'Content created successfully! 🎉',
                  data: { content }
            });
      } catch (error) {
            console.error('Content creation error:', error);
            res.status(500).json({
                  success: false,
                  message: 'Failed to create content',
                  error: error.message
            });
      }
};

// @desc    Get single content by ID
// @route   GET /api/content/:id
// @access  Public
const getContent = async (req, res) => {
      try {
            const content = await Content.findById(req.params.id)
                  .populate('creator', 'username displayName avatar role');

            if (!content) {
                  return res.status(404).json({
                        success: false,
                        message: 'Content not found'
                  });
            }

            // Check Privacy logic - only for private content
            const creatorId = content.creator?._id || content.creator;
            const isPrivateContent = content.visibility === 'private';

            if (isPrivateContent && creatorId) {
                  const creator = await User.findById(creatorId);
                  const isPrivateAccount = creator && creator.isPrivate;

                  if (isPrivateContent || isPrivateAccount) {
                        // Determine if viewer is allowed
                        let isAllowed = false;

                        if (req.user) {
                              const isOwner = req.user.id === creator._id.toString();
                              const isFollower = creator.followers && creator.followers.includes(req.user.id);
                              if (isOwner || isFollower || req.user.role === 'admin') {
                                    isAllowed = true;
                              }
                        }

                        if (!isAllowed) {
                              return res.status(403).json({
                                    success: false,
                                    message: "This account is private. Follow to see content."
                              });
                        }
                  }
            }

            // Increment view count (not shown publicly if silentMode)
            content.metrics.viewCount += 1;
            await content.save();

            // Prepare response (hide metrics if silentMode)
            const responseContent = content.toObject();
            if (content.silentMode) {
                  delete responseContent.metrics;
            }

            res.json({
                  success: true,
                  data: { content: responseContent }
            });
      } catch (error) {
            console.error('getContent error:', error);
            res.status(500).json({
                  success: false,
                  message: 'Failed to get content',
                  error: error.message
            });
      }
};

// @desc    Update content
// @route   PUT /api/content/:id
// @access  Private (owner only)
const updateContent = async (req, res) => {
      try {
            let content = await Content.findById(req.params.id);

            if (!content) {
                  return res.status(404).json({
                        success: false,
                        message: 'Content not found'
                  });
            }

            // Check ownership
            if (content.creator.toString() !== req.user.id && req.user.role !== 'admin') {
                  return res.status(403).json({
                        success: false,
                        message: 'Not authorized to update this content'
                  });
            }

            const allowedUpdates = ['title', 'body', 'purpose', 'topics', 'tags',
                  'visibility', 'chapters', 'notes', 'silentMode', 'status'];

            const updates = {};
            for (const key of allowedUpdates) {
                  if (req.body[key] !== undefined) {
                        updates[key] = req.body[key];
                  }
            }

            content = await Content.findByIdAndUpdate(
                  req.params.id,
                  updates,
                  { new: true, runValidators: true }
            );

            res.json({
                  success: true,
                  message: 'Content updated successfully',
                  data: { content }
            });
      } catch (error) {
            res.status(500).json({
                  success: false,
                  message: 'Failed to update content',
                  error: error.message
            });
      }
};

// @desc    Delete content
// @route   DELETE /api/content/:id
// @access  Private (owner only)
const deleteContent = async (req, res) => {
      try {
            const content = await Content.findById(req.params.id);

            if (!content) {
                  return res.status(404).json({
                        success: false,
                        message: 'Content not found'
                  });
            }

            // Check ownership
            if (content.creator.toString() !== req.user.id && req.user.role !== 'admin') {
                  return res.status(403).json({
                        success: false,
                        message: 'Not authorized to delete this content'
                  });
            }

            await Content.findByIdAndDelete(req.params.id);

            // Update user stats
            await User.findByIdAndUpdate(req.user.id, {
                  $inc: { 'stats.contentCount': -1 }
            });

            res.json({
                  success: true,
                  message: 'Content deleted successfully'
            });
      } catch (error) {
            res.status(500).json({
                  success: false,
                  message: 'Failed to delete content',
                  error: error.message
            });
      }
};

// @desc    Mark content as helpful
// @route   POST /api/content/:id/helpful
// @access  Private
const markHelpful = async (req, res) => {
      try {
            const content = await Content.findById(req.params.id);

            if (!content) {
                  return res.status(404).json({
                        success: false,
                        message: 'Content not found'
                  });
            }

            // Check if already interacted
            const existing = await Interaction.findOne({
                  user: req.user.id,
                  content: req.params.id,
                  type: { $in: ['helpful', 'not-useful'] }
            });

            if (existing) {
                  // Update existing interaction
                  if (existing.type === 'helpful') {
                        // Remove the helpful mark
                        await Interaction.findByIdAndDelete(existing._id);
                        content.metrics.helpfulCount -= 1;
                  } else {
                        // Change from not-useful to helpful
                        existing.type = 'helpful';
                        await existing.save();
                        content.metrics.helpfulCount += 1;
                        content.metrics.notUsefulCount -= 1;
                  }
            } else {
                  // Create new interaction
                  await Interaction.create({
                        user: req.user.id,
                        content: req.params.id,
                        type: 'helpful'
                  });
                  content.metrics.helpfulCount += 1;
            }

            await content.save();

            // Update creator's helpful received stat
            await User.findByIdAndUpdate(content.creator, {
                  $inc: { 'stats.helpfulReceived': existing?.type === 'helpful' ? -1 : 1 }
            });

            res.json({
                  success: true,
                  message: 'Feedback recorded privately'
            });
      } catch (error) {
            res.status(500).json({
                  success: false,
                  message: 'Failed to record feedback',
                  error: error.message
            });
      }
};

// @desc    Mark content as not useful
// @route   POST /api/content/:id/not-useful
// @access  Private
const markNotUseful = async (req, res) => {
      try {
            const content = await Content.findById(req.params.id);

            if (!content) {
                  return res.status(404).json({
                        success: false,
                        message: 'Content not found'
                  });
            }

            // Check if already interacted
            const existing = await Interaction.findOne({
                  user: req.user.id,
                  content: req.params.id,
                  type: { $in: ['helpful', 'not-useful'] }
            });

            if (existing) {
                  if (existing.type === 'not-useful') {
                        await Interaction.findByIdAndDelete(existing._id);
                        content.metrics.notUsefulCount -= 1;
                  } else {
                        existing.type = 'not-useful';
                        await existing.save();
                        content.metrics.notUsefulCount += 1;
                        content.metrics.helpfulCount -= 1;
                  }
            } else {
                  await Interaction.create({
                        user: req.user.id,
                        content: req.params.id,
                        type: 'not-useful'
                  });
                  content.metrics.notUsefulCount += 1;
            }

            await content.save();

            res.json({
                  success: true,
                  message: 'Feedback recorded. We\'ll improve your feed.'
            });
      } catch (error) {
            res.status(500).json({
                  success: false,
                  message: 'Failed to record feedback',
                  error: error.message
            });
      }
};

// @desc    Save content
// @route   POST /api/content/:id/save
// @access  Private
const saveContent = async (req, res) => {
      try {
            const content = await Content.findById(req.params.id);

            if (!content) {
                  return res.status(404).json({
                        success: false,
                        message: 'Content not found'
                  });
            }

            const existing = await Interaction.findOne({
                  user: req.user.id,
                  content: req.params.id,
                  type: 'save'
            });

            if (existing) {
                  await Interaction.findByIdAndDelete(existing._id);
                  content.metrics.saveCount -= 1;
                  await content.save();

                  res.json({
                        success: true,
                        message: 'Removed from saved items'
                  });
            } else {
                  await Interaction.create({
                        user: req.user.id,
                        content: req.params.id,
                        type: 'save'
                  });
                  content.metrics.saveCount += 1;
                  await content.save();

                  res.json({
                        success: true,
                        message: 'Saved for later 📌'
                  });
            }
      } catch (error) {
            res.status(500).json({
                  success: false,
                  message: 'Failed to save content',
                  error: error.message
            });
      }
};

// @desc    Get user's content
// @route   GET /api/content/my
// @access  Private
const getMyContent = async (req, res) => {
      try {
            const { status, contentType, page = 1, limit = 10 } = req.query;

            const query = { creator: req.user.id };
            if (status) query.status = status;
            if (contentType) query.contentType = contentType;

            const contents = await Content.find(query)
                  .sort({ createdAt: -1 })
                  .skip((page - 1) * limit)
                  .limit(parseInt(limit));

            const total = await Content.countDocuments(query);

            res.json({
                  success: true,
                  data: {
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
                  message: 'Failed to get your content',
                  error: error.message
            });
      }
};

// @desc    Get saved content
// @route   GET /api/content/saved
// @access  Private
const getSavedContent = async (req, res) => {
      try {
            const { page = 1, limit = 10 } = req.query;

            const savedInteractions = await Interaction.find({
                  user: req.user.id,
                  type: 'save'
            })
                  .sort({ createdAt: -1 })
                  .skip((page - 1) * limit)
                  .limit(parseInt(limit))
                  .populate({
                        path: 'content',
                        populate: { path: 'creator', select: 'username displayName avatar' }
                  });

            const contents = savedInteractions
                  .filter(i => i.content)
                  .map(i => i.content);

            res.json({
                  success: true,
                  data: { contents }
            });
      } catch (error) {
            res.status(500).json({
                  success: false,
                  message: 'Failed to get saved content',
                  error: error.message
            });
      }
};

// @desc    Share content (increment count)
// @route   POST /api/content/:id/share
// @access  Public
const shareContent = async (req, res) => {
      try {
            const content = await Content.findById(req.params.id);
            if (!content) {
                  return res.status(404).json({ success: false, message: "Content not found" });
            }

            content.metrics.shareCount += 1;
            await content.save();

            res.json({ success: true, message: "Content shared", data: { shareCount: content.metrics.shareCount } });
      } catch (error) {
            res.status(500).json({ success: false, message: "Failed to share content", error: error.message });
      }
};

module.exports = {
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
};
