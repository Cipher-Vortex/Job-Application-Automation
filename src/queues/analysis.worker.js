"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analysisWorker = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../config/redis");
const MatcherAgent_1 = require("../agents/MatcherAgent");
const index_1 = require("./index");
const Job_1 = __importDefault(require("../models/Job"));
exports.analysisWorker = new bullmq_1.Worker('jd-analysis', async (job) => {
    console.log(`[Agent 2] Analyzing job: ${job.data.jobTitle} at ${job.data.company}`);
    // 1. Analyze against the candidate profile
    const analysis = await MatcherAgent_1.MatcherAgent.analyzeJD(job.data.jobDescription);
    // 2. Save result to DB
    await Job_1.default.updateOne({ jobUrl: job.data.jobUrl }, {
        matchScore: analysis.technical_score,
        skillsMatched: analysis.evaluation?.strong_matches || [],
        missingSkills: analysis.evaluation?.missing_skills || [],
        status: 'Analyzed'
    });
    // 3. Delegate next step
    if (analysis.technical_score >= 70 || analysis.suitability_score >= 70) {
        console.log(`[Agent 2] Matches! Queuing ${job.data.company} for Application Prep.`);
        await index_1.applicationPrepQueue.add('prep', {
            ...job.data,
            analysis
        });
    }
    else {
        console.log(`[Agent 2] Score too low (${analysis.technical_score}) for ${job.data.company}. Skipping.`);
        await Job_1.default.updateOne({ jobUrl: job.data.jobUrl }, { status: 'Skipped' });
    }
}, { connection: redis_1.redisConnection });
//# sourceMappingURL=analysis.worker.js.map