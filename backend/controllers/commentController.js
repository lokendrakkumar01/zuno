const Comment = require('../models/Comment');
const Content = require('../models/Content');
const { createNotification } = require('../utils/notificationService');

// @desc    Add a comment
// @route   POST /api/comments/:contentId
// @access  Private
const addComment = async (req, res) => {
      try {
            const { text } = req.body;
            const trimmedText = text?.trim();
            const content = await Content.findById(req.params.contentId);

            if (!content) {
                  return res.status(404).json({
                        success: false,
                        message: 'Content not found'
                  });
            }

            if (!trimmedText) {
                  return res.status(400).json({
                        success: false,
                        message: 'Comment text is required'
                  });
            }

            const comment = await Comment.create({
                  user: req.user.id,
                  content: req.params.contentId,
                  text: trimmedText
            });
            content.metrics.commentCount = (content.metrics.commentCount || 0) + 1;
            await content.save();

            const populatedComment = await Comment.findById(comment._id).populate('user', 'username displayName avatar');

            await createNotification({
                  recipientId: content.creator,
                  actor: populatedComment.user,
                  type: 'comment',
                  title: 'New comment on your post',
                  body: `${populatedComment.user.displayName || populatedComment.user.username} commented on "${content.title || 'your post'}".`,
                  entityType: 'content',
                  entityId: content._id,
                  metadata: {
                        username: populatedComment.user.username,
                        contentTitle: content.title || ''
                  }
            });

            res.status(201).json({
                  success: true,
                  data: {
                        comment: populatedComment,
                        commentCount: content.metrics.commentCount
                  }
            });
      } catch (error) {
            res.status(500).json({
                  success: false,
                  message: 'Failed to add comment',
                  error: error.message
            });
      }
};

// @desc    Get comments for a post
// @route   GET /api/comments/:contentId
// @access  Public
const getComments = async (req, res) => {
      try {
            const comments = await Comment.find({ content: req.params.contentId })
                  .sort({ createdAt: -1 })
                  .populate('user', 'username displayName avatar');

            res.json({
                  success: true,
                  data: { comments }
            });
      } catch (error) {
            res.status(500).json({
                  success: false,
                  message: 'Failed to get comments',
                  error: error.message
            });
      }
};

// @desc    Delete a comment
// @route   DELETE /api/comments/:id
// @access  Private
const deleteComment = async (req, res) => {
      try {
            const comment = await Comment.findById(req.params.id);

            if (!comment) {
                  return res.status(404).json({
                        success: false,
                        message: 'Comment not found'
                  });
            }

            // Check ownership (or allow admin/content creator to delete - implementing owner for now)
            if (comment.user.toString() !== req.user.id) {
                  return res.status(403).json({
                        success: false,
                        message: 'Not authorized to delete this comment'
                  });
            }

            await Comment.findByIdAndDelete(req.params.id);
            await Content.findByIdAndUpdate(comment.content, {
                  $inc: { 'metrics.commentCount': -1 }
            });
            const updatedContent = await Content.findById(comment.content).select('metrics.commentCount').lean();

            res.json({
                  success: true,
                  message: 'Comment deleted',
                  data: {
                        commentCount: Math.max(0, updatedContent?.metrics?.commentCount || 0)
                  }
            });
      } catch (error) {
            res.status(500).json({
                  success: false,
                  message: 'Failed to delete comment',
                  error: error.message
            });
      }
};

module.exports = {
      addComment,
      getComments,
      deleteComment
};
