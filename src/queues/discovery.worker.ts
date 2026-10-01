import { Worker } from 'bullmq';
import { redisConnection } from '../config/redis';
import { jdAnalysisQueue } from './index';
import JobModel from '../models/Job';

// Agent 1: Job Hunter Worker logic
export const discoveryWorker = new Worker('job-discovery', async job => {
  console.log(`[Agent 1] Processing Scraped Job: ${job.data.jobTitle} at ${job.data.company}`);
  
  try {
    // 1. Detect Duplicates / Upsert into DB
    let existingJob = await JobModel.findOne({ jobUrl: job.data.jobUrl });
    if (existingJob) {
      console.log(`[Agent 1] Job already exists in DB. Skipping.`);
      return;
    }

    const newJob = new JobModel({
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
    await jdAnalysisQueue.add('analyze', { ...job.data, jobId: newJob._id });
    
  } catch (err) {
    console.error(`[Agent 1] Error processing discovered job:`, err);
  }

}, { connection: redisConnection });
