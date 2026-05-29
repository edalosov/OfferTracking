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

// Returns null on any error instead of throwing — used for optional endpoints
async function tryFetch(url) {
  try { return await fetchWithKey(url); } catch { return null; }
}

async function fetchNftMetadata(chain, contract, tokenId) {
  const data = await fetchWithKey(
    `${OPENSEA_API_BASE}/chain/${chain}/contract/${contract}/nfts/${tokenId}`
  );
  const nft = data.nft || {};
  return {
    name: nft.name || `#${tokenId}`,
    image_url: nft.image_url || nft.display_image_url || null,
    collection_name: nft.collection || null, // this is the collection slug
  };
}

function priceFromCurrent({ value, decimals = 18, currency = 'ETH' }) {
  return { offer: parseFloat(value) / Math.pow(10, decimals), currency };
}

function priceFromOrder(order) {
  // v2 structure
  if (order.price?.current?.value) return priceFromCurrent(order.price.current);
  // legacy fallback
  const value = order.current_price || order.base_price || '0';
  const asset = order.maker_asset_bundle?.assets?.[0];
  return {
    offer: parseFloat(value) / Math.pow(10, asset?.decimals ?? 18),
    currency: asset?.asset_contract?.symbol || 'ETH',
  };
}

async function fetchHighestOffer(chain, contract, tokenId, collectionSlug) {
  // Fetch token offer and listing in parallel
  const [offerData, listingData] = await Promise.all([
    collectionSlug
      ? tryFetch(`${OPENSEA_API_BASE}/offers/collection/${collectionSlug}/nfts/${tokenId}/best`)
      : Promise.resolve(null),
    collectionSlug
      ? tryFetch(`${OPENSEA_API_BASE}/listings/collection/${collectionSlug}/nfts/${tokenId}/best`)
      : Promise.resolve(null),
  ]);

  // Resolve offer (fall back to collection floor offer if no token-level offer)
  let offerResult = offerData;
  if (!offerResult?.price?.value && collectionSlug) {
    offerResult = await tryFetch(`${OPENSEA_API_BASE}/offers/collection/${collectionSlug}/best`);
  }

  let offer = 0, currency = 'ETH', expires_at = null;
  if (offerResult?.price?.value) {
    ({ offer, currency } = priceFromCurrent(offerResult.price));
    const endTime = offerResult.protocol_data?.parameters?.endTime;
    expires_at = endTime ? new Date(parseInt(endTime) * 1000).toISOString() : null;
  }

  let listing = 0, listing_currency = 'ETH';
  if (listingData?.price?.value) {
    ({ offer: listing, currency: listing_currency } = priceFromCurrent(listingData.price));
  }

  return { offer, currency, expires_at, listing, listing_currency };
}

module.exports = { parseOpenSeaUrl, fetchNftMetadata, fetchHighestOffer };
