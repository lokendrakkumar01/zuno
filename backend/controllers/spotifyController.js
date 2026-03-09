let spotifyAccessToken = null;
let tokenExpiry = null;

// @desc    Get Spotify Access Token (Client Credentials Flow)
const getSpotifyToken = async () => {
      // Check if current token is still valid (with 1 min buffer)
      if (spotifyAccessToken && tokenExpiry && Date.now() < tokenExpiry - 60000) {
            return spotifyAccessToken;
      }

      const clientId = process.env.SPOTIFY_CLIENT_ID || '22dc10f695a74384a7c1048eba63ca96';
      const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

      if (!clientSecret) {
            throw new Error('Spotify Client Secret not configured');
      }

      try {
            const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
            const response = await fetch('https://accounts.spotify.com/api/token', {
                  method: 'POST',
                  headers: {
                        'Authorization': `Basic ${authHeader}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                  },
                  body: 'grant_type=client_credentials'
            });

            const data = await response.json();

            if (!response.ok) {
                  throw new Error(data.error_description || 'Failed to get Spotify token');
            }

            spotifyAccessToken = data.access_token;
            tokenExpiry = Date.now() + (data.expires_in * 1000);
            return spotifyAccessToken;
      } catch (error) {
            console.error('Spotify Auth Error:', error.message);
            throw new Error('Failed to authenticate with Spotify');
      }
};

// @desc    Search tracks on Spotify
// @route   GET /api/spotify/search?q=query
// @access  Private
const searchTracks = async (req, res) => {
      const { q } = req.query;

      if (!q) {
            return res.status(400).json({ success: false, message: 'Search query is required' });
      }

      try {
            const token = await getSpotifyToken();
            const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=10`, {
                  headers: {
                        'Authorization': `Bearer ${token}`
                  }
            });

            const data = await response.json();

            if (!response.ok) {
                  throw new Error(data.error?.message || 'Failed to search Spotify');
            }

            const tracks = data.tracks.items.map(track => ({
                  trackId: track.id,
                  name: track.name,
                  artist: track.artists.map(a => a.name).join(', '),
                  albumArt: track.album.images[0]?.url,
                  previewUrl: track.preview_url,
                  externalUrl: track.external_urls.spotify
            }));

            res.json({
                  success: true,
                  data: { tracks }
            });
      } catch (error) {
            console.error('Spotify Search Error:', error.message);
            res.status(500).json({
                  success: false,
                  message: 'Failed to search Spotify tracks',
                  error: error.message
            });
      }
};

module.exports = {
      searchTracks
};
