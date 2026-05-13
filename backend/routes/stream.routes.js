const express = require('express');
const fs = require('fs');
const path = require('path');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();
const CHUNK_SIZE = 2 * 1024 * 1024;

router.get('/:filename', protect, async (req, res) => {
  try {
    const range = req.headers.range;
    if (!range) return res.status(400).json({ success: false, message: 'Range header is required' });

    const filePath = path.join(__dirname, '..', 'uploads', 'videos', path.basename(req.params.filename));
    if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: 'Video not found' });

    const videoSize = fs.statSync(filePath).size;
    const start = Number(range.replace(/\D/g, ''));
    const end = Math.min(start + CHUNK_SIZE - 1, videoSize - 1);
    const contentLength = end - start + 1;

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${videoSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': contentLength,
      'Content-Type': 'video/mp4'
    });

    return fs.createReadStream(filePath, { start, end }).pipe(res);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
