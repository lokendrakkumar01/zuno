const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

mongoose.connect(process.env.MONGODB_URI)
      .then(async () => {
            const user = await User.findById('69aa5d4d84ff066a3b5650b1');
            console.log('Creator User:', user ? user.username : 'Not found');

            const lokendra = await User.findOne({ username: /lokendra/i });
            console.log('Lokendra User:', lokendra ? lokendra.username + ' ' + lokendra._id : 'Not found');
            process.exit(0);
      });
