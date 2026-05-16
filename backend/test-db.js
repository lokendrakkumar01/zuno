require('dotenv').config();
const mongoose = require('mongoose');
const { Message } = require('./models/Message');

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    
    // Fetch some recent messages
    const msgs = await Message.find({}).sort({ createdAt: -1 }).limit(10).lean();
    console.log(JSON.stringify(msgs.map(m => ({ id: m._id, text: m.text, sender: m.sender, receiver: m.receiver, deletedBy: m.deletedBy, clientMsgId: m.clientMsgId })), null, 2));
    
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
};
run();
