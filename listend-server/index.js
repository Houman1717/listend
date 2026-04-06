// listend backend server
require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const supabase = require('./db');
const { runRefresh } = require('./refresh');
const { spotifyGet } = require('./spotify');
const { getCached, setCache, TTL_24H, TTL_7D } = require('./cache');

const app = express();
const PORT = process.env.PORT || 8080;

// ── Startup env check ─────────────────────────────────────────────────────────
const REQUIRED_VARS = ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'LASTFM_API_KEY', 'GENIUS_ACCESS_TOKEN'];
for (const v of REQUIRED_VARS) {
  if (!process.env[v]) console.warn(`[startup] WARNING: env var ${v} is not set`);
  else console.log(`[startup] ${v}: set ✓`);
}

// ── In-memory response cache ───────────────────────────────────────────────────

const memCache = new Map();

const TTL_6H  = 6  * 60 * 60 * 1000;
const TTL_10M = 10 * 60 * 1000;

function cacheGet(key) {
  const entry = memCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { memCache.delete(key); return null; }
  return entry.data;
}

function cacheSet(key, data, ttlMs) {
  memCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

function cacheClear(...keys) {
  if (keys.length === 0) { memCache.clear(); return; }
  for (const k of keys) memCache.delete(k);
}

// Allow any origin — the client is a mobile app, not a browser page
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

// ── GET /health ───────────────────────────────────────────────────────────────

app.get('/health', (req, res) => res.json({ ok: true }));

// ── GET /home ─────────────────────────────────────────────────────────────────

app.get('/home', async (req, res) => {
  const CACHE_KEY = 'home';

  const mem = cacheGet(CACHE_KEY);
  if (mem) return res.json(mem);

  const db = await getCached(CACHE_KEY, TTL_24H);
  if (db) { cacheSet(CACHE_KEY, db, TTL_6H); return res.json(db); }

  try {
    const [albumsRes, songsRes, artistsRes] = await Promise.all([
      supabase.from('home_albums').select('*').order('updated_at', { ascending: false }).limit(10),
      supabase.from('home_songs').select('*').order('updated_at', { ascending: false }).limit(10),
      supabase.from('home_artists').select('*').order('updated_at', { ascending: false }).limit(8),
    ]);

    if (albumsRes.error) throw albumsRes.error;
    if (songsRes.error) throw songsRes.error;
    if (artistsRes.error) throw artistsRes.error;

    const payload = {
      albums: (albumsRes.data ?? []).map(r => ({
        id: r.spotify_id,
        title: r.title,
        artist: r.artist,
        artworkUrl: r.artwork_url,
        year: r.year ?? 0,
      })),
      songs: (songsRes.data ?? []).map(r => ({
        id: r.spotify_id,
        title: r.title,
        artist: r.artist,
        artworkUrl: r.artwork_url,
      })),
      artists: (artistsRes.data ?? []).map(r => ({
        id: r.spotify_id,
        name: r.name,
        artworkUrl: r.artwork_url,
        genre: r.genre ?? '',
      })),
    };

    cacheSet(CACHE_KEY, payload, TTL_6H);
    await setCache(CACHE_KEY, payload);
    res.json(payload);
  } catch (err) {
    console.error('[/home]', err.message ?? err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /genres ───────────────────────────────────────────────────────────────

app.get('/genres', async (req, res) => {
  const CACHE_KEY = 'genres';

  const mem = cacheGet(CACHE_KEY);
  if (mem) return res.json(mem);

  const db = await getCached(CACHE_KEY, TTL_24H);
  if (db) { cacheSet(CACHE_KEY, db, TTL_6H); return res.json(db); }

  try {
    const { data, error } = await supabase
      .from('genre_albums')
      .select('*')
      .order('genre_label');

    if (error) throw error;

    const grouped = {};
    for (const r of data ?? []) {
      if (!grouped[r.genre_label]) grouped[r.genre_label] = [];
      grouped[r.genre_label].push({
        id: r.spotify_id,
        title: r.title,
        artist: r.artist,
        artworkUrl: r.artwork_url,
        year: r.year ?? 0,
      });
    }

    cacheSet(CACHE_KEY, grouped, TTL_6H);
    await setCache(CACHE_KEY, grouped);
    res.json(grouped);
  } catch (err) {
    console.error('[/genres]', err.message ?? err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /decades ──────────────────────────────────────────────────────────────

app.get('/decades', async (req, res) => {
  const CACHE_KEY = 'decades';

  const mem = cacheGet(CACHE_KEY);
  if (mem) return res.json(mem);

  const db = await getCached(CACHE_KEY, TTL_24H);
  if (db) { cacheSet(CACHE_KEY, db, TTL_6H); return res.json(db); }

  try {
    const { data, error } = await supabase
      .from('decade_albums')
      .select('*')
      .order('decade_label');

    if (error) throw error;

    const grouped = {};
    for (const r of data ?? []) {
      if (!grouped[r.decade_label]) grouped[r.decade_label] = [];
      grouped[r.decade_label].push({
        id: r.spotify_id,
        title: r.title,
        artist: r.artist,
        artworkUrl: r.artwork_url,
        year: r.year ?? 0,
      });
    }

    cacheSet(CACHE_KEY, grouped, TTL_6H);
    await setCache(CACHE_KEY, grouped);
    res.json(grouped);
  } catch (err) {
    console.error('[/decades]', err.message ?? err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /search ───────────────────────────────────────────────────────────────

app.get('/search', async (req, res) => {
  const { q, type } = req.query;
  if (!q || !type) return res.status(400).json({ error: 'q and type are required' });
  if (!['album', 'track', 'artist'].includes(type)) {
    return res.status(400).json({ error: 'type must be album, track, or artist' });
  }

  const CACHE_KEY = `search:${type}:${q.trim().toLowerCase()}`;

  const mem = cacheGet(CACHE_KEY);
  if (mem) return res.json(mem);

  const db = await getCached(CACHE_KEY, TTL_24H);
  if (db) { cacheSet(CACHE_KEY, db, TTL_10M); return res.json(db); }

  try {
    const encoded = encodeURIComponent(q);
    const data = await spotifyGet(`/search?q=${encoded}&type=${type}&limit=10&market=US`);

    let results;
    if (type === 'album') {
      results = (data.albums?.items ?? []).filter(Boolean).map(item => ({
        id: item.id,
        title: item.name,
        artist: item.artists?.[0]?.name ?? '',
        year: parseInt(item.release_date?.slice(0, 4) ?? '0', 10),
        artworkUrl: item.images?.[0]?.url ?? '',
      }));
    } else if (type === 'track') {
      results = (data.tracks?.items ?? []).filter(Boolean).map(item => ({
        id: item.id,
        title: item.name,
        artist: item.artists?.[0]?.name ?? '',
        artworkUrl: item.album?.images?.[0]?.url ?? '',
      }));
    } else {
      results = (data.artists?.items ?? []).filter(Boolean).map(item => ({
        id: item.id,
        name: item.name,
        genre: item.genres?.[0] ?? '',
        artworkUrl: item.images?.[0]?.url ?? '',
      }));
    }

    cacheSet(CACHE_KEY, results, TTL_10M);
    await setCache(CACHE_KEY, results);
    res.json(results);
  } catch (err) {
    console.error('[/search]', err.message ?? err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /discover/new-releases ────────────────────────────────────────────────

app.get('/discover/new-releases', async (req, res) => {
  const CACHE_KEY = 'discover:new-releases';

  const mem = cacheGet(CACHE_KEY);
  if (mem) return res.json(mem);

  const db = await getCached(CACHE_KEY, TTL_24H);
  if (db) { cacheSet(CACHE_KEY, db, TTL_6H); return res.json(db); }

  try {
    const data = await spotifyGet('/search?q=tag:new&type=album&limit=10&market=US');
    const results = (data.albums?.items ?? []).filter(Boolean).map(item => ({
      id: item.id,
      title: item.name,
      artist: item.artists?.[0]?.name ?? '',
      year: parseInt(item.release_date?.slice(0, 4) ?? '0', 10),
      artworkUrl: item.images?.[0]?.url ?? '',
    }));
    cacheSet(CACHE_KEY, results, TTL_6H);
    await setCache(CACHE_KEY, results);
    res.json(results);
  } catch (err) {
    console.error('[/discover/new-releases]', err.message ?? err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /discover/popular ─────────────────────────────────────────────────────

app.get('/discover/popular', async (req, res) => {
  const CACHE_KEY = 'discover:popular';

  const mem = cacheGet(CACHE_KEY);
  if (mem) return res.json(mem);

  const db = await getCached(CACHE_KEY, TTL_24H);
  if (db) { cacheSet(CACHE_KEY, db, TTL_6H); return res.json(db); }

  try {
    const year = new Date().getFullYear();
    const data = await spotifyGet(`/search?q=year:${year}&type=album&limit=10&market=US`);
    const results = (data.albums?.items ?? []).filter(Boolean).map(item => ({
      id: item.id,
      title: item.name,
      artist: item.artists?.[0]?.name ?? '',
      year: parseInt(item.release_date?.slice(0, 4) ?? '0', 10),
      artworkUrl: item.images?.[0]?.url ?? '',
    }));
    cacheSet(CACHE_KEY, results, TTL_6H);
    await setCache(CACHE_KEY, results);
    res.json(results);
  } catch (err) {
    console.error('[/discover/popular]', err.message ?? err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /discover/coming-soon ─────────────────────────────────────────────────

app.get('/discover/coming-soon', async (req, res) => {
  const CACHE_KEY = 'discover:coming-soon';

  const mem = cacheGet(CACHE_KEY);
  if (mem) return res.json(mem);

  const db = await getCached(CACHE_KEY, TTL_24H);
  if (db) { cacheSet(CACHE_KEY, db, TTL_6H); return res.json(db); }

  try {
    const year = new Date().getFullYear();
    const data = await spotifyGet(`/search?q=year:${year}&type=album&limit=10`);
    const results = (data.albums?.items ?? []).filter(Boolean).map(item => ({
      id: item.id,
      title: item.name,
      artist: item.artists?.[0]?.name ?? '',
      year: parseInt(item.release_date?.slice(0, 4) ?? '0', 10),
      artworkUrl: item.images?.[0]?.url ?? '',
    }));
    cacheSet(CACHE_KEY, results, TTL_6H);
    await setCache(CACHE_KEY, results);
    res.json(results);
  } catch (err) {
    console.error('[/discover/coming-soon]', err.message ?? err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /lastfm/artist — ?artist=<name> ───────────────────────────────────────
// Switched from path params to query params to safely handle names with /&?# etc.

app.get('/lastfm/artist', async (req, res) => {
  const artistName = (req.query.artist ?? '').trim();
  if (!artistName) return res.status(400).json({ error: 'artist query param required' });

  console.log(`[/lastfm/artist] artist="${artistName}" LASTFM_API_KEY=${process.env.LASTFM_API_KEY ? 'set' : 'MISSING'}`);

  const CACHE_KEY = `lastfm_artist_${artistName.toLowerCase()}`;

  const mem = cacheGet(CACHE_KEY);
  if (mem) { console.log(`[/lastfm/artist] cache hit (memory)`); return res.json(mem); }

  const db = await getCached(CACHE_KEY, TTL_7D);
  if (db) { console.log(`[/lastfm/artist] cache hit (db)`); cacheSet(CACHE_KEY, db, TTL_6H); return res.json(db); }

  try {
    const url =
      `http://ws.audioscrobbler.com/2.0/?method=artist.getinfo` +
      `&artist=${encodeURIComponent(artistName)}` +
      `&api_key=${process.env.LASTFM_API_KEY}` +
      `&format=json`;

    console.log(`[/lastfm/artist] fetching Last.fm for "${artistName}"`);
    const resp = await fetch(url);
    console.log(`[/lastfm/artist] Last.fm HTTP status: ${resp.status}`);
    if (!resp.ok) throw new Error(`Last.fm artist.getinfo → ${resp.status}`);
    const json = await resp.json();
    console.log(`[/lastfm/artist] Last.fm response keys:`, Object.keys(json));

    if (json.error) throw new Error(`Last.fm error ${json.error}: ${json.message}`);

    const a = json.artist;
    const payload = {
      name: a.name,
      listeners: parseInt(a.stats?.listeners ?? '0', 10),
      bio: a.bio?.summary ?? '',
      tags: (a.tags?.tag ?? []).map(t => t.name),
      similar: (a.similar?.artist ?? []).map(s => ({ name: s.name, url: s.url })),
    };

    console.log(`[/lastfm/artist] success — ${payload.listeners} listeners, ${payload.tags.length} tags`);
    cacheSet(CACHE_KEY, payload, TTL_6H);
    await setCache(CACHE_KEY, payload);
    res.json(payload);
  } catch (err) {
    console.error('[/lastfm/artist] ERROR:', err.message ?? err);
    res.status(500).json({ error: err.message ?? 'Internal server error' });
  }
});

// ── GET /lastfm/album — ?artist=<name>&album=<name> ──────────────────────────

app.get('/lastfm/album', async (req, res) => {
  const artistName = (req.query.artist ?? '').trim();
  const albumName  = (req.query.album  ?? '').trim();
  if (!artistName || !albumName) return res.status(400).json({ error: 'artist and album query params required' });

  console.log(`[/lastfm/album] artist="${artistName}" album="${albumName}" LASTFM_API_KEY=${process.env.LASTFM_API_KEY ? 'set' : 'MISSING'}`);

  const CACHE_KEY = `lastfm_album_${artistName.toLowerCase()}_${albumName.toLowerCase()}`;

  const mem = cacheGet(CACHE_KEY);
  if (mem) { console.log(`[/lastfm/album] cache hit (memory)`); return res.json(mem); }

  const db = await getCached(CACHE_KEY, TTL_7D);
  if (db) { console.log(`[/lastfm/album] cache hit (db)`); cacheSet(CACHE_KEY, db, TTL_6H); return res.json(db); }

  try {
    const url =
      `http://ws.audioscrobbler.com/2.0/?method=album.getinfo` +
      `&artist=${encodeURIComponent(artistName)}` +
      `&album=${encodeURIComponent(albumName)}` +
      `&api_key=${process.env.LASTFM_API_KEY}` +
      `&format=json`;

    console.log(`[/lastfm/album] fetching Last.fm for "${artistName} - ${albumName}"`);
    const resp = await fetch(url);
    console.log(`[/lastfm/album] Last.fm HTTP status: ${resp.status}`);
    if (!resp.ok) throw new Error(`Last.fm album.getinfo → ${resp.status}`);
    const json = await resp.json();
    console.log(`[/lastfm/album] Last.fm response keys:`, Object.keys(json));

    if (json.error) throw new Error(`Last.fm error ${json.error}: ${json.message}`);

    const al = json.album;
    const payload = {
      name: al.name,
      artist: al.artist,
      listeners: parseInt(al.listeners ?? '0', 10),
      description: al.wiki?.summary ?? '',
      tags: (al.tags?.tag ?? []).map(t => t.name),
    };

    console.log(`[/lastfm/album] success — ${payload.listeners} listeners, ${payload.tags.length} tags, desc length=${payload.description.length}`);
    cacheSet(CACHE_KEY, payload, TTL_6H);
    await setCache(CACHE_KEY, payload);
    res.json(payload);
  } catch (err) {
    console.error('[/lastfm/album] ERROR:', err.message ?? err);
    res.status(500).json({ error: err.message ?? 'Internal server error' });
  }
});

// ── Genius credits helper ─────────────────────────────────────────────────────
// Fetches and parses Genius credits for one track. Returns null on any failure.
// All raw fields are logged so Railway deploy logs show exactly what Genius returns.

const GENIUS_EXCLUDE = /publisher|published by|under exclusive license|distributor|distributed by|copyright|℗|record label|label|℗\s*&\s*©|rights reserved/i;

async function fetchSongCredits(artistName, trackName) {
  const query = `${artistName} ${trackName}`;
  console.log(`[genius] ── searching: "${query}"`);

  const searchResp = await fetch(
    `https://api.genius.com/search?q=${encodeURIComponent(query)}`,
    { headers: { Authorization: `Bearer ${process.env.GENIUS_ACCESS_TOKEN}` } }
  );
  console.log(`[genius] search HTTP ${searchResp.status} for "${query}"`);
  if (!searchResp.ok) return null;

  const searchJson = await searchResp.json();
  const hits = searchJson.response?.hits ?? [];
  console.log(`[genius] hits: ${hits.length} for "${query}"`);
  if (!hits.length) return null;

  const hit = hits[0];
  const songId = hit.result.id;
  console.log(`[genius] top hit: id=${songId} title="${hit.result.title}" artist="${hit.result.primary_artist?.name}"`);

  const songResp = await fetch(
    `https://api.genius.com/songs/${songId}?text_format=plain`,
    { headers: { Authorization: `Bearer ${process.env.GENIUS_ACCESS_TOKEN}` } }
  );
  console.log(`[genius] song detail HTTP ${songResp.status} for id=${songId}`);
  if (!songResp.ok) return null;

  const songJson = await songResp.json();
  const song = songJson.response?.song;
  if (!song) return null;

  // ── Raw fields — logged in full before any filtering ──────────────────────
  const rawCustomPerfs  = song.custom_performances ?? [];
  const rawProducers    = (song.producer_artists ?? []).map(a => a.name);
  const rawWriters      = (song.writer_artists   ?? []).map(a => a.name);

  console.log(`[genius] RAW custom_performances (${rawCustomPerfs.length} entries):`);
  rawCustomPerfs.forEach((p, i) =>
    console.log(`  [${i}] "${p.label}" → ${(p.artists ?? []).map(a => a.name).join(', ') || '(no artists)'}`)
  );
  console.log(`[genius] RAW producer_artists (${rawProducers.length}):`, rawProducers);
  console.log(`[genius] RAW writer_artists   (${rawWriters.length}):`,   rawWriters);

  // ── Filter to music-relevant roles only ───────────────────────────────────
  const credits = rawCustomPerfs
    .filter(p => Array.isArray(p.artists) && p.artists.length > 0)
    .filter(p => !GENIUS_EXCLUDE.test(p.label ?? ''))
    .map(p => ({ label: p.label, artists: p.artists.map(a => a.name).filter(Boolean) }))
    .filter(p => p.artists.length > 0);

  console.log(`[genius] FILTERED credits (${credits.length} roles):`);
  credits.forEach(c => console.log(`  "${c.label}" → ${c.artists.join(', ')}`));

  // ── Flat producers / writers ──────────────────────────────────────────────
  const perfProducers = credits.filter(p => /produced/i.test(p.label)).flatMap(p => p.artists);
  const producers = [...new Set([...perfProducers, ...rawProducers])].filter(Boolean);

  const perfWriters = credits.filter(p => /written|lyrics/i.test(p.label)).flatMap(p => p.artists);
  const writers = [...new Set([...perfWriters, ...rawWriters])].filter(Boolean);

  console.log(`[genius] producers (${producers.length}):`, producers);
  console.log(`[genius] writers   (${writers.length}):`,   writers);

  return {
    trackTitle: song.title ?? hit.result.title,
    artist:     song.primary_artist?.name ?? hit.result.primary_artist?.name ?? null,
    producers:  producers.length ? producers : null,
    writers:    writers.length   ? writers   : null,
    credits,
    // score = number of filtered roles; used to pick the richest result across tracks
    _score: credits.length,
  };
}

// ── GET /genius/credits ───────────────────────────────────────────────────────
// ?artist=<name>&tracks=<t1>&tracks=<t2>&tracks=<t3>  (tracks repeated up to 3×)
// Tries each track in order, returns whichever has the most custom_performances
// data after filtering. Falls back to producer_artists/writer_artists if all
// tracks return empty custom_performances.

app.get('/genius/credits', async (req, res) => {
  const artistName = (req.query.artist ?? '').trim();

  // Accept both ?track= (legacy single) and ?tracks[]= / ?tracks= (multi)
  const rawTracks = req.query.tracks ?? req.query.track ?? '';
  const trackList = (Array.isArray(rawTracks) ? rawTracks : [rawTracks])
    .map(t => t.trim()).filter(Boolean).slice(0, 3);

  if (!artistName || !trackList.length) {
    return res.status(400).json({ error: 'artist and at least one tracks param required' });
  }

  console.log(`[/genius/credits] ══ START artist="${artistName}" tracks=${JSON.stringify(trackList)} token=${process.env.GENIUS_ACCESS_TOKEN ? 'set' : 'MISSING'}`);

  const CACHE_KEY = `genius_v4_${artistName.toLowerCase()}_${trackList[0].toLowerCase()}`;

  const mem = cacheGet(CACHE_KEY);
  if (mem) { console.log(`[/genius/credits] cache hit (memory)`); return res.json(mem); }

  const db = await getCached(CACHE_KEY, TTL_7D);
  if (db) { console.log(`[/genius/credits] cache hit (db)`); cacheSet(CACHE_KEY, db, TTL_6H); return res.json(db); }

  try {
    let best = null;

    for (const trackName of trackList) {
      console.log(`[/genius/credits] trying track "${trackName}" …`);
      const result = await fetchSongCredits(artistName, trackName);

      if (!result) {
        console.log(`[/genius/credits] no result for "${trackName}" — skipping`);
        continue;
      }

      console.log(`[/genius/credits] track "${trackName}" scored ${result._score} filtered roles`);

      if (!best || result._score > best._score) {
        best = result;
        console.log(`[/genius/credits] new best: "${trackName}" (score ${result._score})`);
      }

      // Stop early if we already have rich credits (≥3 roles)
      if (best._score >= 3) {
        console.log(`[/genius/credits] score ≥ 3 — stopping early`);
        break;
      }
    }

    if (!best) {
      console.log(`[/genius/credits] all tracks returned no data — returning empty`);
      const empty = { producers: null, writers: null, credits: [] };
      cacheSet(CACHE_KEY, empty, TTL_6H);
      await setCache(CACHE_KEY, empty);
      return res.json(empty);
    }

    console.log(`[/genius/credits] ══ FINAL using "${best.trackTitle}" score=${best._score}`);

    const { _score, trackTitle, ...payload } = best;

    cacheSet(CACHE_KEY, payload, TTL_6H);
    await setCache(CACHE_KEY, payload);
    res.json(payload);
  } catch (err) {
    console.error('[/genius/credits] ERROR:', err.message ?? err);
    res.status(500).json({ error: err.message ?? 'Internal server error' });
  }
});

// ── GET /spotify/album/:id/tracks ────────────────────────────────────────────
// Returns the full tracklist for an album.

app.get('/spotify/album/:id/tracks', async (req, res) => {
  const { id } = req.params;
  const CACHE_KEY = `spotify_album_tracks_${id}`;

  const mem = cacheGet(CACHE_KEY);
  if (mem) return res.json(mem);

  const db = await getCached(CACHE_KEY, TTL_24H);
  if (db) { cacheSet(CACHE_KEY, db, TTL_6H); return res.json(db); }

  try {
    const data = await spotifyGet(`/albums/${id}/tracks?limit=50&market=US`);
    const tracks = (data.items ?? []).map(t => ({
      number: t.track_number,
      id: t.id,
      title: t.name,
      durationMs: t.duration_ms,
      featuredArtists: (t.artists ?? []).slice(1).map(a => a.name),
    }));
    cacheSet(CACHE_KEY, tracks, TTL_6H);
    await setCache(CACHE_KEY, tracks);
    res.json(tracks);
  } catch (err) {
    console.error('[/spotify/album/tracks]', err.message ?? err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /spotify/artist/:id/top-tracks ────────────────────────────────────────

app.get('/spotify/artist/:id/top-tracks', async (req, res) => {
  const { id } = req.params;
  const CACHE_KEY = `spotify_artist_top_tracks_${id}`;

  const mem = cacheGet(CACHE_KEY);
  if (mem) return res.json(mem);

  const db = await getCached(CACHE_KEY, TTL_24H);
  if (db) { cacheSet(CACHE_KEY, db, TTL_6H); return res.json(db); }

  try {
    const data = await spotifyGet(`/artists/${id}/top-tracks?market=US`);
    const tracks = (data.tracks ?? []).slice(0, 10).map((t, i) => ({
      number: i + 1,
      id: t.id,
      title: t.name,
      artworkUrl: t.album?.images?.[0]?.url ?? '',
      albumTitle: t.album?.name ?? '',
      durationMs: t.duration_ms,
    }));
    cacheSet(CACHE_KEY, tracks, TTL_6H);
    await setCache(CACHE_KEY, tracks);
    res.json(tracks);
  } catch (err) {
    console.error('[/spotify/artist/top-tracks]', err.message ?? err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /spotify/artist/:id/albums ────────────────────────────────────────────

app.get('/spotify/artist/:id/albums', async (req, res) => {
  const { id } = req.params;
  const CACHE_KEY = `spotify_artist_albums_${id}`;

  const mem = cacheGet(CACHE_KEY);
  if (mem) return res.json(mem);

  const db = await getCached(CACHE_KEY, TTL_24H);
  if (db) { cacheSet(CACHE_KEY, db, TTL_6H); return res.json(db); }

  try {
    const data = await spotifyGet(`/artists/${id}/albums?include_groups=album,single&market=US&limit=20`);
    const albums = (data.items ?? []).map(item => ({
      id: item.id,
      title: item.name,
      artworkUrl: item.images?.[0]?.url ?? '',
      year: parseInt(item.release_date?.slice(0, 4) ?? '0', 10),
      type: item.album_group ?? 'album',
    }));
    cacheSet(CACHE_KEY, albums, TTL_6H);
    await setCache(CACHE_KEY, albums);
    res.json(albums);
  } catch (err) {
    console.error('[/spotify/artist/albums]', err.message ?? err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /spotify/recommendations — ?trackIds=id1&trackIds=id2&excludeAlbumId=id ─
// Seeds Spotify recommendations with up to 2 track IDs. Extracts unique albums
// from the returned tracks, excluding the source album. Returns [] silently if
// the endpoint is unavailable (deprecated in some markets / app tiers).

app.get('/spotify/recommendations', async (req, res) => {
  const rawIds = req.query.trackIds ?? [];
  const trackIds = (Array.isArray(rawIds) ? rawIds : [rawIds]).filter(Boolean).slice(0, 2);
  const excludeAlbumId = (req.query.excludeAlbumId ?? '').trim();

  if (!trackIds.length) return res.status(400).json({ error: 'trackIds required' });

  const CACHE_KEY = `spotify_recs_${trackIds.join('_')}_excl_${excludeAlbumId}`;

  const mem = cacheGet(CACHE_KEY);
  if (mem) { console.log('[/spotify/recommendations] cache hit (memory)'); return res.json(mem); }

  const db = await getCached(CACHE_KEY, TTL_24H);
  if (db) { console.log('[/spotify/recommendations] cache hit (db)'); cacheSet(CACHE_KEY, db, TTL_6H); return res.json(db); }

  try {
    const seeds = trackIds.join(',');
    console.log(`[/spotify/recommendations] seed_tracks=${seeds} excludeAlbum=${excludeAlbumId}`);
    const data = await spotifyGet(`/recommendations?seed_tracks=${seeds}&limit=12&market=US`);

    const seen = new Set([excludeAlbumId].filter(Boolean));
    const albums = [];
    for (const track of (data.tracks ?? [])) {
      const alb = track.album;
      if (!alb || seen.has(alb.id)) continue;
      seen.add(alb.id);
      albums.push({
        id:         alb.id,
        title:      alb.name,
        artist:     alb.artists?.[0]?.name ?? '',
        artworkUrl: alb.images?.[0]?.url ?? '',
        year:       parseInt(alb.release_date?.slice(0, 4) ?? '0', 10),
      });
    }

    const result = albums.slice(0, 8);
    console.log(`[/spotify/recommendations] returning ${result.length} albums`);
    cacheSet(CACHE_KEY, result, TTL_6H);
    await setCache(CACHE_KEY, result);
    res.json(result);
  } catch (err) {
    // Recommendations may return 403 on some Spotify tiers — return empty so
    // the frontend simply hides the section rather than showing an error.
    console.warn('[/spotify/recommendations] failed:', err.message ?? err);
    res.json([]);
  }
});

// ── GET /refresh ──────────────────────────────────────────────────────────────

app.get('/refresh', async (req, res) => {
  try {
    await runRefresh();
    cacheClear('home', 'genres', 'decades',
               'discover:new-releases', 'discover:popular', 'discover:coming-soon');
    console.log('[/refresh] Cache cleared after refresh.');
    res.json({ success: true });
  } catch (err) {
    console.error('[/refresh]', err.message ?? err);
    res.status(500).json({ success: false, error: err.message ?? 'Refresh failed' });
  }
});

// ── Cron: refresh every 6 hours ───────────────────────────────────────────────

cron.schedule('0 */6 * * *', () => {
  console.log('[cron] Triggering scheduled refresh...');
  runRefresh().then(() => {
    cacheClear('home', 'genres', 'decades',
               'discover:new-releases', 'discover:popular', 'discover:coming-soon');
    console.log('[cron] Cache cleared after refresh.');
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Listend server listening on port ${PORT}`);
});
