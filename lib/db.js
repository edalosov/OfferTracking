const { neon } = require('@neondatabase/serverless');

// sql is initialised lazily so the module can be required without POSTGRES_URL at import time
let _sql;
function getSql() {
  if (!_sql) _sql = neon(process.env.POSTGRES_URL);
  return _sql;
}

async function ensureSchema() {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS nfts (
      id                    SERIAL PRIMARY KEY,
      opensea_url           TEXT NOT NULL,
      chain                 TEXT NOT NULL DEFAULT 'ethereum',
      contract_address      TEXT NOT NULL,
      token_id              TEXT NOT NULL,
      name                  TEXT,
      image_url             TEXT,
      collection_name       TEXT,
      current_highest_offer NUMERIC DEFAULT 0,
      offer_currency        TEXT DEFAULT 'ETH',
      last_fetched          TIMESTAMPTZ,
      alert_threshold       NUMERIC,
      last_alert_sent       TIMESTAMPTZ,
      created_at            TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(chain, contract_address, token_id)
    )
  `;
}

async function getAllNfts() {
  await ensureSchema();
  return getSql()`SELECT * FROM nfts ORDER BY created_at DESC`;
}

async function insertNft({ opensea_url, chain, contract_address, token_id, name, image_url, collection_name }) {
  await ensureSchema();
  await getSql()`
    INSERT INTO nfts (opensea_url, chain, contract_address, token_id, name, image_url, collection_name)
    VALUES (${opensea_url}, ${chain}, ${contract_address}, ${token_id}, ${name}, ${image_url}, ${collection_name})
    ON CONFLICT (chain, contract_address, token_id) DO NOTHING
  `;
}

async function getNftByCoords(chain, contract_address, token_id) {
  const rows = await getSql()`
    SELECT * FROM nfts
    WHERE chain = ${chain} AND contract_address = ${contract_address} AND token_id = ${token_id}
  `;
  return rows[0] || null;
}

async function getNftById(id) {
  const rows = await getSql()`SELECT * FROM nfts WHERE id = ${id}`;
  return rows[0] || null;
}

async function deleteNft(id) {
  await getSql()`DELETE FROM nfts WHERE id = ${id}`;
}

async function updateOffer(id, offer, currency) {
  await getSql()`
    UPDATE nfts
    SET current_highest_offer = ${offer},
        offer_currency = ${currency},
        last_fetched = CURRENT_TIMESTAMP
    WHERE id = ${id}
  `;
}

async function updateAlertThreshold(id, threshold) {
  await getSql()`UPDATE nfts SET alert_threshold = ${threshold} WHERE id = ${id}`;
}

async function updateLastAlertSent(id) {
  await getSql()`UPDATE nfts SET last_alert_sent = CURRENT_TIMESTAMP WHERE id = ${id}`;
}

module.exports = {
  getAllNfts,
  insertNft,
  getNftByCoords,
  getNftById,
  deleteNft,
  updateOffer,
  updateAlertThreshold,
  updateLastAlertSent,
};
