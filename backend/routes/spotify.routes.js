const express = require('express');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

let cachedToken = null;
let tokenExpiresAt = 0;

const getSpotifyToken = async () => {
  try {
    // Temporarily disabled caching to force fresh permissions from Spotify
    // if (cachedToken && tokenExpiresAt > Date.now() + 30000) return cachedToken;
    const credentials = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64');
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });
    if (!response.ok) throw new Error('Spotify token request failed');
    const data = await response.json();
    cachedToken = data.access_token;
    tokenExpiresAt = Date.now() + data.expires_in * 1000;
    return cachedToken;
  } catch (error) {
    throw error;
  }
};

router.get('/search', protect, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 80);
    if (!q) return res.status(400).json({ success: false, message: 'Search query is required' });

    if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
      return res.status(500).json({ 
        success: false, 
        message: 'Spotify API credentials are not configured on the server environment.' 
      });
    }

    const token = await getSpotifyToken();
    // Removed market parameter to allow global search (fixing potential 403 if market didn't match account)
    const searchUrl = `https://api.spotify.com/v1/search?type=track&limit=10&q=${encodeURIComponent(q)}`;
    
    const response = await fetch(searchUrl, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const spotifyError = errData.error?.message || response.statusText || 'Search failed';
      console.error('[Spotify Search Error]', response.status, errData);
      return res.status(response.status).json({ 
        success: false, 
        message: `Spotify API Error (${response.status}): ${spotifyError}` 
      });
    }
    
    const data = await response.json();
    const items = data.tracks?.items || [];
    
    const mappedTracks = items.map((track) => ({
      trackId: track.id,
      name: track.name,
      artist: track.artists?.map(a => a.name).join(', ') || 'Unknown Artist',
      albumArt: track.album?.images?.[0]?.url || '',
      previewUrl: track.preview_url || null
    }));

    return res.json({ success: true, data: { tracks: mappedTracks } });
  } catch (error) {
    console.error('[Spotify Route Error]', error);
    return res.status(500).json({ 
      success: false, 
      message: error.message === 'Spotify token request failed' 
        ? 'Spotify Authentication Failed: Check your Client ID and Secret in Render.' 
        : error.message 
    });
  }
});

module.exports = router;
