const http = require('http');
require('dotenv').config();

require('./scripts/ensure-runtime-deps');

const app = require('./app');
const connectDB = require('./config/db');
const initSocket = require('./socket');

const PORT = process.env.PORT || 5000;
const required = [
  'MONGODB_URI',
  'JWT_SECRET',
  'CLIENT_URL',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET'
];

required.forEach((key) => {
  if (!process.env[key]) {
    console.error(`MISSING ENV: ${key}`);
    process.exit(1);
  }
});

const server = http.createServer(app);

initSocket(server);

const startServer = async () => {
  try {
    await connectDB();
    server.listen(PORT, () => {
      console.log(`Zuno server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }
};

process.on('unhandledRejection', (error) => {
  console.error('[Process] Unhandled rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('[Process] Uncaught exception:', error);
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('[Process] SIGTERM received. Shutting down gracefully...');
  server.close(() => process.exit(0));
});

const BACKEND_URL = process.env.RENDER_EXTERNAL_URL || process.env.BACKEND_URL;
if (BACKEND_URL && process.env.NODE_ENV === 'production') {
  setInterval(() => {
    fetch(`${BACKEND_URL}/health`).catch(() => {});
  }, 14 * 60 * 1000).unref();
}

startServer();
