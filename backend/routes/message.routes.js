const express = require('express');
const mongoose = require('mongoose');
const { Message, Conversation } = require('../models/Message');
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

const getUnreadForUser = (conversation, userId) => {
  const unread = conversation?.unreadCount;
  const key = toId(userId);
  if (!unread) return 0;
  if (typeof unread.get === 'function') return Number(unread.get(key) || 0);
  return Number(unread[key] || 0);
};

const getDirectConversation = async (userA, userB, { create = true } = {}) => {
  const participants = [toId(userA), toId(userB)].sort();
  let conversation = await Conversation.findOne({
    participants: { $all: participants, $size: 2 },
    isGroup: false
  });
  if (conversation || !create) return conversation;
  conversation = await Conversation.create({
    participants,
    isGroup: false,
    unreadCount: new Map()
  });
  return conversation;
};

const getConversationForParam = async (currentUserId, paramId) => {
  if (!mongoose.isValidObjectId(paramId)) return { conversation: null, otherUserId: paramId };

  const conversation = await Conversation.findOne({
    _id: paramId,
    participants: currentUserId
  });

  if (conversation) {
    const otherUserId = (conversation.participants || [])
      .map(toId)
      .find((id) => id !== toId(currentUserId));
    return { conversation, otherUserId, isConversationId: true };
  }

  const directConversation = await getDirectConversation(currentUserId, paramId);
  return { conversation: directConversation, otherUserId: paramId, isConversationId: false };
};

router.get('/conversations', async (req, res) => {
  try {
    const legacy = await Conversation.find({ participants: req.user._id })
      .populate('participants', 'username displayName avatar isOnline offlineStatus')
      .populate('lastMessage.sender', 'username displayName avatar')
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();

    const currentUserId = toId(req.user._id);
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
        unreadCount: getUnreadForUser(conversation, currentUserId),
        updatedAt: conversation.updatedAt
      };
    });

    const conversations = legacyConversations
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
    const before = req.query.before || req.query.beforeId;
    const { conversation, otherUserId } = await getConversationForParam(req.user._id, req.params.userId);
    const query = {
      conversationId: conversation._id,
      deletedBy: { $ne: req.user._id }
    };
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

    const otherUser = await User.findById(otherUserId).select('username displayName avatar isOnline offlineStatus blockedUsers').lean();
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
        iBlocked: Array.isArray(req.user.blockedUsers) && req.user.blockedUsers.some((id) => toId(id) === toId(otherUserId)),
        theyBlocked: Array.isArray(otherUser.blockedUsers) && otherUser.blockedUsers.some((id) => toId(id) === toId(req.user._id))
      };
    }

    await Promise.all([
      Message.updateMany(
        { conversationId: conversation._id, receiver: req.user._id, read: false },
        { $set: { read: true, status: 'read', readAt: new Date() } }
      ),
      Conversation.findByIdAndUpdate(conversation._id, { $set: { [`unreadCount.${toId(req.user._id)}`]: 0 } })
    ]);

    return res.json({ ...response, data: response });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:userId', uploadMultiple.single('media'), async (req, res) => {
  try {
    const text = cleanText(req.body.text);
    if (!text && !req.file) return res.status(400).json({ success: false, message: 'Message text or media is required' });

    const conversation = await getDirectConversation(req.user._id, req.params.userId);
    const media = req.file ? {
      url: req.file.path,
      type: req.file.mimetype.startsWith('video/') ? 'video' : 'image'
    } : { url: '', type: '' };

    const message = await Message.create({
      conversationId: conversation._id,
      sender: req.user._id,
      receiver: req.params.userId,
      clientMsgId: cleanText(req.body.clientMsgId).slice(0, 80),
      text,
      media,
      status: 'sent'
    });

    await Conversation.findByIdAndUpdate(conversation._id, {
      $set: {
        lastMessage: {
          text: text || (media.type ? `${media.type[0].toUpperCase()}${media.type.slice(1)} attachment` : 'Media shared'),
          sender: req.user._id,
          createdAt: message.createdAt
        },
        updatedAt: new Date()
      },
      $inc: { [`unreadCount.${toId(req.params.userId)}`]: 1 }
    });
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
      metadata: { conversationId: conversation._id, senderId: req.user._id }
    }).catch((error) => console.warn('[Messages] Notification failed:', error.message));

    return res.status(201).json({ success: true, message: payload, data: { message: payload } });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Duplicate client message id' });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/edit/:messageId', async (req, res) => {
  try {
    const text = cleanText(req.body.text);
    if (!text) return res.status(400).json({ success: false, message: 'Message text is required' });

    const message = await Message.findOneAndUpdate(
      { _id: req.params.messageId, sender: req.user._id, deletedForEveryone: { $ne: true } },
      { text, edited: true, editedAt: new Date() },
      { new: true }
    )
      .populate('sender', 'username displayName avatar')
      .populate('receiver', 'username displayName avatar')
      .lean();

    if (!message) return res.status(404).json({ success: false, message: 'Message not found or cannot be edited' });

    const payload = messageView(message);
    emitToUser(message.sender, 'messageEdited', payload);
    emitToUser(message.sender, 'message_edited', payload);
    if (message.receiver) {
      emitToUser(message.receiver, 'messageEdited', payload);
      emitToUser(message.receiver, 'message_edited', payload);
    }

    return res.json({ success: true, data: { message: payload }, message: payload });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/clear/:userId', async (req, res) => {
  try {
    const conversation = await getDirectConversation(req.user._id, req.params.userId);
    await Message.updateMany(
      { conversationId: conversation._id, $or: [{ sender: req.user._id }, { receiver: req.user._id }] },
      { $addToSet: { deletedBy: req.user._id } }
    );
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:userId/read', async (req, res) => {
  try {
    const conversation = await getDirectConversation(req.user._id, req.params.userId);
    await Message.updateMany(
      { conversationId: conversation._id, receiver: req.user._id, read: false },
      { read: true, status: 'read', readAt: new Date() }
    );
    await Conversation.findByIdAndUpdate(conversation._id, { $set: { [`unreadCount.${toId(req.user._id)}`]: 0 } });
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

    const updatedMessage = await Message.findById(message._id)
      .populate('sender', 'username displayName avatar')
      .populate('receiver', 'username displayName avatar')
      .lean();

    return res.json({ success: true, data: { ...payload, message: messageView(updatedMessage) } });
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
    if (type === 'everyone') {
      emitToUser(message.sender, 'messageDeletedForEveryone', payload);
      emitToUser(message.sender, 'message_deleted', payload);
      if (message.receiver) {
        emitToUser(message.receiver, 'messageDeletedForEveryone', payload);
        emitToUser(message.receiver, 'message_deleted', payload);
      }
    } else {
      emitToUser(req.user._id, 'message_deleted', payload);
    }

    return res.json({ success: true, data: payload });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
