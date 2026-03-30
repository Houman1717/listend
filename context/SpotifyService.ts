// ─── Spotify Client Credentials Service ──────────────────────────────────────
// Note: embedding credentials in a client app is a known trade-off of the
// Client Credentials flow — there is no per-user auth here.

const CLIENT_ID = '15eb472d52e74891ad93df89f614bd06';
const CLIENT_SECRET = 'a8a060441f4b40e7826a70121b95ca1a';
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

export async function spotifyGet<T = any>(path: string): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Spotify API error: ${res.status}`);
  return res.json() as Promise<T>;
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
