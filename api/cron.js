require('dotenv').config();
const { pollAllNfts } = require('../lib/poller');

module.exports = async (req, res) => {
  try {
    await pollAllNfts();
    res.json({ success: true });
  } catch (err) {
    console.error('[cron]', err.message);
    res.status(500).json({ error: err.message });
  }
};
