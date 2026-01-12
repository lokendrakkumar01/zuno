const express = require('express');
const router = express.Router();
const {
      getDashboardStats,
      getAllUsers,
      updateUser,
      getAllContent,
      moderateContent,
      getReports,
      getConfigs,
      updateConfig,
      initializeConfigs
} = require('../controllers/adminController');
const { protect, adminOnly, moderatorAccess } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Admin-only routes
router.get('/stats', adminOnly, getDashboardStats);
router.get('/users', adminOnly, getAllUsers);
router.put('/users/:id', adminOnly, updateUser);
router.get('/config', adminOnly, getConfigs);
router.put('/config/:key', adminOnly, updateConfig);
router.post('/config/init', adminOnly, initializeConfigs);

// Moderator+ routes
router.get('/content', moderatorAccess, getAllContent);
router.put('/content/:id', moderatorAccess, moderateContent);
router.get('/reports', moderatorAccess, getReports);

module.exports = router;
