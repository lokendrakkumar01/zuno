const { Message, Conversation } = require('../models/Message');
const User = require('../models/User');
const { getReceiverSocketId, io } = require('../socket/socket');

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

            let messages = await Message.find({
                  $or: [
                        { sender: req.user.id, receiver: userId },
                        { sender: userId, receiver: req.user.id }
                  ]
            })
                  .sort({ createdAt: -1 }) // Get newest first
                  .skip((page - 1) * limit)
                  .limit(parseInt(limit))
                  .populate('sender', 'username displayName avatar')
                  .populate('receiver', 'username displayName avatar')
                  .populate({
                        path: 'replyTo',
                        populate: { path: 'sender', select: 'username displayName' }
                  });

            // Reverse to display oldest to newest (top to bottom) in the UI
            messages = messages.reverse();

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

// @desc    Send a message to a user (text, image, or video)
// @route   POST /api/messages/:userId
// @access  Private
const sendMessage = async (req, res) => {
      try {
            const { userId } = req.params;
            const { text, mediaUrl, mediaType, replyTo } = req.body;

            // Must have either text or media
            if ((!text || !text.trim()) && !mediaUrl && !req.file) {
                  return res.status(400).json({
                        success: false,
                        message: 'Message text or media is required'
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

            // Build message data
            const msgData = {
                  sender: req.user.id,
                  receiver: userId,
                  text: text ? text.trim() : ''
            };

            if (replyTo) {
                  msgData.replyTo = replyTo;
            }

            // Add media if present
            if (mediaUrl) {
                  msgData.media = {
                        url: mediaUrl,
                        type: mediaType || 'image'
                  };
            }

            // Handle file upload if present (multer middleware already processed it)
            if (req.file) {
                  const isCloudinary = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
                  if (isCloudinary) {
                        // Cloudinary multer storage already uploaded the file
                        // req.file.path contains the Cloudinary URL
                        msgData.media = {
                              url: req.file.path,
                              type: req.file.mimetype && req.file.mimetype.startsWith('video') ? 'video'
                                    : (req.file.originalname && /\.(mp4|webm|mov|avi|mkv)$/i.test(req.file.originalname) ? 'video' : 'image')
                        };
                  } else {
                        msgData.media = {
                              url: `/uploads/${req.file.filename}`,
                              type: req.file.mimetype.startsWith('video') ? 'video' : 'image'
                        };
                  }
            }

            // Create message
            const message = await Message.create(msgData);

            // Populate sender info
            await message.populate('sender', 'username displayName avatar');
            await message.populate('receiver', 'username displayName avatar');
            if (replyTo) {
                  await message.populate({
                        path: 'replyTo',
                        populate: { path: 'sender', select: 'username displayName' }
                  });
            }

            // Conversation last message text
            const lastText = text ? text.trim() : (msgData.media?.type === 'video' ? '🎬 Video' : '📷 Photo');

            // Update or create conversation
            let conversation = await Conversation.findOne({
                  participants: { $all: [req.user.id, userId] }
            });

            if (conversation) {
                  conversation.lastMessage = {
                        text: lastText,
                        sender: req.user.id,
                        createdAt: new Date()
                  };
                  if (!conversation.unreadCount) {
                        conversation.unreadCount = new Map();
                  }
                  const currentUnread = conversation.unreadCount.get(userId) || 0;
                  conversation.unreadCount.set(userId, currentUnread + 1);
                  await conversation.save();
            } else {
                  conversation = await Conversation.create({
                        participants: [req.user.id, userId],
                        lastMessage: {
                              text: lastText,
                              sender: req.user.id,
                              createdAt: new Date()
                        },
                        unreadCount: new Map([[userId, 1]])
                  });
            }

            // SOCKET.IO functionality
            const receiverSocketId = getReceiverSocketId(userId);
            if (receiverSocketId) {
                  // io.to(<socket_id>).emit() used to send events to specific client
                  io.to(receiverSocketId).emit("newMessage", message);
            }

            // Also emit back to sender (for multi-tab / other windows of same user)
            const senderSocketId = getReceiverSocketId(req.user.id);
            if (senderSocketId) {
                  io.to(senderSocketId).emit("newMessage", message);
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

// @desc    Edit a message
// @route   PUT /api/messages/edit/:messageId
// @access  Private
const editMessage = async (req, res) => {
      try {
            const { messageId } = req.params;
            const { text } = req.body;

            if (!text || !text.trim()) {
                  return res.status(400).json({
                        success: false,
                        message: 'Message text is required'
                  });
            }

            const message = await Message.findById(messageId);
            if (!message) {
                  return res.status(404).json({
                        success: false,
                        message: 'Message not found'
                  });
            }

            // Only sender can edit
            if (message.sender.toString() !== req.user.id) {
                  return res.status(403).json({
                        success: false,
                        message: 'You can only edit your own messages'
                  });
            }

            message.text = text.trim();
            message.edited = true;
            await message.save();

            await message.populate('sender', 'username displayName avatar');
            await message.populate('receiver', 'username displayName avatar');

            // Update conversation lastMessage if this was the latest
            await Conversation.findOneAndUpdate(
                  {
                        participants: { $all: [message.sender._id, message.receiver._id] },
                        'lastMessage.createdAt': { $lte: message.createdAt }
                  },
                  {
                        'lastMessage.text': text.trim()
                  }
            );

            res.json({
                  success: true,
                  message: 'Message updated',
                  data: { message }
            });
      } catch (error) {
            console.error('editMessage error:', error);
            res.status(500).json({
                  success: false,
                  message: 'Failed to edit message',
                  error: error.message
            });
      }
};

// @desc    Delete a message
// @route   DELETE /api/messages/delete/:messageId
// @access  Private
const deleteMessage = async (req, res) => {
      try {
            const { messageId } = req.params;

            const message = await Message.findById(messageId);
            if (!message) {
                  return res.status(404).json({
                        success: false,
                        message: 'Message not found'
                  });
            }

            // Both sender and receiver can delete
            const isSender = message.sender.toString() === req.user.id;
            const isReceiver = message.receiver.toString() === req.user.id;
            if (!isSender && !isReceiver) {
                  return res.status(403).json({
                        success: false,
                        message: 'You can only delete messages in your conversations'
                  });
            }

            const senderId = message.sender;
            const receiverId = message.receiver;

            await Message.findByIdAndDelete(messageId);

            // Update conversation's lastMessage to the previous message
            const lastMsg = await Message.findOne({
                  $or: [
                        { sender: senderId, receiver: receiverId },
                        { sender: receiverId, receiver: senderId }
                  ]
            }).sort({ createdAt: -1 });

            if (lastMsg) {
                  await Conversation.findOneAndUpdate(
                        { participants: { $all: [senderId, receiverId] } },
                        {
                              lastMessage: {
                                    text: lastMsg.text,
                                    sender: lastMsg.sender,
                                    createdAt: lastMsg.createdAt
                              }
                        }
                  );
            } else {
                  // No messages left — delete conversation
                  await Conversation.findOneAndDelete({
                        participants: { $all: [senderId, receiverId] }
                  });
            }

            res.json({
                  success: true,
                  message: 'Message deleted'
            });
      } catch (error) {
            console.error('deleteMessage error:', error);
            res.status(500).json({
                  success: false,
                  message: 'Failed to delete message',
                  error: error.message
            });
      }
};

// @desc    Add or remove reaction from a message
// @route   PUT /api/messages/react/:messageId
// @access  Private
const reactToMessage = async (req, res) => {
      try {
            const { messageId } = req.params;
            const { emoji } = req.body;

            if (!emoji) {
                  return res.status(400).json({ success: false, message: 'Emoji is required' });
            }

            const message = await Message.findById(messageId);
            if (!message) {
                  return res.status(404).json({ success: false, message: 'Message not found' });
            }

            // Must be sender or receiver
            if (message.sender.toString() !== req.user.id && message.receiver.toString() !== req.user.id) {
                  return res.status(403).json({ success: false, message: 'Not authorized' });
            }

            // Check if user already reacted with this emoji
            const existingReactionIdx = message.reactions.findIndex(
                  r => r.user.toString() === req.user.id && r.emoji === emoji
            );

            if (existingReactionIdx > -1) {
                  // Remove reaction
                  message.reactions.splice(existingReactionIdx, 1);
            } else {
                  // Add reaction
                  message.reactions.push({ emoji, user: req.user.id });
            }

            await message.save();

            // Populate sender info before returning
            await message.populate('sender', 'username displayName avatar');
            await message.populate('receiver', 'username displayName avatar');
            await message.populate('reactions.user', 'username displayName avatar');

            // Send via socket
            const receiverId = message.sender.toString() === req.user.id ? message.receiver.toString() : message.sender.toString();
            const receiverSocketId = getReceiverSocketId(receiverId);
            if (receiverSocketId) {
                  io.to(receiverSocketId).emit("messageReaction", { messageId, reactions: message.reactions });
            }

            res.json({
                  success: true,
                  message: 'Reaction updated',
                  data: { message }
            });
      } catch (error) {
            console.error('reactToMessage error:', error);
            res.status(500).json({
                  success: false,
                  message: 'Failed to react to message',
                  error: error.message
            });
      }
};

// @desc    Clear all messages with a specific user
// @route   DELETE /api/messages/clear/:userId
// @access  Private
const clearChat = async (req, res) => {
      try {
            const { userId } = req.params;
            const currentUserId = req.user.id;

            // Delete all messages between these two users
            await Message.deleteMany({
                  $or: [
                        { sender: currentUserId, receiver: userId },
                        { sender: userId, receiver: currentUserId }
                  ]
            });

            // Update or delete the conversation
            const conversation = await Conversation.findOne({
                  participants: { $all: [currentUserId, userId] }
            });

            if (conversation) {
                  // Option 1: Delete the conversation entirely
                  // await Conversation.findByIdAndDelete(conversation._id);

                  // Option 2: Clear lastMessage and unread counts
                  conversation.lastMessage = { text: '', sender: null, createdAt: Date.now() };
                  if (conversation.unreadCount) {
                        conversation.unreadCount.set(currentUserId, 0);
                        conversation.unreadCount.set(userId, 0);
                  }
                  await conversation.save();
            }

            res.json({
                  success: true,
                  message: 'Chat cleared successfully'
            });
      } catch (error) {
            console.error('clearChat error:', error);
            res.status(500).json({
                  success: false,
                  message: 'Failed to clear chat',
                  error: error.message
            });
      }
};

module.exports = {
      getConversations,
      getMessages,
      sendMessage,
      markAsRead,
      getUnreadCount,
      editMessage,
      deleteMessage,
      reactToMessage,
      clearChat
};
