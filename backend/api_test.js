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
                  if (parsed.data && parsed.data.user) {
                        parsed.data.user.avatar = "[Removed base64]";
                  }
                  console.log("Success:", parsed.success);
                  console.log("Message:", parsed.message);
            } catch (e) {
                  console.log("Not JSON:", data.substring(0, 200));
            }
      });
}).on('error', (err) => {
      console.log('Error: ' + err.message);
});
