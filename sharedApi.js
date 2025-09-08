// Shared API wiring for Express or Vite dev server middleware
const path = require('path');
const fs = require('fs');
const express = require('express');
const {
  init,
  seedTemplateIfMissing,
  getTemplate,
  saveTemplate,
  listDealers,
  getDealer,
  createDealer,
  updateDealer,
  deleteDealer
} = require('./db');

const TEMPLATE_FILE_PATH = path.join(__dirname, 'template.txt');
let dataInitialized = false;

async function initData() {
  if (dataInitialized) return;
  await init; // wait for sql.js module
  let defaultTemplate = 'Dealer: {{DEALER_NAME}}\nAddress: {{ADDRESS}}\nContact: {{NUMBER}}\nBrand: {{BRAND}}\n';
  try {
    if (fs.existsSync(TEMPLATE_FILE_PATH)) {
      const fileContent = fs.readFileSync(TEMPLATE_FILE_PATH,'utf8');
      if (fileContent.trim()) defaultTemplate = fileContent;
    }
  } catch {}
  try { seedTemplateIfMissing(defaultTemplate); } catch {}
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
  return template;
}

function createApiRouter() {
  const app = express();
  app.use(express.json());

  app.get('/health', (req,res)=>{ res.json({ ok:true }); });

  app.get('/template', (req,res)=>{
    try { res.json({ template: getTemplate() }); }
    catch (e) { res.status(500).json({ error:'Failed to read template' }); }
  });
  app.put('/template', (req,res)=>{
    const { template } = req.body || {};
    if (typeof template !== 'string') return res.status(400).json({ error:'template must be string' });
    try { saveTemplate(template); res.json({ ok:true }); }
    catch { res.status(500).json({ error:'Failed to write template' }); }
  });

  app.get('/dealers', (req,res)=>{
    try { res.json({ dealers: listDealers() }); }
    catch { res.status(500).json({ error:'Failed to read dealers' }); }
  });
  app.post('/dealers', (req,res)=>{
    const { name, address, number, brand } = req.body || {};
    if (!name) return res.status(400).json({ error:'name required' });
    try {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2,6);
      const dealer = createDealer({ id, name, address, number, brand });
      res.status(201).json({ dealer });
    } catch { res.status(500).json({ error:'Failed to create dealer' }); }
  });
  app.put('/dealers/:id', (req,res)=>{
    const { id } = req.params;
    try {
      const d = updateDealer(id, req.body || {});
      if (!d) return res.status(404).json({ error:'not found' });
      res.json({ dealer:d });
    } catch { res.status(500).json({ error:'Failed to update dealer' }); }
  });
  app.delete('/dealers/:id', (req,res)=>{
    const { id } = req.params;
    try {
      const existing = getDealer(id);
      if (!existing) return res.status(404).json({ error:'not found' });
      deleteDealer(id);
      res.json({ ok:true });
    } catch { res.status(500).json({ error:'Failed to delete dealer' }); }
  });
  app.get('/dealers/:id/render', (req,res)=>{
    const { id } = req.params;
    try {
      const dealer = getDealer(id);
      if (!dealer) return res.status(404).json({ error:'not found' });
      const template = getTemplate();
      const rendered = renderTemplateForDealer(template, dealer);
      res.json({ rendered, dealer });
    } catch { res.status(500).json({ error:'Failed to render' }); }
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
