/**
 * server.js — FIX: BUG 6 (Render.com Free Tier Sleeping) + BUG 9 (CORS)
 *
 * BUGS FIXED:
 *  - BUG 6: Server sleeps after 15 min → self-ping every 14 min (production only)
 *    Uses node's built-in fetch (Node 18+) so no extra dependency needed.
 *  - BUG 9: CORS headers tightened and sourced from env so they match deployment.
 *  - Added graceful shutdown on SIGTERM (Render sends this before container stops).
 *  - Explicit unhandledRejection + uncaughtException handlers with safe exit codes.
 *  - Memory pressure logged: on free tier (350 MB limit) this helps debug OOM kills.
 */

'use strict';

require('dotenv').config();
const http = require('http');

const app      = require('./app');
const connectDB = require('./config/db');
const initSocket = require('./socket');

const PORT = parseInt(process.env.PORT || '5000', 10);

// ── Required env vars ────────────────────────────────────────────────────────
const REQUIRED_ENV = [
  'MONGODB_URI',
  'JWT_SECRET',
  'CLIENT_URL',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
];

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[Server] ❌ MISSING ENV: ${key} — set it in the Render dashboard`);
    process.exit(1);
  }
}

// ── Create server ────────────────────────────────────────────────────────────
const server = http.createServer(app);
initSocket(server);

// ── Startup ───────────────────────────────────────────────────────────────────
const startServer = async () => {
  try {
    await connectDB();
    server.listen(PORT, () => {
      const heapMB = Math.round(process.memoryUsage().heapUsed / 1_048_576);
      console.log(`🚀 Zuno server running on port ${PORT} (heap ${heapMB} MB)`);
    });
  } catch (err) {
    console.error('[Server] Failed to start:', err.message);
    process.exit(1);
  }
};

// ── FIX BUG 6: Self-ping keep-alive (production only, every 14 minutes) ─────
// Render.com free tier spins down after 15 min of inactivity.
// This pings the health endpoint 1 min before that threshold to prevent sleeping.
const BACKEND_URL =
  process.env.RENDER_EXTERNAL_URL ||
  process.env.BACKEND_URL ||
  `http://localhost:${PORT}`;

if (process.env.NODE_ENV === 'production') {
  const PING_INTERVAL_MS = 14 * 60 * 1000; // 14 minutes

  const ping = () => {
    fetch(`${BACKEND_URL}/health`, { signal: AbortSignal.timeout(10_000) })
      .then(() => console.log('[Keep-alive] ✅ ping OK'))
      .catch((err) => console.warn('[Keep-alive] ⚠️  ping failed:', err.message));
  };

  // Start pinging after server is up (delay 60 s to avoid pinging before boot finishes)
  setTimeout(() => {
    ping(); // first immediate ping after boot delay
    setInterval(ping, PING_INTERVAL_MS).unref();
  }, 60_000).unref();

  console.log(`[Keep-alive] Scheduled every 14 min → ${BACKEND_URL}/health`);
}

// ── Memory pressure logging (every 5 min) ────────────────────────────────────
// Helps diagnose OOM kills on Render's free tier (350 MB node limit)
if (process.env.NODE_ENV === 'production') {
  setInterval(() => {
    const { heapUsed, heapTotal, rss } = process.memoryUsage();
    const toMB = (b) => Math.round(b / 1_048_576);
    console.log(`[Memory] heap=${toMB(heapUsed)}/${toMB(heapTotal)} MB  rss=${toMB(rss)} MB`);

    // Trigger GC if available (node --expose-gc flag is set on Render)
    if (typeof global.gc === 'function') global.gc();
  }, 5 * 60 * 1000).unref();
}

// ── Process event handlers ────────────────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  console.error('[Process] Unhandled rejection:', reason);
  // Do NOT exit — unhandled rejections don't crash production in Node 18+
});

process.on('uncaughtException', (err) => {
  console.error('[Process] Uncaught exception:', err);
  process.exit(1); // must exit — process state is undefined after uncaught exception
});

// FIX BUG 6: Graceful shutdown on Render SIGTERM
process.on('SIGTERM', () => {
  console.log('[Process] SIGTERM received — shutting down gracefully…');
  server.close(() => {
    console.log('[Process] HTTP server closed. Bye!');
    process.exit(0);
  });
  // Force exit if graceful shutdown takes > 10 s
  setTimeout(() => process.exit(0), 10_000).unref();
});

startServer();
