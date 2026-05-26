const grid = document.getElementById('nft-grid');
const emptyState = document.getElementById('empty-state');
const addForm = document.getElementById('add-form');
const urlInput = document.getElementById('url-input');
const addBtn = document.getElementById('add-btn');
const addError = document.getElementById('add-error');
const refreshBtn = document.getElementById('refresh-btn');
const sortSelect = document.getElementById('sort-select');
const statusText = document.getElementById('status-text');

function sortNfts(nfts, order) {
  const sorted = [...nfts];
  if (order === 'highest_bid') {
    sorted.sort((a, b) => parseFloat(b.current_highest_offer) - parseFloat(a.current_highest_offer));
  } else if (order === 'alphabetical') {
    sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }
  // 'first_track' keeps the default created_at DESC order from the server
  return sorted;
}

function timeAgo(dateStr) {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function timeUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  return `${Math.floor(hrs / 24)}d ${hrs % 24}h`;
}

function formatOffer(value) {
  if (!value || value === 0) return '0.00';
  return value.toFixed(2);
}

function renderCard(nft) {
  const card = document.createElement('div');
  card.className = 'nft-card';
  card.dataset.id = nft.id;

  const offerNum = parseFloat(nft.current_highest_offer) || 0;
  const offerClass = offerNum === 0 ? 'offer-value zero' : 'offer-value';
  const hasAlert = nft.alert_threshold != null && nft.alert_threshold !== '';
  const alertActive = hasAlert && offerNum >= parseFloat(nft.alert_threshold);

  card.innerHTML = `
    ${nft.image_url
      ? `<img class="card-image" src="${escHtml(nft.image_url)}" alt="${escHtml(nft.name || '')}" loading="lazy" onerror="this.replaceWith(makePlaceholder())">`
      : `<div class="card-image-placeholder">🖼️</div>`
    }
    <div class="card-body">
      <button class="remove-btn" data-id="${nft.id}" title="Remove">×</button>

      <div>
        <div class="card-name" title="${escHtml(nft.name || '')}">${escHtml(nft.name || `#${nft.token_id}`)}</div>
        ${nft.collection_name ? `<div class="card-collection">${escHtml(nft.collection_name)}</div>` : ''}
      </div>

      <div class="card-offer">
        <span class="${offerClass}">${formatOffer(offerNum)}</span>
        <span class="offer-currency">${escHtml(nft.offer_currency || 'ETH')}</span>
      </div>

      <div class="card-updated">Last checked: ${timeAgo(nft.last_fetched)}</div>
      ${timeUntil(nft.offer_expires_at)
        ? `<div class="card-expires ${timeUntil(nft.offer_expires_at) === 'Expired' ? 'expired' : ''}">
             Offer expires: ${timeUntil(nft.offer_expires_at)}
           </div>`
        : ''
      }

      <div class="alert-row">
        <span class="alert-label">Alert at:</span>
        <input
          type="number"
          class="alert-input"
          placeholder="e.g. 0.5"
          min="0"
          step="any"
          value="${hasAlert ? nft.alert_threshold : ''}"
          data-id="${nft.id}"
        />
        <button class="alert-save-btn" data-id="${nft.id}">Save</button>
      </div>

      ${alertActive ? `<div class="alert-active">⚡ Offer exceeds your threshold</div>` : ''}
    </div>
  `;

  return card;
}

function escHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function makePlaceholder() {
  const d = document.createElement('div');
  d.className = 'card-image-placeholder';
  d.textContent = '🖼️';
  return d;
}

async function safeJson(res) {
  const text = await res.text();
  try { return JSON.parse(text); } catch { throw new Error(text.slice(0, 200)); }
}

function renderNfts() {
  grid.querySelectorAll('.nft-card').forEach(c => c.remove());
  const sorted = sortNfts(_cachedNfts, sortSelect.value);
  if (sorted.length === 0) {
    emptyState.classList.remove('hidden');
  } else {
    emptyState.classList.add('hidden');
    sorted.forEach(nft => grid.appendChild(renderCard(nft)));
  }
}

sortSelect.addEventListener('change', renderNfts);

// Size toggle
const sizeBtns = document.querySelectorAll('.size-btn');

function applySize(size) {
  grid.className = `nft-grid size-${size}`;
  sizeBtns.forEach(b => b.classList.toggle('active', b.dataset.size === size));
  localStorage.setItem('nft-card-size', size);
}

sizeBtns.forEach(btn => {
  btn.addEventListener('click', () => applySize(btn.dataset.size));
});

// Restore saved size preference (default: large)
applySize(localStorage.getItem('nft-card-size') || 'large');

let _cachedNfts = [];

async function loadNfts() {
  try {
    const res = await fetch('/api/nfts');
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || res.statusText);
    _cachedNfts = data;
    renderNfts();
    statusText.textContent = `Last refreshed: ${new Date().toLocaleTimeString()}`;
  } catch (err) {
    statusText.textContent = `Error: ${err.message}`;
  }
}

addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  addError.classList.add('hidden');
  addBtn.disabled = true;
  addBtn.textContent = 'Adding...';

  try {
    const res = await fetch('/api/nfts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: urlInput.value }),
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Failed to add NFT');

    urlInput.value = '';
    await loadNfts();
  } catch (err) {
    addError.textContent = err.message;
    addError.classList.remove('hidden');
  } finally {
    addBtn.disabled = false;
    addBtn.textContent = 'Track NFT';
  }
});

refreshBtn.addEventListener('click', async () => {
  refreshBtn.disabled = true;
  refreshBtn.textContent = 'Running...';
  statusText.textContent = 'Polling OpenSea...';

  try {
    await fetch('/api/nfts/refresh', { method: 'POST' });
    // Give the server a moment to update, then reload
    setTimeout(loadNfts, 3000);
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = 'Run';
  }
});

grid.addEventListener('click', async (e) => {
  // Remove button
  if (e.target.classList.contains('remove-btn')) {
    const id = e.target.dataset.id;
    if (!confirm('Remove this NFT from tracking?')) return;
    await fetch(`/api/nfts/${id}`, { method: 'DELETE' });
    await loadNfts();
  }

  // Save alert threshold
  if (e.target.classList.contains('alert-save-btn')) {
    const id = e.target.dataset.id;
    const input = grid.querySelector(`.alert-input[data-id="${id}"]`);
    const threshold = input.value === '' ? null : parseFloat(input.value);

    await fetch(`/api/nfts/${id}/alert`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threshold }),
    });

    e.target.textContent = 'Saved!';
    setTimeout(() => { e.target.textContent = 'Save'; }, 1500);
  }
});

// Auto-refresh display every 60 seconds
setInterval(loadNfts, 60_000);

// Initial load
loadNfts();
