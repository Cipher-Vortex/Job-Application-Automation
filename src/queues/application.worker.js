"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.applicationPrepWorker = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../config/redis");
const ApplicationPrepAgent_1 = require("../agents/ApplicationPrepAgent");
const index_1 = require("./index");
const Job_1 = __importDefault(require("../models/Job"));
exports.applicationPrepWorker = new bullmq_1.Worker('application-prep', async (job) => {
    console.log(`[Agent 3] Preparing application for: ${job.data.jobTitle} at ${job.data.company}`);
    // 1. Generate Cover Letter & Q&A
    const prepData = await ApplicationPrepAgent_1.ApplicationPrepAgent.prepareApplication(job.data.jobTitle, job.data.company, job.data.screeningQuestions || []);
    // 2. Update DB status to Pending Approval
    await Job_1.default.updateOne({ jobUrl: job.data.jobUrl }, { status: 'Pending Approval' });
    // 3. Route to Browser Agent
    console.log(`[Agent 3] Prep complete! Routing to Browser Agent for execution.`);
    await index_1.browserApplyQueue.add('apply', {
        ...job.data,
        prepData
    });
}, { connection: redis_1.redisConnection });
//# sourceMappingURL=application.worker.js.map