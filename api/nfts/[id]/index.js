require('dotenv').config();
const db = require('../../../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  const id = parseInt(req.query.id, 10);
  if (!id) return res.status(400).json({ error: 'Invalid id' });

  const nft = await db.getNftById(id);
  if (!nft) return res.status(404).json({ error: 'Not found' });

  await db.deleteNft(id);
  res.json({ success: true });
};
