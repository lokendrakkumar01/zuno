const express = require('express');
const mongoose = require('mongoose');
const { Message, Conversation } = require('../models/Message');
const Room = require('../models/Room');
const User = require('../models/User');
const { protect } = require('../middlewares/auth.middleware');
const { uploadMultiple } = require('../middlewares/upload.middleware');
const { emitToUser } = require('../socket');
const { createNotification } = require('../utils/notificationService');

const router = express.Router();
router.use(protect);

const toId = (value) => value?.toString?.() || String(value || '');
const cleanText = (value) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, 2000);

const messageView = (message) => ({
  _id: toId(message._id),
  id: toId(message._id),
  roomId: toId(message.roomId || ''),
  conversationId: toId(message.conversationId || message.roomId || ''),
  sender: message.sender,
  receiver: message.receiver,
  text: message.text,
  media: message.media,
  status: message.status,
  read: message.read,
  deliveredAt: message.deliveredAt,
  readAt: message.readAt,
  replyTo: message.replyTo || null,
  reactions: message.reactions || [],
  deletedForEveryone: Boolean(message.deletedForEveryone),
  deletedBy: message.deletedBy || [],
  clientMsgId: message.clientMsgId,
  createdAt: message.createdAt,
  updatedAt: message.updatedAt
});

const getDirectRoom = async (userA, userB) => {
  const ids = [toId(userA), toId(userB)].sort();
  let room = await Room.findOne({ type: 'direct', participants: { $all: ids, $size: 2 } });
  if (room) return room;
  room = await Room.create({ type: 'direct', participants: ids, createdBy: userA });
  return room;
};

router.get('/conversations', async (req, res) => {
  try {
    const [rooms, legacy] = await Promise.all([
      Room.find({ participants: req.user._id })
        .populate('participants', 'username displayName avatar isOnline offlineStatus')
        .populate({
          path: 'lastMessage',
          populate: { path: 'sender receiver', select: 'username displayName avatar' }
        })
        .sort({ updatedAt: -1 })
        .limit(50)
        .lean(),
      Conversation.find({ participants: req.user._id })
        .populate('participants', 'username displayName avatar isOnline offlineStatus')
        .populate('lastMessage.sender', 'username displayName avatar')
        .sort({ updatedAt: -1 })
        .limit(50)
        .lean()
    ]);

    const currentUserId = toId(req.user._id);
    const directRooms = rooms.map((room) => {
      const otherUser = (room.participants || []).find((participant) => toId(participant._id || participant) !== currentUserId);
      return {
        _id: toId(room._id),
        id: toId(room._id),
        roomId: toId(room._id),
        user: otherUser || null,
        isGroup: false,
        lastMessage: room.lastMessage ? messageView(room.lastMessage) : null,
        unreadCount: 0,
        updatedAt: room.updatedAt
      };
    });

    const legacyConversations = legacy.map((conversation) => {
      const otherUser = !conversation.isGroup
        ? (conversation.participants || []).find((participant) => toId(participant._id || participant) !== currentUserId)
        : null;
      return {
        _id: toId(conversation._id),
        id: toId(conversation._id),
        user: otherUser,
        isGroup: Boolean(conversation.isGroup),
        isChannel: Boolean(conversation.isChannel),
        groupName: conversation.groupName || '',
        groupAvatar: conversation.groupAvatar || '',
        participants: conversation.participants || [],
        lastMessage: conversation.lastMessage || null,
        unreadCount: Number(conversation.unreadCount?.[currentUserId] || conversation.unreadCount?.get?.(currentUserId) || 0),
        updatedAt: conversation.updatedAt
      };
    });

    const conversations = [...directRooms, ...legacyConversations]
      .filter((conversation, index, list) => {
        const key = conversation.isGroup
          ? `group:${conversation._id}`
          : `dm:${toId(conversation.user?._id || conversation.user?.id || conversation.user)}`;
        return key !== 'dm:' && list.findIndex((item) => {
          const itemKey = item.isGroup
            ? `group:${item._id}`
            : `dm:${toId(item.user?._id || item.user?.id || item.user)}`;
          return itemKey === key;
        }) === index;
      })
      .sort((left, right) => new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0));

    return res.json({ success: true, conversations, data: { conversations } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Unread message count for nav badge (polled by Layout every 30s)
router.get('/unread/count', async (req, res) => {
  try {
    const unreadCount = await Message.countDocuments({
      receiver: req.user._id,
      read: false
    });
    return res.json({ success: true, data: { unreadCount } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:userId', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 30, 30);
    const before = req.query.before;
    const room = await getDirectRoom(req.user._id, req.params.userId);
    const query = { roomId: room._id, deletedBy: { $ne: req.user._id } };
    if (before && mongoose.isValidObjectId(before)) query._id = { $lt: before };

    const messages = await Message.find(query)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .populate('sender', 'username displayName avatar')
      .populate('receiver', 'username displayName avatar')
      .lean();

    const hasMore = messages.length > limit;
    const page = messages.slice(0, limit).reverse().map(messageView);
    const response = {
      success: true,
      messages: page,
      nextCursor: hasMore ? toId(messages[limit - 1]._id) : null,
      hasMore,
      otherUser: null,
      blockedInfo: { iBlocked: false, theyBlocked: false }
    };

    const otherUser = await User.findById(req.params.userId).select('username displayName avatar isOnline offlineStatus blockedUsers').lean();
    if (otherUser) {
      response.otherUser = {
        _id: toId(otherUser._id),
        id: toId(otherUser._id),
        username: otherUser.username,
        displayName: otherUser.displayName || otherUser.username,
        avatar: otherUser.avatar || '',
        isOnline: Boolean(otherUser.isOnline),
        offlineStatus: otherUser.offlineStatus || null
      };
      response.blockedInfo = {
        iBlocked: Array.isArray(req.user.blockedUsers) && req.user.blockedUsers.some((id) => toId(id) === toId(req.params.userId)),
        theyBlocked: Array.isArray(otherUser.blockedUsers) && otherUser.blockedUsers.some((id) => toId(id) === toId(req.user._id))
      };
    }

    return res.json({ ...response, data: response });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:userId', uploadMultiple.single('media'), async (req, res) => {
  try {
    const text = cleanText(req.body.text);
    if (!text && !req.file) return res.status(400).json({ success: false, message: 'Message text or media is required' });

    const room = await getDirectRoom(req.user._id, req.params.userId);
    const media = req.file ? {
      url: req.file.path,
      type: req.file.mimetype.startsWith('video/') ? 'video' : 'image'
    } : { url: '', type: '' };

    const message = await Message.create({
      roomId: room._id,
      sender: req.user._id,
      receiver: req.params.userId,
      clientMsgId: cleanText(req.body.clientMsgId).slice(0, 80),
      text,
      media,
      status: 'sent'
    });

    await Room.findByIdAndUpdate(room._id, { lastMessage: message._id, updatedAt: new Date() });
    const populated = await Message.findById(message._id)
      .populate('sender', 'username displayName avatar')
      .populate('receiver', 'username displayName avatar')
      .lean();
    const payload = messageView(populated);

    emitToUser(req.params.userId, 'newMessage', payload);
    emitToUser(req.params.userId, 'new_message', payload);
    emitToUser(req.params.userId, 'message-received', payload);
    emitToUser(req.user._id, 'newMessage', payload);
    emitToUser(req.user._id, 'new_message', payload);

    createNotification({
      recipientId: req.params.userId,
      actor: req.user._id,
      type: 'message',
      title: 'New message',
      body: text || 'Sent you a message',
      entityType: 'message',
      entityId: message._id,
      metadata: { roomId: room._id, senderId: req.user._id }
    }).catch((error) => console.warn('[Messages] Notification failed:', error.message));

    return res.status(201).json({ success: true, message: payload });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Duplicate client message id' });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:userId/read', async (req, res) => {
  try {
    const room = await getDirectRoom(req.user._id, req.params.userId);
    await Message.updateMany(
      { roomId: room._id, receiver: req.user._id, read: false },
      { read: true, status: 'read', readAt: new Date() }
    );
    emitToUser(req.params.userId, 'messageRead', { readerId: toId(req.user._id), receiverId: toId(req.user._id) });
    emitToUser(req.params.userId, 'message_read', { readerId: toId(req.user._id), receiverId: toId(req.user._id) });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/react/:messageId', async (req, res) => {
  try {
    const emoji = cleanText(req.body.emoji).slice(0, 20);
    if (!emoji) return res.status(400).json({ success: false, message: 'Emoji is required' });

    const message = await Message.findById(req.params.messageId);
    if (!message) return res.status(404).json({ success: false, message: 'Message not found' });

    message.reactions = (message.reactions || []).filter((reaction) => toId(reaction.user) !== toId(req.user._id));
    message.reactions.push({ user: req.user._id, emoji });
    await message.save();

    const payload = { messageId: toId(message._id), reactions: message.reactions };
    emitToUser(message.sender, 'messageReaction', payload);
    emitToUser(message.sender, 'message_reaction', payload);
    if (message.receiver) {
      emitToUser(message.receiver, 'messageReaction', payload);
      emitToUser(message.receiver, 'message_reaction', payload);
    }

    return res.json({ success: true, data: payload });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/delete/:messageId', async (req, res) => {
  try {
    const type = req.query.type === 'everyone' ? 'everyone' : 'me';
    const update = type === 'everyone'
      ? { deletedForEveryone: true, text: '', media: { url: '', type: '' } }
      : { $addToSet: { deletedBy: req.user._id } };

    const message = await Message.findByIdAndUpdate(req.params.messageId, update, { new: true });
    if (!message) return res.status(404).json({ success: false, message: 'Message not found' });

    const payload = { messageId: toId(message._id), type };
    emitToUser(message.sender, 'messageDeletedForEveryone', payload);
    emitToUser(message.sender, 'message_deleted', payload);
    if (message.receiver) {
      emitToUser(message.receiver, 'messageDeletedForEveryone', payload);
      emitToUser(message.receiver, 'message_deleted', payload);
    }

    return res.json({ success: true, data: payload });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
