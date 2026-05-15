const express = require('express');
const router = express.Router();
const {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead
} = require('../controllers/notificationController');

// Try new middleware path first, fall back to legacy
let protect;
try {
  protect = require('../middlewares/auth.middleware').protect;
} catch {
  protect = require('../middleware/auth').protect;
}

router.get('/', protect, getMyNotifications);
router.put('/read-all', protect, markAllNotificationsRead);
router.put('/:id/read', protect, markNotificationRead);

module.exports = router;
