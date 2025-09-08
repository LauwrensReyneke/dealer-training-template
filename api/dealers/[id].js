const { initData, renderTemplateForDealer } = require('../../../sharedApi');
const { getDealer, updateDealer, deleteDealer, getTemplate } = require('../../../db');

function readBody(req){
  return new Promise((resolve)=>{
    let data='';
    req.on('data', c => data += c);
    req.on('end', ()=> { try { resolve(JSON.parse(data||'{}')); } catch { resolve({}); } });
  });
}

module.exports = async (req, res) => {
  await initData();
  const { id } = req.query || {};
  if (!id) return res.status(400).json({ error:'id required' });

  if (req.method === 'GET') {
    const d = getDealer(id);
    if (!d) return res.status(404).json({ error:'not found' });
    return res.status(200).json({ dealer: d });
  }
  if (req.method === 'PUT') {
    const body = await readBody(req);
    const d = updateDealer(id, body || {});
    if (!d) return res.status(404).json({ error:'not found' });
    return res.status(200).json({ dealer: d });
  }
  if (req.method === 'DELETE') {
    const d = getDealer(id);
    if (!d) return res.status(404).json({ error:'not found' });
    deleteDealer(id);
    return res.status(200).json({ ok:true });
  }
  res.status(405).json({ error:'Method not allowed' });
};

