const https = require('https');
const token = process.env.TEST_AUTH_TOKEN;

if (!token) {
      console.error('Set TEST_AUTH_TOKEN before running this script.');
      process.exit(1);
}

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
