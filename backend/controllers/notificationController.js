const Notification = require('../models/Notification');
const { ACTOR_SELECT, mapNotificationForClient, markNotificationsRead } = require('../utils/notificationService');

const toPositiveInt = (value, fallback) => {
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

// @desc    Get current user's notifications
// @route   GET /api/notifications
// @access  Private
const getMyNotifications = async (req, res) => {
      try {
            const limit = Math.min(toPositiveInt(req.query.limit, 30), 60);
            const page = toPositiveInt(req.query.page, 1);
            const skip = (page - 1) * limit;

            const [notifications, unreadCount] = await Promise.all([
                  Notification.find({ recipient: req.user.id })
                        .populate('actor', ACTOR_SELECT)
                        .sort({ createdAt: -1 })
                        .skip(skip)
                        .limit(limit)
                        .lean(),
                  Notification.countDocuments({
                        recipient: req.user.id,
                        isRead: false
                  })
            ]);

            res.setHeader('Cache-Control', 'private, no-store');
            res.json({
                  success: true,
                  data: {
                        notifications: notifications.map(mapNotificationForClient),
                        unreadCount,
                        pagination: {
                              page,
                              limit,
                              hasMore: notifications.length === limit
                        }
                  }
            });
      } catch (error) {
            res.status(500).json({
                  success: false,
                  message: 'Failed to load notifications',
                  error: error.message
            });
      }
};

// @desc    Mark a notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
const markNotificationRead = async (req, res) => {
      try {
            await markNotificationsRead(req.user.id, [req.params.id]);

            res.json({
                  success: true,
                  message: 'Notification marked as read'
            });
      } catch (error) {
            res.status(500).json({
                  success: false,
                  message: 'Failed to update notification',
                  error: error.message
            });
      }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
const markAllNotificationsRead = async (req, res) => {
      try {
            await markNotificationsRead(req.user.id);

            res.json({
                  success: true,
                  message: 'All notifications marked as read'
            });
      } catch (error) {
            res.status(500).json({
                  success: false,
                  message: 'Failed to update notifications',
                  error: error.message
            });
      }
};

module.exports = {
      getMyNotifications,
      markNotificationRead,
      markAllNotificationsRead
};
