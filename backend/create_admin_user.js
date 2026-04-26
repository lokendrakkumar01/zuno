const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const createAdminUser = async () => {
  try {
    // Connect to database with fixed options
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      // Remove language option to fix the error
    });
    console.log('Connected to MongoDB');

    // Check if admin user already exists
    const existingAdmin = await User.findOne({ email: 'admin@zuno.com' });
    if (existingAdmin) {
      console.log('Admin user already exists:', existingAdmin.username);
      console.log('Login credentials:');
      console.log('Email: admin@zuno.com');
      console.log('Password: (use the one you set or reset it)');
      console.log('Role: admin');
      return;
    }

    // Create admin user
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const adminUser = new User({
      username: 'admin',
      email: 'admin@zuno.com',
      password: hashedPassword,
      displayName: 'ZUNO Admin',
      role: 'admin',
      isVerified: true,
      isActive: true
    });

    await adminUser.save();
    console.log('Admin user created successfully!');
    console.log('Login credentials:');
    console.log('Email: admin@zuno.com');
    console.log('Password: admin123');
    console.log('Role: admin');

  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    await mongoose.disconnect();
  }
};

createAdminUser();
