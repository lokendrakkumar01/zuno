require('dotenv').config();

async function testSpotify() {
  const clientId = process.env.SPOTIFY_CLIENT_ID || '22dc10f695a74384a7c1048eba63ca96';
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || '248a4695a0db444ba2d65d1a04260be9';

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  console.log('Fetching token...');
  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  const tokenData = await tokenRes.json();
  const token = tokenData.access_token;
  console.log('Got token:', token ? 'yes' : 'no');

  console.log('Fetching search...');
  const searchUrl = `https://api.spotify.com/v1/search?type=track&limit=10&market=IN&q=sorry`;
  const res = await fetch(searchUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  });

  const data = await res.json();
  console.log('Search status:', res.status);
  console.log('Search response:', JSON.stringify(data, null, 2));
}

testSpotify().catch(console.error);
