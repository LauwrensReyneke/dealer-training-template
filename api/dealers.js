const { initData } = require('../sharedApi');
const { listDealers, createDealer } = require('../db');

function readBody(req){
  return new Promise((resolve)=>{
    let data='';
    req.on('data', c => data += c);
    req.on('end', ()=> {
      try { resolve(JSON.parse(data||'{}')); } catch { resolve({}); }
    });
  });
}

module.exports = async (req,res) => {
  await initData();
  if (req.method === 'GET') {
    try { return res.status(200).json({ dealers: listDealers() }); }
    catch(e){ return res.status(500).json({ error:'Failed to read dealers' }); }
  }
  if (req.method === 'POST') {
    const body = await readBody(req);
    if (!body.name) return res.status(400).json({ error:'name required' });
    try {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2,6);
      const dealer = createDealer({ id, name: body.name, address: body.address||'', number: body.number||'', brand: body.brand||'' });
      return res.status(201).json({ dealer });
    } catch(e){ return res.status(500).json({ error:'Failed to create dealer' }); }
  }
  res.status(405).json({ error:'Method not allowed' });
};

