import { getCandidateData } from '../agents/llm';
import JobModel from '../models/Job';
import ApplicationModel from '../models/Application';

async function runTests() {
  console.log('=================================================');
  console.log(' RUNNING SYSTEM VERIFICATION SUITE');
  console.log('=================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  // TEST 1: Candidate Knowledge Base JSON loading
  try {
    const candidate = getCandidateData();
    assert(candidate !== null && typeof candidate === 'object', 'Candidate profile loads successfully');
    assert(candidate.candidate.name === 'Kiran S R', 'Candidate name matches Kiran S R');
    assert(candidate.candidate.contact.email === 'skkiran1258@gmail.com', 'Candidate email matches skkiran1258@gmail.com');
    assert(Array.isArray(candidate.skills.frontend), 'Candidate skills contain frontend list');
  } catch (err) {
    assert(false, `Candidate profile loading failed: ${err}`);
  }

  // TEST 2: Job Model Schema verification
  try {
    const sampleJob = new JobModel({
      company: 'Test Corp',
      jobTitle: 'Full Stack Engineer',
      jobUrl: 'https://example.com/job/123-' + Date.now(),
      jobDescription: 'Looking for React and Node.js developer',
      status: 'Pending Approval',
      matchScore: 88
    });
    assert(sampleJob.company === 'Test Corp', 'Job Model instantiates correctly');
    assert(sampleJob.status === 'Pending Approval', 'Job Model supports Pending Approval status');
  } catch (err) {
    assert(false, `Job Model instantiation failed: ${err}`);
  }

  // TEST 3: Application Model Schema verification
  try {
    const sampleApp = new ApplicationModel({
      jobId: '507f1f77bcf86cd799439011',
      coverLetter: 'Generated cover letter text',
      screeningAnswers: new Map([['Notice period?', 'Immediate']])
    });
    assert(sampleApp.coverLetter.length > 0, 'Application Model instantiates correctly');
  } catch (err) {
    assert(false, `Application Model instantiation failed: ${err}`);
  }

  console.log('\n-------------------------------------------------');
  console.log(`SUMMARY: ${passed} Passed | ${failed} Failed`);
  console.log('-------------------------------------------------');
}

runTests();
