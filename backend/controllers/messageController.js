const { Message, Conversation } = require('../models/Message');
const User = require('../models/User');

// @desc    Get conversations for current user
// @route   GET /api/messages/conversations
// @access  Private
const getConversations = async (req, res) => {
      try {
            const conversations = await Conversation.find({
                  participants: req.user.id
            })
                  .populate('participants', 'username displayName avatar')
                  .populate('lastMessage.sender', 'username displayName')
                  .sort({ updatedAt: -1 });

            // Format conversations for frontend
            const formatted = conversations.map(conv => {
                  const otherUser = conv.participants.find(
                        p => p._id.toString() !== req.user.id
                  );
                  const unread = conv.unreadCount?.get(req.user.id) || 0;

                  return {
                        _id: conv._id,
                        user: otherUser,
                        lastMessage: conv.lastMessage,
                        unreadCount: unread,
                        updatedAt: conv.updatedAt
                  };
            });

            res.json({
                  success: true,
                  data: { conversations: formatted }
            });
      } catch (error) {
            console.error('getConversations error:', error);
            res.status(500).json({
                  success: false,
                  message: 'Failed to get conversations',
                  error: error.message
            });
      }
};

// @desc    Get messages with a specific user
// @route   GET /api/messages/:userId
// @access  Private
const getMessages = async (req, res) => {
      try {
            const { userId } = req.params;
            const { page = 1, limit = 50 } = req.query;

            // Verify other user exists
            const otherUser = await User.findById(userId).select('username displayName avatar');
            if (!otherUser) {
                  return res.status(404).json({
                        success: false,
                        message: 'User not found'
                  });
            }

            const messages = await Message.find({
                  $or: [
                        { sender: req.user.id, receiver: userId },
                        { sender: userId, receiver: req.user.id }
                  ]
            })
                  .sort({ createdAt: 1 })
                  .skip((page - 1) * limit)
                  .limit(parseInt(limit))
                  .populate('sender', 'username displayName avatar')
                  .populate('receiver', 'username displayName avatar');

            // Mark messages as read
            await Message.updateMany(
                  { sender: userId, receiver: req.user.id, read: false },
                  { $set: { read: true } }
            );

            // Reset unread count for this conversation
            await Conversation.findOneAndUpdate(
                  {
                        participants: { $all: [req.user.id, userId] }
                  },
                  { $set: { [`unreadCount.${req.user.id}`]: 0 } }
            );

            res.json({
                  success: true,
                  data: {
                        messages,
                        otherUser
                  }
            });
      } catch (error) {
            console.error('getMessages error:', error);
            res.status(500).json({
                  success: false,
                  message: 'Failed to get messages',
                  error: error.message
            });
      }
};

// @desc    Send a message to a user
// @route   POST /api/messages/:userId
// @access  Private
const sendMessage = async (req, res) => {
      try {
            const { userId } = req.params;
            const { text } = req.body;

            if (!text || !text.trim()) {
                  return res.status(400).json({
                        success: false,
                        message: 'Message text is required'
                  });
            }

            // Cannot message yourself
            if (userId === req.user.id) {
                  return res.status(400).json({
                        success: false,
                        message: 'You cannot message yourself'
                  });
            }

            // Verify receiver exists
            const receiver = await User.findById(userId);
            if (!receiver) {
                  return res.status(404).json({
                        success: false,
                        message: 'User not found'
                  });
            }

            // Create message
            const message = await Message.create({
                  sender: req.user.id,
                  receiver: userId,
                  text: text.trim()
            });

            // Populate sender info
            await message.populate('sender', 'username displayName avatar');
            await message.populate('receiver', 'username displayName avatar');

            // Update or create conversation
            let conversation = await Conversation.findOne({
                  participants: { $all: [req.user.id, userId] }
            });

            if (conversation) {
                  conversation.lastMessage = {
                        text: text.trim(),
                        sender: req.user.id,
                        createdAt: new Date()
                  };
                  const currentUnread = conversation.unreadCount?.get(userId) || 0;
                  conversation.unreadCount.set(userId, currentUnread + 1);
                  await conversation.save();
            } else {
                  conversation = await Conversation.create({
                        participants: [req.user.id, userId],
                        lastMessage: {
                              text: text.trim(),
                              sender: req.user.id,
                              createdAt: new Date()
                        },
                        unreadCount: new Map([[userId, 1]])
                  });
            }

            res.status(201).json({
                  success: true,
                  message: 'Message sent',
                  data: { message }
            });
      } catch (error) {
            console.error('sendMessage error:', error);
            res.status(500).json({
                  success: false,
                  message: 'Failed to send message',
                  error: error.message
            });
      }
};

// @desc    Mark messages as read
// @route   PUT /api/messages/:userId/read
// @access  Private
const markAsRead = async (req, res) => {
      try {
            const { userId } = req.params;

            await Message.updateMany(
                  { sender: userId, receiver: req.user.id, read: false },
                  { $set: { read: true } }
            );

            // Reset unread count
            await Conversation.findOneAndUpdate(
                  { participants: { $all: [req.user.id, userId] } },
                  { $set: { [`unreadCount.${req.user.id}`]: 0 } }
            );

            res.json({
                  success: true,
                  message: 'Messages marked as read'
            });
      } catch (error) {
            res.status(500).json({
                  success: false,
                  message: 'Failed to mark messages as read',
                  error: error.message
            });
      }
};

// @desc    Get total unread message count
// @route   GET /api/messages/unread/count
// @access  Private
const getUnreadCount = async (req, res) => {
      try {
            const count = await Message.countDocuments({
                  receiver: req.user.id,
                  read: false
            });

            res.json({
                  success: true,
                  data: { unreadCount: count }
            });
      } catch (error) {
            res.status(500).json({
                  success: false,
                  message: 'Failed to get unread count',
                  error: error.message
            });
      }
};

module.exports = {
      getConversations,
      getMessages,
      sendMessage,
      markAsRead,
      getUnreadCount
};
