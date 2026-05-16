require('dotenv').config();
const mongoose = require('mongoose');
const { Message } = require('./models/Message');

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    
    // Simulate req.user.id and userId
    const reqUserId = "69aa5d4d84ff066a3b5650b1";
    const userId = "69e374d5e25637dc8bfbb13f";

    const dmBranches = [
      { sender: reqUserId, receiver: userId },
      { sender: userId, receiver: reqUserId },
    ];

    const msgFilter = {
      $or: dmBranches,
      deletedBy: { $ne: reqUserId },
    };

    console.log("Filter:", JSON.stringify(msgFilter, null, 2));

    const msgs = await Message.find(msgFilter).sort({ createdAt: -1 }).limit(10).lean();
    console.log("Found:", msgs.length);
    console.log(msgs.map(m => m.text));
    
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
};
run();
