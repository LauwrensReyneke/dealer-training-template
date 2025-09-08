// Catch-all serverless function for all /api/* requests.
// Fix: previous file was corrupted (missing imports, stray 'a' references).
// We normalize req.url so routes '/template' and '/api/template' both work.
const express = require('express');
const { createApiRouter, initData } = require('../sharedApi');

let app; // reuse between invocations

function normalizePath(req, _res, next){
  // Vercel may give '/template' or '/api/template'. If second, strip leading /api.
  if (req.url.startsWith('/api/')) req.url = req.url.slice(4);
  next();
}

function build(){
  const inst = express();
  inst.use(express.json({ limit: '1mb' }));
  inst.use((req,_res,next)=>{ if(!req._logged){ console.log('[api fn] req.url incoming:', req.url); req._logged=true; } next(); });
  inst.use(normalizePath);
  inst.use(createApiRouter()); // router defines /template, /dealers, etc.
  // Fallback 404 JSON
  inst.use((req,res)=> res.status(404).json({ error:'Not found', path:req.originalUrl }));
  // Error handler
  // eslint-disable-next-line no-unused-vars
  inst.use((err, _req, res, _next)=>{ console.error('[api fn] error:', err); res.status(500).json({ error:'Server error', detail: err.message }); });
  return inst;
}

module.exports = async function handler(req, res){
  try { await initData(); } catch (e){ console.error('[api fn] initData error', e); }
  if (!app) app = build();
  return app(req, res);
};
