const { createClient } = require('@libsql/client');

const url = process.env.LIBSQL_URL;
const authToken = process.env.LIBSQL_AUTH_TOKEN;
if (!url) throw new Error('remoteDb.js loaded without LIBSQL_URL');
const client = createClient({ url, authToken });

async function exec(sql, params=[]) { return client.execute({ sql, args: params }); }

async function initSchema(){
  await exec(`CREATE TABLE IF NOT EXISTS templates (
    key TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );`);
  await exec(`CREATE TABLE IF NOT EXISTS dealers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT DEFAULT '',
    number TEXT DEFAULT '',
    brand TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );`);
}

const init = (async () => { await initSchema(); })();

async function seedTemplateIfMissing(defaultContent){
  const r = await exec('SELECT 1 FROM templates WHERE key=? LIMIT 1', ['main']);
  if (r.rows.length === 0){
    await exec('INSERT INTO templates (key, content) VALUES (?, ?)', ['main', defaultContent]);
  }
}
async function listTemplates(){
  const r = await exec('SELECT key, updated_at FROM templates ORDER BY datetime(updated_at) DESC, key COLLATE NOCASE');
  return r.rows.map(row=>({ key: row.key, updated_at: row.updated_at }));
}
async function getTemplate(key='main'){
  const r = await exec('SELECT content FROM templates WHERE key=? LIMIT 1', [key]);
  if (r.rows[0]?.content) return r.rows[0].content;
  if (key === 'main') {
    const f = await exec('SELECT content FROM templates ORDER BY datetime(updated_at) DESC, key COLLATE NOCASE LIMIT 1');
    return f.rows[0]?.content || '';
  }
  return '';
}
async function saveTemplate(key, content){
  if (content === undefined) { content = key; key = 'main'; }
  if (!key || !key.trim()) key='main';
  await exec(`INSERT INTO templates (key, content) VALUES (?, ?) ON CONFLICT(key)
    DO UPDATE SET content=excluded.content, updated_at=CURRENT_TIMESTAMP`, [key, content]);
}
async function deleteTemplate(key){
  if (!key || key === 'main') return false;
  await exec('DELETE FROM templates WHERE key=?', [key]);
  return true;
}
async function renameTemplate(oldKey, newKey){
  if (!oldKey || !newKey) return false; if (oldKey === newKey) return true;
  const exists = await exec('SELECT 1 FROM templates WHERE key=? LIMIT 1', [newKey]);
  if (exists.rows.length) return false;
  const upd = await exec('UPDATE templates SET key=?, updated_at=CURRENT_TIMESTAMP WHERE key=?', [newKey, oldKey]);
  return (upd.rowsAffected || 0) > 0;
}

// Dealer functions
async function listDealers(){
  const r = await exec('SELECT id,name,address,number,brand FROM dealers ORDER BY name COLLATE NOCASE');
  return r.rows.map(row => ({ ...row }));
}
async function getDealer(id){
  const r = await exec('SELECT id,name,address,number,brand FROM dealers WHERE id=?', [id]);
  return r.rows[0] || null;
}
async function createDealer({ id, name, address='', number='', brand='' }){
  await exec('INSERT INTO dealers (id,name,address,number,brand) VALUES (?,?,?,?,?)', [id,name,address,number,brand]);
  return getDealer(id);
}
async function updateDealer(id, fields){
  const current = await getDealer(id); if (!current) return null;
  const next = { ...current, ...fields };
  await exec('UPDATE dealers SET name=?, address=?, number=?, brand=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [next.name,next.address,next.number,next.brand,id]);
  return getDealer(id);
}
async function deleteDealer(id){ await exec('DELETE FROM dealers WHERE id=?', [id]); }

module.exports = {
  init,
  seedTemplateIfMissing,
  listTemplates,
  getTemplate,
  saveTemplate,
  deleteTemplate,
  renameTemplate,
  listDealers,
  getDealer,
  createDealer,
  updateDealer,
  deleteDealer
};
