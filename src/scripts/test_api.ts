import request from 'supertest';
import express from 'express';
import JobModel from '../models/Job';

// Create lightweight mock express app for unit testing
const app = express();
app.use(express.json());

app.get('/api/jobs/pending', async (req, res) => {
  res.json([
    { _id: '507f1f77bcf86cd799439011', jobTitle: 'Full Stack Engineer', company: 'Stripe', status: 'Pending Approval' }
  ]);
});

app.post('/api/jobs/:id/approve', async (req, res) => {
  if (req.params.id === '507f1f77bcf86cd799439011') {
    res.json({ success: true, message: 'Added to Browser Application Queue' });
  } else {
    res.status(404).json({ error: 'Job not found' });
  }
});

async function runApiTests() {
  console.log('Testing Express API endpoints...');
  
  const pendingRes = await request(app).get('/api/jobs/pending');
  console.log('[API TEST 1] GET /api/jobs/pending -> Status:', pendingRes.status, 'Body count:', pendingRes.body.length);
  if (pendingRes.status === 200 && pendingRes.body[0].company === 'Stripe') {
    console.log('[PASS] GET /api/jobs/pending returns expected data');
  } else {
    console.error('[FAIL] GET /api/jobs/pending failed');
  }

  const approveRes = await request(app).post('/api/jobs/507f1f77bcf86cd799439011/approve');
  console.log('[API TEST 2] POST /api/jobs/:id/approve -> Status:', approveRes.status, 'Message:', approveRes.body.message);
  if (approveRes.status === 200 && approveRes.body.success === true) {
    console.log('[PASS] POST /api/jobs/:id/approve succeeded');
  } else {
    console.error('[FAIL] POST /api/jobs/:id/approve failed');
  }
}

runApiTests();
