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

  // Utility for debugging hidden characters in ids
  function idDiagnostics(label, value){
    if (typeof value !== 'string') return { label, type: typeof value };
    return {
      label,
      value,
      length: value.length,
      codes: Array.from(value).map(c=>c.charCodeAt(0))
    };
  }

  function normalizeId(str){
    if (typeof str !== 'string') return '';
    // Remove zero-width / BOM characters that could sneak in from copy/paste or transport
    return str.replace(/[\u200B-\u200D\uFEFF]/g,'').trim();
  }

  async function maybeFlush(){
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try { const { flushDirty } = require('./blobDb'); if (typeof flushDirty === 'function') await flushDirty(); } catch (e){ console.warn('[flush] failed', e.message); }
    }
  }

  function sanitizeId(raw){
    if (typeof raw !== 'string') return '';
    return normalizeId(raw); // trimming + zero-width removal
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
  // Enhanced: fetch a single dealer with diagnostics
  app.get('/dealers/:id', async (req,res)=>{
    const rawId = req.params.id;
    const id = sanitizeId(rawId);
    if (!id) return res.status(400).json({ error:'invalid id', raw: rawId });
    try {
      let dealer = await getDealer(id);
      let fallbackUsed = false;
      if (!dealer) {
        // Fallback: search all dealers after normalizing their ids (handles hidden chars)
        const all = await listDealers();
        dealer = all.find(d => sanitizeId(d.id) === id) || null;
        fallbackUsed = !!dealer;
        if (!dealer) {
          const meta = {
            error: 'not found',
            id,
            rawId,
            idLength: id.length,
            rawIdLength: typeof rawId === 'string' ? rawId.length : null,
            idCharCodes: idDiagnostics('id', id).codes,
            rawIdCharCodes: idDiagnostics('rawId', rawId).codes,
            instance: INSTANCE_ID,
            presentIds: all.map(d=>d.id),
            presentIdCharCodes: all.map(d=>({ id: d.id, codes: idDiagnostics('present', d.id).codes })),
            fallbackTried: true
          };
          console.warn('[dealer:get] not found (debug meta)', meta);
          return res.status(404).json(meta);
        }
      }
      res.json({ dealer, instance: INSTANCE_ID, fallbackUsed });
    } catch (e){
      console.error('[dealer:get] error', { id, message: e.message });
      res.status(500).json({ error:'Failed to read dealer', id });
    }
  });
  app.post('/dealers', async (req,res)=>{
    const { name, address, number, brand } = req.body || {};
    if (!name) return res.status(400).json({ error:'name required' });
    try {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2,6);
      const dealer = await createDealer({ id, name, address, number, brand });
      await maybeFlush();
      console.log('[dealer:create]', { id: dealer?.id, instance: INSTANCE_ID });
      res.status(201).json({ dealer });
    } catch (e){
      console.error('[dealer:create] fail', e.message);
      res.status(500).json({ error:'Failed to create dealer' });
    }
  });
  app.put('/dealers/:id', async (req,res)=>{
    const id = sanitizeId(req.params.id);
    try {
      const d = await updateDealer(id, req.body || {});
      if (!d) {
        const all = await listDealers();
        console.warn('[dealer:update] not found', { id, have: all.map(x=>x.id) });
        return res.status(404).json({ error:'not found', id, presentIds: all.map(x=>x.id) });
      }
      await maybeFlush();
      res.json({ dealer:d });
    } catch (e){
      console.error('[dealer:update] error', { id, message: e.message });
      res.status(500).json({ error:'Failed to update dealer', id });
    }
  });
  app.delete('/dealers/:id', async (req,res)=>{
    const id = sanitizeId(req.params.id);
    try {
      const existing = await getDealer(id);
      if (!existing) {
        const all = await listDealers();
        console.warn('[dealer:delete] not found', { id, have: all.map(d=>d.id) });
        return res.status(404).json({ error:'not found', id, presentIds: all.map(d=>d.id) });
      }
      await deleteDealer(id);
      await maybeFlush();
      res.json({ ok:true });
    } catch (e){
      console.error('[dealer:delete] error', { id, message: e.message });
      res.status(500).json({ error:'Failed to delete dealer', id });
    }
  });
  app.get('/dealers/:id/render', async (req,res)=>{
    const rawId = req.params.id;
    const id = sanitizeId(rawId);
    const debug = 'debug' in req.query || process.env.DEBUG_RENDER;
    const meta = { id, rawId, instance: INSTANCE_ID, storage: storageMode() };
    try {
      const dealers = debug ? await listDealers() : null;
      let dealer = await getDealer(id);
      let fallbackUsed = false;
      if ((!dealer || !dealer.id) && dealers) {
        dealer = dealers.find(d => sanitizeId(d.id) === id) || null;
        fallbackUsed = !!dealer;
      }
      if (!dealer || !dealer.id) {
        if (debug && dealers) meta.dealersPresent = dealers.map(d=>d.id);
        meta.reason = 'dealer_not_found';
        meta.fallbackUsed = fallbackUsed;
        console.warn('[dealer:render] dealer_not_found', meta);
        return res.status(404).json({ error:'dealer not found', ...meta });
      }
      const template = await getTemplate();
      if (debug) {
        meta.templateLength = template.length;
        meta.templateHash = require('crypto').createHash('md5').update(template).digest('hex').slice(0,12);
      }
      const rendered = renderTemplateForDealer(template, dealer);
      if (debug) meta.renderedLength = rendered.length;
      meta.fallbackUsed = fallbackUsed;
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
  app.get('/debug/dealer/:id/raw', async (req,res)=>{
    const rawId = req.params.id;
    const id = sanitizeId(rawId);
    try {
      const dealer = await getDealer(id);
      const all = await listDealers();
      res.json({
        query: { rawId, id },
        diagnostics: {
          raw: idDiagnostics('rawId', rawId),
          sanitized: idDiagnostics('id', id)
        },
        found: !!dealer,
        dealer,
        present: all.map(d=>({ id: d.id, len: d.id.length, codes: idDiagnostics('present', d.id).codes }))
      });
    } catch (e){ res.status(500).json({ error:'debug_dealer_failed', message: e.message }); }
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
