const { createClient } = require('redis');

let client = null;
let ready = false;

const getRedisClient = async () => {
  if (!process.env.REDIS_URL) return null;
  if (client && ready) return client;

  if (!client) {
    client = createClient({ url: process.env.REDIS_URL });
    client.on('error', (error) => {
      ready = false;
      console.warn('[Redis] Cache unavailable:', error.message);
    });
    client.on('ready', () => {
      ready = true;
      console.log('[Redis] Cache connected');
    });
  }

  if (!client.isOpen) {
    await client.connect();
  }

  return ready ? client : null;
};

const getJson = async (key) => {
  try {
    const redis = await getRedisClient();
    if (!redis) return null;
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

const setJson = async (key, value, ttlSeconds = 60) => {
  try {
    const redis = await getRedisClient();
    if (!redis) return;
    await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch {
    // Cache writes are optional.
  }
};

const delByPattern = async (pattern) => {
  try {
    const redis = await getRedisClient();
    if (!redis) return;
    let cursor = 0;
    do {
      const reply = await redis.scan(cursor, { MATCH: pattern, COUNT: 100 });
      cursor = Number(reply.cursor);
      if (reply.keys.length) await redis.del(reply.keys);
    } while (cursor !== 0);
  } catch {
    // Cache invalidation is best effort.
  }
};

module.exports = { getJson, setJson, delByPattern };
