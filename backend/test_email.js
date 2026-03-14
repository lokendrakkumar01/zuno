require('dotenv').config();
const { sendLoginEmail } = require('./config/emailService');

async function test() {
  console.log('Testing email send...');
  await sendLoginEmail('lokendrakumar4812@gmail.com', 'Lokendra', new Date().toLocaleString());
  console.log('Check your inbox.');
}

test();
