const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

// Minimal single-file embedded DB (sql.js in-memory with file persistence)
// In Vercel serverless functions the filesystem is read-only except /tmp.
// Use /tmp for persistence there so warm invocations can re-use the file.
const IS_VERCEL = !!process.env.VERCEL;
const DATA_DIR = IS_VERCEL ? '/tmp' : path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, 'app.sqlite');

let SQL;
let db;

function locateFile(file){
  try {
    const path = require('path');
    const fs = require('fs');
    const candidates = [
      path.join(__dirname,'node_modules','sql.js','dist',file),
      path.join(process.cwd(),'node_modules','sql.js','dist',file)
    ];
    for (const c of candidates){ if (fs.existsSync(c)) { return c; } }
    return require.resolve('sql.js/dist/' + file);
  } catch (e){
    console.error('[db] locateFile fallback for', file, e.message);
    return 'sql-wasm.wasm';
  }
}

function run(sql){ db.exec(sql); }
function prepare(sql){ return db.prepare(sql); }

function persist(){
  try {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (e){
    if (!IS_VERCEL) {
      // Log only outside Vercel to keep functions lean
      console.warn('[db] persist failed', e.message);
    }
  }
}

function initSchema(){
  run(`CREATE TABLE IF NOT EXISTS templates (\n  key TEXT PRIMARY KEY,\n  content TEXT NOT NULL,\n  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP\n);`);
  run(`CREATE TABLE IF NOT EXISTS dealers (\n  id TEXT PRIMARY KEY,\n  name TEXT NOT NULL,\n  address TEXT DEFAULT '',\n  number TEXT DEFAULT '',\n  brand TEXT DEFAULT '',\n  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,\n  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP\n);`);
}

// Seed template if missing
function seedTemplateIfMissing(defaultContent) {
  const row = prepare('SELECT 1 FROM templates WHERE key=?').getAsObject(['main']);
  if (!row['1']) {
    prepare('INSERT INTO templates (key, content) VALUES (?, ?)').run(['main', defaultContent]);
    persist();
  }
}

function migrateDealersFromJson(jsonPath) {
  if (!fs.existsSync(jsonPath)) return;
  const count = prepare('SELECT count(*) AS c FROM dealers').getAsObject().c;
  if (Number(count) > 0) return;
  try {
    const raw = fs.readFileSync(jsonPath,'utf8');
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : parsed.dealers || [];
    if (!list.length) return;
    run('BEGIN');
    const ins = prepare('INSERT INTO dealers (id,name,address,number,brand) VALUES (?,?,?,?,?)');
    for (const d of list) {
      ins.run([ d.id || (Date.now().toString(36)+Math.random().toString(36).slice(2,6)), d.name||'', d.address||'', d.number||'', d.brand||'' ]);
    }
    run('COMMIT');
    persist();
  } catch {/* ignore */}
}

// Template API
function getTemplate(){
  const r = prepare('SELECT content FROM templates WHERE key=?').getAsObject(['main']);
  return r.content || '';
}
function saveTemplate(content){
  prepare(`INSERT INTO templates (key, content) VALUES ('main', ?) ON CONFLICT(key) DO UPDATE SET content=excluded.content, updated_at=CURRENT_TIMESTAMP`).run([content]);
  persist();
}

// Dealer API
function listDealers(){
  const stmt = prepare('SELECT id,name,address,number,brand FROM dealers ORDER BY name COLLATE NOCASE');
  const out = []; while (stmt.step()) out.push(stmt.getAsObject()); return out;
}
function getDealer(id){ return prepare('SELECT id,name,address,number,brand FROM dealers WHERE id=?').getAsObject([id]) || null; }
function createDealer({ id, name, address='', number='', brand='' }){
  prepare('INSERT INTO dealers (id,name,address,number,brand) VALUES (?,?,?,?,?)').run([id,name,address,number,brand]);
  persist();
  return getDealer(id);
}
function updateDealer(id, fields){
  const current = getDealer(id); if (!current || !current.id) return null;
  const next = { ...current, ...fields };
  prepare('UPDATE dealers SET name=?, address=?, number=?, brand=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run([next.name,next.address,next.number,next.brand,id]);
  persist();
  return getDealer(id);
}
function deleteDealer(id){ prepare('DELETE FROM dealers WHERE id=?').run([id]); persist(); }

const init = (async () => {
  try {
    SQL = await initSqlJs({ locateFile });
  } catch (e){
    console.error('[db] initSqlJs failed', e); throw e;
  }
  if (fs.existsSync(DB_PATH)) {
    try {
      const buf = fs.readFileSync(DB_PATH);
      db = new SQL.Database(buf);
    } catch (e) {
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
  }
  initSchema();
})();

module.exports = {
  init,
  seedTemplateIfMissing,
  migrateDealersFromJson,
  getTemplate,
  saveTemplate,
  listDealers,
  getDealer,
  createDealer,
  updateDealer,
  deleteDealer,
  DB_PATH
};
