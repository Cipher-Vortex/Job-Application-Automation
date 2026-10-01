import { Worker } from 'bullmq';
import { redisConnection } from '../config/redis';
import { ApplicationPrepAgent } from '../agents/ApplicationPrepAgent';
import { browserApplyQueue } from './index';
import JobModel from '../models/Job';

export const applicationPrepWorker = new Worker('application-prep', async job => {
  console.log(`[Agent 3] Preparing application for: ${job.data.jobTitle} at ${job.data.company}`);
  
  // 1. Generate Cover Letter & Q&A
  const prepData = await ApplicationPrepAgent.prepareApplication(
    job.data.jobTitle, 
    job.data.company, 
    job.data.screeningQuestions || []
  );
  
  // 2. Update DB status to Pending Approval
  await JobModel.updateOne({ jobUrl: job.data.jobUrl }, { status: 'Pending Approval' });
  
  // 3. Route to Browser Agent
  console.log(`[Agent 3] Prep complete! Routing to Browser Agent for execution.`);
  await browserApplyQueue.add('apply', {
    ...job.data,
    prepData
  });

}, { connection: redisConnection });
