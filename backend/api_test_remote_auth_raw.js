const https = require('https');
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5YTUxNjAwZWYyYTBiMjJhZGViMDlmMCIsImlhdCI6MTc3Mjk1NTE4NCwiZXhwIjoxNzc1NTQ3MTg0fQ.Y-cUzDYzagUyuocsw5OPTdeFXllRsPNauWH_8RQhf0o';

const options = {
      hostname: 'zuno-backend-bevi.onrender.com',
      port: 443,
      path: '/api/feed/creator/lokendra?t=' + Date.now(),
      method: 'GET',
      headers: {
            'Authorization': `Bearer ${token}`
      }
};

const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
            data += chunk;
      });
      res.on('end', () => {
            console.log(data); // Print the ENTIRE RAW JSON!
      });
});

req.on('error', (err) => {
      console.log('Error: ' + err.message);
});

req.end();
