const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const connectDB = require('./config/db');

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
const { app, server } = require('./socket/socket');

// Connect to MongoDB
// Database connection is handled in startServer
// connectDB();

// Middleware
const compression = require('compression');
app.use(compression()); // Gzip compress all responses for faster transfer

// CORS - allow all origins including custom domain
const allowedOrigins = [
  'https://zunoworld.tech',
  'https://www.zunoworld.tech',
  'https://zuno-frontend.onrender.com',
  'http://localhost:3000',
  'http://localhost:5173',
];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.some(o => origin.startsWith(o)) || origin.includes('onrender.com')) {
      return callback(null, true);
    }
    return callback(null, true); // Allow all for now in production
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files for uploads with proper headers
app.use('/uploads', (req, res, next) => {
  // Set cache control headers for media files
  res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache
  res.setHeader('Access-Control-Allow-Origin', '*'); // Allow CORS for media
  next();
}, express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, path) => {
    // Additional headers for video streaming support
    if (path.endsWith('.mp4') || path.endsWith('.webm') || path.endsWith('.mov')) {
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', 'video/mp4');
    }
  }
}));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notes', noteRoutes);
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
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to Database first
    await connectDB();

    server.listen(PORT, () => {
      console.log(`🚀 ZUNO Server running on port ${PORT}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();
