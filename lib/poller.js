const db = require('./db');
const { fetchHighestOffer } = require('./opensea');
const { sendAlertEmail } = require('./emailer');

async function pollAllNfts() {
  const nfts = await db.getAllNfts();
  console.log(`[poll] Checking ${nfts.length} NFT(s)...`);

  for (const nft of nfts) {
    try {
      const { offer, currency } = await fetchHighestOffer(
        nft.chain,
        nft.contract_address,
        nft.token_id
      );

      await db.updateOffer(nft.id, offer, currency);

      if (nft.alert_threshold != null && offer >= nft.alert_threshold && offer > 0) {
        const hourAgo = Date.now() - 60 * 60 * 1000;
        const lastSent = nft.last_alert_sent ? new Date(nft.last_alert_sent).getTime() : 0;

        if (lastSent < hourAgo) {
          await sendAlertEmail({ ...nft, offer_currency: currency }, offer).catch(err =>
            console.error(`[email] Failed for NFT ${nft.id}:`, err.message)
          );
          await db.updateLastAlertSent(nft.id);
          console.log(`[alert] Sent email for "${nft.name}" (${offer} ${currency})`);
        }
      }

      console.log(`[poll] "${nft.name}": ${offer} ${currency}`);
    } catch (err) {
      console.error(`[poll] Error for NFT ${nft.id}:`, err.message);
    }
  }
}

module.exports = { pollAllNfts };
