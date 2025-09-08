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

function storageMode(){
  return process.env.LIBSQL_URL ? 'remote-libsql' : (process.env.BLOB_READ_WRITE_TOKEN ? 'vercel-blob' : 'in-memory-sqljs');
}

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

  async function maybeFlush(){
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try { const { flushDirty } = require('./blobDb'); if (typeof flushDirty === 'function') await flushDirty(); } catch (e){ console.warn('[flush] failed', e.message); }
    }
  }

  app.get('/health', async (req,res)=>{ res.json({ ok:true, instance: INSTANCE_ID, storage: storageMode() }); });
  app.get('/debug/state', async (req,res)=>{
    try {
      const dealers = await listDealers();
      const template = await getTemplate();
      res.json({
        instance: INSTANCE_ID,
        storage: storageMode(),
        dealersCount: dealers.length,
        dealerIds: dealers.map(d=>d.id).slice(0,50),
        templateLength: template.length,
        templateHash: require('crypto').createHash('sha1').update(template).digest('hex').slice(0,12)
      });
    } catch (e){ res.status(500).json({ error:'debug_state_failed', message: e.message }); }
  });

  app.get('/template', async (req,res)=>{
    try { const t = await getTemplate(); res.json({ template: t }); }
    catch (e) { res.status(500).json({ error:'Failed to read template' }); }
  });
  app.put('/template', async (req,res)=>{
    const { template } = req.body || {};
    if (typeof template !== 'string') return res.status(400).json({ error:'template must be string' });
    try { await saveTemplate(template); await maybeFlush(); res.json({ ok:true }); }
    catch { res.status(500).json({ error:'Failed to write template' }); }
  });

  app.get('/dealers', async (req,res)=>{
    try { const dealers = await listDealers(); console.log('[dealers] list', { instance: INSTANCE_ID, count: dealers.length }); res.json({ dealers, instance: INSTANCE_ID }); }
    catch { res.status(500).json({ error:'Failed to read dealers', instance: INSTANCE_ID }); }
  });
  // New: fetch a single dealer
  app.get('/dealers/:id', async (req,res)=>{
    const { id } = req.params;
    try {
      const dealer = await getDealer(id);
      if (!dealer) return res.status(404).json({ error:'not found' });
      res.json({ dealer, instance: INSTANCE_ID });
    } catch { res.status(500).json({ error:'Failed to read dealer' }); }
  });
  app.post('/dealers', async (req,res)=>{
    const { name, address, number, brand } = req.body || {};
    if (!name) return res.status(400).json({ error:'name required' });
    try {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2,6);
      const dealer = await createDealer({ id, name, address, number, brand });
      await maybeFlush();
      res.status(201).json({ dealer });
    } catch { res.status(500).json({ error:'Failed to create dealer' }); }
  });
  app.put('/dealers/:id', async (req,res)=>{
    const { id } = req.params;
    try {
      const d = await updateDealer(id, req.body || {});
      if (!d) return res.status(404).json({ error:'not found' });
      await maybeFlush();
      res.json({ dealer:d });
    } catch { res.status(500).json({ error:'Failed to update dealer' }); }
  });
  app.delete('/dealers/:id', async (req,res)=>{
    const { id } = req.params;
    try {
      const existing = await getDealer(id);
      if (!existing) return res.status(404).json({ error:'not found' });
      await deleteDealer(id);
      await maybeFlush();
      res.json({ ok:true });
    } catch { res.status(500).json({ error:'Failed to delete dealer' }); }
  });
  app.get('/dealers/:id/render', async (req,res)=>{
    const { id } = req.params;
    const debug = 'debug' in req.query || process.env.DEBUG_RENDER;
    const meta = { id, instance: INSTANCE_ID, storage: storageMode() };
    try {
      const dealers = debug ? await listDealers() : null;
      const dealer = await getDealer(id);
      if (!dealer || !dealer.id) {
        if (debug) meta.dealersPresent = dealers.map(d=>d.id);
        meta.reason = 'dealer_not_found';
        return res.status(404).json({ error:'dealer not found', ...meta });
      }
      const template = await getTemplate();
      if (debug) {
        meta.templateLength = template.length;
        meta.templateHash = require('crypto').createHash('md5').update(template).digest('hex').slice(0,12);
      }
      const rendered = renderTemplateForDealer(template, dealer);
      if (debug) meta.renderedLength = rendered.length;
      const wantsRaw = 'raw' in req.query || /text\/plain/.test(req.headers.accept||'');
      if (wantsRaw) {
        res.set('Content-Type','text/plain; charset=utf-8');
        if (debug) res.set('X-Debug-Meta', Buffer.from(JSON.stringify(meta)).toString('base64'));
        return res.send(rendered);
      }
      res.json({ rendered, dealer, ...meta });
    } catch (e) {
      meta.reason = 'exception';
      meta.message = e.message;
      if (debug) meta.stack = e.stack?.split('\n').slice(0,4).join(' | ');
      console.error('[render] error', meta);
      res.status(500).json({ error:'render_failed', ...meta });
    }
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
