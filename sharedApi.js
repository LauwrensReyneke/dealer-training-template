const express = require('express');
const fs = require('fs');
const path = require('path');

// Dynamic storage selection: blobDb (blob persistence) > local embedded db
const storage = process.env.BLOB_READ_WRITE_TOKEN ? require('./blobDb') : require('./db');
const { seedTemplateIfMissing, getTemplate, saveTemplate, listDealers, getDealer, createDealer, updateDealer, deleteDealer, upsertDealers } = storage;

const TEMPLATE_FILE_PATH = path.join(__dirname, 'template.txt');
const DEALERS_JSON_PATH = path.join(__dirname, 'data', 'dealers.json');
let dataInitialized = false;

async function initData(){
  if (dataInitialized) return;
  await storage.init;
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
  const notFound = (res,id)=> res.status(404).json({ error:'not_found', id });
  const bad = (res,err)=> res.status(400).json({ error: err });
  const serverErr = (res,e)=> res.status(500).json({ error:'server_error', message: e.message });

  // Template
  app.get('/template', async (_req,res)=>{ try { res.json({ template: await getTemplate() }); } catch(e){ serverErr(res,e); } });
  app.put('/template', async (req,res)=>{
    const { template } = req.body||{}; if (typeof template !== 'string') return bad(res,'invalid_template');
    try { await saveTemplate(template); res.json({ ok:true }); } catch(e){ serverErr(res,e); }
  });

  // Dealers list
  app.get('/dealers', async (_req,res)=>{ try { res.json({ dealers: await listDealers() }); } catch(e){ serverErr(res,e); } });

  // Dealer CRUD (query id)
  app.get('/dealer', async (req,res)=>{ const id = sanitizeId(req.query.id); if (!id) return bad(res,'id_required'); try { const dealer = await getDealer(id); if (!dealer) return notFound(res,id); res.json({ dealer }); } catch(e){ serverErr(res,e); } });
  app.post('/dealer', async (req,res)=>{ const { name, address='', number='', brand='' } = req.body||{}; if (!name) return bad(res,'name_required'); try { const id = Date.now().toString(36)+Math.random().toString(36).slice(2,6); const dealer = await createDealer({ id, name, address, number, brand }); res.status(201).json({ dealer }); } catch(e){ serverErr(res,e); } });
  app.put('/dealer', async (req,res)=>{ const id = sanitizeId(req.query.id); if (!id) return bad(res,'id_required'); try { const dealer = await updateDealer(id, req.body||{}); if (!dealer) return notFound(res,id); res.json({ dealer }); } catch(e){ serverErr(res,e); } });
  app.delete('/dealer', async (req,res)=>{ const id = sanitizeId(req.query.id); if (!id) return bad(res,'id_required'); try { const existing = await getDealer(id); if (!existing) return notFound(res,id); await deleteDealer(id); res.json({ ok:true }); } catch(e){ serverErr(res,e); } });

  // Render
  app.get('/render', async (req,res)=>{ const id = sanitizeId(req.query.id); if (!id) return bad(res,'id_required'); try { const dealer = await getDealer(id); if (!dealer) return notFound(res,id); const template = await getTemplate(); const rendered = renderTemplateForDealer(template, dealer); res.json({ rendered, dealer }); } catch(e){ serverErr(res,e); } });

  // Populate dealers (idempotent) - always reads data/dealers.json
  const handlePopulate = async (_req,res)=>{
    try {
      let list = [];
      if (fs.existsSync(DEALERS_JSON_PATH)) {
        try {
          const raw = fs.readFileSync(DEALERS_JSON_PATH,'utf8');
            const parsed = JSON.parse(raw);
            list = Array.isArray(parsed) ? parsed : (parsed.dealers||[]);
        } catch (e){ return res.status(500).json({ error:'parse_error', message: e.message }); }
      } else {
        return res.status(404).json({ error:'dealers_file_missing' });
      }
      const inserted = upsertDealers(list);
      const all = await listDealers();
      res.json({ inserted, total: all.length });
    } catch(e){ serverErr(res,e); }
  };
  app.post('/populate', handlePopulate);
  app.get('/populate', handlePopulate);

  return app;
}

function registerApi(app){ app.use('/api', createApiRouter()); }

module.exports = { initData, registerApi, createApiRouter, renderTemplateForDealer };
