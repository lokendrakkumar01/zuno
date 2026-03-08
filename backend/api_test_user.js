const https = require('https');

https.get('https://zuno-backend-bevi.onrender.com/api/users/lokendra', (res) => {
      let data = '';
      res.on('data', (chunk) => {
            data += chunk;
      });
      res.on('end', () => {
            console.log("Status Code:", res.statusCode);
            try {
                  const parsed = JSON.parse(data);
                  console.log("Parsed JSON:", Object.keys(parsed));
                  console.log("Success:", parsed.success);
                  if (parsed.data && parsed.data.user) {
                        console.log("User found:", parsed.data.user.username);
                  } else {
                        console.log("User data:", JSON.stringify(parsed.data).substring(0, 100));
                  }
            } catch (e) {
                  console.log("Error parsing:", e);
            }
      });
});
