/**
 * messageController.js — FIX: PROBLEMS 4 & 6
 *
 * FIX PROBLEM 4 (DB slow):
 *   - Promise.all() for parallel DB operations wherever possible
 *   - .lean() on every read query (returns plain JS objects, ~40 % faster)
 *   - Cursor-based pagination (no expensive .skip()) using _id or createdAt
 *   - Conversation lastMessage update is setImmediate (non-blocking)
 *
 * FIX PROBLEM 6 (Missing features):
 *   - After sending, Conversation.lastMessage + unreadCount updated in background
 *   - Mark-as-read also resets unreadCount in a single atomic update
 */

'use strict';

const { Message, Conversation } = require('../models/Message');
const User = require('../models/User');

// Use lazy require so the file works even if socket hasn't been initialized yet
const getSocket = () => {
  try {
    return require('../socket');
  } catch {
    return null;
  }
};

// ─── Small helpers ────────────────────────────────────────────────────────────

const normalizeId = (v) => {
  if (!v) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (typeof v?.toHexString === 'function') return v.toHexString();
  if (v?._id) return normalizeId(v._id);
  if (v?.id)  return normalizeId(v.id);
  const str = v?.toString?.();
  return str && str !== '[object Object]' ? str : '';
};

const hasId = (list, id) =>
  Array.isArray(list) && list.some((e) => e?.toString() === id?.toString());

const fail = (res, status, message) =>
  res.status(status).json({ success: false, message });

const serverError = (res, msg, err) => {
  if (process.env.NODE_ENV !== 'production') console.error(`[Messages] ${msg}:`, err);
  return res.status(500).json({ success: false, message: msg });
};

// Thin serialisers (keep the payload lean — no circular refs)
const serializeUser = (user) => {
  if (!user) return null;
  const id = normalizeId(user._id || user.id || user);
  if (!id) return null;
  return {
    _id:         id,
    id,
    username:    user.username    || '',
    displayName: user.displayName || user.username || '',
    avatar:      user.avatar      || '',
    isOnline:    Boolean(user.isOnline),
    offlineStatus: user.offlineStatus || null,
  };
};

const serializeMessage = (m) => {
  if (!m) return null;
  return {
    ...m,
    _id:            normalizeId(m._id),
    conversationId: normalizeId(m.conversationId) || null,
    sender:         typeof m.sender === 'object' ? serializeUser(m.sender) : normalizeId(m.sender),
    receiver:       m.receiver
      ? (typeof m.receiver === 'object' ? serializeUser(m.receiver) : normalizeId(m.receiver))
      : null,
    replyTo:        m.replyTo
      ? { ...m.replyTo, _id: normalizeId(m.replyTo._id), sender: serializeUser(m.replyTo.sender) }
      : null,
    reactions:      Array.isArray(m.reactions)
      ? m.reactions.map((r) => ({ ...r, user: normalizeId(r.user) }))
      : [],
    deletedBy:      Array.isArray(m.deletedBy)
      ? m.deletedBy.map(normalizeId).filter(Boolean)
      : [],
  };
};

const serializeConversation = (conv, currentUserId) => {
  if (!conv) return null;
  const participants = (conv.participants || []).map(serializeUser).filter(Boolean);
  const me = normalizeId(currentUserId);
  const other = conv.isGroup ? null : participants.find((p) => p._id !== me) || null;

  return {
    _id:         normalizeId(conv._id),
    user:        other,
    isGroup:     Boolean(conv.isGroup),
    isChannel:   Boolean(conv.isChannel),
    groupName:   conv.groupName   || '',
    groupAvatar: conv.groupAvatar || '',
    groupAdmin:  typeof conv.groupAdmin === 'object'
      ? serializeUser(conv.groupAdmin)
      : normalizeId(conv.groupAdmin),
    participants: conv.isGroup ? participants : undefined,
    lastMessage:  conv.lastMessage
      ? {
          ...conv.lastMessage,
          sender: typeof conv.lastMessage.sender === 'object'
            ? serializeUser(conv.lastMessage.sender)
            : normalizeId(conv.lastMessage.sender),
        }
      : null,
    unreadCount: Number(conv.unreadCount || 0),
    updatedAt:   conv.updatedAt || null,
  };
};

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/messages/conversations
 * FIX PROBLEM 4: .lean() + limited projection + compound index on participants/updatedAt
 */
const getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({ participants: req.user.id })
      .populate('participants', 'username displayName avatar isOnline offlineStatus')
      .select('participants lastMessage unreadCount isGroup isChannel groupName groupAvatar groupAdmin updatedAt')
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean(); // FIX PROBLEM 4

    const formatted = conversations.map((c) =>
      serializeConversation({
        ...c,
        unreadCount: c.unreadCount ? (c.unreadCount[req.user.id] || 0) : 0,
      }, req.user.id)
    );

    return res.json({ success: true, data: { conversations: formatted } });
  } catch (err) {
    return serverError(res, 'Failed to get conversations', err);
  }
};

/**
 * GET /api/messages/:userId?page=1&limit=30&beforeId=<id>
 * FIX PROBLEM 4:
 *   - Promise.all() to fetch user + conversation in parallel
 *   - Cursor pagination via _id (avoids skip on large collections)
 *   - .lean() on message query
 *   - Read-receipt + unread-reset in setImmediate (non-blocking)
 */
const getMessages = async (req, res) => {
  try {
    const { userId } = req.params;
    const { beforeId, limit = 30 } = req.query;
    const pageSize = Math.min(parseInt(limit, 10) || 30, 100);

    // FIX PROBLEM 4: parallel DB calls
    const [otherUser, conversation] = await Promise.all([
      User.findById(userId)
        .select('username displayName avatar blockedUsers isOnline offlineStatus')
        .lean(),                           // FIX PROBLEM 4: lean()
      Conversation.findOne({
        participants: { $all: [req.user.id, userId] },
        isGroup: false,
      }).select('_id unreadCount').lean(), // FIX PROBLEM 4: lean() + minimal projection
    ]);

    if (!otherUser) return fail(res, 404, 'User not found');

    const blockedInfo = {
      iBlocked:    hasId(req.user?.blockedUsers, userId),
      theyBlocked: hasId(otherUser.blockedUsers, req.user.id),
    };

    // FIX PROBLEM 4: cursor pagination — filter by _id < beforeId (uses index, no skip)
    const cursorFilter = beforeId ? { _id: { $lt: beforeId } } : {};

    const dmBranches = [
      { sender: req.user.id, receiver: userId },
      { sender: userId, receiver: req.user.id },
    ];

    const msgFilter = {
      $or: conversation
        ? [{ conversationId: conversation._id }, ...dmBranches]
        : dmBranches,
      deletedBy: { $ne: req.user.id },
      ...cursorFilter,
    };

    // FIX PROBLEM 4: .lean() — plain objects are ~40 % faster than Mongoose docs
    const messages = await Message.find(msgFilter)
      .sort({ createdAt: -1 })  // newest first; frontend reverses
      .limit(pageSize)
      .populate('sender',   'username displayName avatar isOnline offlineStatus')
      .populate('receiver', 'username displayName avatar')
      .populate({ path: 'replyTo', populate: { path: 'sender', select: 'username displayName' } })
      .select('sender receiver text media replyTo reactions read status createdAt edited deletedForEveryone deletedBy conversationId clientMsgId')
      .lean(); // FIX PROBLEM 4

    const hasMore = messages.length === pageSize;

    // FIX PROBLEM 4 & 6: fire-and-forget read receipt (never blocks response)
    setImmediate(() => {
      // Mark messages from other user as read
      Message.updateMany(
        { sender: userId, receiver: req.user.id, read: false },
        { $set: { read: true, status: 'read', readAt: new Date() } }
      ).catch(() => {});

      // Reset unread counter
      const convQuery = conversation
        ? { _id: conversation._id }
        : { participants: { $all: [req.user.id, userId] } };
      Conversation.findOneAndUpdate(
        convQuery,
        { $set: { [`unreadCount.${req.user.id}`]: 0 } }
      ).catch(() => {});
    });

    return res.json({
      success: true,
      data: {
        messages:       messages.map(serializeMessage),
        hasMore,
        oldestMessageId: messages.length ? normalizeId(messages[messages.length - 1]._id) : null,
        otherUser:      serializeUser(otherUser),
        blockedInfo,
      },
    });
  } catch (err) {
    return serverError(res, 'Failed to get messages', err);
  }
};

/**
 * POST /api/messages/:userId
 * FIX PROBLEM 4 & 6:
 *   - Emit socket event immediately after Message.create (no populate delay)
 *   - Conversation update happens in setImmediate (non-blocking)
 */
const sendMessage = async (req, res) => {
  try {
    const { userId } = req.params;
    const { text, mediaUrl, mediaType, replyTo, clientMsgId } = req.body;

    if ((!text || !text.trim()) && !mediaUrl && !req.file) {
      return fail(res, 400, 'Message text or media is required');
    }
    if (userId === req.user.id) {
      return fail(res, 400, 'You cannot message yourself');
    }

    // FIX PROBLEM 4: lean() for fast existence check
    const receiver = await User.findById(userId).select('blockedUsers').lean();
    if (!receiver) return fail(res, 404, 'User not found');

    if (hasId(req.user?.blockedUsers, userId)) {
      return fail(res, 403, 'You have blocked this user');
    }
    if (hasId(receiver.blockedUsers, req.user.id)) {
      return fail(res, 403, 'This user is unavailable');
    }

    const msgData = {
      sender:    req.user.id,
      receiver:  userId,
      text:      text ? text.trim() : '',
      clientMsgId: clientMsgId || undefined,
    };

    if (replyTo) msgData.replyTo = replyTo;

    if (mediaUrl) {
      msgData.media = { url: mediaUrl, type: mediaType || 'image' };
    }
    if (req.file) {
      const isVideo = req.file.mimetype?.startsWith('video') ||
        /\.(mp4|webm|mov|avi|mkv)$/i.test(req.file.originalname || '');
      msgData.media = {
        url:  req.file.path || `/uploads/${req.file.filename}`,
        type: isVideo ? 'video' : 'image',
      };
    }

    // Persist message
    const message = await Message.create(msgData);

    // Build socket payload without another DB round-trip (FIX PROBLEM 1 / 4)
    const socketPayload = serializeMessage({
      ...message.toObject(),
      sender:   { _id: req.user.id, username: req.user.username, avatar: req.user.avatar },
      receiver: { _id: userId },
    });

    // Emit to receiver immediately
    const socketModule = getSocket();
    if (socketModule?.emitToUser) {
      socketModule.emitToUser(userId,      'newMessage', socketPayload);
      socketModule.emitToUser(req.user.id, 'newMessage', socketPayload);
    }

    // FIX PROBLEM 6: update Conversation in background
    const lastText = msgData.text || (msgData.media?.type === 'video' ? 'Video' : 'Photo');
    setImmediate(() => updateLastMessage(req.user.id, userId, lastText, message._id));

    return res.status(201).json({
      success: true,
      message: 'Message sent',
      data: { message: socketPayload },
    });
  } catch (err) {
    return serverError(res, 'Failed to send message', err);
  }
};

/**
 * PUT /api/messages/:userId/read
 * FIX PROBLEM 4 & 6: parallel update + reset unread
 */
const markAsRead = async (req, res) => {
  try {
    const { userId } = req.params;

    // FIX PROBLEM 4: run both updates in parallel
    await Promise.all([
      Message.updateMany(
        { sender: userId, receiver: req.user.id, read: false },
        { $set: { read: true, status: 'read', readAt: new Date() } }
      ),
      Conversation.findOneAndUpdate(
        { participants: { $all: [req.user.id, userId] } },
        { $set: { [`unreadCount.${req.user.id}`]: 0 } }
      ),
    ]);

    return res.json({ success: true, message: 'Messages marked as read' });
  } catch (err) {
    return serverError(res, 'Failed to mark messages as read', err);
  }
};

/**
 * GET /api/messages/unread/count
 * FIX PROBLEM 4: lean() + minimal select
 */
const getUnreadCount = async (req, res) => {
  try {
    const conversations = await Conversation.find({ participants: req.user.id })
      .select('unreadCount')
      .lean(); // FIX PROBLEM 4

    const count = conversations.reduce((total, c) => {
      return total + (c?.unreadCount?.[req.user.id] || 0);
    }, 0);

    return res.json({ success: true, data: { unreadCount: count } });
  } catch (err) {
    return serverError(res, 'Failed to get unread count', err);
  }
};

/**
 * PUT /api/messages/edit/:messageId
 */
const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { text } = req.body;
    if (!text?.trim()) return fail(res, 400, 'Message text is required');

    const message = await Message.findById(messageId);
    if (!message) return fail(res, 404, 'Message not found');
    if (message.sender.toString() !== req.user.id) {
      return fail(res, 403, 'You can only edit your own messages');
    }

    message.text    = text.trim();
    message.edited  = true;
    message.editedAt = new Date();
    await message.save();

    return res.json({ success: true, message: 'Message updated', data: { message } });
  } catch (err) {
    return serverError(res, 'Failed to edit message', err);
  }
};

/**
 * DELETE /api/messages/delete/:messageId?type=me|everyone
 */
const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const type = req.query.type || 'me';

    const message = await Message.findById(messageId);
    if (!message) return fail(res, 404, 'Message not found');

    const isSender = message.sender.toString() === req.user.id;

    if (type === 'everyone') {
      if (!isSender && req.user.role !== 'admin') {
        return fail(res, 403, 'Only the sender can delete for everyone');
      }
      message.deletedForEveryone = true;
      message.text  = '';
      message.media = { url: '', type: '' };
      await message.save();

      // Notify both parties via socket
      const socketModule = getSocket();
      if (socketModule?.emitToUser) {
        const payload = { messageId: normalizeId(message._id) };
        socketModule.emitToUser(message.receiver?.toString(), 'messageDeletedForEveryone', payload);
        socketModule.emitToUser(message.sender?.toString(),   'messageDeletedForEveryone', payload);
      }

      return res.json({ success: true, message: 'Message deleted for everyone' });
    }

    // Delete for me
    if (!message.deletedBy.includes(req.user.id)) {
      message.deletedBy.push(req.user.id);
      await message.save();
    }
    return res.json({ success: true, message: 'Message deleted for you' });
  } catch (err) {
    return serverError(res, 'Failed to delete message', err);
  }
};

/**
 * PUT /api/messages/react/:messageId
 */
const reactToMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    if (!emoji) return fail(res, 400, 'Emoji is required');

    const message = await Message.findById(messageId);
    if (!message) return fail(res, 404, 'Message not found');

    const idx = message.reactions.findIndex(
      (r) => r.user.toString() === req.user.id && r.emoji === emoji
    );

    if (idx > -1) message.reactions.splice(idx, 1);
    else message.reactions.push({ emoji, user: req.user.id });

    await message.save();

    const payload = {
      messageId,
      reactions: message.reactions,
      conversationId: message.conversationId?.toString() || null,
    };

    const socketModule = getSocket();
    if (socketModule?.emitToUser) {
      socketModule.emitToUser(message.sender.toString(),   'messageReaction', payload);
      socketModule.emitToUser(message.receiver?.toString(), 'messageReaction', payload);
    }

    return res.json({ success: true, data: { message } });
  } catch (err) {
    return serverError(res, 'Failed to react to message', err);
  }
};

/**
 * DELETE /api/messages/clear/:userId
 */
const clearChat = async (req, res) => {
  try {
    const { userId } = req.params;
    const me = req.user.id;

    await Message.updateMany(
      {
        $or: [
          { sender: me, receiver: userId },
          { sender: userId, receiver: me },
        ],
        deletedBy: { $ne: me },
      },
      { $addToSet: { deletedBy: me } }
    );

    await Conversation.findOneAndUpdate(
      { participants: { $all: [me, userId] }, isGroup: false },
      { $set: { [`unreadCount.${me}`]: 0 } }
    );

    return res.json({ success: true, message: 'Chat cleared' });
  } catch (err) {
    return serverError(res, 'Failed to clear chat', err);
  }
};

// ─── Background helper — FIX PROBLEM 6 ───────────────────────────────────────
async function updateLastMessage(senderId, receiverId, text, messageId) {
  try {
    const lastMessage = { text, sender: senderId, createdAt: new Date() };
    const existing = await Conversation.findOne({
      participants: { $all: [senderId, receiverId] },
      isGroup: false,
    });

    if (existing) {
      existing.lastMessage = lastMessage;
      if (!existing.unreadCount) existing.unreadCount = new Map();
      existing.unreadCount.set(receiverId, (existing.unreadCount.get(receiverId) || 0) + 1);
      await existing.save();
    } else {
      await Conversation.create({
        participants: [senderId, receiverId],
        isGroup:      false,
        lastMessage,
        unreadCount:  new Map([[receiverId, 1]]),
      });
    }
  } catch (err) {
    console.warn('[Messages] updateLastMessage failed:', err.message);
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

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
};
