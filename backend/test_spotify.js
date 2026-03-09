const clientId = process.env.SPOTIFY_CLIENT_ID || '22dc10f695a74384a7c1048eba63ca96';
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || 'b3b85f082e0544da9e88ddff650567e1';

const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
            'Authorization': `Basic ${authHeader}`,
            'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
}).then(res => res.text()).then(text => console.log('RESPONSE:', text)).catch(console.error);
