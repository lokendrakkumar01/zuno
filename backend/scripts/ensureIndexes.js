require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Content = require('../models/Content');
const Comment = require('../models/Comment');
const Interaction = require('../models/Interaction');
const Notification = require('../models/Notification');
const User = require('../models/User');

const ensureIndexes = async () => {
      await connectDB();

      await Promise.all([
            Content.collection.createIndex(
                  { creator: 1, createdAt: -1 },
                  { name: 'profile_creator_createdAt' }
            ),
            Content.collection.createIndex(
                  { status: 1, visibility: 1, isApproved: 1, createdAt: -1, _id: -1 },
                  { name: 'feed_cursor_status_visibility_createdAt' }
            ),
            Content.collection.createIndex(
                  { title: 'text', body: 'text', tags: 'text' },
                  { name: 'content_text_search', weights: { title: 5, tags: 3, body: 1 } }
            ),
            Comment.collection.createIndex(
                  { content: 1, createdAt: -1 },
                  { name: 'comment_content_createdAt' }
            ),
            Interaction.collection.createIndex(
                  { content: 1, type: 1, createdAt: -1 },
                  { name: 'interaction_content_type_createdAt' }
            ),
            Notification.collection.createIndex(
                  { recipient: 1, createdAt: -1 },
                  { name: 'notification_recipient_createdAt' }
            ),
            Notification.collection.createIndex(
                  { expiresAt: 1 },
                  {
                        name: 'notification_ttl_expiresAt',
                        expireAfterSeconds: 0,
                        partialFilterExpression: { expiresAt: { $type: 'date' } }
                  }
            ),
            User.collection.createIndex(
                  { username: 'text', displayName: 'text' },
                  { name: 'user_text_search', weights: { username: 5, displayName: 3 } }
            )
      ]);

      console.log('[indexes] All requested indexes are ensured.');
      await mongoose.connection.close();
};

ensureIndexes().catch(async (error) => {
      console.error('[indexes] Failed to ensure indexes:', error);
      await mongoose.connection.close().catch(() => undefined);
      process.exit(1);
});
