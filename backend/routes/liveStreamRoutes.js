const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');

// In-memory store for active live streams
const activeStreams = new Map();

// Start a new live stream
router.post('/start', protect, (req, res) => {
  const { title, description } = req.body;
  const userId = req.user._id.toString();
  const username = req.user.username;
  const avatar = req.user.avatar;
  const displayName = req.user.displayName || username;

  // End any existing stream for this user
  activeStreams.delete(userId);

  const stream = {
    id: `stream_${userId}_${Date.now()}`,
    hostId: userId,
    hostUsername: username,
    hostAvatar: avatar,
    hostDisplayName: displayName,
    title: title || `${displayName}'s Live Stream`,
    description: description || '',
    startedAt: new Date().toISOString(),
    viewerCount: 0,
    comments: []
  };

  activeStreams.set(userId, stream);

  res.json({ success: true, data: { stream } });
});

// Get all active streams
router.get('/active', (req, res) => {
  const streams = Array.from(activeStreams.values());
  res.json({ success: true, data: { streams } });
});

// Get a specific stream
router.get('/:hostId', (req, res) => {
  const stream = activeStreams.get(req.params.hostId);
  if (!stream) {
    return res.status(404).json({ success: false, message: 'Stream not found or has ended' });
  }
  res.json({ success: true, data: { stream } });
});

// End a stream
router.delete('/end', protect, (req, res) => {
  const userId = req.user._id.toString();
  activeStreams.delete(userId);
  res.json({ success: true, message: 'Stream ended' });
});

module.exports = router;
module.exports.activeStreams = activeStreams;
