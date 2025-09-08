const path = require('path');
const fs = require('fs');
const express = require('express');

// Choose DB adapter precedence: libsql > blob > local
const db = process.env.LIBSQL_URL
  ? require('./remoteDb')
  : (process.env.BLOB_READ_WRITE_TOKEN ? require('./blobDb') : require('./db'));
const {
  seedTemplateIfMissing,
  getTemplate,
  saveTemplate,
  listDealers,
  getDealer,
  createDealer,
  updateDealer,
  deleteDealer
} = db;

const TEMPLATE_FILE_PATH = path.join(__dirname, 'template.txt');
let dataInitialized = false;
let INSTANCE_ID = process.env.INSTANCE_ID || (Math.random().toString(36).slice(2,10));

async function initData() {
  if (dataInitialized) return;
  await db.init; // wait for DB init promise
  let defaultTemplate = 'Dealer: {{DEALER_NAME}}\nAddress: {{ADDRESS}}\nContact: {{NUMBER}}\nBrand: {{BRAND}}\n';
  try {
    if (fs.existsSync(TEMPLATE_FILE_PATH)) {
      const fileContent = fs.readFileSync(TEMPLATE_FILE_PATH,'utf8');
      if (fileContent.trim()) defaultTemplate = fileContent; // raw use
    }
  } catch {}
  try { await seedTemplateIfMissing(defaultTemplate); } catch {}
  dataInitialized = true;
}

function renderTemplateForDealer(template, dealer) {
  if (!dealer) return template;
  const vars = {
    DEALER_NAME: dealer.name || '',
    NAME: dealer.name || '',
    ADDRESS: dealer.address || '',
    NUMBER: dealer.number || '',
    PHONE: dealer.number || '',
    BRAND: dealer.brand || ''
  };
  for (const [key, value] of Object.entries(vars)) {
    const re = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    template = template.replace(re, value);
  }
  return template; // no trimming / normalization
}

function createApiRouter() {
  const app = express();
  app.use(express.json());

  app.get('/health', async (req,res)=>{ res.json({ ok:true, instance: INSTANCE_ID, storage: process.env.LIBSQL_URL ? 'remote-libsql' : (process.env.BLOB_READ_WRITE_TOKEN ? 'vercel-blob' : 'in-memory-sqljs') }); });

  app.get('/template', async (req,res)=>{
    try { const t = await getTemplate(); res.json({ template: t }); }
    catch (e) { res.status(500).json({ error:'Failed to read template' }); }
  });
  app.put('/template', async (req,res)=>{
    const { template } = req.body || {};
    if (typeof template !== 'string') return res.status(400).json({ error:'template must be string' });
    try { await saveTemplate(template); res.json({ ok:true }); }
    catch { res.status(500).json({ error:'Failed to write template' }); }
  });

  app.get('/dealers', async (req,res)=>{
    try { const dealers = await listDealers(); console.log('[dealers] list', { instance: INSTANCE_ID, count: dealers.length }); res.json({ dealers, instance: INSTANCE_ID }); }
    catch { res.status(500).json({ error:'Failed to read dealers', instance: INSTANCE_ID }); }
  });
  app.post('/dealers', async (req,res)=>{
    const { name, address, number, brand } = req.body || {};
    if (!name) return res.status(400).json({ error:'name required' });
    try {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2,6);
      const dealer = await createDealer({ id, name, address, number, brand });
      res.status(201).json({ dealer });
    } catch { res.status(500).json({ error:'Failed to create dealer' }); }
  });
  app.put('/dealers/:id', async (req,res)=>{
    const { id } = req.params;
    try {
      const d = await updateDealer(id, req.body || {});
      if (!d) return res.status(404).json({ error:'not found' });
      res.json({ dealer:d });
    } catch { res.status(500).json({ error:'Failed to update dealer' }); }
  });
  app.delete('/dealers/:id', async (req,res)=>{
    const { id } = req.params;
    try {
      const existing = await getDealer(id);
      if (!existing) return res.status(404).json({ error:'not found' });
      await deleteDealer(id);
      res.json({ ok:true });
    } catch { res.status(500).json({ error:'Failed to delete dealer' }); }
  });
  app.get('/dealers/:id/render', async (req,res)=>{
    const { id } = req.params;
    try {
      const dealer = await getDealer(id);
      if (!dealer || !dealer.id) {
        console.warn('[render] dealer not found', { id, instance: INSTANCE_ID });
        return res.status(404).json({ error:'dealer not found', id, instance: INSTANCE_ID });
      }
      const template = await getTemplate();
      const rendered = renderTemplateForDealer(template, dealer);
      console.log('[render] success', { id, instance: INSTANCE_ID });
      const wantsRaw = 'raw' in req.query || /text\/plain/.test(req.headers.accept||'');
      if (wantsRaw) {
        res.set('Content-Type','text/plain; charset=utf-8').send(rendered);
      } else {
        res.json({ rendered, dealer, instance: INSTANCE_ID });
      }
    } catch (e) {
      console.error('[render] error', { id, instance: INSTANCE_ID, msg: e.message });
      res.status(500).json({ error:'Failed to render', instance: INSTANCE_ID }); }
  });

  // Debug endpoint (not for production) to inspect current dealers
  app.get('/debug/dealers', async (req,res)=>{
    try { res.json({ dealers: await listDealers() }); }
    catch { res.status(500).json({ error:'debug list failed' }); }
  });

  return app;
}

function registerApi(app) {
  app.use('/api', createApiRouter());
}

module.exports = {
  initData,
  registerApi,
  createApiRouter,
  renderTemplateForDealer
};
