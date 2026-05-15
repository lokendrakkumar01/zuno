const express = require('express');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

let cachedToken = null;
let tokenExpiresAt = 0;

const getSpotifyToken = async () => {
  // Use cached token if still valid (with 60s buffer)
  if (cachedToken && tokenExpiresAt > Date.now() + 60000) return cachedToken;

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET is not set in environment variables.');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('[Spotify Token Error]', response.status, data);
    throw new Error(`Spotify auth failed (${response.status}): ${data.error_description || data.error || 'Unknown error'}`);
  }

  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in * 1000);
  console.log('[Spotify] New token acquired, expires in', data.expires_in, 'seconds');
  return cachedToken;
};

router.get('/search', protect, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 100);
    if (!q) return res.json({ success: true, data: { tracks: [] } });

    let token;
    try {
      token = await getSpotifyToken();
    } catch (tokenErr) {
      console.error('[Spotify] Token error:', tokenErr.message);
      return res.status(500).json({
        success: false,
        message: `Spotify authentication failed: ${tokenErr.message}`
      });
    }

    // Use market=IN for India, which helps with search results & preview URLs
    const searchUrl = `https://api.spotify.com/v1/search?type=track&limit=10&market=IN&q=${encodeURIComponent(q)}`;

    const response = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error('[Spotify Search Error]', response.status, JSON.stringify(errData));

      // Reset cache on auth errors so next request gets fresh token
      if (response.status === 401 || response.status === 403) {
        cachedToken = null;
        tokenExpiresAt = 0;
      }

      const reason = errData.error?.message || errData.error?.reason || response.statusText || 'Unknown';
      return res.status(response.status).json({
        success: false,
        message: `Spotify search failed (${response.status}): ${reason}`
      });
    }

    const data = await response.json();
    const items = data.tracks?.items || [];

    const mappedTracks = items.map((track) => ({
      trackId: track.id,
      name: track.name,
      artist: track.artists?.map(a => a.name).join(', ') || 'Unknown Artist',
      albumArt: track.album?.images?.[0]?.url || '',
      albumName: track.album?.name || '',
      durationMs: track.duration_ms || 0,
      previewUrl: track.preview_url || null,   // null = no 30s preview from Spotify
      spotifyUrl: track.external_urls?.spotify || ''
    }));

    console.log(`[Spotify] Search "${q}": ${mappedTracks.length} results, ${mappedTracks.filter(t => t.previewUrl).length} with preview`);

    return res.json({ success: true, data: { tracks: mappedTracks } });
  } catch (error) {
    console.error('[Spotify Route Error]', error.message);
    return res.status(500).json({
      success: false,
      message: `Server error: ${error.message}`
    });
  }
});

module.exports = router;
