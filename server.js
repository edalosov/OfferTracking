require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const path = require('path');

const db = require('./db');
const { parseOpenSeaUrl, fetchNftMetadata, fetchHighestOffer } = require('./opensea');
const { sendAlertEmail } = require('./emailer');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Poll all tracked NFTs ---
async function pollAllNfts() {
  const nfts = db.getAllNfts.all();
  console.log(`[poll] Checking ${nfts.length} NFT(s)...`);

  for (const nft of nfts) {
    try {
      const { offer, currency } = await fetchHighestOffer(
        nft.chain,
        nft.contract_address,
        nft.token_id
      );

      db.updateOffer.run({ id: nft.id, offer, currency });

      // Check alert threshold
      if (
        nft.alert_threshold != null &&
        offer >= nft.alert_threshold &&
        offer > 0
      ) {
        const hourAgo = Date.now() - 60 * 60 * 1000;
        const lastSent = nft.last_alert_sent ? new Date(nft.last_alert_sent).getTime() : 0;

        if (lastSent < hourAgo) {
          const freshNft = { ...nft, offer_currency: currency };
          await sendAlertEmail(freshNft, offer).catch(err =>
            console.error(`[email] Failed for NFT ${nft.id}:`, err.message)
          );
          db.updateLastAlertSent.run(nft.id);
          console.log(`[alert] Sent email for "${nft.name}" (${offer} ${currency})`);
        }
      }

      console.log(`[poll] "${nft.name}": ${offer} ${currency}`);
    } catch (err) {
      console.error(`[poll] Error for NFT ${nft.id}:`, err.message);
    }
  }
}

// --- Routes ---

app.get('/api/nfts', (_req, res) => {
  res.json(db.getAllNfts.all());
});

app.post('/api/nfts', async (req, res) => {
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

  db.insertNft.run({
    opensea_url: url.trim(),
    chain: parsed.chain,
    contract_address: parsed.contract_address,
    token_id: parsed.token_id,
    name: meta.name,
    image_url: meta.image_url,
    collection_name: meta.collection_name,
  });

  // Fetch initial offer immediately in background
  const nfts = db.getAllNfts.all();
  const inserted = nfts.find(
    n =>
      n.chain === parsed.chain &&
      n.contract_address === parsed.contract_address &&
      n.token_id === parsed.token_id
  );

  if (inserted) {
    fetchHighestOffer(parsed.chain, parsed.contract_address, parsed.token_id)
      .then(({ offer, currency }) => db.updateOffer.run({ id: inserted.id, offer, currency }))
      .catch(err => console.warn('[offer] Initial fetch failed:', err.message));
  }

  res.json({ success: true, nft: inserted || null });
});

app.delete('/api/nfts/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!db.getNftById.get(id)) return res.status(404).json({ error: 'Not found' });
  db.deleteNft.run(id);
  res.json({ success: true });
});

app.put('/api/nfts/:id/alert', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { threshold } = req.body;
  if (!db.getNftById.get(id)) return res.status(404).json({ error: 'Not found' });

  const parsed = threshold === null || threshold === '' ? null : parseFloat(threshold);
  db.updateAlertThreshold.run({ id, threshold: isNaN(parsed) ? null : parsed });
  res.json({ success: true });
});

app.post('/api/nfts/refresh', async (_req, res) => {
  pollAllNfts().catch(err => console.error('[refresh] Error:', err.message));
  res.json({ success: true, message: 'Refresh started' });
});

// --- Cron: every 15 minutes ---
cron.schedule('*/15 * * * *', () => {
  pollAllNfts().catch(err => console.error('[cron] Error:', err.message));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`NFT Offer Tracker running at http://localhost:${PORT}`);
  console.log('Polling every 15 minutes. Next poll at the next :00 or :15 mark.');
});
