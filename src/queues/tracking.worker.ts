import { Worker } from 'bullmq';
import { redisConnection } from '../config/redis';
import JobModel from '../models/Job';

export const trackingWorker = new Worker('tracking', async job => {
  console.log(`[Agent 5] Tracking application for: ${job.data.company} - ${job.data.jobTitle}`);
  
  try {
    // Record status in DB & Log for CRM/Sheets export
    if (job.data._id) {
      await JobModel.updateOne({ _id: job.data._id }, { status: 'Applied' });
    }
    console.log(`[Agent 5] Successfully logged application status for ${job.data.company}`);
  } catch (err) {
    console.error(`[Agent 5] Error tracking application:`, err);
  }
}, { connection: redisConnection });
