// Verifies that creating a dealer persists to data/app.sqlite across server restarts.
const fs = require('fs');
const path = require('path');
const assert = (cond, msg) => { if(!cond) throw new Error(msg); };

(async () => {
  process.env.PORT = '0';
  const dbFile = path.join(__dirname, 'data', 'app.sqlite');
  const sizeBefore = fs.existsSync(dbFile) ? fs.statSync(dbFile).size : 0;
  const { ready } = require('./index');
  const server = await ready;
  const port = server.address().port;
  const base = `http://localhost:${port}`;

  // List dealers initial
  let r = await fetch(base + '/api/dealers');
  assert(r.ok, 'initial list dealers');
  const initialList = (await r.json()).dealers;

  // Create dealer
  r = await fetch(base + '/api/dealers', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name:'Persist Dealer', address:'Persist St', number:'999', brand:'Keep' }) });
  assert(r.ok, 'create dealer ok');
  const created = (await r.json()).dealer;
  assert(created && created.id, 'dealer has id');

  // Close server to flush
  await new Promise(res => server.close(res));

  const sizeAfter = fs.existsSync(dbFile) ? fs.statSync(dbFile).size : 0;
  assert(sizeAfter >= sizeBefore, 'db file size should not shrink');

  // Start fresh process (simulate restart) by spawning a child process that lists dealers
  const { spawnSync } = require('child_process');
  const probe = spawnSync(process.execPath, ['-e', `
    const { ready } = require('./index');
    (async () => { const s = await ready; const port = s.address().port; const res = await fetch('http://localhost:'+port+'/api/dealers'); const list = (await res.json()).dealers; console.log(JSON.stringify(list)); s.close(); })();
  `], { cwd: __dirname, encoding:'utf8' });

  if (probe.error) throw probe.error;
  const outLine = probe.stdout.trim().split('\n').pop();
  let list;
  try { list = JSON.parse(outLine); } catch { throw new Error('Could not parse dealers from restarted process: '+outLine); }
  assert(Array.isArray(list), 'list after restart is array');
  assert(list.some(d => d.name === 'Persist Dealer'), 'persisted dealer found after restart');

  console.log('PERSISTENCE TEST PASSED');
})();

