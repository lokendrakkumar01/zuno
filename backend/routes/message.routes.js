const express = require('express');
const mongoose = require('mongoose');
const { Message, Conversation } = require('../models/Message');
const Room = require('../models/Room');
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
  sender: message.sender,
  receiver: message.receiver,
  text: message.text,
  media: message.media,
  status: message.status,
  read: message.read,
  deliveredAt: message.deliveredAt,
  readAt: message.readAt,
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
      Room.find({ participants: req.user._id }).sort({ updatedAt: -1 }).limit(50).lean(),
      Conversation.find({ participants: req.user._id }).sort({ updatedAt: -1 }).limit(50).lean()
    ]);
    return res.json({ success: true, conversations: [...rooms, ...legacy] });
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
    return res.json({
      success: true,
      messages: page,
      nextCursor: hasMore ? toId(messages[limit - 1]._id) : null,
      hasMore
    });
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
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
