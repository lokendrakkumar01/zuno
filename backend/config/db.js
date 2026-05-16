/**
 * config/db.js — FIX: BUG 4 (DB Connection Pool Exhausted)
 *
 * BUGS FIXED:
 *  - maxPoolSize was 5 → random 503 errors under load
 *  - No waitQueueTimeoutMS → connections queued forever
 *  - No minPoolSize → cold pool on first burst of traffic
 *  - No heartbeatFrequencyMS → slow detection of dead primaries
 *
 * FIXES:
 *  - maxPoolSize: 100  — handles concurrent traffic
 *  - minPoolSize: 5    — keeps 5 connections warm at all times
 *  - maxIdleTimeMS: 45000 — reclaim idle connections quickly
 *  - waitQueueTimeoutMS: 10000 — fail fast instead of queuing forever
 *  - serverSelectionTimeoutMS: 8000 — detect primary failure in 8 s
 *  - heartbeatFrequencyMS: 10000 — monitor replica set every 10 s
 *  - Connection error event emits a clear log without crashing process
 */

'use strict';

const mongoose = require('mongoose');

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not set. Add it to your Render environment variables.');
  }

  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 3000;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const conn = await mongoose.connect(mongoUri, {
        // ── FIX BUG 4: Connection pool tuning ───────────────────────────────
        maxPoolSize:          100,   // was 5 — caused 503s under load
        minPoolSize:          5,     // keep 5 warm connections pre-allocated
        maxIdleTimeMS:        45_000, // reclaim idle connections after 45 s
        waitQueueTimeoutMS:   10_000, // fail fast if pool full (was: infinite)

        // ── Timeouts ─────────────────────────────────────────────────────────
        serverSelectionTimeoutMS: 8_000,  // detect primary failure quickly
        socketTimeoutMS:          45_000,
        connectTimeoutMS:         10_000,
        heartbeatFrequencyMS:     10_000, // monitor replica set health every 10 s

        // ── Render.com free tier: no DNS TTL caching ─────────────────────────
        family: 4,
      });

      console.log(`✅ MongoDB connected: ${conn.connection.host} (pool max=${100})`);

      // ── FIX BUG 4: Connection event handlers ────────────────────────────────
      mongoose.connection.on('disconnected', () => {
        console.warn('⚠️  MongoDB disconnected — Mongoose will auto-reconnect');
      });

      mongoose.connection.on('reconnected', () => {
        console.log('✅ MongoDB reconnected');
      });

      // FIX BUG 4: log pool errors without crashing the process
      mongoose.connection.on('error', (err) => {
        console.error('❌ MongoDB connection error:', err.message);
        // Do NOT call process.exit() here — Mongoose will try to reconnect
      });

      // FIX BUG 4: monitor pool stats every 30 s in non-production
      if (process.env.NODE_ENV !== 'production') {
        setInterval(() => {
          const { poolSize, socketCount } = mongoose.connection.db?.s?.topology ?? {};
          if (poolSize !== undefined) {
            console.log(`[DB Pool] poolSize=${poolSize} sockets=${socketCount}`);
          }
        }, 30_000).unref();
      }

      return; // success — exit retry loop
    } catch (err) {
      console.error(`❌ MongoDB connection failed (attempt ${attempt}/${MAX_RETRIES}): ${err.message}`);
      if (attempt < MAX_RETRIES) {
        console.log(`🔄 Retrying in ${RETRY_DELAY_MS / 1000} s…`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      } else {
        throw new Error(`All ${MAX_RETRIES} MongoDB connection attempts failed.`);
      }
    }
  }
};

module.exports = connectDB;
