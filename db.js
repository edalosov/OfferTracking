const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'tracker.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS nfts (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    opensea_url           TEXT NOT NULL,
    chain                 TEXT NOT NULL DEFAULT 'ethereum',
    contract_address      TEXT NOT NULL,
    token_id              TEXT NOT NULL,
    name                  TEXT,
    image_url             TEXT,
    collection_name       TEXT,
    current_highest_offer REAL DEFAULT 0,
    offer_currency        TEXT DEFAULT 'ETH',
    last_fetched          DATETIME,
    alert_threshold       REAL,
    last_alert_sent       DATETIME,
    created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(chain, contract_address, token_id)
  )
`);

const getAllNfts = db.prepare('SELECT * FROM nfts ORDER BY created_at DESC');

const insertNft = db.prepare(`
  INSERT OR IGNORE INTO nfts (opensea_url, chain, contract_address, token_id, name, image_url, collection_name)
  VALUES (@opensea_url, @chain, @contract_address, @token_id, @name, @image_url, @collection_name)
`);

const deleteNft = db.prepare('DELETE FROM nfts WHERE id = ?');

const updateOffer = db.prepare(`
  UPDATE nfts
  SET current_highest_offer = @offer,
      offer_currency = @currency,
      last_fetched = CURRENT_TIMESTAMP
  WHERE id = @id
`);

const updateAlertThreshold = db.prepare(`
  UPDATE nfts SET alert_threshold = @threshold WHERE id = @id
`);

const updateLastAlertSent = db.prepare(`
  UPDATE nfts SET last_alert_sent = CURRENT_TIMESTAMP WHERE id = @id
`);

const getNftById = db.prepare('SELECT * FROM nfts WHERE id = ?');

module.exports = {
  getAllNfts,
  insertNft,
  deleteNft,
  updateOffer,
  updateAlertThreshold,
  updateLastAlertSent,
  getNftById,
};
