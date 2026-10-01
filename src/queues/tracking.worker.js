"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackingWorker = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../config/redis");
const Job_1 = __importDefault(require("../models/Job"));
exports.trackingWorker = new bullmq_1.Worker('tracking', async (job) => {
    console.log(`[Agent 5] Tracking application for: ${job.data.company} - ${job.data.jobTitle}`);
    try {
        // Record status in DB & Log for CRM/Sheets export
        if (job.data._id) {
            await Job_1.default.updateOne({ _id: job.data._id }, { status: 'Applied' });
        }
        console.log(`[Agent 5] Successfully logged application status for ${job.data.company}`);
    }
    catch (err) {
        console.error(`[Agent 5] Error tracking application:`, err);
    }
}, { connection: redis_1.redisConnection });
//# sourceMappingURL=tracking.worker.js.map