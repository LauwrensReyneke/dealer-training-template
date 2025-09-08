const express = require('express');
const fs = require('fs');
const path = require('path');

// Dynamic storage selection: blobDb (blob persistence) > local embedded db
const storage = process.env.BLOB_READ_WRITE_TOKEN ? require('./blobDb') : require('./db');
const { seedTemplateIfMissing, getTemplate, saveTemplate, deleteTemplate, listTemplates, listDealers, getDealer, createDealer, updateDealer, deleteDealer, upsertDealers, renameTemplate } = storage;

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
  const sanitizeTemplateKey = key => (typeof key==='string'? key.replace(/[^a-zA-Z0-9._-]+/g,'').slice(0,48): '');
  const notFound = (res,id)=> res.status(404).json({ error:'not_found', id });
  const bad = (res,err)=> res.status(400).json({ error: err });
  const serverErr = (res,e)=> res.status(500).json({ error:'server_error', message: e.message });

  // Templates (multi)
  app.get('/templates', async (_req,res)=>{ try { const list = (await listTemplates()).map(r=>({ key: r.key, updated_at: r.updated_at })); res.json({ templates: list }); } catch(e){ serverErr(res,e); } });
  app.get('/template', async (req,res)=>{ try { const key = sanitizeTemplateKey(req.query.key)||'main'; const template = await getTemplate(key); res.json({ key, template }); } catch(e){ serverErr(res,e); } });
  app.put('/template', async (req,res)=>{ const { template, key } = req.body||{}; if (typeof template !== 'string') return bad(res,'invalid_template'); const k = sanitizeTemplateKey(key)||'main'; try { await saveTemplate(k, template); res.json({ ok:true, key:k }); } catch(e){ serverErr(res,e); } });
  app.delete('/template', async (req,res)=>{ const key = sanitizeTemplateKey(req.query.key); if (!key) return bad(res,'key_required'); try { const ok = await deleteTemplate(key); if (!ok) return notFound(res,key); res.json({ ok:true }); } catch(e){ serverErr(res,e); } });
  app.post('/rename', async (req,res)=>{
    const srcOld = req.query.oldKey || (req.body&&req.body.oldKey);
    const srcNew = req.query.newKey || (req.body&&req.body.newKey);
    const o = sanitizeTemplateKey(srcOld);
    const n = sanitizeTemplateKey(srcNew);
    if (!o || !n) return bad(res,'keys_required');
    try { const ok = await renameTemplate(o,n); if (!ok) return res.status(409).json({ error:'rename_failed' }); res.json({ ok:true, key:n }); } catch(e){ serverErr(res,e); }
  });
  // Dealers
  app.get('/dealers', async (_req,res)=>{ try { res.json({ dealers: await listDealers() }); } catch(e){ serverErr(res,e); } });
  app.get('/dealer', async (req,res)=>{ const id = sanitizeId(req.query.id); if (!id) return bad(res,'id_required'); try { const dealer = await getDealer(id); if (!dealer) return notFound(res,id); res.json({ dealer }); } catch(e){ serverErr(res,e); } });
  app.post('/dealer', async (req,res)=>{ const { name, address='', number='', brand='' } = req.body||{}; if (!name) return bad(res,'name_required'); try { const id = Date.now().toString(36)+Math.random().toString(36).slice(2,6); const dealer = await createDealer({ id, name, address, number, brand }); res.status(201).json({ dealer }); } catch(e){ serverErr(res,e); } });
  app.put('/dealer', async (req,res)=>{ const id = sanitizeId(req.query.id); if (!id) return bad(res,'id_required'); try { const dealer = await updateDealer(id, req.body||{}); if (!dealer) return notFound(res,id); res.json({ dealer }); } catch(e){ serverErr(res,e); } });
  app.delete('/dealer', async (req,res)=>{ const id = sanitizeId(req.query.id); if (!id) return bad(res,'id_required'); try { const existing = await getDealer(id); if (!existing) return notFound(res,id); await deleteDealer(id); res.json({ ok:true }); } catch(e){ serverErr(res,e); } });

  // Render
  app.get('/render', async (req,res)=>{ const id = sanitizeId(req.query.id); if (!id) return bad(res,'id_required'); try { const dealer = await getDealer(id); if (!dealer) return notFound(res,id); const tplKey = sanitizeTemplateKey(req.query.template)||'main'; const template = await getTemplate(tplKey); const rendered = renderTemplateForDealer(template, dealer); res.json({ rendered, dealer, templateKey: tplKey }); } catch(e){ serverErr(res,e); } });

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

