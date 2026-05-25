require('dotenv').config();
const { pollAllNfts } = require('../../lib/poller');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await pollAllNfts();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
