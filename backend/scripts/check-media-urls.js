// Script to check media URLs in the database
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Content = require('../models/Content');

const checkMediaUrls = async () => {
      try {
            await mongoose.connect(process.env.MONGODB_URI);
            console.log('Connected to MongoDB');

            // Find all content with media
            const contents = await Content.find({ 'media.0': { $exists: true } }).limit(5);
            console.log(`\nFound ${contents.length} content items with media\n`);

            contents.forEach((content, index) => {
                  console.log(`\n--- Content ${index + 1} ---`);
                  console.log(`ID: ${content._id}`);
                  console.log(`Title: ${content.title || 'No title'}`);
                  console.log(`Content Type: ${content.contentType}`);
                  console.log(`Created: ${content.createdAt}`);
                  console.log(`Media:`);
                  content.media.forEach((mediaItem, mIndex) => {
                        console.log(`  [${mIndex}] URL: ${mediaItem.url}`);
                        console.log(`      Type: ${mediaItem.type}`);
                        console.log(`      Status: ${mediaItem.status}`);
                  });
            });

            console.log('\n✅ Check complete!');
            process.exit(0);
      } catch (error) {
            console.error('Check failed:', error);
            process.exit(1);
      }
};

checkMediaUrls();
