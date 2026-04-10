const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  activeStreams,
  serializeStream,
  pruneExpiredStreams,
  isStreamJoinable
} = require('../socket/socket');

// Start a new live stream (Legacy route - can be removed eventually, but left for backwards compat during rolling deploy)
router.post('/start', protect, (req, res) => {
  const { title, description } = req.body;
  const userId = req.user._id.toString();
  const username = req.user.username;
  const avatar = req.user.avatar;
  const displayName = req.user.displayName || username;

  const existing = activeStreams.get(userId);
  if (existing) activeStreams.delete(userId);

  const existing2 = activeStreams.get(userId) || {};
  activeStreams.set(userId, {
    ...existing2,
    id: `stream_${userId}_${Date.now()}`,
    hostId: userId,
    hostUsername: username,
    hostAvatar: avatar,
    hostDisplayName: displayName,
    title: title || `${displayName}'s Live Stream`,
    description: description || '',
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    viewerCount: 0,
    viewers: existing2.viewers || new Set(),
    viewerSockets: existing2.viewerSockets || new Map(),
    bannedViewers: existing2.bannedViewers || new Set(),
    liveKitProvisioned: false
  });

  res.json({ success: true, data: { stream: serializeStream(activeStreams.get(userId)) } });
});

const { getLiveKitToken } = require('../controllers/liveKitController');

// Generate LiveKit token for SFU streaming (replaces /start)
router.post('/token', protect, getLiveKitToken);

// Get all active streams — filter out zombie entries with no hostSocketId (socket never connected)
router.get('/active', (req, res) => {
  pruneExpiredStreams();
  const streams = Array.from(activeStreams.values())
    .filter(isStreamJoinable)
    .map(serializeStream);
  res.json({ success: true, data: { streams } });
});

// Get a specific stream
router.get('/:hostId', (req, res) => {
  pruneExpiredStreams();
  const stream = activeStreams.get(req.params.hostId);
  if (!isStreamJoinable(stream)) {
    return res.status(404).json({ success: false, message: 'Stream not found or has ended' });
  }
  res.json({ success: true, data: { stream: serializeStream(stream) } });
});

// End a stream (HTTP fallback — socket endStream handler is the primary cleanup)
router.delete('/end', protect, (req, res) => {
  const userId = req.user._id.toString();
  activeStreams.delete(userId);
  res.json({ success: true, message: 'Stream ended' });
});

module.exports = router;
