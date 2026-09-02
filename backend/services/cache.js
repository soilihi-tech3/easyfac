const Redis = require('ioredis');
const { LRUCache } = require('lru-cache');

// Local fallback in-memory cache if Redis is not available
const memoryCache = new LRUCache({
  max: 1000,
  ttl: 1000 * 60 * 5, // 5 minutes default
});

let redisClient = null;
let isRedisConnected = false;

// Attempt Redis connection if REDIS_URL or REDIS_HOST is set
const redisUrl = process.env.REDIS_URL;
const redisHost = process.env.REDIS_HOST;

if (redisUrl || redisHost) {
  try {
    const config = redisUrl || {
      host: redisHost || '127.0.0.1',
      port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      retryStrategy: (times) => {
        if (times > 3) return null; // stop retrying after 3 attempts, fallback to memory
        return Math.min(times * 100, 2000);
      }
    };
    redisClient = new Redis(config);

    redisClient.on('connect', () => {
      isRedisConnected = true;
      console.log('⚡ [Cache] Redis client connected successfully!');
    });

    redisClient.on('error', (err) => {
      isRedisConnected = false;
      console.warn('⚠️ [Cache] Redis error, using in-memory LRU fallback:', err.message);
    });
  } catch (e) {
    console.warn('⚠️ [Cache] Redis init error, using in-memory LRU fallback:', e.message);
  }
} else {
  console.log('⚡ [Cache] Using high-performance in-memory LRU cache engine.');
}

const cacheService = {
  async get(key) {
    try {
      if (isRedisConnected && redisClient) {
        const val = await redisClient.get(key);
        return val ? JSON.parse(val) : null;
      }
    } catch (err) {
      console.warn(`[Cache GET Error] ${key}:`, err.message);
    }
    const memVal = memoryCache.get(key);
    return memVal !== undefined ? memVal : null;
  },

  async set(key, value, ttlSeconds = 60) {
    try {
      memoryCache.set(key, value, { ttl: ttlSeconds * 1000 });
      if (isRedisConnected && redisClient) {
        await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      }
    } catch (err) {
      console.warn(`[Cache SET Error] ${key}:`, err.message);
    }
  },

  async del(key) {
    try {
      memoryCache.delete(key);
      if (isRedisConnected && redisClient) {
        await redisClient.del(key);
      }
    } catch (err) {
      console.warn(`[Cache DEL Error] ${key}:`, err.message);
    }
  },

  async delByPrefix(prefix) {
    try {
      for (const key of memoryCache.keys()) {
        if (typeof key === 'string' && key.startsWith(prefix)) {
          memoryCache.delete(key);
        }
      }
      if (isRedisConnected && redisClient) {
        const keys = await redisClient.keys(`${prefix}*`);
        if (keys.length > 0) {
          await redisClient.del(...keys);
        }
      }
    } catch (err) {
      console.warn(`[Cache delByPrefix Error] ${prefix}:`, err.message);
    }
  },

  async flushPattern(pattern) {
    try {
      memoryCache.clear();
      if (isRedisConnected && redisClient) {
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
          await redisClient.del(...keys);
        }
      }
    } catch (err) {
      console.warn(`[Cache FLUSH Error]:`, err.message);
    }
  }
};

module.exports = cacheService;
