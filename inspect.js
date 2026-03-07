const fs = require('fs');
const data = JSON.parse(fs.readFileSync('test_feed.json', 'utf8'));

if (!data.data.contents || data.data.contents.length === 0) {
      console.log("No contents available.");
      process.exit(0);
}

const item = data.data.contents[0];
let found = false;

function findHuge(obj, path = '') {
      if (typeof obj === 'string') {
            if (obj.length > 50000) {
                  console.log(path, obj.substring(0, 50) + '...', obj.length);
                  found = true;
            }
            return;
      }
      if (typeof obj === 'object' && obj !== null) {
            Object.keys(obj).forEach(k => findHuge(obj[k], path ? path + '.' + k : k));
      }
}

findHuge(item, 'item');

if (!found) {
      console.log("No string > 50,000 chars found in the item");
}
