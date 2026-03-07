const https = require('https');
https.get('https://zuno-backend-bevi.onrender.com/api/feed?mode=all&page=1&limit=5', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
            try {
                  const json = JSON.parse(data);
                  if (!json.success) { console.error('API Error:', json); return; }
                  const titles = json.data.contents.map(c => ({ id: c._id, type: c.contentType, date: c.createdAt }));
                  console.log(JSON.stringify(titles, null, 2));
            } catch (e) { console.error('Parse Error:', e.message); }
      });
}).on('error', err => console.error(err));
