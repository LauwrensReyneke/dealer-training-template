const initSqlJs = require('sql.js');

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
if (!BLOB_TOKEN) throw new Error('blobDb loaded without BLOB_READ_WRITE_TOKEN');
const BLOB_DB_KEY = process.env.BLOB_DB_KEY || 'app.sqlite';
let BLOB_ACCESS = (process.env.BLOB_ACCESS || 'public').toLowerCase();
if (BLOB_ACCESS !== 'public' && BLOB_ACCESS !== 'private') {
  console.warn('[blobDb] invalid BLOB_ACCESS value, falling back to public');
  BLOB_ACCESS = 'public';
}

let SQL;
let db;
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
    // Validate SQLite header ("SQLite format 3\0")
    const header = Buffer.from(buffer.slice(0,16)).toString('utf8');
    if (header !== 'SQLite format 3\0') {
      console.warn('[blobDb] invalid sqlite header in blob, ignoring and starting fresh');
      return false;
    }
    db = new SQL.Database(buffer);
    return true;
  } catch (e){
    console.warn('[blobDb] loadFromBlob failed', e.message);
    return false;
  }
}

async function performUpload(){
  try {
    const data = db.export();
    await put(BLOB_DB_KEY, Buffer.from(data), {
      access: BLOB_ACCESS,
      token: BLOB_TOKEN,
      contentType: 'application/octet-stream',
      addRandomSuffix: false,
    });
    dirty = false;
    console.log('[blobDb] upload ok', { key: BLOB_DB_KEY, bytes: data.length });
  } catch (e){
    if (/access must be "public"/i.test(e.message) && BLOB_ACCESS !== 'public') {
      console.warn('[blobDb] retry public');
      BLOB_ACCESS = 'public';
      return performUpload();
    }
    console.error('[blobDb] upload failed', e.message);
  }
}

function exportAndScheduleUpload(){
  dirty = true;
  if (process.env.VERCEL) return;
  clearTimeout(uploadTimer);
  uploadTimer = setTimeout(()=> { if (dirty) performUpload(); }, 250);
}

async function flushDirty(){ if (dirty) await performUpload(); }

function run(sql){ db.exec(sql); }
function prepare(sql){ return db.prepare(sql); }

function initSchema(){
  run(`CREATE TABLE IF NOT EXISTS templates (\n  key TEXT PRIMARY KEY,\n  content TEXT NOT NULL,\n  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP\n);`);
  run(`CREATE TABLE IF NOT EXISTS dealers (\n  id TEXT PRIMARY KEY,\n  name TEXT NOT NULL,\n  address TEXT DEFAULT '',\n  number TEXT DEFAULT '',\n  brand TEXT DEFAULT '',\n  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,\n  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP\n);`);
  try { run(`CREATE UNIQUE INDEX IF NOT EXISTS dealers_name_unique ON dealers (lower(name));`); } catch(_) {}
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

function upsertDealers(list){
  if (!Array.isArray(list) || !list.length) return 0;
  const findByName = prepare('SELECT id FROM dealers WHERE lower(name)=lower(?) LIMIT 1');
  const insertStmt = prepare('INSERT INTO dealers (id,name,address,number,brand) VALUES (?,?,?,?,?)');
  let inserted = 0;
  run('BEGIN');
  for (const d of list){
    if (!d) continue;
    const name = (d.name || d["Dealer Name"] || d.dealerName || '').trim();
    if (!name) continue;
    const exists = findByName.getAsObject([name]);
    if (exists && exists.id) continue;
    const address = (d.address || d.Address || '').trim();
    const number = (d.number || d.Number || '').trim();
    const brand = (d.brand || d.Brand || '').trim();
    const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,48) || (Date.now().toString(36));
    let id = baseSlug;
    let attempt = 0;
    while (prepare('SELECT 1 AS x FROM dealers WHERE id=?').getAsObject([id]).x && attempt < 3){
      id = baseSlug + '-' + Math.random().toString(36).slice(2,6);
      attempt++;
    }
    try { insertStmt.run([id,name,address,number,brand]); inserted++; } catch(_){ }
  }
  run('COMMIT');
  if (inserted) exportAndScheduleUpload();
  return inserted;
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
  deleteDealer,
  flushDirty,
  upsertDealers
};
