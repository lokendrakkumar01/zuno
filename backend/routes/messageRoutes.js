const express = require('express');
const router = express.Router();
const {
      getConversations,
      getMessages,
      sendMessage,
      markAsRead,
      getUnreadCount,
      editMessage,
      deleteMessage
} = require('../controllers/messageController');
const { protect } = require('../middleware/auth');

// All routes are protected
router.use(protect);

// Conversations
router.get('/conversations', getConversations);

// Unread count (must be before /:userId)
router.get('/unread/count', getUnreadCount);

// Edit & Delete messages (must be before /:userId)
router.put('/edit/:messageId', editMessage);
router.delete('/delete/:messageId', deleteMessage);

// Messages with a specific user
router.get('/:userId', getMessages);
router.post('/:userId', sendMessage);
router.put('/:userId/read', markAsRead);

module.exports = router;
