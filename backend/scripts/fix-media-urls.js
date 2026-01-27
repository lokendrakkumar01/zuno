// Script to fix media URLs in existing content
// Run this once to clean up URLs with cache-busting timestamps

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Content = require('../models/Content');

const fixMediaUrls = async () => {
      try {
            await mongoose.connect(process.env.MONGODB_URI);
            console.log('Connected to MongoDB');

            // Find all content with media
            const contents = await Content.find({ 'media.0': { $exists: true } });
            console.log(`Found ${contents.length} content items with media`);

            let fixedCount = 0;

            for (const content of contents) {
                  let needsUpdate = false;

                  for (const mediaItem of content.media) {
                        // Remove any query parameters (like ?v=timestamp or ?cache=timestamp)
                        if (mediaItem.url && (mediaItem.url.includes('?v=') || mediaItem.url.includes('?cache='))) {
                              const cleanUrl = mediaItem.url.split('?')[0];
                              console.log(`Fixing URL: ${mediaItem.url} -> ${cleanUrl}`);
                              mediaItem.url = cleanUrl;
                              needsUpdate = true;
                        }
                  }

                  if (needsUpdate) {
                        await content.save();
                        fixedCount++;
                  }
            }

            console.log(`✅ Fixed ${fixedCount} content items`);
            console.log('Migration complete!');
            process.exit(0);
      } catch (error) {
            console.error('Migration failed:', error);
            process.exit(1);
      }
};

fixMediaUrls();
