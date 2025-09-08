const { init } = require('../db');
module.exports = async (req, res) => {
  try { await init; res.status(200).json({ ok: true }); }
  catch (e){ res.status(500).json({ ok:false, error: e.message }); }
};

