require('dotenv').config();
const { pollAllNfts } = require('../lib/poller');

module.exports = async (req, res) => {
  // Vercel cron sends GET requests; also allow POST for manual triggers via cron-job.org
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await pollAllNfts();
    res.json({ success: true });
  } catch (err) {
    console.error('[cron] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
