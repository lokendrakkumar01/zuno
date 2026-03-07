const mongoose = require('mongoose');
require('dotenv').config();
const Content = require('./models/Content');

mongoose.connect(process.env.MONGODB_URI)
      .then(async () => {
            const posts = await Content.find({}).sort({ createdAt: -1 }).limit(2).lean();
            console.log(JSON.stringify(posts, null, 2));
            process.exit(0);
      })
      .catch(err => {
            console.error(err);
            process.exit(1);
      });
