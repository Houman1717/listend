// ─── Spotify Client Credentials Service ──────────────────────────────────────
// Note: embedding credentials in a client app is a known trade-off of the
// Client Credentials flow — there is no per-user auth here.

const CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID ?? '15eb472d52e74891ad93df89f614bd06';
const CLIENT_SECRET = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET ?? '169d56a0bf5c4fe794cf0b11da40019c';
const API_BASE = 'https://api.spotify.com/v1';

// ─── Token cache (in-memory, resets on app restart) ──────────────────────────

let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const credentials = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) throw new Error(`Spotify auth failed: ${res.status}`);
  const data = await res.json();

  cachedToken = data.access_token;
  // Subtract 60s as a safety buffer before the real expiry
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken!;
}

// ─── Authenticated GET ────────────────────────────────────────────────────────

async function spotifyGetOnce<T = any>(path: string, token: string): Promise<{ status: number; json?: T; body?: string }> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('[Spotify] Response status:', res.status);
  if (!res.ok) {
    const body = await res.text();
    return { status: res.status, body };
  }
  const json = await res.json();
  return { status: res.status, json: json as T };
}

export async function spotifyGet<T = any>(path: string): Promise<T> {
  console.log('[Spotify] GET', path);
  const token = await getToken();
  const result = await spotifyGetOnce<T>(path, token);

  if (result.status === 401 || result.status === 403) {
    // Token was rejected — invalidate the cache and fetch a fresh one, then retry once.
    console.warn(`[Spotify] ${result.status} received, refreshing token and retrying…`);
    cachedToken = null;
    tokenExpiry = 0;
    const freshToken = await getToken();
    const retry = await spotifyGetOnce<T>(path, freshToken);
    if (!retry.json) {
      console.error('[Spotify] Error body:', retry.body);
      throw new Error(`Spotify API error: ${retry.status}`);
    }
    console.log('[Spotify] Response keys:', Object.keys(retry.json as object));
    return retry.json;
  }

  if (!result.json) {
    console.error('[Spotify] Error body:', result.body);
    throw new Error(`Spotify API error: ${result.status}`);
  }
  console.log('[Spotify] Response keys:', Object.keys(result.json as object));
  return result.json;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type SpotifyAlbum = {
  id: string;
  title: string;
  artist: string;
  year: number;
  artworkUrl: string;
};

export type SpotifyTrack = {
  id: string;
  title: string;
  artist: string;
  artworkUrl: string;
};

export type SpotifyArtist = {
  id: string;
  name: string;
  genre: string;
  artworkUrl: string;
};

// ─── Normalizers ──────────────────────────────────────────────────────────────

export function albumFromSpotify(item: any): SpotifyAlbum {
  return {
    id: item.id ?? '',
    title: item.name ?? '',
    artist: item.artists?.[0]?.name ?? '',
    // release_date can be "YYYY", "YYYY-MM", or "YYYY-MM-DD"
    year: item.release_date ? parseInt(item.release_date.slice(0, 4), 10) : 0,
    // images are sorted largest → smallest; use first (highest quality)
    artworkUrl: item.images?.[0]?.url ?? '',
  };
}

export function trackFromSpotify(item: any): SpotifyTrack {
  return {
    id: item.id ?? '',
    title: item.name ?? '',
    artist: item.artists?.[0]?.name ?? '',
    artworkUrl: item.album?.images?.[0]?.url ?? '',
  };
}

export function artistFromSpotify(item: any): SpotifyArtist {
  return {
    id: item.id ?? '',
    name: item.name ?? '',
    genre: item.genres?.[0] ?? '',
    artworkUrl: item.images?.[0]?.url ?? '',
  };
}
