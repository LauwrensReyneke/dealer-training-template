// Basic integration smoke test for templating engine (sql.js backed)
//const assert = (cond, msg) => { if(!cond) throw new Error('Assertion failed: '+msg); };
const { strict: assert } = require('assert');

process.env.PORT = '0';

(async () => {
  const { ready, server: srvGetter } = require('./index');
  const server = await ready;
  const port = server.address().port;
  const base = 'http://localhost:' + port;
  try {
    let r = await fetch(base + '/api/template');
    assert(r.ok, 'GET /api/template ok');
    const orig = (await r.json()).template;
    assert(typeof orig === 'string', 'template is string');

    const modified = orig + (orig.endsWith('\n') ? '' : '\n') + '# test marker\n';
    r = await fetch(base + '/api/template', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ template: modified }) });
    assert(r.ok, 'PUT /api/template ok');

    r = await fetch(base + '/api/dealer', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name:'Test Dealer', address:'1 Test Way', number:'123', brand:'BrandX' }) });
    assert(r.ok, 'POST /api/dealer ok');
    const dealer = (await r.json()).dealer;
    assert(dealer && dealer.id, 'dealer created with id');

    r = await fetch(base + '/api/dealers');
    assert(r.ok, 'GET /api/dealers ok');
    const list = (await r.json()).dealers;
    assert(Array.isArray(list) && list.some(d=>d.id===dealer.id), 'dealer present in list');

    r = await fetch(`${base}/api/dealer/render?id=${dealer.id}`);
    assert(r.ok, 'GET /api/dealers/:id/render ok');
    const rendered = (await r.json()).rendered;
    assert(rendered.includes('Test Dealer'), 'rendered includes dealer name');

    await fetch(`${base}/api/dealer?id=${dealer.id}`, { method:'DELETE' });
    await fetch(base + '/api/template', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ template: orig }) });

    console.log('ALL TESTS PASSED');
  } catch (e) {
    console.error('TEST FAILURE:', e.message);
    process.exitCode = 1;
  } finally {
    setTimeout(()=> server.close(()=> process.exit()), 50);
  }
})();
