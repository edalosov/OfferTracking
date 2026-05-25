const OPENSEA_API_BASE = 'https://api.opensea.io/api/v2';

function parseOpenSeaUrl(url) {
  try {
    const u = new URL(url.trim());
    if (!u.hostname.includes('opensea.io')) throw new Error('Not an OpenSea URL');

    const parts = u.pathname.replace(/^\//, '').split('/');

    // /assets/{chain}/{contract}/{tokenId}  or  /item/{chain}/{contract}/{tokenId}
    if ((parts[0] === 'assets' || parts[0] === 'item') && parts.length >= 4) {
      return { chain: parts[1], contract_address: parts[2].toLowerCase(), token_id: parts[3] };
    }

    // /assets/{contract}/{tokenId}  (legacy Ethereum-only URLs)
    if (parts[0] === 'assets' && parts.length === 3) {
      return { chain: 'ethereum', contract_address: parts[1].toLowerCase(), token_id: parts[2] };
    }

    throw new Error('Could not parse NFT contract and token ID from URL');
  } catch (err) {
    throw new Error(`Invalid OpenSea URL: ${err.message}`);
  }
}

async function fetchWithKey(url) {
  const apiKey = process.env.OPENSEA_API_KEY;
  if (!apiKey) throw new Error('OPENSEA_API_KEY is not set');

  const res = await fetch(url, {
    headers: { 'x-api-key': apiKey, accept: 'application/json' },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenSea API error ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

async function fetchNftMetadata(chain, contract, tokenId) {
  const data = await fetchWithKey(
    `${OPENSEA_API_BASE}/chain/${chain}/contract/${contract}/nfts/${tokenId}`
  );
  const nft = data.nft || {};
  return {
    name: nft.name || `#${tokenId}`,
    image_url: nft.image_url || nft.display_image_url || null,
    collection_name: nft.collection || null,
  };
}

async function fetchHighestOffer(chain, contract, tokenId) {
  try {
    const data = await fetchWithKey(
      `${OPENSEA_API_BASE}/orders/${chain}/seaport/offers` +
        `?asset_contract_address=${contract}&token_ids=${tokenId}` +
        `&order_by=eth_price&order_direction=desc&limit=1`
    );

    const orders = data.orders || [];
    if (orders.length === 0) return { offer: 0, currency: 'ETH' };

    const order = orders[0];
    const currentPrice = order.current_price || order.base_price || '0';
    const decimals = order.taker_asset_bundle?.assets?.[0]?.decimals ?? 18;
    const offerInEth = parseFloat(currentPrice) / Math.pow(10, decimals);
    const symbol =
      order.taker_asset_bundle?.assets?.[0]?.asset_contract?.symbol || 'ETH';

    return { offer: offerInEth, currency: symbol };
  } catch {
    return { offer: 0, currency: 'ETH' };
  }
}

module.exports = { parseOpenSeaUrl, fetchNftMetadata, fetchHighestOffer };
