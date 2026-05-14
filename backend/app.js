const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const passport = require('passport');
const path = require('path');
require('dotenv').config();

require('./config/passport');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const messageRoutes = require('./routes/message.routes');
const streamRoutes = require('./routes/stream.routes');
const spotifyRoutes = require('./routes/spotify.routes');

const optionalRoute = (routePath) => {
  try {
    return require(routePath);
  } catch (error) {
    console.warn(`[Routes] Skipping ${routePath}: ${error.message}`);
    return null;
  }
};

const legacyRoutes = {
  auth: optionalRoute('./routes/authRoutes'),
  users: optionalRoute('./routes/userRoutes'),
  content: optionalRoute('./routes/contentRoutes'),
  comments: optionalRoute('./routes/commentRoutes'),
  feed: optionalRoute('./routes/feedRoutes'),
  admin: optionalRoute('./routes/adminRoutes'),
  notes: optionalRoute('./routes/noteRoutes'),
  livestream: optionalRoute('./routes/liveStreamRoutes'),
  notifications: optionalRoute('./routes/notificationRoutes')
};

const app = express();

const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3002',
  'https://zunoworld.tech',
  'https://www.zunoworld.tech'
];

const allowedOrigins = new Set([
  ...defaultAllowedOrigins,
  ...(process.env.CLIENT_URL || '').split(',').map((origin) => origin.trim()).filter(Boolean),
  ...(process.env.CORS_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean)
]);

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());
app.use(cors({
  origin: function (origin, callback) {
    // Always allow the request's origin to avoid CORS blocking frontend
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.options('*', cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(mongoSanitize());
app.use(passport.initialize());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' }
}));

app.get('/', (req, res) => {
  res.json({ success: true, message: 'Zuno API is running', environment: process.env.NODE_ENV || 'development' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

// Alias /api/ping → /api/health (used by frontend keep-alive and wake utilities)
app.get('/api/ping', (req, res) => {
  res.json({ success: true, status: 'ok' });
});

app.use('/api/auth', authRoutes);
if (legacyRoutes.auth) app.use('/api/auth', legacyRoutes.auth);
app.use('/api/users', userRoutes);
if (legacyRoutes.users) app.use('/api/users', legacyRoutes.users);
if (legacyRoutes.content) app.use('/api/content', legacyRoutes.content);
if (legacyRoutes.comments) app.use('/api/comments', legacyRoutes.comments);
if (legacyRoutes.feed) app.use('/api/feed', legacyRoutes.feed);
if (legacyRoutes.admin) app.use('/api/admin', legacyRoutes.admin);
app.use('/api/messages', messageRoutes);
if (legacyRoutes.notes) app.use('/api/notes', legacyRoutes.notes);
if (legacyRoutes.livestream) app.use('/api/livestream', legacyRoutes.livestream);
app.use('/api/stream', streamRoutes);
app.use('/api/spotify', spotifyRoutes);
if (legacyRoutes.notifications) app.use('/api/notifications', legacyRoutes.notifications);

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error('[App Error]', err);
  res.status(err.statusCode || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Server error' : err.message
  });
});

module.exports = app;
