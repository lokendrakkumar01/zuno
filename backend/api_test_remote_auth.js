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
            console.log("Status Code:", res.statusCode);
            try {
                  const parsed = JSON.parse(data);
                  if (parsed.data && parsed.data.creator) {
                        parsed.data.creator.avatar = "[Removed base64]";
                  }
                  if (parsed.data && parsed.data.contents) {
                        console.log(`Contents length: ${parsed.data.contents.length}`);
                        if (parsed.data.contents.length > 0) {
                              console.log("Sample title:", parsed.data.contents[0].title || parsed.data.contents[0].body);
                        }
                  } else {
                        console.log("No contents field found in data");
                  }
            } catch (e) {
                  console.log("Not JSON:", data.substring(0, 200));
            }
      });
});

req.on('error', (err) => {
      console.log('Error: ' + err.message);
});

req.end();
