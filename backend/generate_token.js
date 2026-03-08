require('dotenv').config();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

async function exec() {
      await mongoose.connect(process.env.MONGODB_URI);
      const User = require('./models/User');
      const user = await User.findOne({ username: 'lokendra' });
      if (user) {
            const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
                  expiresIn: process.env.JWT_EXPIRE || '30d',
            });
            console.log(token);
      }
      process.exit(0);
}
exec();
