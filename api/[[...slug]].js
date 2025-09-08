const express = require('express');
const path = require('path');
const fs = require('fs');
const { createApiRouter, initData } = require('../sharedApi');

let app; // reuse between invocations

function build(){
  const inst = express();
  inst.use(express.json({ limit: '1mb' }));
  inst.use((req,_res,next)=>{ if(!req._logged){ console.log('[api fn] incoming url:', req.url); req._logged=true; } next(); });
  const router = createApiRouter();
  // Mount API first
  inst.use('/api', router);
  // Also allow root-level API access (backwards compatibility)
  inst.use(router);

  // Static client assets (if built)
  const clientDist = path.join(__dirname,'..','client','dist');
  if (fs.existsSync(clientDist)) {
    inst.use(express.static(clientDist));
    // SPA fallback (only for non-API, non-static requests)
    inst.get('*', (req,res,next)=>{
      if (req.path.startsWith('/api/')) return next();
      const indexPath = path.join(clientDist,'index.html');
      if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
      return next();
    });
  }

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
