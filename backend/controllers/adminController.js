const User = require('../models/User');
const Content = require('../models/Content');
const AdminConfig = require('../models/AdminConfig');
const Interaction = require('../models/Interaction');
const { sendCustomAdminEmail } = require('../config/emailService');

// @desc    Get admin dashboard stats
// @route   GET /api/admin/stats
// @access  Admin
const getDashboardStats = async (req, res) => {
      try {
            const [
                  totalUsers,
                  totalContent,
                  totalReports,
                  activeUsers
            ] = await Promise.all([
                  User.countDocuments(),
                  Content.countDocuments(),
                  Interaction.countDocuments({ type: 'report' }),
                  User.countDocuments({ isActive: true })
            ]);

            // Content by type
            const contentByType = await Content.aggregate([
                  { $group: { _id: '$contentType', count: { $sum: 1 } } }
            ]);

            // Users by role
            const usersByRole = await User.aggregate([
                  { $group: { _id: '$role', count: { $sum: 1 } } }
            ]);

            res.json({
                  success: true,
                  data: {
                        totalUsers,
                        activeUsers,
                        totalContent,
                        totalReports,
                        contentByType,
                        usersByRole
                  }
            });
      } catch (error) {
            res.status(500).json({
                  success: false,
                  message: 'Failed to get dashboard stats',
                  error: error.message
            });
      }
};

// @desc    Get all users (paginated)
// @route   GET /api/admin/users
// @access  Admin
const getAllUsers = async (req, res) => {
      try {
            const { page = 1, limit = 20, role, search } = req.query;

            let query = {};
            if (role) query.role = role;
            if (search) {
                  query.$or = [
                        { username: { $regex: search, $options: 'i' } },
                        { email: { $regex: search, $options: 'i' } }
                  ];
            }

            const users = await User.find(query)
                  .select('-password')
                  .sort({ createdAt: -1 })
                  .skip((page - 1) * limit)
                  .limit(parseInt(limit));

            const total = await User.countDocuments(query);

            res.json({
                  success: true,
                  data: {
                        users,
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
                  message: 'Failed to get users',
                  error: error.message
            });
      }
};

// @desc    Update user role/status/verification
// @route   PUT /api/admin/users/:id
// @access  Admin
const updateUser = async (req, res) => {
      try {
            const { role, isActive, trustLevel, isVerified, password } = req.body;
 
             const updates = {};
             if (role) updates.role = role;
             if (isActive !== undefined) updates.isActive = isActive;
             if (trustLevel !== undefined) updates.trustLevel = trustLevel;
             if (isVerified !== undefined) updates.isVerified = isVerified;
             
             // Allow admin to set a new password
             let passwordChanged = false;
             if (password) {
                   const bcrypt = require('bcryptjs');
                   const salt = await bcrypt.genSalt(10);
                   updates.password = await bcrypt.hash(password, salt);
                   passwordChanged = true;
             }

            const user = await User.findByIdAndUpdate(
                  req.params.id,
                  updates,
                  { new: true }
            ).select('-password');

            if (!user) {
                  return res.status(404).json({
                        success: false,
                        message: 'User not found'
                  });
            }

            // If password was changed, send notification email automatically
            if (passwordChanged) {
                  try {
                        const subject = '🔐 Security Alert: Your ZUNO Password has been Reset';
                        const message = `Hello ${user.displayName || user.username},\n\nYour ZUNO account password has been reset by an administrator.\n\nYour new temporary password is: ${password}\n\nPlease log in and change your password immediately for security.\n\nBest regards,\nZUNO Administration`;
                        await sendCustomAdminEmail(user.email, user.displayName || user.username, subject, message);
                        console.log(`[Admin] Password reset email sent to ${user.email}`);
                  } catch (mailError) {
                        console.error('[Admin] Failed to send password reset email:', mailError.message);
                        // We still return success since the DB update worked
                  }
            }

            res.json({
                  success: true,
                  message: passwordChanged ? 'User updated and password reset email sent' : 'User updated successfully',
                  data: { user }
            });
      } catch (error) {
            res.status(500).json({
                  success: false,
                  message: 'Failed to update user',
                  error: error.message
            });
      }
};

// @desc    Toggle user ban (active/inactive)
// @route   PUT /api/admin/users/:id/ban
// @access  Admin
const toggleUserBan = async (req, res) => {
      try {
            const user = await User.findById(req.params.id).select('-password');
            if (!user) {
                  return res.status(404).json({ success: false, message: 'User not found' });
            }
            user.isActive = !user.isActive;
            await user.save();
            res.json({
                  success: true,
                  message: `User ${user.isActive ? 'unbanned' : 'banned'} successfully`,
                  data: { user }
            });
      } catch (error) {
            res.status(500).json({ success: false, message: 'Failed to toggle ban', error: error.message });
      }
};

// @desc    Send email to a user
// @route   POST /api/admin/users/:id/email
// @access  Admin
const sendUserEmail = async (req, res) => {
      try {
            const { subject, message } = req.body;
            if (!subject || !message) {
                  return res.status(400).json({ success: false, message: 'Subject and message are required' });
            }

            const user = await User.findById(req.params.id);
            if (!user) {
                  return res.status(404).json({ success: false, message: 'User not found' });
            }

            await sendCustomAdminEmail(user.email, user.displayName || user.username, subject, message);

            res.json({
                  success: true,
                  message: `Email sent to ${user.email} successfully`
            });
      } catch (error) {
            console.error('[Admin] sendUserEmail error:', error.message);
            res.status(500).json({ success: false, message: `Failed to send email: ${error.message || 'Email service error. Check EMAIL_USER/EMAIL_PASS environment variables.'}` });
      }
};

// @desc    Get pending verification requests
// @route   GET /api/admin/verifications
// @access  Admin
const getPendingVerifications = async (req, res) => {
      try {
            const users = await User.find({ 'verificationRequest.status': 'pending' })
                  .select('-password')
                  .sort({ 'verificationRequest.requestedAt': 1 });
            res.json({ success: true, data: { users } });
      } catch (error) {
            res.status(500).json({ success: false, message: 'Failed to get verifications', error: error.message });
      }
};

// @desc    Approve or reject a verification request
// @route   PUT /api/admin/verifications/:id
// @access  Admin
const handleVerification = async (req, res) => {
      try {
            const { action } = req.body; // 'approve' or 'reject'
            const user = await User.findById(req.params.id).select('-password');
            if (!user) {
                  return res.status(404).json({ success: false, message: 'User not found' });
            }
            if (action === 'approve') {
                  user.isVerified = true;
                  user.verificationRequest.status = 'approved';
            } else {
                  user.isVerified = false;
                  user.verificationRequest.status = 'rejected';
            }
            user.verificationRequest.reviewedAt = new Date();
            await user.save();
            res.json({
                  success: true,
                  message: `Verification ${action}d successfully`,
                  data: { user }
            });
      } catch (error) {
            res.status(500).json({ success: false, message: 'Failed to handle verification', error: error.message });
      }
};


// @desc    Get all content for moderation
// @route   GET /api/admin/content
// @access  Admin/Moderator
const getAllContent = async (req, res) => {
      try {
            const { page = 1, limit = 20, status, contentType, isApproved } = req.query;

            let query = { status: { $ne: 'removed' } };
            if (status) query.status = status;
            if (contentType) query.contentType = contentType;
            if (isApproved !== undefined) query.isApproved = isApproved === 'true';

            const contents = await Content.find(query)
                  .populate('creator', 'username displayName')
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
                  message: 'Failed to get content',
                  error: error.message
            });
      }
};

// @desc    Moderate content (approve/remove)
// @route   PUT /api/admin/content/:id
// @access  Admin/Moderator
const moderateContent = async (req, res) => {
      try {
            const { isApproved, status, moderationNote } = req.body;

            const updates = {};
            if (isApproved !== undefined) updates.isApproved = isApproved;
            if (status) updates.status = status;
            if (moderationNote) updates.moderationNote = moderationNote;

            const content = await Content.findByIdAndUpdate(
                  req.params.id,
                  updates,
                  { new: true }
            );

            if (!content) {
                  return res.status(404).json({
                        success: false,
                        message: 'Content not found'
                  });
            }

            // If removing, also delete from DB after marking
            if (updates.status === 'removed') {
                  await Content.findByIdAndDelete(req.params.id);
                  return res.json({
                        success: true,
                        message: 'Content removed and deleted successfully',
                        data: { content }
                  });
            }

            res.json({
                  success: true,
                  message: 'Content moderated successfully',
                  data: { content }
            });
      } catch (error) {
            res.status(500).json({
                  success: false,
                  message: 'Failed to moderate content',
                  error: error.message
            });
      }
};

// @desc    Get reports
// @route   GET /api/admin/reports
// @access  Admin/Moderator
const getReports = async (req, res) => {
      try {
            const { page = 1, limit = 20 } = req.query;

            const reports = await Interaction.find({ type: 'report' })
                  .populate('user', 'username')
                  .populate({
                        path: 'content',
                        populate: { path: 'creator', select: 'username' }
                  })
                  .sort({ createdAt: -1 })
                  .skip((page - 1) * limit)
                  .limit(parseInt(limit));

            const total = await Interaction.countDocuments({ type: 'report' });

            res.json({
                  success: true,
                  data: {
                        reports,
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
                  message: 'Failed to get reports',
                  error: error.message
            });
      }
};

// @desc    Handle report action
// @route   PUT /api/admin/reports/:id
// @access  Admin/Moderator
const handleReportAction = async (req, res) => {
      try {
            const { action } = req.body; // 'dismissed' or 'removed'
            const report = await Interaction.findById(req.params.id);

            if (!report || report.type !== 'report') {
                  return res.status(404).json({
                        success: false,
                        message: 'Report not found'
                  });
            }

            if (action === 'removed') {
                  // Delete the reported content
                  if (report.content) {
                        const content = await Content.findById(report.content);
                        if (content) {
                              content.status = 'removed';
                              await content.save();
                        }
                  }
            }

            // After handling, delete the report Interaction
            await Interaction.findByIdAndDelete(req.params.id);

            res.json({
                  success: true,
                  message: `Report marked as ${action}`
            });
      } catch (error) {
            res.status(500).json({
                  success: false,
                  message: 'Failed to handle report',
                  error: error.message
            });
      }
};

// @desc    Get all feature flags
// @route   GET /api/admin/config
// @access  Admin
const getConfigs = async (req, res) => {
      try {
            const configs = await AdminConfig.find().sort({ category: 1, key: 1 });
            res.json({
                  success: true,
                  data: { configs }
            });
      } catch (error) {
            res.status(500).json({
                  success: false,
                  message: 'Failed to get configs',
                  error: error.message
            });
      }
};

// @desc    Update or create config
// @route   PUT /api/admin/config/:key
// @access  Admin
const updateConfig = async (req, res) => {
      try {
            const { key } = req.params;
            const { value, description, category, isActive } = req.body;

            const updates = {};
            if (value !== undefined) updates.value = value;
            if (description !== undefined) updates.description = description;
            if (category !== undefined) updates.category = category;
            if (isActive !== undefined) updates.isActive = isActive;
            updates.updatedBy = req.user.id;

            const config = await AdminConfig.findOneAndUpdate(
                  { key },
                  { $set: updates },
                  { new: true, upsert: true }
            );

            res.json({
                  success: true,
                  message: 'Config updated successfully',
                  data: { config }
            });
      } catch (error) {
            res.status(500).json({
                  success: false,
                  message: 'Failed to update config',
                  error: error.message
            });
      }
};

// @desc    Initialize default configs
// @route   POST /api/admin/config/init
// @access  Admin
const initializeConfigs = async (req, res) => {
      try {
            const defaultConfigs = [
                  { key: 'FEATURE_PHOTO_UPLOAD', value: true, category: 'feature', description: 'Enable photo uploads' },
                  { key: 'FEATURE_VIDEO_UPLOAD', value: true, category: 'feature', description: 'Enable video uploads' },
                  { key: 'FEATURE_LIVE_STREAM', value: true, category: 'feature', description: 'Enable live streaming' },
                  { key: 'FEATURE_SILENT_MODE', value: true, category: 'feature', description: 'Allow silent mode on content' },
                  { key: 'UPLOAD_MAX_IMAGE_SIZE_MB', value: 10, category: 'upload', description: 'Max image size in MB' },
                  { key: 'UPLOAD_MAX_VIDEO_SIZE_MB', value: 100, category: 'upload', description: 'Max video size in MB' },
                  { key: 'UPLOAD_MAX_VIDEO_DURATION_SEC', value: 600, category: 'upload', description: 'Max video duration in seconds' },
                  { key: 'MODERATION_AUTO_APPROVE', value: true, category: 'moderation', description: 'Auto-approve content from trusted users' },
                  { key: 'FEED_DEFAULT_MODE', value: 'learning', category: 'feed', description: 'Default feed mode for new users' },
                  { key: 'EMERGENCY_MAINTENANCE_MODE', value: false, category: 'emergency', description: 'Enable maintenance mode' }
            ];

            for (const config of defaultConfigs) {
                  await AdminConfig.findOneAndUpdate(
                        { key: config.key },
                        { ...config, updatedBy: req.user.id },
                        { upsert: true }
                  );
            }

            res.json({
                  success: true,
                  message: 'Default configs initialized'
            });
      } catch (error) {
            res.status(500).json({
                  success: false,
                  message: 'Failed to initialize configs',
                  error: error.message
            });
      }
};

// @desc    Delete a user permanently
// @route   DELETE /api/admin/users/:id
// @access  Admin
const deleteUser = async (req, res) => {
      try {
            const targetId = req.params.id;

            // Prevent admin from deleting themselves
            if (targetId === req.user.id.toString()) {
                  return res.status(400).json({
                        success: false,
                        message: 'You cannot delete your own account.'
                  });
            }

            const user = await User.findById(targetId);
            if (!user) {
                  return res.status(404).json({
                        success: false,
                        message: 'User not found'
                  });
            }

            await User.findByIdAndDelete(targetId);

            res.json({
                  success: true,
                  message: `User "${user.username}" deleted permanently.`
            });
      } catch (error) {
            res.status(500).json({
                  success: false,
                  message: 'Failed to delete user',
                  error: error.message
            });
      }
};

module.exports = {
      getDashboardStats,
      getAllUsers,
      updateUser,
      toggleUserBan,
      deleteUser,
      sendUserEmail,
      getPendingVerifications,
      handleVerification,
      getAllContent,
      moderateContent,
      getReports,
      handleReportAction,
      getConfigs,
      updateConfig,
      initializeConfigs
};

