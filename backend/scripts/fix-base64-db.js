const { MongoClient } = require('mongodb');
require('dotenv').config();

const cleanDatabase = async () => {
      let client;
      try {
            client = new MongoClient(process.env.MONGODB_URI);
            await client.connect();
            const db = client.db();
            console.log('Connected directly to MongoDB');

            let fixedUsers = 0;
            let fixedContent = 0;

            // 1. Fix massive Base64 avatars in Users using cursor
            const usersCursor = db.collection('users').find({});
            for await (const user of usersCursor) {
                  if (user.avatar && user.avatar.startsWith('data:image') && user.avatar.length > 50000) {
                        console.log(`Fixing avatar for user: ${user.username} (Length: ${user.avatar.length})`);
                        await db.collection('users').updateOne(
                              { _id: user._id },
                              { $set: { avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username || 'user'}` } }
                        );
                        fixedUsers++;
                  }
            }

            // 2. Fix massive Base64 media in Content using cursor
            const contentsCursor = db.collection('contents').find({});
            for await (const content of contentsCursor) {
                  let contentModified = false;
                  let updatedMedia = content.media || [];

                  for (let i = 0; i < updatedMedia.length; i++) {
                        if (updatedMedia[i].url && updatedMedia[i].url.startsWith('data:image') && updatedMedia[i].url.length > 50000) {
                              console.log(`Fixing media for content ID: ${content._id} (Length: ${updatedMedia[i].url.length})`);
                              updatedMedia[i].url = `https://placehold.co/600x400?text=Image+Too+Large`;
                              contentModified = true;
                        }
                  }

                  if (contentModified) {
                        await db.collection('contents').updateOne(
                              { _id: content._id },
                              { $set: { media: updatedMedia } }
                        );
                        fixedContent++;
                  }
            }

            console.log(`Database Cleanup Complete!`);
            console.log(`- Users fixed: ${fixedUsers}`);
            console.log(`- Contents fixed: ${fixedContent}`);
      } catch (error) {
            console.error('Error during cleanup:', error);
      } finally {
            if (client) {
                  await client.close();
            }
      }
};

cleanDatabase();
