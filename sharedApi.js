const path = require('path');
const fs = require('fs');
const express = require('express');

// Adapter selection
const db = process.env.LIBSQL_URL ? require('./remoteDb') : (process.env.BLOB_READ_WRITE_TOKEN ? require('./blobDb') : require('./db'));
const { seedTemplateIfMissing, getTemplate, saveTemplate, listDealers, getDealer, createDealer, updateDealer, deleteDealer } = db;

const TEMPLATE_FILE_PATH = path.join(__dirname, 'template.txt');
let dataInitialized = false;
const INSTANCE_ID = process.env.INSTANCE_ID || (Math.random().toString(36).slice(2,10));

function storageMode(){ return process.env.LIBSQL_URL ? 'remote-libsql' : (process.env.BLOB_READ_WRITE_TOKEN ? 'vercel-blob' : 'in-memory-sqljs'); }

async function initData(){
  if (dataInitialized) return;
  await db.init;
  let def = 'Dealer: {{DEALER_NAME}}\nAddress: {{ADDRESS}}\nContact: {{NUMBER}}\nBrand: {{BRAND}}\n';
  try { if (fs.existsSync(TEMPLATE_FILE_PATH)) { const t = fs.readFileSync(TEMPLATE_FILE_PATH,'utf8'); if (t.trim()) def = t; } } catch {}
  try { await seedTemplateIfMissing(def); } catch {}
  dataInitialized = true;
}

function renderTemplateForDealer(tpl, dealer){
  if (!dealer) return tpl;
  const map = { DEALER_NAME: dealer.name||'', NAME: dealer.name||'', ADDRESS: dealer.address||'', NUMBER: dealer.number||'', PHONE: dealer.number||'', BRAND: dealer.brand||'' };
  for (const [k,v] of Object.entries(map)) tpl = tpl.replace(new RegExp(`{{\\s*${k}\\s*}}`,'g'), v);
  return tpl;
}

function createApiRouter(){
  const app = express();
  app.use(express.json({ limit:'1mb' }));

  const zeroWidthRE = /[\u200B-\u200D\uFEFF]/g;
  const sanitizeId = id => (typeof id==='string'? id.replace(zeroWidthRE,'').trim(): '');
  async function maybeFlush(){ if (process.env.BLOB_READ_WRITE_TOKEN) { try { const { flushDirty } = require('./blobDb'); if (flushDirty) await flushDirty(); } catch {} } }
  const notFound = (res,id)=> res.status(404).json({ error:'not_found', id });
  const bad = (res,err)=> res.status(400).json({ error: err });
  const serverErr = (res,e)=> res.status(500).json({ error:'server_error', message: e.message });

  // Health
  app.get('/health', (req,res)=> res.json({ ok:true, instance: INSTANCE_ID, storage: storageMode() }));

  // Template
  app.get('/template', async (_req,res)=>{ try { res.json({ template: await getTemplate() }); } catch(e){ serverErr(res,e); } });
  app.put('/template', async (req,res)=>{
    const { template } = req.body||{}; if (typeof template !== 'string') return bad(res,'invalid_template');
    try { await saveTemplate(template); await maybeFlush(); res.json({ ok:true }); } catch(e){ serverErr(res,e); }
  });

  // List dealers
  app.get('/dealers', async (_req,res)=>{ try { res.json({ dealers: await listDealers(), instance: INSTANCE_ID }); } catch(e){ serverErr(res,e); } });

  // Single dealer CRUD via query string
  // GET /dealer?id=XYZ
  app.get('/dealer', async (req,res)=>{
    const id = sanitizeId(req.query.id); if (!id) return bad(res,'id_required');
    try { const dealer = await getDealer(id); if (!dealer) return notFound(res,id); res.json({ dealer }); } catch(e){ serverErr(res,e); }
  });
  // POST /dealer (create)
  app.post('/dealer', async (req,res)=>{
    const { name, address='', number='', brand='' } = req.body||{}; if (!name) return bad(res,'name_required');
    try { const id = Date.now().toString(36)+Math.random().toString(36).slice(2,6); const dealer = await createDealer({ id, name, address, number, brand }); await maybeFlush(); res.status(201).json({ dealer }); } catch(e){ serverErr(res,e); }
  });
  // PUT /dealer?id=XYZ
  app.put('/dealer', async (req,res)=>{
    const id = sanitizeId(req.query.id); if (!id) return bad(res,'id_required');
    try { const dealer = await updateDealer(id, req.body||{}); if (!dealer) return notFound(res,id); await maybeFlush(); res.json({ dealer }); } catch(e){ serverErr(res,e); }
  });
  // DELETE /dealer?id=XYZ
  app.delete('/dealer', async (req,res)=>{
    const id = sanitizeId(req.query.id); if (!id) return bad(res,'id_required');
    try { const existing = await getDealer(id); if (!existing) return notFound(res,id); await deleteDealer(id); await maybeFlush(); res.json({ ok:true }); } catch(e){ serverErr(res,e); }
  });
  // GET /dealer/render?id=XYZ[&raw][&debug]
  app.get('/render', async (req,res)=>{
    const id = sanitizeId(req.query.id); if (!id) return bad(res,'id_required');
    const debug = 'debug' in req.query;
    try {
      const dealer = await getDealer(id); if (!dealer) return notFound(res,id);
      const template = await getTemplate();
      const rendered = renderTemplateForDealer(template, dealer);
      if ('raw' in req.query || /text\/plain/.test(req.headers.accept||'')) {
        res.set('Content-Type','text/plain; charset=utf-8');
        if (debug) res.set('X-Debug-Info', JSON.stringify({ id, len: rendered.length }));
        return res.send(rendered);
      }
      const body = { rendered, dealer }; if (debug) body.debug = { id, templateLength: template.length };
      res.json(body);
    } catch(e){ serverErr(res,e); }
  });

  return app;
}

function registerApi(app){ app.use('/api', createApiRouter()); }

module.exports = { initData, registerApi, createApiRouter, renderTemplateForDealer };
