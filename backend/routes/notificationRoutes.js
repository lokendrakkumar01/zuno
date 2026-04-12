const express = require('express');
const router = express.Router();
const {
      getMyNotifications,
      markNotificationRead,
      markAllNotificationsRead
} = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

router.get('/', protect, getMyNotifications);
router.put('/read-all', protect, markAllNotificationsRead);
router.put('/:id/read', protect, markNotificationRead);

module.exports = router;
