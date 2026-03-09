const express = require('express');
const router = express.Router();
const { searchTracks } = require('../controllers/spotifyController');
const { protect } = require('../middleware/auth');

// Protected search route
router.get('/search', protect, searchTracks);

module.exports = router;
