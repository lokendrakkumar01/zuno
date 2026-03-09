require('dotenv').config();

async function testSpotify() {
      const clientId = process.env.SPOTIFY_CLIENT_ID || '22dc10f695a74384a7c1048eba63ca96';
      const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

      if (!clientSecret) {
            console.error('❌ Error: SPOTIFY_CLIENT_SECRET is not set in .env file.');
            return;
      }

      console.log('Testing Spotify Auth with Client ID:', clientId);

      try {
            const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
            const authRes = await fetch('https://accounts.spotify.com/api/token', {
                  method: 'POST',
                  headers: {
                        'Authorization': `Basic ${authHeader}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                  },
                  body: 'grant_type=client_credentials'
            });

            const authData = await authRes.json();
            if (!authRes.ok) {
                  throw new Error(authData.error_description || 'Auth failed');
            }

            console.log('✅ Spotify Auth Successful! Token type:', authData.token_type);

            const searchRes = await fetch('https://api.spotify.com/v1/search?q=Stay&type=track&limit=1', {
                  headers: { 'Authorization': `Bearer ${authData.access_token}` }
            });

            const searchData = await searchRes.json();
            if (!searchRes.ok) {
                  throw new Error(searchData.error?.message || 'Search failed');
            }

            console.log('✅ Spotify Search Successful! Found track:', searchData.tracks.items[0]?.name);
            console.log('\nIntegration seems to be working correctly! 🚀');

      } catch (error) {
            console.error('❌ Test Failed:', error.message);
      }
}

testSpotify();
