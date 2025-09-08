// blobDb.js - sqlite (sql.js) in-memory with persistence to Vercel Blob
// Requirements:
//  - Environment variable BLOB_READ_WRITE_TOKEN (Vercel Blob RW token)
//  - Optional BLOB_DB_KEY (defaults to app.sqlite)
// Exposes async functions compatible with sharedApi async usage.

const initSqlJs = require('sql.js');
const { list, put } = require('@vercel/blob');

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
if (!BLOB_TOKEN) throw new Error('blobDb loaded without BLOB_READ_WRITE_TOKEN');
const BLOB_DB_KEY = process.env.BLOB_DB_KEY || 'app.sqlite';

let SQL; // sql.js module
let db;  // sql.js Database instance
let dirty = false;
let uploadTimer;

async function loadFromBlob(){
  try {
    // list blobs with prefix (exact match acceptable)
    const { blobs } = await list({ prefix: BLOB_DB_KEY, token: BLOB_TOKEN, limit: 1 });
    const match = blobs.find(b => b.pathname === BLOB_DB_KEY || b.pathname.endsWith('/'+BLOB_DB_KEY));
    if (!match) return false;
    const res = await fetch(match.url, { cache:'no-store' });
    if (!res.ok) return false;
    const buffer = new Uint8Array(await res.arrayBuffer());
    db = new SQL.Database(buffer);
    return true;
  } catch (e){
    console.warn('[blobDb] loadFromBlob failed', e.message);
    return false;
  }
}

function exportAndScheduleUpload(){
  dirty = true;
  clearTimeout(uploadTimer);
  uploadTimer = setTimeout(async () => {
    if (!dirty) return;
    try {
      const data = db.export();
      await put(BLOB_DB_KEY, Buffer.from(data), {
        access: 'private',
        token: BLOB_TOKEN,
        contentType: 'application/octet-stream',
        addRandomSuffix: false,
      });
      dirty = false;
      // console.log('[blobDb] uploaded');
    } catch (e){
      console.error('[blobDb] upload failed', e.message);
    }
  }, 250); // debounce rapid writes
}

function run(sql){ db.exec(sql); }
function prepare(sql){ return db.prepare(sql); }

function initSchema(){
  run(`CREATE TABLE IF NOT EXISTS templates (\n  key TEXT PRIMARY KEY,\n  content TEXT NOT NULL,\n  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP\n);`);
  run(`CREATE TABLE IF NOT EXISTS dealers (\n  id TEXT PRIMARY KEY,\n  name TEXT NOT NULL,\n  address TEXT DEFAULT '',\n  number TEXT DEFAULT '',\n  brand TEXT DEFAULT '',\n  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,\n  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP\n);`);
}

async function seedTemplateIfMissing(defaultContent){
  const row = prepare('SELECT 1 FROM templates WHERE key=?').getAsObject(['main']);
  if (!row['1']) {
    prepare('INSERT INTO templates (key, content) VALUES (?, ?)').run(['main', defaultContent]);
    exportAndScheduleUpload();
  }
}
async function getTemplate(){
  const r = prepare('SELECT content FROM templates WHERE key=?').getAsObject(['main']);
  return r.content || '';
}
async function saveTemplate(content){
  prepare(`INSERT INTO templates (key, content) VALUES ('main', ?) ON CONFLICT(key) DO UPDATE SET content=excluded.content, updated_at=CURRENT_TIMESTAMP`).run([content]);
  exportAndScheduleUpload();
}
async function listDealers(){
  const stmt = prepare('SELECT id,name,address,number,brand FROM dealers ORDER BY name COLLATE NOCASE');
  const out = []; while (stmt.step()) out.push(stmt.getAsObject()); return out;
}
async function getDealer(id){
  const row = prepare('SELECT id,name,address,number,brand FROM dealers WHERE id=?').getAsObject([id]);
  if (!row || !row.id) return null; return row;
}
async function createDealer({ id, name, address='', number='', brand='' }){
  prepare('INSERT INTO dealers (id,name,address,number,brand) VALUES (?,?,?,?,?)').run([id,name,address,number,brand]);
  exportAndScheduleUpload();
  return getDealer(id);
}
async function updateDealer(id, fields){
  const current = await getDealer(id); if (!current) return null;
  const next = { ...current, ...fields };
  prepare('UPDATE dealers SET name=?, address=?, number=?, brand=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run([next.name,next.address,next.number,next.brand,id]);
  exportAndScheduleUpload();
  return getDealer(id);
}
async function deleteDealer(id){
  prepare('DELETE FROM dealers WHERE id=?').run([id]);
  exportAndScheduleUpload();
}

const init = (async () => {
  SQL = await initSqlJs({ locateFile: f => require.resolve('sql.js/dist/' + f) });
  const loaded = await loadFromBlob();
  if (!loaded) {
    db = new SQL.Database();
  }
  initSchema();
})();

module.exports = {
  init,
  seedTemplateIfMissing,
  getTemplate,
  saveTemplate,
  listDealers,
  getDealer,
  createDealer,
  updateDealer,
  deleteDealer
};

