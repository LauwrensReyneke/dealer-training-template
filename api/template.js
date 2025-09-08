const { initData, renderTemplateForDealer } = require('../sharedApi');
const { getTemplate, saveTemplate } = require('../db');

function readBody(req){
  return new Promise((resolve)=>{
    let data='';
    req.on('data',c=> data+=c);
    req.on('end',()=>{
      try { resolve(JSON.parse(data||'{}')); } catch { resolve({}); }
    });
  });
}

module.exports = async (req,res) => {
  await initData();
  if (req.method === 'GET') {
    try { return res.status(200).json({ template: getTemplate() }); }
    catch(e){ return res.status(500).json({ error:'Failed to read template' }); }
  }
  if (req.method === 'PUT') {
    const body = await readBody(req);
    if (typeof body.template !== 'string') return res.status(400).json({ error:'template must be string' });
    try { saveTemplate(body.template); return res.status(200).json({ ok:true }); }
    catch(e){ return res.status(500).json({ error:'Failed to write template' }); }
  }
  res.status(405).json({ error:'Method not allowed' });
};

