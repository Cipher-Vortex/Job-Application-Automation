import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db';
import JobModel from './models/Job';
import path from 'path';
import { createProxyMiddleware } from 'http-proxy-middleware';

import './queues/discovery.worker';
import './queues/analysis.worker';
import './queues/application.worker';
import './queues/browser.worker';
import './queues/tracking.worker';
import { browserApplyQueue } from './queues/index';

console.log("=================================================");
console.log("JobPilot AI 5-Agent Architecture Starting...");
console.log("=================================================");

const app = express();
app.use(cors());

// Universal Routing: Transparently tunnel any /api/ai requests internally to the hidden Python Engine
app.use('/api/ai', createProxyMiddleware({
  target: 'http://127.0.0.1:8001/api/ai',
  changeOrigin: true,
}));

app.use(express.json());

// Serve static frontend - Path dynamically resolves from dist/index.js -> /app/frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// API: Get pending jobs (Human Review Queue)
app.get('/api/jobs/pending', async (req, res) => {
  try {
    const jobs = await JobModel.find({ status: 'Pending Approval' }).lean();
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// API: Approve Job
app.post('/api/jobs/:id/approve', async (req, res) => {
  try {
    const job = await JobModel.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    
    // Switch status
    job.status = 'Approved';
    await job.save();

    // Send to Agent 4 (Browser Automation)
    await browserApplyQueue.add('apply', { ...job.toObject(), type: 'approved_application' });

    res.json({ success: true, message: 'Added to Browser Application Queue' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// API: Get all jobs for dashboard
app.get('/api/jobs', async (req, res) => {
  try {
    const jobs = await JobModel.find().lean();
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
  } catch(err) {
    res.status(500).json({ error: 'Server error' });
  }
});

import { jdAnalysisQueue } from './queues/index';

// API: Seed Jobs from Python Scraper
app.post('/api/jobs/seed', async (req, res) => {
  try {
    const jobData = req.body;
    
    // Check if duplicate
    let existingJob = await JobModel.findOne({ jobUrl: jobData.url });
    if (existingJob) {
      return res.json({ success: true, message: 'Job already exists, skipped.' });
    }

    const newJob = new JobModel({
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
    await jdAnalysisQueue.add('analyze', { ...newJob.toObject(), jobId: newJob._id });
    
    res.json({ success: true, message: 'Added to Discovered & Analysis Queue' });
  } catch (error) {
    console.error("Error seeding job:", error);
    res.status(500).json({ error: 'Server error' });
  }
});

async function start() {
    await connectDB();
    console.log("Workers attached to Redis Queues.");
    
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
}

start();
