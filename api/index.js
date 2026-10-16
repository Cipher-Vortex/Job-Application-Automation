// Universal API Entrypoint for Vercel Serverless & Cloud Deployments
// Exports the complete JobPilot production Express engine with all live ATS routes, real-time sync & analytics
const app = require('../server/index');

module.exports = app;
