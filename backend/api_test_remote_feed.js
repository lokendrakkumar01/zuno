const https = require('https');

https.get('https://zuno-backend-bevi.onrender.com/api/feed/creator/lokendra', (res) => {
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
}).on('error', (err) => {
      console.log('Error: ' + err.message);
});
