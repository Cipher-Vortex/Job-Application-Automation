import { Redis } from 'ioredis';

const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

const bullMqOptions = { maxRetriesPerRequest: null };

// Check if user provided a full URL (redis://) or just a hostname
export const redisConnection = 
  (REDIS_HOST.startsWith('redis://') || REDIS_HOST.startsWith('rediss://'))
    ? new Redis(REDIS_HOST, bullMqOptions)
    : new Redis({ host: REDIS_HOST, port: REDIS_PORT, ...bullMqOptions });

redisConnection.on('connect', () => {
  console.log('Redis connected successfully');
});

redisConnection.on('error', (err) => {
  console.error('Redis connection error:', err);
});
