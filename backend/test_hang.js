const https = require('https');
console.log('Fetching from Render API...');
const req = https.get('https://zuno-backend-bevi.onrender.com/api/feed?mode=all', { timeout: 15000 }, (res) => {
      console.log('Got response:', res.statusCode);
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => console.log('Response body:', data));
});
req.on('timeout', () => { console.error('Request timed out!'); req.destroy(); });
req.on('error', err => console.error('Error:', err.message));
