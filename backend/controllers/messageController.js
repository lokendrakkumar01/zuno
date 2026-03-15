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
                  .sort({ updatedAt: -1 })
                  .limit(50)
                  .lean();

            const formatted = conversations.map(conv => {
                  let otherUser = null;
                  if (!conv.isGroup) {
                        otherUser = conv.participants.find(
                              p => p && p._id && p._id.toString() !== req.user.id
                        );
                  }
                  const unread = conv.unreadCount ? (conv.unreadCount[req.user.id] || 0) : 0;

                  return {
                        _id: conv._id,
                        user: otherUser,
                        isGroup: conv.isGroup || false,
                        isChannel: conv.isChannel || false,
                        groupName: conv.groupName,
                        groupAvatar: conv.groupAvatar,
                        groupAdmin: conv.groupAdmin,
                        participants: (conv.isGroup || conv.isChannel) ? conv.participants : undefined,
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
            const otherUser = await User.findById(userId).select('username displayName avatar blockedUsers');
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
                  ],
                  deletedBy: { $ne: req.user.id } // Filter out messages deleted by this user
            })
                  .sort({ createdAt: 1 }) // Get oldest first for UI display
                  .skip((page - 1) * limit)
                  .limit(parseInt(limit))
                  .populate('sender', 'username displayName avatar avatarColor isOnline offlineStatus')
                  .populate('receiver', 'username displayName avatar avatarColor')
                  .populate({
                        path: 'replyTo',
                        populate: { path: 'sender', select: 'username displayName' }
                  });

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

            // Check blocked status
            const currentUser = await User.findById(req.user.id);
            const blockedInfo = {
                  iBlocked: currentUser.blockedUsers.includes(userId),
                  theyBlocked: otherUser.blockedUsers ? otherUser.blockedUsers.includes(req.user.id) : false
            };

            res.json({
                  success: true,
                  data: {
                        messages,
                        otherUser,
                        blockedInfo
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

            // Verify receiver exists — use lean for speed
            const receiver = await User.findById(userId).lean();
            if (!receiver) {
                  return res.status(404).json({
                        success: false,
                        message: 'User not found'
                  });
            }
 
            // Check if blocked — use lean
            const currentUser = await User.findById(req.user.id).lean();
            if (currentUser.blockedUsers.includes(userId)) {
                  return res.status(403).json({
                        success: false,
                        message: 'You have blocked this user. Unblock them to send messages.'
                  });
            }
 
            if (receiver.blockedUsers.includes(req.user.id)) {
                  return res.status(403).json({
                        success: false,
                        message: 'This user is unavailable'
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

            // Create message instance but DO NOT await save yet
            const message = new Message(msgData);

            // Conversation last message text
            const lastText = text ? text.trim() : (msgData.media?.type === 'video' ? '🎬 Video' : '📷 Photo');

            // Fire and forget conversation update to speed up socket delivery
            Conversation.findOne({
                  participants: { $all: [req.user.id, userId] }
            }).then(conversation => {
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
                        return conversation.save();
                  } else {
                        return Conversation.create({
                              participants: [req.user.id, userId],
                              lastMessage: {
                                    text: lastText,
                                    sender: req.user.id,
                                    createdAt: new Date()
                              },
                              unreadCount: new Map([[userId, 1]])
                        });
                  }
            }).catch(err => console.error("Conversation err:", err));

            // Construct manual populated payload for INSTANT socket delivery
            const socketPayload = message.toObject();
            socketPayload.createdAt = new Date(); // FIX: unsaved Mongoose docs don't have timestamps yet
            if (req.body.clientMsgId) {
                  socketPayload.clientMsgId = req.body.clientMsgId;
            }
            socketPayload.sender = {
                  _id: req.user._id || req.user.id,
                  username: req.user.username,
                  displayName: req.user.displayName,
                  avatar: req.user.avatar
            };
            socketPayload.receiver = {
                  _id: receiver._id,
                  username: receiver.username,
                  displayName: receiver.displayName,
                  avatar: receiver.avatar
            };

            // SOCKET.IO functionality — fires instantly, no awaiting db
            const receiverSocketId = getReceiverSocketId(userId);
            if (receiverSocketId) {
                  io.to(receiverSocketId).emit("newMessage", socketPayload);
            }

            const senderSocketId = getReceiverSocketId(req.user.id);
            if (senderSocketId) {
                  io.to(senderSocketId).emit("newMessage", socketPayload);
            }

            // Immediately send back a fast HTTP response for optimistic UI
            res.status(201).json({
                  success: true,
                  message: 'Message sent quickly (optimistic)',
                  data: { message: socketPayload } // The raw populated payload sent via socket
            });

            // NOW save to DB in the background to not delay the sender
            try {
                  await message.save();
                  // Populate if needed for future cache invalidation, though not strictly required for this specific HTTP response anymore
            } catch (saveErr) {
                  console.error("Delayed message save err:", saveErr);
            }
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
            const type = req.query.type || 'me'; // 'me' or 'everyone'

            const message = await Message.findById(messageId);
            if (!message) {
                  return res.status(404).json({
                        success: false,
                        message: 'Message not found'
                  });
            }

            // Both sender and receiver can delete for "me". Only sender can delete for "everyone"
            const isSender = message.sender.toString() === req.user.id;
            const isReceiver = message.receiver && message.receiver.toString() === req.user.id;
            
            if (type === 'everyone') {
                  let isGroupAdmin = false;
                  if (!isSender && message.conversationId) {
                        const group = await Conversation.findById(message.conversationId);
                        if (group && group.groupAdmin && group.groupAdmin.toString() === req.user.id.toString()) {
                              isGroupAdmin = true;
                        }
                  }

                  if (!isSender && !isGroupAdmin && req.user.role !== 'admin') {
                        return res.status(403).json({
                              success: false,
                              message: 'You can only delete your own messages for everyone'
                        });
                  }
                  
                  // Mark as deleted for everyone, clear content for privacy
                  message.deletedForEveryone = true;
                  message.text = '';
                  message.media = { url: '', type: '' };
                  await message.save();

                  const deletedPayload = { messageId: message._id, conversationId: message.conversationId };
                  if (message.conversationId) {
                        // Group chat - emit to all group members via socket room (group room id)
                        io.to(message.conversationId.toString()).emit('messageDeletedForEveryone', deletedPayload);
                  } else if (message.receiver) {
                        // DM - emit to receiver
                        const receiverSocketId = getReceiverSocketId(message.receiver.toString());
                        if (receiverSocketId) {
                              io.to(receiverSocketId).emit('messageDeletedForEveryone', deletedPayload);
                        }
                        // Also emit back to sender (they may have multiple tabs)
                        const senderSocketId = getReceiverSocketId(message.sender.toString());
                        if (senderSocketId) {
                              io.to(senderSocketId).emit('messageDeletedForEveryone', deletedPayload);
                        }
                  }

                  return res.json({
                        success: true,
                        message: 'Message deleted for everyone',
                        data: { message }
                  });
            } else {
                  // Delete for me
                  if (!isSender && !isReceiver && !message.conversationId) {
                         // Fallback check: user must be part of the chat. The middleware/other logic ensures this but double check
                  }

                  if (!message.deletedBy.includes(req.user.id)) {
                        message.deletedBy.push(req.user.id);
                        await message.save();
                  }

                  return res.json({
                        success: true,
                        message: 'Message deleted for you',
                        data: { message }
                  });
            }
      } catch (error) {
            console.error('Delete message error:', error);
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

            // Broadcast to the other user's specific room
            io.to(receiverId).emit("messageReaction", { messageId, reactions: message.reactions });

            // Also broadcast to the current user's room (so their other open tabs instantly sync)
            io.to(req.user.id).emit("messageReaction", { messageId, reactions: message.reactions });

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

// @desc    Create a new group or channel
// @route   POST /api/messages/group/create
// @access  Private
const createGroup = async (req, res) => {
      try {
            const { name, participants, isChannel, description } = req.body;

            let parsedParticipants = participants;
            if (typeof participants === 'string') {
                  try {
                        parsedParticipants = JSON.parse(participants);
                  } catch (e) {
                         // split by comma if not valid json
                        parsedParticipants = participants.split(',');
                  }
            }

            if (!name || !parsedParticipants || parsedParticipants.length === 0) {
                  return res.status(400).json({ success: false, message: 'Name and participants are required' });
            }

            // Ensure current user is in participants
            const allParticipants = [...new Set([...parsedParticipants, req.user.id])];

            // Handle file upload if present
            let groupAvatar = '';
            if (req.file) {
                  const isCloudinary = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
                  if (isCloudinary) {
                        groupAvatar = req.file.path;
                  } else {
                        groupAvatar = `/uploads/${req.file.filename}`;
                  }
            }

            const conversation = await Conversation.create({
                  isGroup: true,
                  isChannel: isChannel === 'true' || isChannel === true,
                  groupName: name,
                  groupDescription: description || '',
                  groupAvatar: groupAvatar,
                  groupAdmin: req.user.id,
                  participants: allParticipants,
                  unreadCount: new Map(allParticipants.map(id => [id.toString(), 0]))
            });

            await conversation.populate('participants', 'username displayName avatar');
            await conversation.populate('groupAdmin', 'username displayName avatar');

            res.status(201).json({
                  success: true,
                  data: { conversation }
            });
      } catch (error) {
            console.error('createGroup error:', error);
            res.status(500).json({ success: false, message: 'Failed to create group', error: error.message });
      }
};

// @desc    Get group messages
// @route   GET /api/messages/group/:groupId
// @access  Private
const getGroupMessages = async (req, res) => {
      try {
            const { groupId } = req.params;
            const { page = 1, limit = 50 } = req.query;

            const conversation = await Conversation.findById(groupId).populate('participants', 'username displayName avatar blockedUsers');
            if (!conversation || !conversation.isGroup) {
                  return res.status(404).json({ success: false, message: 'Group not found' });
            }

            if (!conversation.participants.some(p => p._id.toString() === req.user.id)) {
                  return res.status(403).json({ success: false, message: 'Not a member of this group' });
            }

            let messages = await Message.find({ 
                  conversationId: groupId,
                  deletedBy: { $ne: req.user.id }
            })
                  .sort({ createdAt: -1 })
                  .skip((page - 1) * limit)
                  .limit(parseInt(limit))
                  .populate('sender', 'username displayName avatar')
                  .populate({
                        path: 'replyTo',
                        populate: { path: 'sender', select: 'username displayName' }
                  });

            messages = messages.reverse();
            await Conversation.findOneAndUpdate(
                  { _id: groupId },
                  { $set: { [`unreadCount.${req.user.id}`]: 0 } }
            );

            res.json({
                  success: true,
                  data: {
                        messages,
                        group: conversation
                  }
            });
      } catch (error) {
            console.error('getGroupMessages error:', error);
            res.status(500).json({ success: false, message: 'Failed to get group messages', error: error.message });
      }
};

// @desc    Send a group message
// @route   POST /api/messages/group/:groupId
// @access  Private
const sendGroupMessage = async (req, res) => {
      try {
            const { groupId } = req.params;
            const { text, mediaUrl, mediaType, replyTo } = req.body;

            const conversation = await Conversation.findById(groupId);
            if (!conversation || !conversation.isGroup) {
                  return res.status(404).json({ success: false, message: 'Group not found' });
            }

            if (!conversation.participants.includes(req.user.id)) {
                  return res.status(403).json({ success: false, message: 'Not a member' });
            }

            if (conversation.isChannel && conversation.groupAdmin.toString() !== req.user.id) {
                  return res.status(403).json({ success: false, message: 'Only admins can post in channels' });
            }

            const msgData = {
                  sender: req.user.id,
                  conversationId: groupId,
                  text: text ? text.trim() : ''
            };

            if (replyTo) msgData.replyTo = replyTo;

            if (mediaUrl) {
                  msgData.media = { url: mediaUrl, type: mediaType || 'image' };
            } else if (req.file) {
                  const isCloudinary = !!(process.env.CLOUDINARY_CLOUD_NAME);
                  msgData.media = {
                        url: isCloudinary ? req.file.path : `/uploads/${req.file.filename}`,
                        type: req.file.mimetype && req.file.mimetype.startsWith('video') ? 'video' : 'image'
                  };
            }

            const message = new Message(msgData);
            const lastText = text ? text.trim() : (msgData.media?.type === 'video' ? '🎬 Video' : '📷 Photo');

            conversation.lastMessage = { text: lastText, sender: req.user.id, createdAt: new Date() };
            if (!conversation.unreadCount) conversation.unreadCount = new Map();
            conversation.participants.forEach(pId => {
                  if (pId.toString() !== req.user.id) {
                        const count = conversation.unreadCount.get(pId.toString()) || 0;
                        conversation.unreadCount.set(pId.toString(), count + 1);
                  }
            });
            await conversation.save();

            const socketPayload = message.toObject();
            socketPayload.createdAt = new Date();
            if (req.body.clientMsgId) socketPayload.clientMsgId = req.body.clientMsgId;
            socketPayload.sender = { _id: req.user.id, id: req.user.id, username: req.user.username, displayName: req.user.displayName, avatar: req.user.avatar };

            conversation.participants.forEach(pId => {
                  const socketId = getReceiverSocketId(pId.toString());
                  if (socketId) {
                        io.to(socketId).emit("newGroupMessage", { ...socketPayload, groupId });
                  }
            });

            res.status(201).json({ success: true, data: { message: socketPayload } });

            try { await message.save(); } catch (e) { console.error(e); }

      } catch (error) {
            console.error('sendGroupMessage error:', error);
            res.status(500).json({ success: false, message: 'Failed to send group message', error: error.message });
      }
};

// @desc    Delete a group or channel
// @route   DELETE /api/messages/group/:groupId
// @access  Private
const deleteGroup = async (req, res) => {
      try {
            const { groupId } = req.params;
            const conversation = await Conversation.findById(groupId);
            
            if (!conversation || !conversation.isGroup) {
                  return res.status(404).json({ success: false, message: 'Group not found' });
            }
            
            // Only group admin can delete
            const isAdmin = conversation.groupAdmin.toString() === req.user.id;
            if (!isAdmin) {
                  return res.status(403).json({ success: false, message: 'Only the group admin can delete this' });
            }
            
            // Delete all messages in this conversation
            await Message.deleteMany({ conversationId: groupId });
            
            // Delete the conversation
            await Conversation.findByIdAndDelete(groupId);
            
            res.json({ success: true, message: 'Group/Channel deleted successfully' });
      } catch (error) {
            console.error('deleteGroup error:', error);
            res.status(500).json({ success: false, message: 'Failed to delete group', error: error.message });
      }
};

// @desc    Add participants to a group
// @route   PUT /api/messages/group/:groupId/participants/add
// @access  Private
const addGroupParticipants = async (req, res) => {
      try {
            const { groupId } = req.params;
            const { participants } = req.body; // Array of user IDs

            const conversation = await Conversation.findById(groupId);
            
            if (!conversation || !conversation.isGroup) {
                  return res.status(404).json({ success: false, message: 'Group not found' });
            }
            
            // Anyone can add participants, removed admin check

            if (!participants || participants.length === 0) {
                   return res.status(400).json({ success: false, message: 'No participants provided' });
            }

            // Filter out existing participants to prevent duplicates
            const newParticipants = participants.filter(
                  id => !conversation.participants.some(p => p.toString() === id)
            );

            if (newParticipants.length === 0) {
                  return res.status(400).json({ success: false, message: 'All users are already in the group' });
            }

            conversation.participants.push(...newParticipants);

            // Add to unread counts
            if (!conversation.unreadCount) conversation.unreadCount = new Map();
            newParticipants.forEach(id => {
                  conversation.unreadCount.set(id.toString(), 0);
            });

            await conversation.save();

            // Notify via socket (optional) - you might want to create a system message
            const sysMessage = new Message({
                  sender: req.user.id,
                  conversationId: groupId,
                  text: 'Added new participants'
            });
            await sysMessage.save();
            
            conversation.participants.forEach(pId => {
                  const socketId = getReceiverSocketId(pId.toString());
                  if (socketId) {
                        io.to(socketId).emit("newGroupMessage", { ...sysMessage.toObject(), groupId });
                  }
            });

            res.json({ success: true, message: 'Participants added successfully', data: { conversation } });
      } catch (error) {
            console.error('addGroupParticipants error:', error);
            res.status(500).json({ success: false, message: 'Failed to add participants', error: error.message });
      }
};

// @desc    Remove a participant from a group
// @route   PUT /api/messages/group/:groupId/participants/remove
// @access  Private
const removeGroupParticipant = async (req, res) => {
      try {
            const { groupId } = req.params;
            const { userId } = req.body;

            const conversation = await Conversation.findById(groupId);
            
            if (!conversation || !conversation.isGroup) {
                  return res.status(404).json({ success: false, message: 'Group not found' });
            }
            
            // Only group admin can remove, and cannot remove themselves this way (use leave group)
            if (conversation.groupAdmin.toString() !== req.user.id) {
                  return res.status(403).json({ success: false, message: 'Only the group admin can remove participants' });
            }

            if (userId === req.user.id) {
                   return res.status(400).json({ success: false, message: 'You cannot remove yourself. Use leave group instead.' });
            }

            const index = conversation.participants.findIndex(p => p.toString() === userId);
            if (index === -1) {
                  return res.status(404).json({ success: false, message: 'User is not in the group' });
            }

            conversation.participants.splice(index, 1);
            if (conversation.unreadCount) {
                  conversation.unreadCount.delete(userId);
            }

            await conversation.save();

            const sysMessage = new Message({
                  sender: req.user.id,
                  conversationId: groupId,
                  text: 'Removed a participant'
            });
            await sysMessage.save();
            
            conversation.participants.forEach(pId => {
                  const socketId = getReceiverSocketId(pId.toString());
                  if (socketId) {
                        io.to(socketId).emit("newGroupMessage", { ...sysMessage.toObject(), groupId });
                  }
            });

            res.json({ success: true, message: 'Participant removed successfully', data: { conversation } });
      } catch (error) {
            console.error('removeGroupParticipant error:', error);
            res.status(500).json({ success: false, message: 'Failed to remove participant', error: error.message });
      }
};

// @desc    Leave a group
// @route   PUT /api/messages/group/:groupId/leave
// @access  Private
const leaveGroup = async (req, res) => {
      try {
            const { groupId } = req.params;

            const conversation = await Conversation.findById(groupId);
            
            if (!conversation || !conversation.isGroup) {
                  return res.status(404).json({ success: false, message: 'Group not found' });
            }
            
            const index = conversation.participants.findIndex(p => p.toString() === req.user.id);
            if (index === -1) {
                  return res.status(400).json({ success: false, message: 'You are not in this group' });
            }

            conversation.participants.splice(index, 1);
            if (conversation.unreadCount) {
                  conversation.unreadCount.delete(req.user.id);
            }

            // If the user leaving is the admin
            if (conversation.groupAdmin.toString() === req.user.id) {
                  if (conversation.participants.length > 0) {
                        // Reassign admin to the next participant
                        conversation.groupAdmin = conversation.participants[0];
                  } else {
                        // Delete group if empty
                        await Message.deleteMany({ conversationId: groupId });
                        await Conversation.findByIdAndDelete(groupId);
                        return res.json({ success: true, message: 'Left group. Group deleted as it was empty.' });
                  }
            }

            await conversation.save();

            const sysMessage = new Message({
                  sender: req.user.id,
                  conversationId: groupId,
                  text: 'Left the group'
            });
            await sysMessage.save();
            
            conversation.participants.forEach(pId => {
                  const socketId = getReceiverSocketId(pId.toString());
                  if (socketId) {
                        io.to(socketId).emit("newGroupMessage", { ...sysMessage.toObject(), groupId });
                  }
            });

            res.json({ success: true, message: 'Successfully left the group', data: { conversation } });
      } catch (error) {
            console.error('leaveGroup error:', error);
            res.status(500).json({ success: false, message: 'Failed to leave group', error: error.message });
      }
};

// @desc    Update group info
// @route   PUT /api/messages/group/:groupId/info
// @access  Private
const updateGroupInfo = async (req, res) => {
      try {
            const { groupId } = req.params;
            const { groupName, groupDescription } = req.body;

            const conversation = await Conversation.findById(groupId);
            
            if (!conversation || !conversation.isGroup) {
                  return res.status(404).json({ success: false, message: 'Group not found' });
            }
            
            // Only group admin can update info
            if (conversation.groupAdmin.toString() !== req.user.id) {
                  return res.status(403).json({ success: false, message: 'Only the group admin can update info' });
            }

            if (groupName) conversation.groupName = groupName;
            if (groupDescription !== undefined) conversation.groupDescription = groupDescription;

            // Handle file upload if present
            if (req.file) {
                  const isCloudinary = !!(process.env.CLOUDINARY_CLOUD_NAME);
                  if (isCloudinary) {
                        conversation.groupAvatar = req.file.path;
                  } else {
                        conversation.groupAvatar = `/uploads/${req.file.filename}`;
                  }
            }

            await conversation.save();

            res.json({ success: true, message: 'Group info updated successfully', data: { conversation } });
      } catch (error) {
            console.error('updateGroupInfo error:', error);
            res.status(500).json({ success: false, message: 'Failed to update group info', error: error.message });
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
      clearChat,
      createGroup,
      getGroupMessages,
      sendGroupMessage,
      deleteGroup,
      addGroupParticipants,
      removeGroupParticipant,
      leaveGroup,
      updateGroupInfo
};
