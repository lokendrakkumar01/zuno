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
      clearChat,
      createGroup,
      getGroupMessages,
      sendGroupMessage,
      deleteGroup,
      addGroupParticipants,
      removeGroupParticipant,
      leaveGroup,
      updateGroupInfo
} = require('../controllers/messageController');
const { protect } = require('../middleware/auth');
const { uploadMultiple } = require('../middleware/upload');

// All routes are protected
router.use(protect);

// Conversations
router.get('/conversations', getConversations);

// Group Chat specific routes
router.post('/group/create', uploadMultiple.single('avatar'), createGroup);
router.get('/group/:groupId', getGroupMessages);
router.post('/group/:groupId', uploadMultiple.single('media'), sendGroupMessage);
router.delete('/group/:groupId', deleteGroup);
router.put('/group/:groupId/participants/add', addGroupParticipants);
router.put('/group/:groupId/participants/remove', removeGroupParticipant);
router.put('/group/:groupId/leave', leaveGroup);
router.put('/group/:groupId/info', uploadMultiple.single('groupAvatar'), updateGroupInfo);

// Unread count (must be before /:userId)
router.get('/unread/count', getUnreadCount);

// Edit & Delete messages (must be before /:userId)
router.put('/edit/:messageId', editMessage);
router.delete('/delete/:messageId', deleteMessage);
router.put('/react/:messageId', reactToMessage);

// Clear chat with specific user
router.delete('/clear/:userId', clearChat);

// Messages with a specific user
router.get('/:userId', getMessages);
router.post('/:userId', uploadMultiple.single('media'), sendMessage);
router.put('/:userId/read', markAsRead);

module.exports = router;
