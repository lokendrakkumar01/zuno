const Comment = require('../models/Comment');
const Content = require('../models/Content');

// @desc    Add a comment
// @route   POST /api/comments/:contentId
// @access  Private
const addComment = async (req, res) => {
      try {
            const { text } = req.body;
            const content = await Content.findById(req.params.contentId);

            if (!content) {
                  return res.status(404).json({
                        success: false,
                        message: 'Content not found'
                  });
            }

            const comment = await Comment.create({
                  user: req.user.id,
                  content: req.params.contentId,
                  text
            });

            const populatedComment = await Comment.findById(comment._id).populate('user', 'username displayName avatar');

            res.status(201).json({
                  success: true,
                  data: { comment: populatedComment }
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

            res.json({
                  success: true,
                  message: 'Comment deleted'
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
