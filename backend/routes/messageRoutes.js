const express = require('express');
const router = express.Router();
const {
      getConversations,
      getMessages,
      sendMessage,
      markAsRead,
      getUnreadCount,
      editMessage,
      deleteMessage,
      reactToMessage,
      forwardMessage
} = require('../controllers/messageController');
const { protect } = require('../middleware/auth');
const { uploadMultiple } = require('../middleware/upload');

// All routes are protected
router.use(protect);

// Conversations
router.get('/conversations', getConversations);

// Unread count (must be before /:userId)
router.get('/unread/count', getUnreadCount);

// Edit, Delete, React, Forward (must be before /:userId)
router.put('/edit/:messageId', editMessage);
router.delete('/delete/:messageId', deleteMessage);
router.post('/react/:messageId', reactToMessage);
router.post('/forward/:messageId', forwardMessage);

// Messages with a specific user
router.get('/:userId', getMessages);
router.post('/:userId', uploadMultiple.single('media'), sendMessage);
router.put('/:userId/read', markAsRead);

module.exports = router;
