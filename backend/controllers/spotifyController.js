// @desc    Search tracks via iTunes API (Fallback for Spotify IP Block on Render)
// @route   GET /api/spotify/search?q=query
// @access  Private
const searchTracks = async (req, res) => {
      const { q } = req.query;

      if (!q) {
            return res.status(400).json({ success: false, message: 'Search query is required' });
      }

      try {
            // Using iTunes API as an open, free alternative that doesn't block server IPs as aggressively
            const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=10`);

            const responseText = await response.text();
            let data;
            try {
                  data = JSON.parse(responseText);
            } catch (e) {
                  throw new Error(`Invalid JSON from iTunes Search API. Raw response: ${responseText.substring(0, 100)}`);
            }

            if (!response.ok) {
                  throw new Error(data.error?.message || 'Failed to search tracks');
            }

            const tracks = data.results.map(track => ({
                  trackId: track.trackId.toString(),
                  name: track.trackName,
                  artist: track.artistName,
                  albumArt: track.artworkUrl100?.replace('100x100', '300x300') || track.artworkUrl60,
                  previewUrl: track.previewUrl,
                  externalUrl: track.trackViewUrl
            }));

            res.json({
                  success: true,
                  data: { tracks }
            });
      } catch (error) {
            console.error('Track Search Error:', error.message);
            res.status(500).json({
                  success: false,
                  message: 'Failed to search tracks',
                  error: error.message
            });
      }
};

module.exports = {
      searchTracks
};
