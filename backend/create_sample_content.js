const mongoose = require('mongoose');
require('dotenv').config();

const Content = require('./models/Content');
const User = require('./models/User');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected');
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error);
    process.exit(1);
  }
};

const createSampleContent = async () => {
  try {
    // Find or create a sample user
    let sampleUser = await User.findOne({ username: 'sampleuser' });
    
    if (!sampleUser) {
      sampleUser = await User.create({
        username: 'sampleuser',
        email: 'sample@example.com',
        password: 'hashedpassword123',
        displayName: 'Sample User',
        bio: 'This is a sample user for testing',
        isVerified: true
      });
      console.log('✅ Created sample user');
    }

    // Check if sample content already exists
    const existingContent = await Content.findOne({ creator: sampleUser._id });
    if (existingContent) {
      console.log('✅ Sample content already exists');
      return;
    }

    // Create sample content
    const sampleContents = [
      {
        creator: sampleUser._id,
        contentType: 'post',
        title: 'Welcome to ZUNO!',
        body: 'This is a sample post to test the feed functionality. ZUNO is a social platform for sharing ideas, skills, and learning together.',
        purpose: 'idea',
        topics: ['learning', 'technology'],
        visibility: 'public',
        status: 'published',
        isApproved: true
      },
      {
        creator: sampleUser._id,
        contentType: 'post',
        title: 'Learning JavaScript',
        body: 'JavaScript is a powerful programming language. Here are some tips for beginners: 1. Start with basics, 2. Practice regularly, 3. Build projects.',
        purpose: 'learning',
        topics: ['learning', 'technology'],
        visibility: 'public',
        status: 'published',
        isApproved: true
      },
      {
        creator: sampleUser._id,
        contentType: 'post',
        title: 'Problem Solving Tips',
        body: 'When facing a difficult problem, try these approaches: Break it down into smaller parts, research similar solutions, and don\'t be afraid to ask for help.',
        purpose: 'solution',
        topics: ['problem-solving', 'learning'],
        visibility: 'public',
        status: 'published',
        isApproved: true
      }
    ];

    await Content.insertMany(sampleContents);
    console.log('✅ Created sample content');
    
  } catch (error) {
    console.error('❌ Error creating sample content:', error);
  }
};

const main = async () => {
  await connectDB();
  await createSampleContent();
  console.log('✅ Sample content creation completed');
  process.exit(0);
};

main();