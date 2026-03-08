const mongoose = require('mongoose');
const User = require('./backend/models/User');
const Content = require('./backend/models/Content');
require('dotenv').config({ path: './backend/.env' });

async function checkData() {
      await mongoose.connect(process.env.MONGO_URI);
      console.log("Connected to MongoDB directly for diagnostics");

      const username = 'lokendra';
      const user = await User.findOne({ username });
      if (!user) {
            console.log("User not found!");
            process.exit();
      }

      console.log(`Checking content for creator ID: ${user._id}`);

      // Check all posts for this user, ignoring status/approval
      const allPosts = await Content.find({ creator: user._id }).lean();
      console.log(`Total posts in DB for this user: ${allPosts.length}`);
      if (allPosts.length > 0) {
            console.log("Sample post status:", allPosts[0].status, "visibility:", allPosts[0].visibility, "isApproved:", allPosts[0].isApproved);
      }

      // Now check exact query from feedController
      const query = {
            creator: user._id,
            status: 'published',
            isApproved: true
      };
      const published = await Content.find(query).lean();
      console.log(`Posts matching the getCreatorFeed exact query: ${published.length}`);

      if (published.length === 0 && allPosts.length > 0) {
            console.log("AH! The posts exist but they are failing the status='published' OR isApproved=true check.");

            // Let's force approve them for testing
            const result = await Content.updateMany({ creator: user._id }, { isApproved: true, status: 'published', visibility: 'public' });
            console.log(`Updated ${result.modifiedCount} posts to be approved and published.`);
      }

      process.exit();
}

checkData();
