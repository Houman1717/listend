// v2 - cache bust restart
// listend backend server
require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const supabase = require('./db');
const { runRefresh, refreshHomeArtists } = require('./refresh');
const { getCached, setCache, deleteCache, deleteCachePrefix, TTL_24H, TTL_7D } = require('./cache');
const generateAppleToken = require('./utils/appleToken');

async function amFetch(path) {
  const resp = await fetch(`https://api.music.apple.com/v1${path}`, {
    headers: { Authorization: `Bearer ${generateAppleToken()}` },
  });
  if (!resp.ok) throw new Error(`Apple Music ${path} → ${resp.status}`);
  return resp.json();
}

const amArtwork = raw => (raw?.url ?? '').replace('{w}x{h}', '500x500');

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
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Parse JSON bodies — limit raised to 10 MB to handle base64-encoded images
app.use(express.json({ limit: '10mb' }));

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
        releaseDate: r.year ? String(r.year) : undefined,
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
    const amType = type === 'album' ? 'albums' : type === 'track' ? 'songs' : 'artists';
    const url = `https://api.music.apple.com/v1/catalog/us/search?term=${encodeURIComponent(q)}&types=${amType}&limit=10`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${generateAppleToken()}` },
    });
    if (!resp.ok) throw new Error(`Apple Music search → ${resp.status}`);
    const data = await resp.json();

    const artworkUrl = raw => (raw?.url ?? '').replace('{w}x{h}', '500x500');

    let results;
    if (type === 'album') {
      results = (data.results?.albums?.data ?? []).map(item => ({
        id: item.id,
        title: item.attributes?.name ?? '',
        artist: item.attributes?.artistName ?? '',
        year: parseInt(item.attributes?.releaseDate?.slice(0, 4) ?? '0', 10),
        artworkUrl: artworkUrl(item.attributes?.artwork),
      }));
    } else if (type === 'track') {
      results = (data.results?.songs?.data ?? []).map(item => ({
        id: item.id,
        title: item.attributes?.name ?? '',
        artist: item.attributes?.artistName ?? '',
        artworkUrl: artworkUrl(item.attributes?.artwork),
        releaseDate: item.attributes?.releaseDate?.slice(0, 4) ?? '',
      }));
    } else {
      results = (data.results?.artists?.data ?? []).map(item => ({
        id: item.id,
        name: item.attributes?.name ?? '',
        genre: item.attributes?.genreNames?.[0] ?? '',
        artworkUrl: artworkUrl(item.attributes?.artwork),
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
    const year = new Date().getFullYear();
    const data = await amFetch(`/catalog/us/search?term=${encodeURIComponent(`new releases ${year}`)}&types=albums&limit=10`);
    const results = (data.results?.albums?.data ?? []).map(item => ({
      id: item.id,
      title: item.attributes?.name ?? '',
      artist: item.attributes?.artistName ?? '',
      year: parseInt(item.attributes?.releaseDate?.slice(0, 4) ?? '0', 10),
      artworkUrl: amArtwork(item.attributes?.artwork),
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
    const data = await amFetch(`/catalog/us/search?term=${encodeURIComponent(`best albums ${year}`)}&types=albums&limit=10`);
    const results = (data.results?.albums?.data ?? []).map(item => ({
      id: item.id,
      title: item.attributes?.name ?? '',
      artist: item.attributes?.artistName ?? '',
      year: parseInt(item.attributes?.releaseDate?.slice(0, 4) ?? '0', 10),
      artworkUrl: amArtwork(item.attributes?.artwork),
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
    const data = await amFetch(`/catalog/us/search?term=${encodeURIComponent(`coming soon ${year}`)}&types=albums&limit=10`);
    const results = (data.results?.albums?.data ?? []).map(item => ({
      id: item.id,
      title: item.attributes?.name ?? '',
      artist: item.attributes?.artistName ?? '',
      year: parseInt(item.attributes?.releaseDate?.slice(0, 4) ?? '0', 10),
      artworkUrl: amArtwork(item.attributes?.artwork),
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
  const bust = req.query.bust === '1';
  if (!artistName) return res.status(400).json({ error: 'artist query param required' });

  console.log(`[/lastfm/artist] artist="${artistName}" bust=${bust} LASTFM_API_KEY=${process.env.LASTFM_API_KEY ? 'set' : 'MISSING'}`);

  const CACHE_KEY = `lastfm_artist_${artistName.toLowerCase()}`;

  if (!bust) {
    const mem = cacheGet(CACHE_KEY);
    if (mem) { console.log(`[/lastfm/artist] cache hit (memory)`); return res.json(mem); }

    const db = await getCached(CACHE_KEY, TTL_7D);
    if (db) { console.log(`[/lastfm/artist] cache hit (db)`); cacheSet(CACHE_KEY, db, TTL_6H); return res.json(db); }
  }

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

    // Fetch Apple Music images for each similar artist — allSettled so one failure doesn't break the list
    const similarRaw = a.similar?.artist ?? [];
    const imageResults = await Promise.allSettled(
      similarRaw.map(async (s, i) => {
        const q = encodeURIComponent(s.name);
        const sr = await amFetch(`/catalog/us/search?term=${q}&types=artists&limit=1`);
        const hit = sr.results?.artists?.data?.[0];
        if (i === 0) {
          console.log(`[/lastfm/artist] first similar artist Apple Music result (${s.name}):`, JSON.stringify(hit));
        }
        const imageUrl = amArtwork(hit?.attributes?.artwork) || null;
        console.log(`[/lastfm/artist] similar artist "${s.name}" imageUrl: ${imageUrl}`);
        return { name: s.name, url: s.url, imageUrl };
      })
    );
    const similarWithImages = imageResults.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      console.warn(`[/lastfm/artist] Apple Music image lookup failed for "${similarRaw[i]?.name}":`, r.reason?.message);
      return { name: similarRaw[i].name, url: similarRaw[i].url, imageUrl: null };
    });

    const payload = {
      name: a.name,
      listeners: parseInt(a.stats?.listeners ?? '0', 10),
      bio: a.bio?.summary ?? '',
      tags: (a.tags?.tag ?? []).map(t => t.name),
      similar: similarWithImages,
    };

    console.log(`[/lastfm/artist] success — ${payload.listeners} listeners, ${payload.tags.length} tags, ${payload.similar.length} similar`);
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

// ── GET /spotify/track/:id ────────────────────────────────────────────────────
// Returns a single track's release date and basic info.

app.get('/spotify/track/:id', async (req, res) => {
  const { id } = req.params;
  if (!id || id === 'undefined') {
    return res.status(400).json({ error: 'track id is required' });
  }
  const CACHE_KEY = `spotify_track_${id}`;

  const mem = cacheGet(CACHE_KEY);
  if (mem) return res.json(mem);

  const db = await getCached(CACHE_KEY, TTL_24H);
  if (db) { cacheSet(CACHE_KEY, db, TTL_6H); return res.json(db); }

  try {
    const data = await amFetch(`/catalog/us/songs/${id}`);
    const t = data.data?.[0];
    const payload = {
      id:          t?.id ?? id,
      title:       t?.attributes?.name ?? '',
      artist:      t?.attributes?.artistName ?? '',
      artworkUrl:  amArtwork(t?.attributes?.artwork),
      albumId:     t?.relationships?.albums?.data?.[0]?.id ?? '',
      releaseDate: t?.attributes?.releaseDate ?? '',
    };
    cacheSet(CACHE_KEY, payload, TTL_6H);
    await setCache(CACHE_KEY, payload);
    res.json(payload);
  } catch (err) {
    console.error('[/spotify/track]', err.message ?? err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/spotify/album/:id/tracks', async (req, res) => {
  const { id } = req.params;
  const CACHE_KEY = `spotify_album_tracks_${id}`;

  const mem = cacheGet(CACHE_KEY);
  if (mem) return res.json(mem);

  const db = await getCached(CACHE_KEY, TTL_24H);
  if (db) { cacheSet(CACHE_KEY, db, TTL_6H); return res.json(db); }

  try {
    const data = await amFetch(`/catalog/us/albums/${id}/tracks`);
    const tracks = (data.data ?? []).map((t, i) => ({
      number: t.attributes?.trackNumber ?? i + 1,
      id: t.id,
      title: t.attributes?.name ?? '',
      durationMs: t.attributes?.durationInMillis ?? null,
      featuredArtists: [],
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
// Workaround for dev-mode 403 on /artists/{id}/top-tracks:
// 1. Resolve artist name via Spotify GET /artists/{id}
// 2. Fetch top tracks from Last.fm artist.gettoptracks

app.get('/spotify/artist/:id/top-tracks', async (req, res) => {
  const { id } = req.params;
  const bust = req.query.bust === '1';
  console.log(`[/spotify/artist/top-tracks] ── START id="${id}" bust=${bust}`);

  if (!id || id === 'undefined') {
    return res.status(400).json({ error: 'artist id is required and must not be "undefined"' });
  }

  const CACHE_KEY = `spotify_artist_top_tracks_${id}`;

  try {
    if (!bust) {
      const mem = cacheGet(CACHE_KEY);
      if (mem) { console.log('[/spotify/artist/top-tracks] cache hit (memory)'); return res.json(mem); }

      const db = await getCached(CACHE_KEY, TTL_24H);
      if (db) { console.log('[/spotify/artist/top-tracks] cache hit (db)'); cacheSet(CACHE_KEY, db, TTL_6H); return res.json(db); }
    }

    // Step 1: resolve artist name from Apple Music
    console.log(`[/spotify/artist/top-tracks] resolving artist name for id="${id}"`);
    const artistData = await amFetch(`/catalog/us/artists/${id}`);
    const artistName = artistData.data?.[0]?.attributes?.name ?? '';
    console.log(`[/spotify/artist/top-tracks] artist name="${artistName}"`);

    // Step 2: fetch top tracks from Last.fm
    const lfmUrl =
      `http://ws.audioscrobbler.com/2.0/?method=artist.gettoptracks` +
      `&artist=${encodeURIComponent(artistName)}` +
      `&api_key=${process.env.LASTFM_API_KEY}` +
      `&format=json&limit=5`;
    console.log(`[/spotify/artist/top-tracks] calling Last.fm artist.gettoptracks for "${artistName}"`);
    const lfmResp = await fetch(lfmUrl);
    console.log(`[/spotify/artist/top-tracks] Last.fm HTTP status: ${lfmResp.status}`);
    if (!lfmResp.ok) {
      const body = await lfmResp.text().catch(() => '');
      throw new Error(`Last.fm artist.gettoptracks → ${lfmResp.status}: ${body}`);
    }
    const lfmData = await lfmResp.json();
    const rawTracks = (lfmData.toptracks?.track ?? []).slice(0, 5);

    // Step 3: fetch artwork for each track via Apple Music search (two-pass fallback)
    const results = await Promise.allSettled(
      rawTracks.map(async (t, i) => {
        let artworkUrl = null;
        let albumTitle = null;
        // Pass 1: precise — track + artist
        try {
          const q1 = encodeURIComponent(`${t.name} ${artistName}`);
          const sr1 = await amFetch(`/catalog/us/search?term=${q1}&types=songs&limit=1`);
          const hit1 = sr1.results?.songs?.data?.[0];
          artworkUrl = amArtwork(hit1?.attributes?.artwork) || null;
          albumTitle = hit1?.attributes?.albumName ?? null;
        } catch (e) {
          console.warn(`[/spotify/artist/top-tracks] pass-1 artwork lookup failed for "${t.name}":`, e.message);
        }
        // Pass 2: track name only fallback
        if (!artworkUrl) {
          try {
            const q2 = encodeURIComponent(t.name);
            const sr2 = await amFetch(`/catalog/us/search?term=${q2}&types=songs&limit=1`);
            const hit2 = sr2.results?.songs?.data?.[0];
            artworkUrl = amArtwork(hit2?.attributes?.artwork) || null;
            albumTitle = albumTitle ?? hit2?.attributes?.albumName ?? null;
          } catch (e) {
            console.warn(`[/spotify/artist/top-tracks] pass-2 artwork lookup failed for "${t.name}":`, e.message);
          }
        }
        return {
          number:     i + 1,
          id:         t.mbid || t.url || `${artistName}-${i}`,
          title:      t.name ?? null,
          artworkUrl,
          albumTitle,
          durationMs: t.duration ? parseInt(t.duration, 10) * 1000 : null,
        };
      })
    );
    const tracks = results.map((r, i) =>
      r.status === 'fulfilled'
        ? r.value
        : { number: i + 1, id: `${artistName}-${i}`, title: rawTracks[i]?.name ?? null, artworkUrl: null, albumTitle: null, durationMs: null }
    );

    console.log(`[/spotify/artist/top-tracks] success — ${tracks.length} tracks`);
    cacheSet(CACHE_KEY, tracks, TTL_6H);
    await setCache(CACHE_KEY, tracks);
    res.json(tracks);
  } catch (err) {
    const msg = err.message ?? String(err);
    console.error('[/spotify/artist/top-tracks] ERROR:', msg);
    console.error('[/spotify/artist/top-tracks] STACK:', err.stack);
    res.status(500).json({ error: msg });
  }
});

// ── GET /spotify/artist/:id/albums ────────────────────────────────────────────
// Returns discography grouped by type: { albums, singles, compilations }.
// Uses /artists/{id}/albums which is available in Spotify dev mode.

app.get('/spotify/artist/:id/albums', async (req, res) => {
  const { id } = req.params;
  const bust = req.query.bust === '1';
  console.log(`[/spotify/artist/albums] ── START id="${id}" bust=${bust}`);

  if (!id || id === 'undefined') {
    return res.status(400).json({ error: 'artist id is required and must not be "undefined"' });
  }

  const CACHE_KEY = `spotify_artist_albums_${id}`;

  try {
    if (!bust) {
      const mem = cacheGet(CACHE_KEY);
      if (mem) { console.log('[/spotify/artist/albums] cache hit (memory)'); return res.json(mem); }

      const db = await getCached(CACHE_KEY, TTL_24H);
      if (db) { console.log('[/spotify/artist/albums] cache hit (db)'); cacheSet(CACHE_KEY, db, TTL_6H); return res.json(db); }
    }

    const toItem = item => {
      const attrs = item.attributes ?? {};
      return {
        id:            item.id,
        title:         attrs.name ?? '',
        artworkUrl:    amArtwork(attrs.artwork),
        year:          parseInt(attrs.releaseDate?.slice(0, 4) ?? '0', 10),
        isSingle:      attrs.isSingle      ?? null,
        isCompilation: attrs.isCompilation ?? null,
        trackCount:    attrs.trackCount    ?? null,
        url:           attrs.url           ?? '',
        type:          (attrs.albumType ?? '').toLowerCase() || 'unknown',
      };
    };

    // Strip parenthetical suffixes for deduplication key only
    const VARIANT_SUFFIX_RE = /\s*[\(\[].*[\)\]]\s*$/i;

    const baseTitle = title => title.replace(VARIANT_SUFFIX_RE, '').trim().toLowerCase();

    // Keywords anywhere in the title that mark a non-album release
    const TITLE_EXCLUDE_RE = /\b(singles?|ep|live|session|acoustic|acapella|a cappella|remixes?|edit|remaster(?:ed)?|version|instrumental|karaoke|concert|tour|performance|highlights?|collection|greatest\s+hits?|chopnotslop)\b|best\s+of\b|apple(?:\s+music)?\s+presents|chopped\s+not\s+slopped/i;

    // Titles that should always be included regardless of keyword filters
    const TITLE_ALLOWLIST = [
      'christmas carollll',
      'members only',
    ];
    const inAllowlist = title => TITLE_ALLOWLIST.some(t => title.toLowerCase().includes(t));

    const isAlbum = item => {
      if (inAllowlist(item.title)) return true;
      if (item.isSingle === true) return false;
      // Keep only large diverse compilations (e.g. Trilogy at 33 tracks).
      // Best-of / playlist compilations are typically < 30 tracks.
      if (item.isCompilation === true && (item.trackCount === null || item.trackCount < 30)) return false;
      // Real albums have at least 6 tracks; single bundles/EPs typically don't
      if (item.trackCount !== null && item.trackCount < 6) return false;
      if (item.url && item.url.toLowerCase().includes('/single/')) return false;
      // Reject if the title itself contains any version-indicator keyword
      if (TITLE_EXCLUDE_RE.test(item.title)) return false;
      return true;
    };

    let allItems = [];
    let nextPath = `/catalog/us/artists/${id}/albums?limit=25`;
    let page = 0;
    const PAGE_CAP = 5;
    while (nextPath && page < PAGE_CAP) {
      console.log(`[/spotify/artist/albums] fetching page ${page + 1}/${PAGE_CAP}: ${nextPath}`);
      try {
        const data = await amFetch(nextPath);
        if (page === 0 && data.data?.length) {
          data.data.slice(0, 3).forEach((item, i) => {
            const a = item.attributes ?? {};
            console.log(`[/spotify/artist/albums] item[${i}] attrs: name="${a.name}" isSingle=${a.isSingle} isCompilation=${a.isCompilation} trackCount=${a.trackCount} albumType="${a.albumType}" url="${a.url}"`);
          });
        }
        allItems = allItems.concat((data.data ?? []).map(toItem));
        nextPath = data.next ? data.next.replace('/v1', '') : null;
      } catch (pageErr) {
        console.warn(`[/spotify/artist/albums] page ${page + 1} failed, stopping pagination:`, pageErr.message);
        nextPath = null;
      }
      page++;
    }

    const filtered = allItems.filter(isAlbum);
    console.log(`[/spotify/artist/albums] fetched ${allItems.length} total → ${filtered.length} after isAlbum filter`);

    // Deduplicate by base title — keep the version without a parenthetical suffix;
    // break ties by preferring higher trackCount then earlier year.
    const dedupMap = new Map();
    for (const item of filtered) {
      const key = baseTitle(item.title);
      const existing = dedupMap.get(key);
      if (!existing) { dedupMap.set(key, item); continue; }
      // Prefer the title with no parenthetical (canonical version)
      const itemHasSuffix     = /[\(\[]/.test(item.title);
      const existingHasSuffix = /[\(\[]/.test(existing.title);
      if (!itemHasSuffix && existingHasSuffix) { dedupMap.set(key, item); continue; }
      if (itemHasSuffix && !existingHasSuffix) continue;
      // Both or neither have a suffix — prefer higher track count, then earlier year
      if ((item.trackCount ?? 0) > (existing.trackCount ?? 0)) { dedupMap.set(key, item); continue; }
      if (item.year < existing.year) { dedupMap.set(key, item); }
    }
    const albums = [...dedupMap.values()];
    console.log(`[/spotify/artist/albums] ${filtered.length} → ${albums.length} after dedup`);

    const grouped = { albums, singles: [], compilations: [] };

    console.log(`[/spotify/artist/albums] success — ${grouped.albums.length} albums`);
    cacheSet(CACHE_KEY, grouped, TTL_6H);
    await setCache(CACHE_KEY, grouped);
    res.json(grouped);
  } catch (err) {
    const msg = err.message ?? String(err);
    console.error('[/spotify/artist/albums] ERROR:', msg);
    console.error('[/spotify/artist/albums] STACK:', err.stack);
    res.status(500).json({ error: msg });
  }
});

// ── GET /spotify/recommendations — ?trackIds=id1&trackIds=id2&excludeAlbumId=id ─
// Uses Apple Music search on each seed track ID to find related albums.
// Returns [] silently on failure so the frontend simply hides the section.

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
    // Resolve each seed track ID to a title via Apple Music, then search for related albums
    const seen = new Set([excludeAlbumId].filter(Boolean));
    const albums = [];

    for (const trackId of trackIds) {
      try {
        const songData = await amFetch(`/catalog/us/songs/${trackId}`);
        const song = songData.data?.[0];
        if (!song) continue;
        const term = encodeURIComponent(`${song.attributes?.name ?? ''} ${song.attributes?.artistName ?? ''}`);
        const searchData = await amFetch(`/catalog/us/search?term=${term}&types=albums&limit=6`);
        for (const item of (searchData.results?.albums?.data ?? [])) {
          if (seen.has(item.id)) continue;
          seen.add(item.id);
          albums.push({
            id:         item.id,
            title:      item.attributes?.name ?? '',
            artist:     item.attributes?.artistName ?? '',
            artworkUrl: amArtwork(item.attributes?.artwork),
            year:       parseInt(item.attributes?.releaseDate?.slice(0, 4) ?? '0', 10),
          });
        }
      } catch (e) {
        console.warn(`[/spotify/recommendations] lookup failed for trackId=${trackId}:`, e.message);
      }
    }

    const result = albums.slice(0, 8);
    console.log(`[/spotify/recommendations] returning ${result.length} albums`);
    cacheSet(CACHE_KEY, result, TTL_6H);
    await setCache(CACHE_KEY, result);
    res.json(result);
  } catch (err) {
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

// ── GET /api/admin/refresh-home-artists ───────────────────────────────────────

app.get('/api/admin/refresh-home-artists', async (req, res) => {
  try {
    const artists = await refreshHomeArtists();
    cacheClear('home');
    await deleteCache('home');
    console.log('[/api/admin/refresh-home-artists] done, both caches cleared.');
    res.json({ success: true, count: artists.length, artists });
  } catch (err) {
    console.error('[/api/admin/refresh-home-artists]', err.message ?? err);
    res.status(500).json({ success: false, error: err.message ?? 'Refresh failed' });
  }
});

// ── GET /api/admin/purge-artist-album-cache ───────────────────────────────────

app.get('/api/admin/purge-artist-album-cache', async (req, res) => {
  try {
    for (const key of memCache.keys()) {
      if (key.startsWith('spotify_artist_albums_')) memCache.delete(key);
    }
    await deleteCachePrefix('spotify_artist_albums_');
    console.log('[/api/admin/purge-artist-album-cache] done.');
    res.json({ success: true });
  } catch (err) {
    console.error('[/api/admin/purge-artist-album-cache]', err.message ?? err);
    res.status(500).json({ success: false, error: err.message ?? 'Purge failed' });
  }
});

// ── GET /api/admin/purge-lastfm-cache ─────────────────────────────────────────

app.get('/api/admin/purge-lastfm-cache', async (req, res) => {
  try {
    // Clear all lastfm_artist_* keys from in-memory cache
    for (const key of memCache.keys()) {
      if (key.startsWith('lastfm_artist_')) memCache.delete(key);
    }
    // Clear from Supabase api_cache
    await deleteCachePrefix('lastfm_artist_');
    console.log('[/api/admin/purge-lastfm-cache] done.');
    res.json({ success: true });
  } catch (err) {
    console.error('[/api/admin/purge-lastfm-cache]', err.message ?? err);
    res.status(500).json({ success: false, error: err.message ?? 'Purge failed' });
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

// ── POST /api/upload-avatar ───────────────────────────────────────────────────
// Accepts { user_id, image_base64 }, uploads to the 'avatars' bucket using the
// service-role key (bypasses RLS), returns { url }.

app.post('/api/upload-avatar', async (req, res) => {
  const { user_id, image_base64 } = req.body;
  if (!user_id || !image_base64) {
    return res.status(400).json({ error: 'Missing user_id or image_base64' });
  }

  const path   = `${user_id}/avatar.jpg`;
  const buffer = Buffer.from(image_base64, 'base64');
  console.log(`[upload-avatar] user_id=${user_id} path=${path} bytes=${buffer.length}`);

  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, buffer, { contentType: 'image/jpeg', upsert: true });

  if (error) {
    console.error('[upload-avatar] storage error:', error);
    return res.status(500).json({ error: error.message });
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  const url = `${data.publicUrl}?t=${Date.now()}`;
  console.log(`[upload-avatar] success → ${url}`);
  return res.json({ url });
});

// ── POST /api/upload-cover ────────────────────────────────────────────────────
// Accepts { user_id, image_base64 }, uploads to the 'cover photos' bucket using
// the service-role key, returns { url }.

app.post('/api/upload-cover', async (req, res) => {
  const { user_id, image_base64 } = req.body;
  if (!user_id || !image_base64) {
    return res.status(400).json({ error: 'Missing user_id or image_base64' });
  }

  const path   = `${user_id}/cover.jpg`;
  const buffer = Buffer.from(image_base64, 'base64');
  console.log(`[upload-cover] user_id=${user_id} path=${path} bytes=${buffer.length}`);

  const { error } = await supabase.storage
    .from('cover photos')
    .upload(path, buffer, { contentType: 'image/jpeg', upsert: true });

  if (error) {
    console.error('[upload-cover] storage error:', error);
    return res.status(500).json({ error: error.message });
  }

  const { data } = supabase.storage.from('cover photos').getPublicUrl(path);
  const url = `${data.publicUrl}?t=${Date.now()}`;
  console.log(`[upload-cover] success → ${url}`);
  return res.json({ url });
});

// ── POST /api/delete-cover ────────────────────────────────────────────────────
// Accepts { user_id }, removes the user's cover.jpg from the 'cover photos'
// bucket using the service-role key (bypasses RLS).

app.post('/api/delete-cover', async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) {
    return res.status(400).json({ error: 'Missing user_id' });
  }

  const path = `${user_id}/cover.jpg`;
  console.log(`[delete-cover] user_id=${user_id} path=${path}`);

  const { error } = await supabase.storage
    .from('cover photos')
    .remove([path]);

  if (error) {
    console.error('[delete-cover] storage error:', error);
    return res.status(500).json({ error: error.message });
  }

  console.log(`[delete-cover] success → ${path} removed`);
  return res.json({ success: true });
});

// ── GET /apple-token ──────────────────────────────────────────────────────────

app.get('/apple-token', (req, res) => {
  res.json({ token: generateAppleToken() });
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Listend server listening on port ${PORT}`);
});
