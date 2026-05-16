const express = require('express');
const mongoose = require('mongoose');
const { Conversation } = require('../models/Message');
const User = require('../models/User');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();
router.use(protect);

const toId = (value) => value?.toString?.() || String(value || '');

const serializeConversation = (conversation, currentUserId) => {
  const me = toId(currentUserId);
  const participants = conversation.participants || [];
  const otherUser = conversation.isGroup
    ? null
    : participants.find((participant) => toId(participant._id || participant) !== me) || null;

  return {
    _id: toId(conversation._id),
    id: toId(conversation._id),
    user: otherUser,
    isGroup: Boolean(conversation.isGroup),
    isChannel: Boolean(conversation.isChannel),
    groupName: conversation.groupName || '',
    groupAvatar: conversation.groupAvatar || '',
    participants,
    lastMessage: conversation.lastMessage || null,
    unreadCount: Number(conversation.unreadCount?.[me] || conversation.unreadCount?.get?.(me) || 0),
    updatedAt: conversation.updatedAt
  };
};

router.get('/', async (req, res) => {
  try {
    const conversations = await Conversation.find({ participants: req.user._id })
      .populate('participants', 'username displayName avatar isOnline offlineStatus')
      .populate('lastMessage.sender', 'username displayName avatar')
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();

    const mapped = conversations.map((conversation) => serializeConversation(conversation, req.user._id));
    return res.json({ success: true, conversations: mapped, data: { conversations: mapped } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const participantId = req.body.userId || req.body.participantId;
    if (!mongoose.isValidObjectId(participantId)) {
      return res.status(400).json({ success: false, message: 'Valid userId is required' });
    }
    if (toId(participantId) === toId(req.user._id)) {
      return res.status(400).json({ success: false, message: 'Cannot create a conversation with yourself' });
    }

    const user = await User.findById(participantId).select('_id').lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const participants = [toId(req.user._id), toId(participantId)].sort();
    const conversation = await Conversation.findOneAndUpdate(
      { participants: { $all: participants, $size: 2 }, isGroup: false },
      { $setOnInsert: { participants, isGroup: false, unreadCount: new Map() } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )
      .populate('participants', 'username displayName avatar isOnline offlineStatus')
      .lean();

    const mapped = serializeConversation(conversation, req.user._id);
    return res.status(201).json({ success: true, conversation: mapped, data: { conversation: mapped } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
