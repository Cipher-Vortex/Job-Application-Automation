import { Worker } from 'bullmq';
import { redisConnection } from '../config/redis';
import { MatcherAgent } from '../agents/MatcherAgent';
import { applicationPrepQueue } from './index';
import JobModel from '../models/Job';

export const analysisWorker = new Worker('jd-analysis', async job => {
  console.log(`[Agent 2] Analyzing job: ${job.data.jobTitle} at ${job.data.company}`);
  
  // 1. Analyze against the candidate profile
  const analysis = await MatcherAgent.analyzeJD(job.data.jobDescription);
  
  // 2. Save result to DB
  await JobModel.updateOne(
    { jobUrl: job.data.jobUrl },
    { 
      matchScore: analysis.technical_score,
      skillsMatched: analysis.evaluation?.strong_matches || [],
      missingSkills: analysis.evaluation?.missing_skills || [],
      status: 'Analyzed'
    }
  );

  // 3. Delegate next step
  if (analysis.technical_score >= 70 || analysis.suitability_score >= 70) {
    console.log(`[Agent 2] Matches! Queuing ${job.data.company} for Application Prep.`);
    await applicationPrepQueue.add('prep', {
      ...job.data,
      analysis
    });
  } else {
    console.log(`[Agent 2] Score too low (${analysis.technical_score}) for ${job.data.company}. Skipping.`);
    await JobModel.updateOne({ jobUrl: job.data.jobUrl }, { status: 'Skipped' });
  }

}, { connection: redisConnection });
