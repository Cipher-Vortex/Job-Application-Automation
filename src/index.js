"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const db_1 = require("./config/db");
const Job_1 = __importDefault(require("./models/Job"));
const path_1 = __importDefault(require("path"));
require("./queues/discovery.worker");
require("./queues/analysis.worker");
require("./queues/application.worker");
require("./queues/browser.worker");
require("./queues/tracking.worker");
const index_1 = require("./queues/index");
console.log("=================================================");
console.log("JobPilot AI 5-Agent Architecture Starting...");
console.log("=================================================");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Serve static frontend - Assumes running from dist/src or root depending on tsx/tsc
app.use(express_1.default.static(path_1.default.join(__dirname, '../../frontend')));
// API: Get pending jobs (Human Review Queue)
app.get('/api/jobs/pending', async (req, res) => {
    try {
        const jobs = await Job_1.default.find({ status: 'Pending Approval' }).lean();
        res.json(jobs);
    }
    catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});
// API: Approve Job
app.post('/api/jobs/:id/approve', async (req, res) => {
    try {
        const job = await Job_1.default.findById(req.params.id);
        if (!job)
            return res.status(404).json({ error: 'Job not found' });
        // Switch status
        job.status = 'Approved';
        await job.save();
        // Send to Agent 4 (Browser Automation)
        await index_1.browserApplyQueue.add('apply', { ...job.toObject(), type: 'approved_application' });
        res.json({ success: true, message: 'Added to Browser Application Queue' });
    }
    catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});
// API: Get all jobs for dashboard
app.get('/api/jobs', async (req, res) => {
    try {
        const jobs = await Job_1.default.find().lean();
        const mapped = jobs.map(j => ({
            id: j._id,
            company: j.company,
            title: j.jobTitle,
            url: j.jobUrl,
            source: j.source,
            location: j.location,
            jobType: 'Full-time',
            salaryRaw: j.salary || 'Unknown',
            remoteType: j.remoteStatus,
            matchScore: j.matchScore
        }));
        res.json(mapped);
    }
    catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});
const index_2 = require("./queues/index");
// API: Seed Jobs from Python Scraper
app.post('/api/jobs/seed', async (req, res) => {
    try {
        const jobData = req.body;
        // Check if duplicate
        let existingJob = await Job_1.default.findOne({ jobUrl: jobData.url });
        if (existingJob) {
            return res.json({ success: true, message: 'Job already exists, skipped.' });
        }
        const newJob = new Job_1.default({
            company: jobData.company,
            jobTitle: jobData.title,
            jobUrl: jobData.url,
            source: jobData.source || 'Scraper',
            location: jobData.location,
            jobDescription: jobData.description || 'Description not provided',
            salary: jobData.salary || 'Unknown',
            status: 'Discovered'
        });
        await newJob.save();
        // Push to Agent 2 (JD Analysis Queue)
        await index_2.jdAnalysisQueue.add('analyze', { ...newJob.toObject(), jobId: newJob._id });
        res.json({ success: true, message: 'Added to Discovered & Analysis Queue' });
    }
    catch (error) {
        console.error("Error seeding job:", error);
        res.status(500).json({ error: 'Server error' });
    }
});
async function start() {
    await (0, db_1.connectDB)();
    console.log("Workers attached to Redis Queues.");
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
    });
}
start();
//# sourceMappingURL=index.js.map