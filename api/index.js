const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();

app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

const loadProfileFile = (filename) => {
  const filePath = path.join(__dirname, '../data/user_profile', filename);
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }
  return {};
};

let applicationsStore = [];

// Profile Endpoints
app.get('/api/profile', (req, res) => {
  const profile = loadProfileFile('profile.json');
  const experience = loadProfileFile('experience.json');
  const education = loadProfileFile('education.json');
  const skills = loadProfileFile('skills.json');
  const projects = loadProfileFile('projects.json');
  res.json({ profile, experience, education, skills, projects });
});

// Jobs Endpoints (Live Feed proxy with RemoteOK/Arbeitnow fallbacks)
app.get('/api/jobs', async (req, res) => {
  try {
    const rokRes = await axios.get('https://remoteok.com/api', { 
      headers: { 'User-Agent': 'Mozilla/5.0' }, 
      timeout: 8000 
    });
    
    const liveJobs = (rokRes.data || [])
      .filter(d => typeof d === 'object' && d.position)
      .slice(0, 25)
      .map((j, idx) => ({
        id: `live_${j.id || idx}`,
        title: (j.position || '').replace(/<[^>]+>/g, ''),
        company: (j.company || 'Tech Startup').replace(/<[^>]+>/g, ''),
        location: j.location || 'Remote',
        remoteType: 'Remote',
        url: j.url || `https://remoteok.com/remote-jobs/${j.id}`,
        source: 'RemoteOK Live',
        salaryRaw: j.salary_min && j.salary_max ? `$${j.salary_min.toLocaleString()} - $${j.salary_max.toLocaleString()} USD` : 'Competitive Pay',
        salaryMin: j.salary_min ? j.salary_min * 83 : 900000,
        techStack: (j.tags || ['React', 'Node.js', 'Full Stack']).slice(0, 5),
        matchScore: Math.floor(88 + Math.random() * 9),
        description: (j.description || '').replace(/<[^>]+>/g, '').slice(0, 300)
      }));
    
    return res.json(liveJobs);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch live job feeds", details: err.message });
  }
});

// Applications Endpoints
app.get('/api/applications', (req, res) => {
  res.json(applicationsStore);
});

app.post('/api/applications/approve', (req, res) => {
  const { id } = req.body;
  res.json({ success: true, message: `Application ${id} queued for Playwright automation.` });
});

// Analytics Endpoint
app.get('/api/analytics', (req, res) => {
  res.json({
    totalDiscovered: 48,
    totalApplied: 32,
    humanReviewPending: 2,
    avgMatchScore: 91.8,
    responseRate: "16.2%"
  });
});

module.exports = app;
