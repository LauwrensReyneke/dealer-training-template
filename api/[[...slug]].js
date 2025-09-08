// Catch-all single serverless function for all /api routes
const express = require('express');
const { createApiRouter, initData } = require('../sharedApi');

let app; // reused across warm invocations

function buildApp(){
  const a = express();
  a.use(express.json({ limit: '1mb' }));
  // Mount at /api so requests like /api/template resolve correctly
  a.use('/api', createApiRouter());
  return a;
}

module.exports = async (req, res) => {
  try { await initData(); } catch {/* ignore init errors; downstream handlers will respond */}
  if (!app) app = buildApp();
  return app(req, res);
};
