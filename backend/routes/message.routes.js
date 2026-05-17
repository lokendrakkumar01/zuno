const express = require('express');
const mongoose = require('mongoose');
const { Message, Conversation } = require('../models/Message');
const User = require('../models/User');
const { protect } = require('../middlewares/auth.middleware');
const { uploadMultiple } = require('../middlewares/upload.middleware');
const { emitToUser, isUserOnline } = require('../socket');
const { createNotification } = require('../utils/notificationService');

const router = express.Router();
router.use(protect);

const toId = (value) => value?.toString?.() || String(value || '');
const cleanText = (value) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, 2000);
const isParticipantId = (id, ...candidates) => candidates.some((candidate) => toId(candidate) === toId(id));
const mediaFromBody = (body = {}, file = null) => {
  const rawUrl = body.mediaUrl || body.media?.url || (file ? file.path : '');
  const fileType = file?.mimetype?.startsWith('video/')
    ? 'video'
    : file?.mimetype?.startsWith('audio/')
      ? 'audio'
      : file?.mimetype?.startsWith('image/')
        ? 'image'
        : file
          ? 'file'
          : '';
  const mediaType = body.mediaType || body.media?.type || fileType;
  const url = String(rawUrl || '').trim();
  return {
    mediaUrl: url,
    media: {
      url,
      type: ['image', 'video', 'audio', 'file'].includes(mediaType) ? mediaType : '',
      name: body.mediaName || file?.originalname || '',
      size: Number(body.mediaSize || file?.size || 0),
      duration: Number(body.mediaDuration || 0)
    }
  };
};

const messageView = (message) => ({
  _id: toId(message._id),
  id: toId(message._id),
  roomId: toId(message.roomId || ''),
  conversationId: toId(message.conversationId || message.roomId || ''),
  sender: message.sender,
  receiver: message.receiver,
  content: message.content || message.text || '',
  text: message.text || message.content || '',
  mediaUrl: message.mediaUrl || message.media?.url || '',
  media: message.media?.url || message.mediaUrl
    ? { ...(message.media || {}), url: message.media?.url || message.mediaUrl }
    : (message.media || { url: '', type: '' }),
  status: message.status,
  read: message.read,
  readBy: message.readBy || [],
  deliveredAt: message.deliveredAt,
  readAt: message.readAt,
  replyTo: message.replyTo || null,
  reactions: message.reactions || [],
  deletedForEveryone: Boolean(message.deletedForEveryone),
  deletedFor: message.deletedFor || message.deletedBy || [],
  deletedBy: message.deletedBy || message.deletedFor || [],
  edited: Boolean(message.edited),
  editedAt: message.editedAt || null,
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

const populateMessage = (id) => Message.findById(id)
  .populate('sender', 'username displayName avatar')
  .populate('receiver', 'username displayName avatar')
  .lean();

const conversationRecipients = (conversation, senderId, fallbackReceiverId) => {
  const sender = toId(senderId);
  const participants = (conversation?.participants || []).map(toId).filter(Boolean);
  const recipients = participants.filter((id) => id !== sender);
  if (recipients.length > 0) return recipients;
  return fallbackReceiverId ? [toId(fallbackReceiverId)] : [];
};

const emitMessageToParticipants = (conversation, senderId, event, payload) => {
  const participants = new Set([
    toId(senderId),
    toId(payload?.receiver?._id || payload?.receiver),
    ...(conversation?.participants || []).map(toId)
  ].filter(Boolean));
  participants.forEach((participantId) => emitToUser(participantId, event, payload));
};

const emitStatusToSender = (senderId, payload) => {
  emitToUser(senderId, 'message-status', payload);
  emitToUser(senderId, 'messageStatus', payload);
  emitToUser(senderId, 'message_status', payload);
  if (payload.status === 'read') {
    emitToUser(senderId, 'messages-read', payload);
    emitToUser(senderId, 'messages_read', payload);
    emitToUser(senderId, 'messageRead', payload);
    emitToUser(senderId, 'message_read', payload);
  }
};

const markMessagesDelivered = async ({ conversation, message, senderId, payload }) => {
  const recipients = conversationRecipients(conversation, senderId, message.receiver);
  const delivered = recipients.some((recipientId) => (typeof isUserOnline === 'function' ? isUserOnline(recipientId) : false));

  if (!delivered) return payload;

  const deliveredAt = new Date();
  await Message.findByIdAndUpdate(message._id, {
    $set: { status: 'delivered', deliveredAt }
  });

  const nextPayload = {
    ...payload,
    status: 'delivered',
    deliveredAt
  };

  emitStatusToSender(senderId, {
    messageId: toId(message._id),
    messageIds: [toId(message._id)],
    clientMsgId: message.clientMsgId,
    conversationId: toId(conversation?._id),
    status: 'delivered',
    deliveredAt
  });

  return nextPayload;
};

const resolveDuplicateMessage = async ({ req, receiverId, clientMsgId }) => {
  if (!clientMsgId) return null;
  const query = {
    sender: req.user._id,
    clientMsgId,
    ...(receiverId ? { receiver: receiverId } : {})
  };
  const existing = await Message.findOne(query)
    .populate('sender', 'username displayName avatar')
    .populate('receiver', 'username displayName avatar')
    .lean();
  return existing ? messageView(existing) : null;
};

const markConversationRead = async ({ conversation, readerId, otherUserId }) => {
  const readAt = new Date();
  const unreadMessages = await Message.find({
    conversationId: conversation._id,
    receiver: readerId,
    read: false,
    deletedForEveryone: { $ne: true }
  })
    .select('_id sender clientMsgId')
    .lean();

  if (unreadMessages.length === 0) {
    await Conversation.findByIdAndUpdate(conversation._id, { $set: { [`unreadCount.${toId(readerId)}`]: 0 } });
    return [];
  }

  const messageIds = unreadMessages.map((message) => message._id);
  await Promise.all([
    Message.updateMany(
      { _id: { $in: messageIds } },
      { $set: { read: true, status: 'read', readAt }, $addToSet: { readBy: readerId } }
    ),
    Conversation.findByIdAndUpdate(conversation._id, { $set: { [`unreadCount.${toId(readerId)}`]: 0 } })
  ]);

  const idsBySender = unreadMessages.reduce((acc, message) => {
    const sender = toId(message.sender || otherUserId);
    if (!sender) return acc;
    if (!acc.has(sender)) acc.set(sender, []);
    acc.get(sender).push(toId(message._id));
    return acc;
  }, new Map());

  idsBySender.forEach((ids, senderId) => {
    emitStatusToSender(senderId, {
      status: 'read',
      readerId: toId(readerId),
      conversationId: toId(conversation._id),
      messageIds: ids,
      messageId: ids[ids.length - 1],
      readAt
    });
  });

  return messageIds.map(toId);
};

const updateLastMessage = async ({ conversation, message, senderId, preview, mediaUrl }) => {
  const inc = conversationRecipients(conversation, senderId, message.receiver)
    .reduce((acc, recipientId) => ({ ...acc, [`unreadCount.${recipientId}`]: 1 }), {});

  await Conversation.findByIdAndUpdate(conversation._id, {
    $set: {
      lastMessage: {
        content: preview,
        text: preview,
        mediaUrl: mediaUrl || '',
        sender: senderId,
        createdAt: message.createdAt
      },
      updatedAt: new Date()
    },
    ...(Object.keys(inc).length ? { $inc: inc } : {})
  });
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

router.post('/', uploadMultiple.single('media'), async (req, res) => {
  try {
    const content = cleanText(req.body.content || req.body.text);
    const receiverId = req.body.receiver || req.body.receiverId;
    const providedConversationId = req.body.conversationId;
    const { media, mediaUrl } = mediaFromBody(req.body, req.file);

    if (!content && !mediaUrl) {
      return res.status(400).json({ success: false, message: 'Message content or media is required' });
    }

    let conversation;
    if (providedConversationId && mongoose.isValidObjectId(providedConversationId)) {
      conversation = await Conversation.findOne({ _id: providedConversationId, participants: req.user._id });
      if (!conversation && receiverId && mongoose.isValidObjectId(receiverId)) {
        conversation = await getDirectConversation(req.user._id, receiverId);
      }
      if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found' });
    } else if (receiverId && mongoose.isValidObjectId(receiverId)) {
      conversation = await getDirectConversation(req.user._id, receiverId);
    } else {
      return res.status(400).json({ success: false, message: 'conversationId or receiver is required' });
    }

    const finalReceiverId = receiverId || conversationRecipients(conversation, req.user._id)[0] || null;
    const clientMsgId = cleanText(req.body.clientMsgId).slice(0, 80) || undefined;
    const duplicate = await resolveDuplicateMessage({ req, receiverId: finalReceiverId, clientMsgId });
    if (duplicate) {
      return res.status(200).json({ success: true, duplicate: true, message: duplicate, data: { message: duplicate } });
    }

    const message = await Message.create({
      conversationId: conversation._id,
      sender: req.user._id,
      receiver: finalReceiverId,
      clientMsgId,
      content,
      text: content,
      media,
      mediaUrl,
      type: media.type || 'text',
      readBy: [req.user._id],
      status: 'sent'
    });

    const preview = content || (media.type ? `${media.type[0].toUpperCase()}${media.type.slice(1)} attachment` : 'Media shared');
    await updateLastMessage({ conversation, message, senderId: req.user._id, preview, mediaUrl });

    const populated = await populateMessage(message._id);
    const payload = await markMessagesDelivered({
      conversation,
      message,
      senderId: req.user._id,
      payload: messageView(populated)
    });

    emitMessageToParticipants(conversation, req.user._id, 'newMessage', payload);
    emitMessageToParticipants(conversation, req.user._id, 'new_message', payload);

    conversationRecipients(conversation, req.user._id, finalReceiverId).forEach((recipientId) => {
      createNotification({
        recipientId,
        actor: req.user._id,
        type: 'message',
        title: 'New message',
        body: content || 'Sent you a message',
        entityType: 'message',
        entityId: message._id,
        metadata: { conversationId: conversation._id, senderId: req.user._id }
      }).catch((error) => console.warn('[Messages] Notification failed:', error.message));
    });

    return res.status(201).json({ success: true, message: payload, data: { message: payload } });
  } catch (error) {
    if (error.code === 11000) {
      const duplicate = await resolveDuplicateMessage({
        req,
        receiverId: req.body.receiver || req.body.receiverId,
        clientMsgId: cleanText(req.body.clientMsgId).slice(0, 80)
      }).catch(() => null);
      if (duplicate) return res.status(200).json({ success: true, duplicate: true, message: duplicate, data: { message: duplicate } });
      return res.status(409).json({ success: false, message: 'Duplicate client message id' });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/:id/edit', async (req, res) => {
  try {
    const content = cleanText(req.body.content || req.body.text);
    if (!content) return res.status(400).json({ success: false, message: 'Message content is required' });

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const message = await Message.findOne({
      _id: req.params.id,
      sender: req.user._id,
      createdAt: { $gte: oneHourAgo },
      deletedForEveryone: { $ne: true }
    });

    if (!message) {
      return res.status(403).json({ success: false, message: 'Message cannot be edited after 1 hour or by another user' });
    }

    message.content = content;
    message.text = content;
    message.edited = true;
    message.editedAt = new Date();
    await message.save();

    const conversation = await Conversation.findById(message.conversationId).lean();
    const payload = messageView(await populateMessage(message._id));
    emitMessageToParticipants(conversation, req.user._id, 'messageEdited', payload);
    emitMessageToParticipants(conversation, req.user._id, 'message_edited', payload);

    return res.json({ success: true, message: payload, data: { message: payload } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id/delete-for-everyone', async (req, res) => {
  try {
    const message = await Message.findOneAndUpdate(
      { _id: req.params.id, sender: req.user._id },
      {
        $set: {
          deletedForEveryone: true,
          content: '',
          text: '',
          mediaUrl: '',
          media: { url: '', type: '' }
        }
      },
      { new: true }
    );
    if (!message) return res.status(404).json({ success: false, message: 'Message not found or not yours' });

    const conversation = await Conversation.findById(message.conversationId).lean();
    const payload = { messageId: toId(message._id), type: 'everyone', conversationId: toId(message.conversationId) };
    emitMessageToParticipants(conversation, req.user._id, 'messageDeletedForEveryone', payload);
    emitMessageToParticipants(conversation, req.user._id, 'message_deleted', payload);
    return res.json({ success: true, data: payload });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id/delete-for-me', async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ success: false, message: 'Message not found' });
    if (!isParticipantId(req.user._id, message.sender, message.receiver)) {
      const conversation = message.conversationId ? await Conversation.findOne({ _id: message.conversationId, participants: req.user._id }).lean() : null;
      if (!conversation) return res.status(403).json({ success: false, message: 'Not authorized for this message' });
    }
    await Message.findByIdAndUpdate(req.params.id, { $addToSet: { deletedFor: req.user._id, deletedBy: req.user._id } });
    const payload = { messageId: toId(message._id), type: 'me', conversationId: toId(message.conversationId), deletedBy: toId(req.user._id) };
    emitToUser(req.user._id, 'message_deleted', payload);
    return res.json({ success: true, data: payload });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:userId', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 30, 30);
    const before = req.query.before || req.query.beforeId;
    const pageNumber = Math.max(Number(req.query.page) || 1, 1);
    const { conversation, otherUserId } = await getConversationForParam(req.user._id, req.params.userId);
    const query = {
      conversationId: conversation._id,
      deletedBy: { $ne: req.user._id },
      deletedFor: { $ne: req.user._id }
    };
    if (before && mongoose.isValidObjectId(before)) query._id = { $lt: before };

    const messages = await Message.find(query)
      .sort({ _id: -1 })
      .skip(before ? 0 : (pageNumber - 1) * limit)
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

    await markConversationRead({ conversation, readerId: req.user._id, otherUserId });

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
    const { media, mediaUrl } = mediaFromBody(req.body, req.file);

    const clientMsgId = cleanText(req.body.clientMsgId).slice(0, 80) || undefined;
    const duplicate = await resolveDuplicateMessage({ req, receiverId: req.params.userId, clientMsgId });
    if (duplicate) {
      return res.status(200).json({ success: true, duplicate: true, message: duplicate, data: { message: duplicate } });
    }

    const message = await Message.create({
      conversationId: conversation._id,
      sender: req.user._id,
      receiver: req.params.userId,
      clientMsgId,
      content: text,
      text,
      media,
      mediaUrl,
      readBy: [req.user._id],
      status: 'sent'
    });

    await Conversation.findByIdAndUpdate(conversation._id, {
      $set: {
        lastMessage: {
          text: text || (media.type ? `${media.type[0].toUpperCase()}${media.type.slice(1)} attachment` : 'Media shared'),
          content: text || (media.type ? `${media.type[0].toUpperCase()}${media.type.slice(1)} attachment` : 'Media shared'),
          mediaUrl,
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
    const payload = await markMessagesDelivered({
      conversation,
      message,
      senderId: req.user._id,
      payload: messageView(populated)
    });

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
      const duplicate = await resolveDuplicateMessage({
        req,
        receiverId: req.params.userId,
        clientMsgId: cleanText(req.body.clientMsgId).slice(0, 80)
      }).catch(() => null);
      if (duplicate) return res.status(200).json({ success: true, duplicate: true, message: duplicate, data: { message: duplicate } });
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
      {
        _id: req.params.messageId,
        sender: req.user._id,
        createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
        deletedForEveryone: { $ne: true }
      },
      { content: text, text, edited: true, editedAt: new Date() },
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
    const messageIds = await markConversationRead({ conversation, readerId: req.user._id, otherUserId: req.params.userId });
    return res.json({ success: true, data: { messageIds } });
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
    const current = await Message.findById(req.params.messageId);
    if (!current) return res.status(404).json({ success: false, message: 'Message not found' });
    if (!isParticipantId(req.user._id, current.sender, current.receiver)) {
      const conversation = current.conversationId ? await Conversation.findOne({ _id: current.conversationId, participants: req.user._id }).lean() : null;
      if (!conversation) return res.status(403).json({ success: false, message: 'Not authorized for this message' });
    }
    if (type === 'everyone' && !isParticipantId(req.user._id, current.sender)) {
      return res.status(403).json({ success: false, message: 'Only the sender can delete for everyone' });
    }
    const update = type === 'everyone'
      ? { deletedForEveryone: true, content: '', text: '', mediaUrl: '', media: { url: '', type: '' } }
      : { $addToSet: { deletedFor: req.user._id, deletedBy: req.user._id } };

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
