const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    // If running in production (Render), we might want to keep retrying or fail hard
    // depending on the orchestrator. For now, we exit so Render knows it failed.
    process.exit(1);
  }
};

module.exports = connectDB;
