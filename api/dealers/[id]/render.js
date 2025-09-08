const { initData, renderTemplateForDealer } = require('../../../../sharedApi');
const { getDealer, getTemplate } = require('../../../../db');

module.exports = async (req, res) => {
  await initData();
  const { id } = req.query || {};
  if (!id) return res.status(400).json({ error: 'id required' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const dealer = getDealer(id);
    if (!dealer) return res.status(404).json({ error: 'not found' });
    const template = getTemplate();
    const rendered = renderTemplateForDealer(template, dealer);
    res.status(200).json({ rendered, dealer });
  } catch (e) {
    res.status(500).json({ error: 'Failed to render' });
  }
};

