require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Content = require('./models/Content');

async function debug() {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log("Connected to MongoDB");

      const username = 'lokendra';
      const creator = await User.findOne({ username });
      if (!creator) {
            console.log("Creator not found");
            process.exit(1);
      }
      console.log("Found creator:", creator._id, creator.username);

      const query = {
            creator: creator._id,
            status: 'published',
            isApproved: true
      };

      const contents = await Content.find(query).lean();
      console.log(`Found ${contents.length} contents for creator`);
      if (contents.length > 0) {
            console.log(contents[0].title || contents[0].body);
            console.log("Visibility:", contents[0].visibility);
            console.log("ExpiresAt:", contents[0].expiresAt);
      }

      const queryPublic = { ...query, visibility: 'public' };
      const publicContents = await Content.find(queryPublic).lean();
      console.log(`Found ${publicContents.length} PUBLIC contents for creator`);

      process.exit(0);
}

debug();
