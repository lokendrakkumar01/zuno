const https = require('https');
const url = 'https://zuno-backend-bevi.onrender.com/api/feed/creator/Lokendra%201';
console.log('Fetching:', url);
https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
            try {
                  const json = JSON.parse(data);
                  if (!json.success) { console.error('API Error:', json); return; }
                  console.log('Creator Posts found:', json.data.contents.length);
                  const titles = json.data.contents.map(c => ({ id: c._id, type: c.contentType, date: c.createdAt }));
                  console.log(JSON.stringify(titles, null, 2));
            } catch (e) { console.error('Parse Error:', e.message); }
      });
}).on('error', err => console.error(err));
