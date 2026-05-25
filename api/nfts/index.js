require('dotenv').config();
const db = require('../../lib/db');
const { parseOpenSeaUrl, fetchNftMetadata, fetchHighestOffer } = require('../../lib/opensea');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    try {
      const nfts = await db.getAllNfts();
      return res.json(nfts);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'POST') {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'url is required' });

    let parsed;
    try {
      parsed = parseOpenSeaUrl(url);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    let meta = { name: `#${parsed.token_id}`, image_url: null, collection_name: null };
    try {
      meta = await fetchNftMetadata(parsed.chain, parsed.contract_address, parsed.token_id);
    } catch (err) {
      console.warn('[meta] Could not fetch metadata:', err.message);
    }

    await db.insertNft({
      opensea_url: url.trim(),
      chain: parsed.chain,
      contract_address: parsed.contract_address,
      token_id: parsed.token_id,
      name: meta.name,
      image_url: meta.image_url,
      collection_name: meta.collection_name,
    });

    const nft = await db.getNftByCoords(
      parsed.chain,
      parsed.contract_address,
      parsed.token_id
    );

    if (nft) {
      try {
        const { offer, currency } = await fetchHighestOffer(
          parsed.chain,
          parsed.contract_address,
          parsed.token_id
        );
        await db.updateOffer(nft.id, offer, currency);
      } catch (err) {
        console.warn('[offer] Initial fetch failed:', err.message);
      }
    }

    return res.status(200).json({ success: true, nft });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
