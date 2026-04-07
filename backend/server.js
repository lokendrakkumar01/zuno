const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

const connectDB = require('./config/db');
const { uploadLimiter, messageLimiter } = require('./middleware/rateLimit');

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const contentRoutes = require('./routes/contentRoutes');
const commentRoutes = require('./routes/commentRoutes');
const feedRoutes = require('./routes/feedRoutes');
const adminRoutes = require('./routes/adminRoutes');
const messageRoutes = require('./routes/messageRoutes');
const spotifyRoutes = require('./routes/spotifyRoutes');
const noteRoutes = require('./routes/noteRoutes');
const liveStreamRoutes = require('./routes/liveStreamRoutes');
const { app, server } = require('./socket/socket');

// Middleware
const compression = require('compression');
app.use(compression());

// Security headers via helmet (must be before CORS and routes)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow images/videos from CDN
  contentSecurityPolicy: false // we manage CSP separately if needed
}));

// Strict CORS — only allow known origins
const allowedOrigins = [
  'https://zunoworld.tech',
  'https://www.zunoworld.tech',
  'https://zuno-frontend.onrender.com',
  'https://zuno-admin.onrender.com',
  'http://localhost:3000',
  'https://localhost:3000',
  'http://localhost:5173',
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow no-origin requests (mobile apps, Capacitor, curl, health checks)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || /\.onrender\.com$/.test(origin)) {
      return callback(null, true);
    }
    console.warn(`[CORS] Blocked request from origin: ${origin}`);
    return callback(new Error(`CORS: origin ${origin} not allowed`), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Handle preflight for all routes

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files for uploads with proper headers
app.use('/uploads', (req, res, next) => {
  // Set cache control headers for media files
  res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache
  res.setHeader('Access-Control-Allow-Origin', '*'); // Allow CORS for media
  next();
}, express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, filePath) => {
    // Set correct MIME type based on extension for video streaming
    if (filePath.endsWith('.mp4')) {
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', 'video/mp4');
    } else if (filePath.endsWith('.webm')) {
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', 'video/webm');
    } else if (filePath.endsWith('.mov')) {
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', 'video/quicktime');
    }
  }
}));

// API Routes (rate limiters applied at route level for targeted control)
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/content', uploadLimiter, contentRoutes);   // 20 uploads/hr per IP
app.use('/api/comments', commentRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/messages', messageLimiter, messageRoutes); // 60 messages/min per IP
app.use('/api/notes', noteRoutes);
app.use('/api/livestream', liveStreamRoutes);
app.use('/api/spotify', spotifyRoutes);

// Root route - API Welcome
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>ZUNO API</title>
      <style>
        body { font-family: sans-serif; background: #0a0a14; color: #f1f5f9; min-height: 100vh; display: flex; align-items: center; justify-content: center; margin: 0; }
        .container { text-align: center; padding: 2rem; }
        .logo { font-size: 4rem; color: #6366f1; }
        h1 { margin: 0.5rem 0; }
        p { color: #94a3b8; }
        .btn { display: inline-block; padding: 0.75rem 2rem; background: #6366f1; color: white; text-decoration: none; border-radius: 0.5rem; margin-top: 1rem; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">Z</div>
        <h1>ZUNO API Server</h1>
        <p>Backend is running! ✅</p>
        <a href="http://localhost:3000" class="btn">Open ZUNO Frontend →</a>
      </div>
    </body>
    </html>
  `);
});

// Health check + keep-alive ping
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'ZUNO Backend is running',
    timestamp: new Date().toISOString()
  });
});

// Ping endpoint to wake server (used by frontend keep-alive)
app.get('/api/ping', (req, res) => {
  res.json({ pong: true, ts: Date.now() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  // Handle Multer errors (file upload issues)
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, message: 'File is too large. Maximum size is 100MB.' });
  }
  if (err && err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({ success: false, message: 'Too many files. Maximum is 10 files per upload.' });
  }
  if (err && err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ success: false, message: 'Unexpected file field. Please use the correct upload form.' });
  }
  if (err && err.message && err.message.includes('Only image and video')) {
    return res.status(400).json({ success: false, message: err.message });
  }

  console.error(`[${req.method} ${req.path}]`, err.stack || err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.status ? err.message : 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 5000;

const keepAlive = require('./utils/keepAlive');

const startServer = async () => {
  try {
    // Connect to Database first
    await connectDB();

    server.listen(PORT, () => {
      console.log(`🚀 ZUNO Server running on port ${PORT}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV}`);
      // Start the Render Keep-Alive job
      keepAlive();
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();
