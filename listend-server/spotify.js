// Spotify Client Credentials auth + request helpers (server-side only)

let tokenCache = null;

// ── Token helpers ─────────────────────────────────────────────────────────────

async function getToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.token;
  }

  const clientId     = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Spotify credentials not configured (SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET missing)');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/x-www-form-urlencoded',
      Authorization:   `Basic ${credentials}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    let body = '';
    try { body = await res.text(); } catch (_) {}
    throw new Error(`Spotify token → ${res.status}: ${body}`);
  }

  const data = await res.json();
  tokenCache = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  console.log(`[spotify] token refreshed, expires in ${data.expires_in}s`);
  return tokenCache.token;
}

// ── Main request helper ───────────────────────────────────────────────────────
// retries: internal counter to prevent infinite 401 recursion (max 1 retry)

async function spotifyGet(path, retries = 0) {
  const token = await getToken();
  console.log(`[spotify] GET ${path.split('?')[0]} (token present: ${!!token})`);

  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  console.log(`[spotify] → ${res.status} for ${path.split('?')[0]}`);

  // ── 401 Unauthorized: refresh token once and retry ─────────────────────────
  if (res.status === 401) {
    if (retries >= 1) {
      throw new Error(`Spotify ${path} → 401 after token refresh (credentials may be invalid)`);
    }
    console.warn('[spotify] 401 — clearing token cache and retrying once');
    tokenCache = null;
    return spotifyGet(path, retries + 1);
  }

  // ── 429 Rate Limited ───────────────────────────────────────────────────────
  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('Retry-After') ?? '5', 10);
    // Cap the wait at 10 seconds so we don't block the server indefinitely
    const waitMs = Math.min(retryAfter * 1000, 10_000);
    console.warn(`[spotify] 429 rate limited on ${path.split('?')[0]}, waiting ${waitMs}ms`);
    await delay(waitMs);
    return spotifyGet(path, retries);
  }

  // ── Any other non-2xx ──────────────────────────────────────────────────────
  if (!res.ok) {
    let body = '';
    try { body = await res.text(); } catch (_) {}
    const msg = `Spotify ${path.split('?')[0]} → ${res.status}: ${body}`;
    console.error('[spotify] error:', msg);
    throw new Error(msg);
  }

  return res.json();
}

const delay = ms => new Promise(r => setTimeout(r, ms));

// ── Normalizers ───────────────────────────────────────────────────────────────

function albumFromItem(item) {
  return {
    spotify_id:  item.id,
    title:       item.name,
    artist:      item.artists?.[0]?.name ?? '',
    artwork_url: item.images?.[0]?.url ?? '',
    year:        parseInt(item.release_date?.slice(0, 4) ?? '0', 10),
  };
}

function trackFromItem(item) {
  return {
    spotify_id:  item.id,
    title:       item.name,
    artist:      item.artists?.[0]?.name ?? '',
    artwork_url: item.album?.images?.[0]?.url ?? '',
  };
}

function artistFromItem(item, genre) {
  return {
    spotify_id:  item.id,
    name:        item.name,
    artwork_url: item.images?.[0]?.url ?? '',
    genre:       genre ?? item.genres?.[0] ?? '',
  };
}

module.exports = { spotifyGet, getToken, albumFromItem, trackFromItem, artistFromItem, delay };
