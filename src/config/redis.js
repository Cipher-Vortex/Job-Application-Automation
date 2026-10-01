"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisConnection = void 0;
const ioredis_1 = require("ioredis");
const REDIS_HOST = process.env.REDIS_HOST || 'redis';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
exports.redisConnection = new ioredis_1.Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    maxRetriesPerRequest: null
});
exports.redisConnection.on('connect', () => {
    console.log('Redis connected successfully');
});
exports.redisConnection.on('error', (err) => {
    console.error('Redis connection error:', err);
});
//# sourceMappingURL=redis.js.map