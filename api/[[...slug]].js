const express = require('express');
const { createApiRouter, initData } = require('../sharedApi');

let app; // reuse between invocations

function build(){
  const inst = express();
  inst.use(express.json({ limit: '1mb' }));
  inst.use((req,_res,next)=>{ if(!req._logged){ console.log('[api fn] incoming url:', req.url); req._logged=true; } next(); });
  const router = createApiRouter();
  inst.use(router);       // handles paths like /template, /dealers
  inst.use('/api', router); // handles paths like /api/template, /api/dealers/...
  inst.use((req,res)=> res.status(404).json({ error:'Not found', path:req.url }));
  // eslint-disable-next-line no-unused-vars
  inst.use((err, _req, res, _next)=>{ console.error('[api fn] error:', err); res.status(500).json({ error:'Server error', detail: err.message }); });
  return inst;
}

module.exports = async function handler(req,res){
  try { await initData(); } catch(e){ console.error('initData failed', e); }
  if (!app) app = build();
  return app(req,res);
};
