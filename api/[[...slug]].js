// Catch-all serverless function for all /api/* requests.
// Simplified: mount router at both root and /api to avoid path normalization edge cases seen on Vercel.
const express = require('express');
const { createApiRouter, initData } = require('../sharedApi');

let app; // reuse between invocations

function build(){
  const inst = express();
  inst.use(express.json({ limit: '1mb' }));
  inst.use((req,_res,next)=>{ if(!req._logged){ console.log('[api fn] incoming url:', req.url); req._logged=true; } next(); });
  const router = createApiRouter();
  // Mount both ways to cover either style of req.url passed by platform
  inst.use(router);       // handles paths like /template, /dealers
  inst.use('/api', router); // handles paths like /api/template, /api/dealers/...
  // Fallback 404
  inst.use((req,res)=> res.status(404).json({ error:'Not found', path:req.url }));
  // Error handler
  // eslint-disable-next-line no-unused-vars
  inst.use((err, _req, res, _next)=>{ console.error('[api fn] error:', err); res.status(500).json({ error:'Server error', detail: err.message }); });
  return inst;
}

module.exports = build;
