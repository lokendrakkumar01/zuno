const mongoose = require('mongoose');
const { Message } = require('./backend/models/Message');

const run = async () => {
  await mongoose.connect('mongodb+srv://user1:ZJvQn7f0AtyyT2rE@cluster0.p0q70.mongodb.net/zuno_prod?retryWrites=true&w=majority&appName=Cluster0');
  
  // Just fetch some recent messages
  const msgs = await Message.find({}).sort({ createdAt: -1 }).limit(5).lean();
  console.log(msgs.map(m => ({ id: m._id, text: m.text, sender: m.sender, receiver: m.receiver, deletedBy: m.deletedBy })));
  
  process.exit(0);
};
run();
