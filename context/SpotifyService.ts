// ─── Spotify Client Credentials Service ──────────────────────────────────────
// Note: embedding credentials in a client app is a known trade-off of the
// Client Credentials flow — there is no per-user auth here.

const CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID ?? '';
const CLIENT_SECRET = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET ?? '';
const API_BASE = 'https://api.spotify.com/v1';

// ─── Credential validation (runs at module load) ──────────────────────────────

if (!CLIENT_ID || CLIENT_ID === 'undefined') {
  console.error(
    '[Spotify] ❌ EXPO_PUBLIC_SPOTIFY_CLIENT_ID is missing or undefined.\n' +
    '  → Add to your .env file:  EXPO_PUBLIC_SPOTIFY_CLIENT_ID=<your_id>\n' +
    '  → Then restart the dev server with:  npx expo start --clear'
  );
} else {
  console.log(`[Spotify] CLIENT_ID  loaded: ${CLIENT_ID.slice(0, 6)}…`);
}

if (!CLIENT_SECRET || CLIENT_SECRET === 'undefined') {
  console.error(
    '[Spotify] ❌ EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET is missing or undefined.\n' +
    '  → Add to your .env file:  EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET=<your_secret>\n' +
    '  → Then restart the dev server with:  npx expo start --clear'
  );
} else {
  console.log(`[Spotify] CLIENT_SECRET loaded: ${CLIENT_SECRET.slice(0, 4)}…`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ─── Token cache (in-memory, resets on app restart) ──────────────────────────

let cachedToken: string | null = null;
let tokenExpiry = 0;
// Single in-flight promise — prevents duplicate parallel token requests
let tokenFetchPromise: Promise<string> | null = null;

async function fetchFreshToken(): Promise<string> {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error(
      '[Spotify] Cannot fetch token: CLIENT_ID or CLIENT_SECRET is empty. ' +
      'Check your .env file and restart the dev server (npx expo start --clear).'
    );
  }

  const credentials = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
  console.log('[Spotify] Fetching new access token…');

  let res: Response;
  try {
    res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
  } catch (networkErr) {
    console.error('[Spotify] Network error fetching token:', networkErr);
    throw new Error(`[Spotify] Network error during token fetch: ${networkErr}`);
  }

  if (!res.ok) {
    const body = await res.text();
    console.error(
      `[Spotify] Token fetch failed — HTTP ${res.status}.\n` +
      `  Response body: ${body}\n` +
      `  CLIENT_ID used: ${CLIENT_ID.slice(0, 6)}…\n` +
      `  Verify credentials at https://developer.spotify.com/dashboard`
    );
    throw new Error(`Spotify auth failed: ${res.status} — ${body}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    console.error('[Spotify] Token response missing access_token field:', JSON.stringify(data));
    throw new Error('Spotify auth response missing access_token');
  }

  cachedToken = data.access_token;
  // Subtract 60s as a safety buffer before the real expiry
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  console.log(`[Spotify] Token obtained, valid for ${data.expires_in - 60}s`);
  return cachedToken!;
}

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) {
    console.log(`[Spotify] Using cached token (prefix: ${cachedToken.slice(0, 8)}…, expires in ${Math.round((tokenExpiry - Date.now()) / 1000)}s)`);
    return cachedToken;
  }

  console.log('[Spotify] No valid cached token — fetching fresh one…');
  // Deduplicate: if a fetch is already in-flight, share the same promise
  if (!tokenFetchPromise) {
    tokenFetchPromise = fetchFreshToken().finally(() => {
      tokenFetchPromise = null;
    });
  }
  return tokenFetchPromise;
}

// ─── Concurrent request queue ────────────────────────────────────────────────
// Every spotifyGet call is funnelled through this queue.  Up to MAX_CONCURRENT
// requests run simultaneously; new slots are opened MIN_REQUEST_GAP_MS apart
// so we stagger launches rather than firing all concurrently at t=0.
//
// When a 429 is received, rateLimitCooldownUntil is set and the drain loop
// refuses to start new entries until the cooldown expires.  In-flight requests
// are not cancelled — they may complete or fail on their own while the cooldown
// prevents new work from starting.

const MIN_REQUEST_GAP_MS  = 100;       // gap between launching each new slot
const MAX_CONCURRENT      = 3;         // max simultaneous in-flight requests
const RATE_LIMIT_COOLDOWN_MS = 60_000; // pause new launches for 60s on any 429

let rateLimitCooldownUntil = 0; // epoch ms; 0 means no active cooldown
let activeCount = 0;            // number of requests currently in-flight
let draining = false;           // prevents concurrent drain loops

type QueueEntry = {
  execute: () => Promise<any>;
  resolve: (v: any) => void;
  reject:  (e: any) => void;
};

const requestQueue: QueueEntry[] = [];

async function drainQueue(): Promise<void> {
  if (draining) return;
  draining = true;

  while (requestQueue.length > 0) {
    // ── No open slots — exit and let the next completing slot re-trigger drain
    if (activeCount >= MAX_CONCURRENT) {
      draining = false;
      return;
    }

    // ── Honour any active rate-limit cooldown before starting the next request
    const cooldownRemaining = rateLimitCooldownUntil - Date.now();
    if (cooldownRemaining > 0) {
      console.log(
        `[Spotify] Rate-limit cooldown — pausing new launches for ${Math.ceil(cooldownRemaining / 1000)}s`
      );
      await sleep(cooldownRemaining);
      continue;
    }

    const entry = requestQueue.shift()!;
    activeCount++;

    // Fire without awaiting — this slot runs concurrently with the next iteration
    entry.execute().then(
      (v) => { entry.resolve(v); activeCount--; drainQueue(); },
      (e) => { entry.reject(e);  activeCount--; drainQueue(); }
    );

    // Stagger slot launches so we don't burst all MAX_CONCURRENT at t=0
    if (requestQueue.length > 0 && activeCount < MAX_CONCURRENT) {
      await sleep(MIN_REQUEST_GAP_MS);
    }
  }

  draining = false;
}

function enqueue<T>(execute: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    requestQueue.push({ execute, resolve, reject } as QueueEntry);
    drainQueue();
  });
}

// ─── Authenticated GET with 429 global cooldown + token retry (internal) ──────

// Only 1 retry for 429 — we wait a full 60s, so a second failure would mean
// the account is still being throttled and we should surface that quickly.
const MAX_429_RETRIES = 1;

async function spotifyGetOnce<T>(
  path: string,
  token: string,
): Promise<{ status: number; json?: T; body?: string; retryAfterMs?: number }> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('[Spotify] Response status:', res.status, path.split('?')[0]);
  if (!res.ok) {
    const body = await res.text();
    const retryAfter = res.headers.get('Retry-After');
    return {
      status: res.status,
      body,
      retryAfterMs: retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined,
    };
  }
  return { status: res.status, json: (await res.json()) as T };
}

// Runs the actual HTTP fetch with retry logic.  Always called via enqueue() —
// must never be called directly.
async function spotifyGetDirect<T>(path: string): Promise<T> {
  console.log('[Spotify] GET', path);
  let token = await getToken();

  for (let attempt = 0; attempt <= MAX_429_RETRIES + 1; attempt++) {
    const result = await spotifyGetOnce<T>(path, token);

    // ── Success ──────────────────────────────────────────────────────────────
    if (result.json !== undefined) return result.json;

    // ── Token rejected — log full details immediately, refresh once, retry ─────
    if (result.status === 401 || result.status === 403) {
      console.error(
        `[Spotify] ${result.status} on attempt ${attempt}.\n` +
        `  Path: ${path}\n` +
        `  Token prefix sent: ${token.slice(0, 8)}…\n` +
        `  Response body: ${result.body}`
      );
      if (attempt > 0) {
        throw new Error(`Spotify API error: ${result.status}`);
      }
      console.warn('[Spotify] Invalidating cached token and fetching a fresh one…');
      cachedToken = null;
      tokenExpiry = 0;
      token = await getToken();
      continue;
    }

    // ── Rate limited — impose 60s global cooldown, then retry once ────────────
    // rateLimitCooldownUntil prevents the drain loop from starting new requests
    // during the cooldown; in-flight requests (including this one) are unaffected.
    if (result.status === 429) {
      if (attempt >= MAX_429_RETRIES) {
        console.error(
          `[Spotify] 429 — still rate-limited after ${MAX_429_RETRIES} cooldown ` +
          `retry for: ${path}`
        );
        throw new Error('Spotify API error: 429 — rate limit exceeded after cooldown retry');
      }
      // Respect Retry-After header, but never less than our minimum cooldown
      const waitMs = Math.max(result.retryAfterMs ?? 0, RATE_LIMIT_COOLDOWN_MS);
      rateLimitCooldownUntil = Date.now() + waitMs;
      console.warn(
        `[Spotify] 429 received — imposing ${waitMs / 1000}s global cooldown on all ` +
        `requests, then retrying once. Path: ${path}`
      );
      await sleep(waitMs);
      continue;
    }

    // ── Other non-retryable error ─────────────────────────────────────────────
    console.error(`[Spotify] HTTP ${result.status}.\n  Path: ${path}\n  Body: ${result.body}`);
    throw new Error(`Spotify API error: ${result.status}`);
  }

  throw new Error('Spotify API error: exhausted retries');
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function spotifyGet<T = any>(path: string): Promise<T> {
  return enqueue(() => spotifyGetDirect<T>(path));
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
