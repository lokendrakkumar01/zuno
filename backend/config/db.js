const mongoose = require('mongoose');

const connectDB = async () => {
  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const conn = await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 15000,  // 15s to find a server
        socketTimeoutMS: 60000,           // 60s socket timeout
        connectTimeoutMS: 15000,          // 15s connection timeout
        maxPoolSize: 10,                  // Connection pool for concurrency
        minPoolSize: 2,                   // Keep minimum connections ready
        heartbeatFrequencyMS: 10000,      // Check connection every 10s
      });
      console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

      // Handle disconnection events gracefully
      mongoose.connection.on('disconnected', () => {
        console.warn('⚠️ MongoDB disconnected. Mongoose will auto-reconnect...');
      });
      mongoose.connection.on('reconnected', () => {
        console.log('✅ MongoDB reconnected successfully');
      });

      return; // Success
    } catch (error) {
      console.error(`❌ MongoDB Connection Error (attempt ${attempt}/${MAX_RETRIES}): ${error.message}`);
      if (attempt < MAX_RETRIES) {
        console.log(`🔄 Retrying in 3 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      } else {
        console.error('💥 All MongoDB connection attempts failed. Exiting...');
        process.exit(1);
      }
    }
  }
};

module.exports = connectDB;
