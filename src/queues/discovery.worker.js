"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.discoveryWorker = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../config/redis");
const index_1 = require("./index");
const Job_1 = __importDefault(require("../models/Job"));
// Agent 1: Job Hunter Worker logic
exports.discoveryWorker = new bullmq_1.Worker('job-discovery', async (job) => {
    console.log(`[Agent 1] Processing Scraped Job: ${job.data.jobTitle} at ${job.data.company}`);
    try {
        // 1. Detect Duplicates / Upsert into DB
        let existingJob = await Job_1.default.findOne({ jobUrl: job.data.jobUrl });
        if (existingJob) {
            console.log(`[Agent 1] Job already exists in DB. Skipping.`);
            return;
        }
        const newJob = new Job_1.default({
            company: job.data.company,
            jobTitle: job.data.jobTitle,
            jobUrl: job.data.jobUrl,
            source: job.data.source,
            location: job.data.location,
            jobDescription: job.data.jobDescription,
            status: 'Discovered'
        });
        await newJob.save();
        // 2. Queue for JD Analysis
        console.log(`[Agent 1] Saved ${job.data.company} to DB. Sending to JD Analyzer (Agent 2).`);
        await index_1.jdAnalysisQueue.add('analyze', { ...job.data, jobId: newJob._id });
    }
    catch (err) {
        console.error(`[Agent 1] Error processing discovered job:`, err);
    }
}, { connection: redis_1.redisConnection });
//# sourceMappingURL=discovery.worker.js.map