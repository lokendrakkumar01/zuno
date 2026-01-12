const User = require('../models/User');
const Content = require('../models/Content');
const AdminConfig = require('../models/AdminConfig');
const Interaction = require('../models/Interaction');

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

// @desc    Update user role/status
// @route   PUT /api/admin/users/:id
// @access  Admin
const updateUser = async (req, res) => {
      try {
            const { role, isActive, trustLevel } = req.body;

            const updates = {};
            if (role) updates.role = role;
            if (isActive !== undefined) updates.isActive = isActive;
            if (trustLevel !== undefined) updates.trustLevel = trustLevel;

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

            res.json({
                  success: true,
                  message: 'User updated successfully',
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

// @desc    Get all content for moderation
// @route   GET /api/admin/content
// @access  Admin/Moderator
const getAllContent = async (req, res) => {
      try {
            const { page = 1, limit = 20, status, contentType, isApproved } = req.query;

            let query = {};
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

            const config = await AdminConfig.findOneAndUpdate(
                  { key },
                  {
                        value,
                        description,
                        category,
                        isActive,
                        updatedBy: req.user.id
                  },
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

module.exports = {
      getDashboardStats,
      getAllUsers,
      updateUser,
      getAllContent,
      moderateContent,
      getReports,
      getConfigs,
      updateConfig,
      initializeConfigs
};
