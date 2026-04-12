const mongoose = require('mongoose');

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('Missing MongoDB connection string. Set MONGODB_URI (or MONGO_URI).');
  }

  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const conn = await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 15000,
        socketTimeoutMS: 60000,
        connectTimeoutMS: 15000,
        maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE) || 20,
        minPoolSize: 2,
        heartbeatFrequencyMS: 10000,
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
        throw new Error('All MongoDB connection attempts failed.');
      }
    }
  }
};

module.exports = connectDB;
