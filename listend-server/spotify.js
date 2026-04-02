// Spotify Client Credentials auth + request helpers (server-side only)

let tokenCache = null;

async function getToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.token;
  }
  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString('base64');

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`Spotify token error: ${res.status}`);
  const data = await res.json();
  tokenCache = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return tokenCache.token;
}

async function spotifyGet(path) {
  const token = await getToken();
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    tokenCache = null;
    return spotifyGet(path); // retry once with fresh token
  }
  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('Retry-After') ?? '60', 10);
    console.warn(`[spotify] Rate limited on ${path}, waiting ${retryAfter}s...`);
    await delay(retryAfter * 1000);
    return spotifyGet(path);
  }
  if (!res.ok) throw new Error(`Spotify ${path} → ${res.status}`);
  return res.json();
}

const delay = ms => new Promise(r => setTimeout(r, ms));

// Normalizers — mirror the client-side shape expected by the React Native app

function albumFromItem(item) {
  return {
    spotify_id: item.id,
    title: item.name,
    artist: item.artists?.[0]?.name ?? '',
    artwork_url: item.images?.[0]?.url ?? '',
    year: parseInt(item.release_date?.slice(0, 4) ?? '0', 10),
  };
}

function trackFromItem(item) {
  return {
    spotify_id: item.id,
    title: item.name,
    artist: item.artists?.[0]?.name ?? '',
    artwork_url: item.album?.images?.[0]?.url ?? '',
  };
}

function artistFromItem(item, genre) {
  return {
    spotify_id: item.id,
    name: item.name,
    artwork_url: item.images?.[0]?.url ?? '',
    genre: genre ?? item.genres?.[0] ?? '',
  };
}

module.exports = { spotifyGet, albumFromItem, trackFromItem, artistFromItem, delay };
