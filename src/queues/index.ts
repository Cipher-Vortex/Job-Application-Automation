import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';

// Define the queues for the 5-Agent workflow
export const jobDiscoveryQueue = new Queue('job-discovery', { connection: redisConnection });
export const jdAnalysisQueue = new Queue('jd-analysis', { connection: redisConnection });
export const applicationPrepQueue = new Queue('application-prep', { connection: redisConnection });
export const browserApplyQueue = new Queue('browser-apply', { connection: redisConnection });
export const trackingQueue = new Queue('tracking', { connection: redisConnection });

console.log('BullMQ Queues Initialized');
