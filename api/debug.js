require('dotenv').config();
const db = require('../lib/db');

async function probe(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'x-api-key': process.env.OPENSEA_API_KEY,
        accept: 'application/json',
      },
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text.slice(0, 300); }
    return { status: res.status, data };
  } catch (err) {
    return { error: err.message };
  }
}

module.exports = async (req, res) => {
  try {
    const id = parseInt(req.query.id, 10);
    if (!id) {
      const all = await db.getAllNfts();
      return res.json({ hint: 'Pass ?id=<id>', nfts: all.map(n => ({ id: n.id, name: n.name, collection_slug: n.collection_name })) });
    }

    const nft = await db.getNftById(id);
    if (!nft) {
      const all = await db.getAllNfts();
      return res.status(404).json({ error: 'NFT not found', available_ids: all.map(n => ({ id: n.id, name: n.name })) });
    }

    const { chain, contract_address: contract, token_id: tokenId, collection_name: slug } = nft;
    const base = 'https://api.opensea.io/api/v2';

    const results = {
      db_row: { chain, contract, tokenId, collection_slug: slug },
      probes: {
        token_best_offer: slug
          ? await probe(`${base}/offers/collection/${slug}/nfts/${tokenId}/best`)
          : 'skipped — no collection slug in DB',
        collection_best_offer: slug
          ? await probe(`${base}/offers/collection/${slug}/best`)
          : 'skipped — no collection slug in DB',
        seaport_offers: await probe(
          `${base}/orders/${chain}/seaport/offers?asset_contract_address=${contract}&token_ids=${tokenId}&limit=1`
        ),
        seaport_offers_sorted: await probe(
          `${base}/orders/${chain}/seaport/offers?asset_contract_address=${contract}&token_ids=${tokenId}&order_by=eth_price&order_direction=desc&limit=1`
        ),
      },
    };

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
