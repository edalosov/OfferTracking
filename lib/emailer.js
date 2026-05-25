const nodemailer = require('nodemailer');

function getTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

async function sendAlertEmail(nft, currentOffer) {
  const to = process.env.ALERT_EMAIL || process.env.GMAIL_USER;
  const subject = `NFT Offer Alert: ${nft.name} reached ${currentOffer} ${nft.offer_currency}`;
  const html = `
    <div style="font-family:sans-serif;max-width:500px;margin:auto">
      <h2 style="color:#6366f1">NFT Offer Alert</h2>
      ${nft.image_url ? `<img src="${nft.image_url}" alt="${nft.name}" style="width:200px;border-radius:8px;display:block;margin-bottom:12px">` : ''}
      <p><strong>${nft.name}</strong>${nft.collection_name ? ` — ${nft.collection_name}` : ''}</p>
      <p>Current highest offer: <strong>${currentOffer} ${nft.offer_currency}</strong></p>
      <p>Your alert threshold: <strong>${nft.alert_threshold} ${nft.offer_currency}</strong></p>
      <p><a href="${nft.opensea_url}" style="color:#6366f1">View on OpenSea →</a></p>
    </div>
  `;

  await getTransporter().sendMail({
    from: `"NFT Tracker" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
  });
}

module.exports = { sendAlertEmail };
