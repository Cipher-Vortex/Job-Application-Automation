"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackingQueue = exports.browserApplyQueue = exports.applicationPrepQueue = exports.jdAnalysisQueue = exports.jobDiscoveryQueue = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../config/redis");
// Define the queues for the 5-Agent workflow
exports.jobDiscoveryQueue = new bullmq_1.Queue('job-discovery', { connection: redis_1.redisConnection });
exports.jdAnalysisQueue = new bullmq_1.Queue('jd-analysis', { connection: redis_1.redisConnection });
exports.applicationPrepQueue = new bullmq_1.Queue('application-prep', { connection: redis_1.redisConnection });
exports.browserApplyQueue = new bullmq_1.Queue('browser-apply', { connection: redis_1.redisConnection });
exports.trackingQueue = new bullmq_1.Queue('tracking', { connection: redis_1.redisConnection });
console.log('BullMQ Queues Initialized');
//# sourceMappingURL=index.js.map