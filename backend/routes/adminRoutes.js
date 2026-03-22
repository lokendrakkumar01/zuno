const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/adminController');
const { protect, adminOnly, moderatorAccess } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Admin-only routes
router.get('/stats', adminOnly, getDashboardStats);
router.get('/users', adminOnly, getAllUsers);
router.put('/users/:id', adminOnly, updateUser);
router.put('/users/:id/ban', adminOnly, toggleUserBan);
router.delete('/users/:id', adminOnly, deleteUser);
router.post('/users/:id/email', adminOnly, sendUserEmail);
router.get('/verifications', adminOnly, getPendingVerifications);
router.put('/verifications/:id', adminOnly, handleVerification);
router.get('/config', adminOnly, getConfigs);
router.put('/config/:key', adminOnly, updateConfig);
router.post('/config/init', adminOnly, initializeConfigs);

// Moderator+ routes
router.get('/content', moderatorAccess, getAllContent);
router.put('/content/:id', moderatorAccess, moderateContent);
router.get('/reports', moderatorAccess, getReports);
router.put('/reports/:id', moderatorAccess, handleReportAction);

module.exports = router;
