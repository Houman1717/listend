// v2 - cache bust restart
// listend backend server
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { query, param, body, validationResult } = require('express-validator');
const cron = require('node-cron');
const supabase = require('./db');
const { runRefresh, refreshHomeArtists } = require('./refresh');
const { getCached, setCache, deleteCache, deleteCachePrefix, TTL_24H, TTL_7D } = require('./cache');
const generateAppleToken = require('./utils/appleToken');
const { GENRE_ALBUMS } = require('./genreData');
const { DECADE_ALBUMS } = require('./decadeData');
const { FEATURED_PLAYLIST_META, PLAYLIST_ALBUMS } = require('./featuredPlaylistsData');

async function amFetch(path) {
  const resp = await fetch(`https://api.music.apple.com/v1${path}`, {
    headers: { Authorization: `Bearer ${generateAppleToken()}` },
  });
  if (!resp.ok) throw new Error(`Apple Music ${path} → ${resp.status}`);
  return resp.json();
}

const amArtwork = raw => (raw?.url ?? '').replace('{w}x{h}', '500x500');

const app = express();
app.set('trust proxy', 1); // Railway sits behind a proxy
const PORT = process.env.PORT || 8080;

// ── Security headers ───────────────────────────────────────────────────────────
app.use(helmet());

// ── Rate limiting — 100 req / 15 min per IP ───────────────────────────────────
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
}));

// ── Kill switch ───────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  if (process.env.KILL_SWITCH === 'true') {
    return res.status(503).json({ error: 'The app is temporarily unavailable for maintenance.' });
  }
  next();
});

// ── Startup env check ─────────────────────────────────────────────────────────
const REQUIRED_VARS = ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'LASTFM_API_KEY', 'GENIUS_ACCESS_TOKEN'];
for (const v of REQUIRED_VARS) {
  if (!process.env[v]) console.warn(`[startup] WARNING: env var ${v} is not set`);
  else console.log(`[startup] ${v}: set ✓`);
}

// ── In-memory response cache ───────────────────────────────────────────────────

const memCache = new Map();

const TTL_6H  = 6  * 60 * 60 * 1000;
const TTL_1H  = 1  * 60 * 60 * 1000;
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

// ── CORS ───────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://listend-production.up.railway.app',
  'http://localhost:8081',
  'http://localhost:3000',
];
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Parse JSON bodies — limit raised to 10 MB to handle base64-encoded images
app.use(express.json({ limit: '10mb' }));

// ── Auth middleware ────────────────────────────────────────────────────────────
// Verifies the Supabase JWT from the Authorization header and attaches req.user.

async function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const { data: { user }, error } = await supabase.auth.getUser(auth.slice(7));
  if (error || !user) return res.status(401).json({ error: 'Invalid or expired token' });
  req.user = user;
  next();
}

// ── Admin middleware ───────────────────────────────────────────────────────────
// Guards ops/admin routes with a static secret sent as X-Admin-Secret header.
// Set ADMIN_SECRET in Railway env vars.

function requireAdmin(req, res, next) {
  const secret = req.headers['x-admin-secret'];
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

// ── Input sanitization helpers ────────────────────────────────────────────────

const stripHtml = v => (typeof v === 'string' ? v.replace(/<[^>]*>/g, '') : v);

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
}

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
    // TODO: swap chartAlbums to a Supabase query once real user listening data exists
    const [chartData, songsRes, artistsRes] = await Promise.all([
      amFetch('/catalog/us/charts?types=albums&limit=10'),
      supabase.from('home_songs').select('*').order('updated_at', { ascending: false }).limit(10),
      supabase.from('home_artists').select('*').order('updated_at', { ascending: false }).limit(8),
    ]);

    if (songsRes.error) throw songsRes.error;
    if (artistsRes.error) throw artistsRes.error;

    const chartAlbums = (chartData?.results?.albums?.[0]?.data ?? []).map(item => {
      const attrs = item.attributes ?? {};
      return {
        id:         item.id,
        title:      attrs.name ?? '',
        artist:     attrs.artistName ?? '',
        artworkUrl: amArtwork(attrs.artwork),
        year:       parseInt(attrs.releaseDate?.slice(0, 4) ?? '0', 10),
      };
    });

    const payload = {
      albums: chartAlbums,
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
  const allGenreKeys = Object.keys(GENRE_ALBUMS);

  const mem = cacheGet(CACHE_KEY);
  if (mem && allGenreKeys.every(g => mem[g])) return res.json(mem);

  const db = await getCached(CACHE_KEY, TTL_24H);
  if (db && allGenreKeys.every(g => db[g])) { cacheSet(CACHE_KEY, db, TTL_6H); return res.json(db); }

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

    // Auto-seed any genres defined in genreData.js that aren't in the DB yet.
    const missingGenres = Object.keys(GENRE_ALBUMS).filter(g => !grouped[g]);
    if (missingGenres.length > 0) {
      console.log('[/genres] auto-seeding missing genres:', missingGenres);
      // Fire-and-forget: seed in background, don't block this response.
      (async () => {
        for (const genre of missingGenres) {
          const albums = GENRE_ALBUMS[genre];
          for (let i = 0; i < albums.length; i += 4) {
            const batch = albums.slice(i, i + 4);
            await Promise.all(batch.map(async ({ artist, title }) => {
              try {
                const q    = encodeURIComponent(`${artist} ${title}`);
                const data = await amFetch(`/catalog/us/search?term=${q}&types=albums&limit=1`);
                const item = data.results?.albums?.data?.[0];
                if (!item) return;
                const artworkUrl = amArtwork(item.attributes?.artwork);
                const year       = parseInt(item.attributes?.releaseDate?.slice(0, 4) ?? '0', 10);
                await supabase.from('genre_albums').upsert({
                  genre_label: genre,
                  spotify_id:  item.id,
                  title:       item.attributes?.name    ?? title,
                  artist:      item.attributes?.artistName ?? artist,
                  artwork_url: artworkUrl,
                  year,
                }, { onConflict: 'genre_label,spotify_id', ignoreDuplicates: true });
              } catch (e) {
                console.error(`[/genres] auto-seed error ${genre} — ${artist} ${title}:`, e.message);
              }
            }));
            await new Promise(r => setTimeout(r, 500));
          }
          console.log(`[/genres] auto-seeded: ${genre}`);
        }
        // Bust cache so next request picks up newly seeded genres.
        cacheClear('genres');
        await deleteCache('genres');
      })();
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

app.get('/search', [
  query('q').trim().customSanitizer(stripHtml).isLength({ max: 200 }).withMessage('q must be 200 characters or fewer'),
  query('type').trim(),
  validate,
], async (req, res) => {
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
    const data = await amFetch('/catalog/us/charts?types=albums&chart=most-played&limit=20');
    const results = (data.results?.albums?.[0]?.data ?? []).map(item => ({
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
// Hardcoded list of 48 widely-streamed albums searched via Apple Music catalog.

const POPULAR_ALBUMS = [
  { artist: 'Bad Bunny',        title: 'Un Verano Sin Ti' },
  { artist: 'The Weeknd',       title: 'Starboy' },
  { artist: 'Ed Sheeran',       title: '÷' },
  { artist: 'Olivia Rodrigo',   title: 'SOUR' },
  { artist: 'The Weeknd',       title: 'After Hours' },
  { artist: 'SZA',              title: 'SOS' },
  { artist: 'Post Malone',      title: "Hollywood's Bleeding" },
  { artist: 'Taylor Swift',     title: 'Lover' },
  { artist: 'Arctic Monkeys',   title: 'AM' },
  { artist: 'Billie Eilish',    title: 'WHEN WE ALL FALL ASLEEP, WHERE DO WE GO?' },
  { artist: 'Dua Lipa',         title: 'Future Nostalgia' },
  { artist: 'Post Malone',      title: 'beerbongs & bentleys' },
  { artist: 'XXXTENTACION',     title: '?' },
  { artist: 'Karol G',          title: 'MAÑANA SERÁ BONITO' },
  { artist: 'Bad Bunny',        title: 'YHLQMDLG' },
  { artist: 'Bruno Mars',       title: "Doo-Wops & Hooligans" },
  { artist: 'Drake',            title: 'Views' },
  { artist: 'Taylor Swift',     title: 'Midnights' },
  { artist: 'Drake',            title: 'Scorpion' },
  { artist: 'The Weeknd',       title: 'Beauty Behind The Madness' },
  { artist: 'Taylor Swift',     title: 'folklore' },
  { artist: 'Travis Scott',     title: 'ASTROWORLD' },
  { artist: 'Harry Styles',     title: 'Fine Line' },
  { artist: 'Justin Bieber',    title: 'Purpose' },
  { artist: 'Ed Sheeran',       title: 'x' },
  { artist: 'Juice WRLD',       title: 'Goodbye & Good Riddance' },
  { artist: 'Lana Del Rey',     title: 'Born to Die' },
  { artist: 'Taylor Swift',     title: 'reputation' },
  { artist: 'Lewis Capaldi',    title: 'Divinely Uninspired To A Hellish Extent' },
  { artist: 'Kendrick Lamar',   title: 'DAMN.' },
  { artist: 'Sam Smith',        title: 'In The Lonely Hour' },
  { artist: 'XXXTENTACION',     title: '17' },
  { artist: 'Billie Eilish',    title: "don't smile at me" },
  { artist: 'Taylor Swift',     title: '1989' },
  { artist: 'Ariana Grande',    title: 'thank u, next' },
  { artist: 'Harry Styles',     title: "Harry's House" },
  { artist: 'Dua Lipa',         title: 'Dua Lipa' },
  { artist: 'Imagine Dragons',  title: 'Evolve' },
  { artist: 'Post Malone',      title: 'Stoney' },
  { artist: 'Khalid',           title: 'American Teen' },
  { artist: 'Ariana Grande',    title: 'Dangerous Woman' },
  { artist: 'J Balvin',         title: 'Vibras' },
  { artist: 'Maroon 5',         title: 'V' },
  { artist: 'The Chainsmokers', title: 'Collage' },
  { artist: 'Hozier',           title: 'Hozier' },
  { artist: 'One Direction',    title: 'Midnight Memories' },
  { artist: 'Shawn Mendes',     title: 'Illuminate' },
  { artist: '21 Savage',        title: 'i am > i was' },
];

app.get('/discover/popular', async (req, res) => {
  const CACHE_KEY = 'discover:popular';

  const mem = cacheGet(CACHE_KEY);
  if (mem) return res.json(mem);

  const db = await getCached(CACHE_KEY, TTL_7D);
  if (db) { cacheSet(CACHE_KEY, db, TTL_6H); return res.json(db); }

  try {
    const results = [];
    const BATCH = 4, DELAY = 500;

    for (let i = 0; i < POPULAR_ALBUMS.length; i += BATCH) {
      const batch = POPULAR_ALBUMS.slice(i, i + BATCH);
      const fetched = await Promise.all(batch.map(async ({ artist, title }) => {
        try {
          const q = encodeURIComponent(`${artist} ${title}`);
          const data = await amFetch(`/catalog/us/search?types=albums&term=${q}&limit=5`);
          const albums = data?.results?.albums?.data ?? [];
          const match = albums.find(a =>
            a.attributes?.name?.toLowerCase() === title.toLowerCase()
          ) ?? albums.find(a =>
            a.attributes?.name?.toLowerCase().includes(title.toLowerCase().slice(0, 8))
          ) ?? albums[0];
          if (!match) return null;
          return {
            id:         match.id,
            title:      match.attributes?.name ?? title,
            artist:     match.attributes?.artistName ?? artist,
            year:       parseInt(match.attributes?.releaseDate?.slice(0, 4) ?? '0', 10),
            artworkUrl: amArtwork(match.attributes?.artwork),
          };
        } catch { return null; }
      }));
      results.push(...fetched.filter(Boolean));
      if (i + BATCH < POPULAR_ALBUMS.length) await new Promise(r => setTimeout(r, DELAY));
    }

    cacheSet(CACHE_KEY, results, TTL_6H);
    await setCache(CACHE_KEY, results);
    res.json(results);
  } catch (err) {
    console.error('[/discover/popular]', err.message ?? err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /discover/coming-soon ─────────────────────────────────────────────────
// Pulls Apple Music's top-pre-adds chart (covers top pre-adds, coming this week,
// coming next week, and editor's picks in one ranked feed).
// Cached 6 h in-memory, 7 days in Supabase — weekly cron busts it every Monday.

app.get('/discover/coming-soon', async (req, res) => {
  const CACHE_KEY = 'discover:coming-soon';

  const mem = cacheGet(CACHE_KEY);
  if (mem) return res.json(mem);

  const db = await getCached(CACHE_KEY, TTL_7D);
  if (db) { cacheSet(CACHE_KEY, db, TTL_6H); return res.json(db); }

  try {
    // Fetch pre-adds and upcoming new releases in parallel then deduplicate.
    const [preAdds, newReleases] = await Promise.allSettled([
      amFetch('/catalog/us/charts?types=albums&chart=top-pre-adds&limit=30'),
      amFetch('/catalog/us/charts?types=albums&chart=most-played&limit=20'),
    ]);

    const normalize = item => ({
      id:         item.id,
      title:      item.attributes?.name ?? '',
      artist:     item.attributes?.artistName ?? '',
      year:       parseInt(item.attributes?.releaseDate?.slice(0, 4) ?? '0', 10),
      artworkUrl: amArtwork(item.attributes?.artwork),
    });

    const seen    = new Set();
    const results = [];

    const addItems = items => {
      for (const item of items) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          results.push(normalize(item));
        }
      }
    };

    if (preAdds.status === 'fulfilled') {
      addItems(preAdds.value?.results?.albums?.[0]?.data ?? []);
    }
    if (newReleases.status === 'fulfilled') {
      addItems(newReleases.value?.results?.albums?.[0]?.data ?? []);
    }

    cacheSet(CACHE_KEY, results, TTL_6H);
    await setCache(CACHE_KEY, results);
    res.json(results);
  } catch (err) {
    console.error('[/discover/coming-soon]', err.message ?? err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /discover/classics ────────────────────────────────────────────────────

// 48 all-time classic albums — Apple Music catalog IDs in list order
const CLASSIC_IDS = [
  268443092,   // Kind of Blue – Miles Davis
  1538081586,  // What's Going On – Marvin Gaye
  1065973699,  // The Dark Side of the Moon – Pink Floyd
  1441164426,  // Abbey Road – The Beatles
  1440788438,  // Songs in the Key of Life – Stevie Wonder
  594061854,   // Rumours – Fleetwood Mac
  1039796877,  // The Rise and Fall of Ziggy Stardust – David Bowie
  1746833068,  // Purple Rain – Prince
  269572838,   // Thriller – Michael Jackson
  1492263092,  // Blue – Joni Mitchell
  1440851613,  // The Velvet Underground & Nico – The Velvet Underground
  1440841241,  // Pet Sounds – The Beach Boys
  684811762,   // London Calling – The Clash
  1440783617,  // Nevermind – Nirvana
  1276760743,  // The Miseducation of Lauryn Hill – Lauryn Hill
  580708175,   // Led Zeppelin IV – Led Zeppelin
  201281514,   // Highway 61 Revisited – Bob Dylan
  1440713018,  // A Love Supreme – John Coltrane
  1422677780,  // Back to Black – Amy Winehouse
  1440828886,  // To Pimp a Butterfly – Kendrick Lamar
  1097861387,  // OK Computer – Radiohead
  800092985,   // The Queen Is Dead – The Smiths
  1377813284,  // Appetite for Destruction – Guns N' Roses
  310730204,   // Born to Run – Bruce Springsteen
  324127933,   // Bridge Over Troubled Water – Simon & Garfunkel
  697194953,   // Discovery – Daft Punk
  186166282,   // Off the Wall – Michael Jackson
  1440872228,  // Exile on Main St. – The Rolling Stones
  1039798000,  // Hunky Dory – David Bowie
  1440806790,  // Innervisions – Stevie Wonder
  1441164670,  // Revolver – The Beatles
  1443155637,  // The Joshua Tree – U2
  212852926,   // Sign o' the Times – Prince
  204669326,   // Ready to Die – The Notorious B.I.G.
  1065975633,  // The Wall – Pink Floyd
  529574560,   // Graceland – Paul Simon
  357652252,   // Electric Ladyland – Jimi Hendrix
  357225315,   // Are You Experienced – Jimi Hendrix
  1440673959,  // Synchronicity – The Police
  747087657,   // Tapestry – Carole King
  1038568061,  // Horses – Patti Smith
  158320766,   // Blood on the Tracks – Bob Dylan
  1065973975,  // Wish You Were Here – Pink Floyd
  1097862870,  // Kid A – Radiohead
  662324135,   // Illmatic – Nas
  266376953,   // Is This It – The Strokes
  1440798539,  // Moving Pictures – Rush
  1440742903,  // My Beautiful Dark Twisted Fantasy – Kanye West
].join(',');

app.get('/discover/classics', async (req, res) => {
  const CACHE_KEY = 'discover:classics';

  try {
    const mem = cacheGet(CACHE_KEY);
    if (mem) return res.json(mem);

    const db = await getCached(CACHE_KEY, TTL_24H);
    if (db) { cacheSet(CACHE_KEY, db, TTL_6H); return res.json(db); }

    const url = `https://api.music.apple.com/v1/catalog/us/albums?ids=${CLASSIC_IDS}`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${generateAppleToken()}` },
    });

    const rawText = await resp.text();
    console.log(`[/discover/classics] AM status=${resp.status} body[0..200]=${rawText.slice(0, 200)}`);

    if (!resp.ok) {
      throw new Error(`Apple Music /catalog/us/albums → ${resp.status}: ${rawText.slice(0, 200)}`);
    }

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      throw new Error(`Apple Music returned non-JSON (status ${resp.status}): ${rawText.slice(0, 200)}`);
    }

    const results = (data.data ?? []).map(item => ({
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
    console.error('[/discover/classics] error:', err.message ?? err);
    res.status(500).json({ error: true, message: err.message ?? 'Internal server error' });
  }
});

// ── GET /discover/top-rated ───────────────────────────────────────────────────
// Acclaimed Music aggregate top 48 albums of all time

const TOP_RATED_IDS = [
  1440841241,  // Pet Sounds – The Beach Boys
  1440783617,  // Nevermind – Nirvana
  1441164670,  // Revolver – The Beatles
  1440851613,  // The Velvet Underground & Nico – The Velvet Underground
  1538081586,  // What's Going On – Marvin Gaye
  1441164604,  // Sgt. Pepper's Lonely Hearts Club Band – The Beatles
  684811762,   // London Calling – The Clash
  1097861387,  // OK Computer – Radiohead
  178049863,   // Blonde on Blonde – Bob Dylan
  1440872228,  // Exile on Main St. – The Rolling Stones
  201281514,   // Highway 61 Revisited – Bob Dylan
  266317242,   // Never Mind the Bollocks – Sex Pistols
  1441133180,  // The Beatles (White Album) – The Beatles
  357225315,   // Are You Experienced – Jimi Hendrix
  1031002336,  // Astral Weeks – Van Morrison
  310730204,   // Born to Run – Bruce Springsteen
  1440828886,  // To Pimp a Butterfly – Kendrick Lamar
  1440837788,  // It Takes a Nation of Millions to Hold Us Back – Public Enemy
  1039796877,  // The Rise and Fall of Ziggy Stardust – David Bowie
  1441164426,  // Abbey Road – The Beatles
  1065973699,  // The Dark Side of the Moon – Pink Floyd
  158320766,   // Blood on the Tracks – Bob Dylan
  269572838,   // Thriller – Michael Jackson
  1249417623,  // Funeral – Arcade Fire
  1038568061,  // Horses – Patti Smith
  1440742903,  // My Beautiful Dark Twisted Fantasy – Kanye West
  800092985,   // The Queen Is Dead – The Smiths
  1049069472,  // Marquee Moon – Television
  268443092,   // Kind of Blue – Miles Davis
  212852926,   // Sign o' the Times – Prince
  357652252,   // Electric Ladyland – Jimi Hendrix
  1441164359,  // Rubber Soul – The Beatles
  580708175,   // Led Zeppelin IV – Led Zeppelin
  266376953,   // Is This It – The Strokes
  1097862870,  // Kid A – Radiohead
  1622368510,  // The Doors – The Doors
  300948043,   // Remain in Light – Talking Heads
  1440850317,  // Who's Next – The Who
  1500643395,  // Beggars Banquet – The Rolling Stones
  1443155637,  // The Joshua Tree – U2
  847972873,   // Ramones – Ramones
  1500642838,  // Let It Bleed – The Rolling Stones
  715864097,   // Blue Lines – Massive Attack
  1445669062,  // Live at the Apollo – James Brown
  1440788438,  // Songs in the Key of Life – Stevie Wonder
  1440949853,  // Automatic for the People – R.E.M.
  1746833068,  // Purple Rain – Prince
  1440806790,  // Innervisions – Stevie Wonder
].join(',');

app.get('/discover/top-rated', async (req, res) => {
  const CACHE_KEY = 'discover:top-rated';

  const mem = cacheGet(CACHE_KEY);
  if (mem) return res.json(mem);

  const db = await getCached(CACHE_KEY, TTL_24H);
  if (db) { cacheSet(CACHE_KEY, db, TTL_6H); return res.json(db); }

  try {
    const data = await amFetch(`/catalog/us/albums?ids=${TOP_RATED_IDS}`);
    const results = (data.data ?? []).map(item => ({
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
    console.error('[/discover/top-rated]', err.message ?? err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/discover/community-popular ──────────────────────────────────────
// All-time most-logged albums from real Listend user data.
// Aggregates in JS (same pattern as fetchTopAlbumsThisWeek) over up to 5000 rows.
// Cached 1 h in-memory, 6 h in Supabase.

app.get('/api/discover/community-popular', async (req, res) => {
  const CACHE_KEY = 'discover:community-popular';

  const mem = cacheGet(CACHE_KEY);
  if (mem) return res.json(mem);

  const db = await getCached(CACHE_KEY, TTL_6H);
  if (db) { cacheSet(CACHE_KEY, db, TTL_1H); return res.json(db); }

  try {
    const { data, error } = await supabase
      .from('user_albums')
      .select('spotify_id, title, artist, year, artwork_url')
      .not('listened_at', 'is', null)
      .limit(5000);

    if (error) throw error;

    const counts = new Map();
    for (const r of (data ?? [])) {
      if (!r.spotify_id) continue;
      const e = counts.get(r.spotify_id);
      if (e) {
        e.count++;
        // prefer non-empty artwork
        if (!e.album.artworkUrl && r.artwork_url) e.album.artworkUrl = r.artwork_url;
      } else {
        counts.set(r.spotify_id, {
          album: { id: r.spotify_id, title: r.title ?? '', artist: r.artist ?? '', year: r.year ?? 0, artworkUrl: r.artwork_url ?? '' },
          count: 1,
        });
      }
    }

    const results = Array.from(counts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 50)
      .map(e => e.album);

    cacheSet(CACHE_KEY, results, TTL_1H);
    await setCache(CACHE_KEY, results);
    res.json(results);
  } catch (err) {
    console.error('[/api/discover/community-popular]', err.message ?? err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/discover/community-top-rated ────────────────────────────────────
// All-time top-rated albums from real Listend user data.
// Requires MIN_RATINGS reviews per album to appear.
// Cached 1 h in-memory, 6 h in Supabase.

const MIN_RATINGS = 3;

app.get('/api/discover/community-top-rated', async (req, res) => {
  const CACHE_KEY = 'discover:community-top-rated';

  const mem = cacheGet(CACHE_KEY);
  if (mem) return res.json(mem);

  const db = await getCached(CACHE_KEY, TTL_6H);
  if (db) { cacheSet(CACHE_KEY, db, TTL_1H); return res.json(db); }

  try {
    const { data, error } = await supabase
      .from('user_albums')
      .select('spotify_id, title, artist, year, artwork_url, rating')
      .not('rating', 'is', null)
      .gt('rating', 0)
      .limit(5000);

    if (error) throw error;

    const agg = new Map();
    for (const r of (data ?? [])) {
      if (!r.spotify_id) continue;
      const e = agg.get(r.spotify_id);
      if (e) {
        e.totalRating += r.rating;
        e.count++;
        if (!e.album.artworkUrl && r.artwork_url) e.album.artworkUrl = r.artwork_url;
      } else {
        agg.set(r.spotify_id, {
          album: { id: r.spotify_id, title: r.title ?? '', artist: r.artist ?? '', year: r.year ?? 0, artworkUrl: r.artwork_url ?? '' },
          totalRating: r.rating,
          count: 1,
        });
      }
    }

    const results = Array.from(agg.values())
      .filter(e => e.count >= MIN_RATINGS)
      .sort((a, b) => (b.totalRating / b.count) - (a.totalRating / a.count))
      .slice(0, 50)
      .map(e => e.album);

    cacheSet(CACHE_KEY, results, TTL_1H);
    await setCache(CACHE_KEY, results);
    res.json(results);
  } catch (err) {
    console.error('[/api/discover/community-top-rated]', err.message ?? err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/discover/community-top-artists ───────────────────────────────────
// All-time top artists from real Listend user data.
// Mirrors fetchTopArtistsThisWeek() in lib/homeData.ts but with no date filter.
// Sources: liked_artists + top5_changes category=artists + user_albums (logged albums).
// Cached 1 h in-memory, 6 h in Supabase.

app.get('/api/discover/community-top-artists', async (req, res) => {
  const CACHE_KEY = 'discover:community-top-artists';

  const mem = cacheGet(CACHE_KEY);
  if (mem) return res.json(mem);

  const db = await getCached(CACHE_KEY, TTL_6H);
  if (db) { cacheSet(CACHE_KEY, db, TTL_1H); return res.json(db); }

  try {
    const [{ data: likedRows, error: e1 }, { data: top5Rows, error: e2 }, { data: albumRows, error: e3 }] = await Promise.all([
      supabase.from('liked_artists').select('artist_id, name, artwork_url').limit(5000),
      supabase.from('top5_changes').select('item_id, item_name, item_image_url').eq('category', 'artists').limit(5000),
      supabase.from('user_albums').select('artist, artwork_url').not('listened_at', 'is', null).limit(5000),
    ]);
    if (e1) throw e1;
    if (e2) throw e2;
    if (e3) throw e3;

    const counts = new Map();
    for (const r of (likedRows ?? [])) {
      if (!r.artist_id) continue;
      const e = counts.get(r.artist_id);
      if (e) e.count++;
      else counts.set(r.artist_id, { artist: { id: r.artist_id, name: r.name ?? '', genre: '', artworkUrl: r.artwork_url ?? '' }, count: 1 });
    }
    for (const r of (top5Rows ?? [])) {
      if (!r.item_id) continue;
      const e = counts.get(r.item_id);
      if (e) e.count++;
      else counts.set(r.item_id, { artist: { id: r.item_id, name: r.item_name ?? '', genre: '', artworkUrl: r.item_image_url ?? '' }, count: 1 });
    }

    // Dedup by name, picking best artworkUrl
    const sorted = Array.from(counts.values()).sort((a, b) => b.count - a.count);
    const byName = new Map();
    for (const entry of sorted) {
      const key = entry.artist.name.toLowerCase().trim();
      if (!key) continue;
      const existing = byName.get(key);
      if (existing) {
        existing.count += entry.count;
        if (!existing.artist.artworkUrl && entry.artist.artworkUrl)
          existing.artist = { ...existing.artist, artworkUrl: entry.artist.artworkUrl };
      } else {
        byName.set(key, { artist: { ...entry.artist }, count: entry.count });
      }
    }

    // Add album log counts — only name available, no artwork (artwork_url is album art not artist)
    for (const r of (albumRows ?? [])) {
      const name = r.artist?.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const existing = byName.get(key);
      if (existing) {
        existing.count++;
      } else {
        byName.set(key, { artist: { id: `name:${key}`, name, genre: '', artworkUrl: '' }, count: 1 });
      }
    }

    const results = Array.from(byName.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 48)
      .map(e => e.artist);

    cacheSet(CACHE_KEY, results, TTL_1H);
    await setCache(CACHE_KEY, results);
    res.json(results);
  } catch (err) {
    console.error('[/api/discover/community-top-artists]', err.message ?? err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/discover/community-top-songs ─────────────────────────────────────
// All-time top songs from real Listend user data.
// Mirrors fetchTopSongsThisWeek() in lib/homeData.ts but with no date filter.
// Source: top5_changes category=songs (all-time Top 5 adds).
// Cached 1 h in-memory, 6 h in Supabase.

app.get('/api/discover/community-top-songs', async (req, res) => {
  const CACHE_KEY = 'discover:community-top-songs';

  const mem = cacheGet(CACHE_KEY);
  if (mem) return res.json(mem);

  const db = await getCached(CACHE_KEY, TTL_6H);
  if (db) { cacheSet(CACHE_KEY, db, TTL_1H); return res.json(db); }

  try {
    const { data, error } = await supabase
      .from('top5_changes')
      .select('item_id, item_name, item_image_url')
      .eq('category', 'songs')
      .limit(5000);

    if (error) throw error;

    const counts = new Map();
    for (const r of (data ?? [])) {
      if (!r.item_id) continue;
      const e = counts.get(r.item_id);
      if (e) e.count++;
      else counts.set(r.item_id, {
        track: { id: r.item_id, title: r.item_name ?? '', artist: '', artworkUrl: r.item_image_url ?? '' },
        count: 1,
      });
    }

    const results = Array.from(counts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 48)
      .map(e => e.track);

    cacheSet(CACHE_KEY, results, TTL_1H);
    await setCache(CACHE_KEY, results);
    res.json(results);
  } catch (err) {
    console.error('[/api/discover/community-top-songs]', err.message ?? err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /discover/recommended ─────────────────────────────────────────────────

app.get('/discover/recommended', async (req, res) => {
  const CACHE_KEY = 'discover:recommended';

  const mem = cacheGet(CACHE_KEY);
  if (mem) return res.json(mem);

  const db = await getCached(CACHE_KEY, TTL_24H);
  if (db) { cacheSet(CACHE_KEY, db, TTL_6H); return res.json(db); }

  try {
    const data = await amFetch('/catalog/us/charts?types=albums&chart=most-played&limit=30');
    const results = (data.results?.albums?.[0]?.data ?? []).map(item => ({
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
    console.error('[/discover/recommended]', err.message ?? err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /discover/top-artists ─────────────────────────────────────────────────
// Hardcoded 48 all-time most popular artists searched via Apple Music catalog.

const TOP_ARTIST_NAMES = [
  'The Beatles', 'Michael Jackson', 'Taylor Swift', 'Elvis Presley', 'Queen',
  'Drake', 'Elton John', 'Madonna', 'The Weeknd', 'Led Zeppelin',
  'Bad Bunny', 'Pink Floyd', 'Eminem', 'Rihanna', 'Ed Sheeran',
  'AC/DC', 'Rolling Stones', 'Justin Bieber', 'Whitney Houston', 'Bruno Mars',
  'Eagles', 'Beyoncé', 'Coldplay', 'Kanye West', 'Billie Eilish',
  'Ariana Grande', 'Adele', 'Metallica', 'Post Malone', 'BTS',
  'Celine Dion', 'U2', 'Garth Brooks', 'Mariah Carey', 'Kendrick Lamar',
  'Maroon 5', 'Katy Perry', 'Bob Marley', 'Fleetwood Mac', 'David Bowie',
  'Lady Gaga', 'Harry Styles', 'Linkin Park', "Guns N' Roses",
  'SZA', 'Lana Del Rey', 'Nirvana', 'Travis Scott',
];

app.get('/discover/top-artists', async (req, res) => {
  const CACHE_KEY = 'discover:top-artists';

  const mem = cacheGet(CACHE_KEY);
  if (mem) return res.json(mem);

  const db = await getCached(CACHE_KEY, TTL_7D);
  if (db) { cacheSet(CACHE_KEY, db, TTL_6H); return res.json(db); }

  try {
    const results = [];
    const BATCH = 4, DELAY = 500;

    for (let i = 0; i < TOP_ARTIST_NAMES.length; i += BATCH) {
      const batch = TOP_ARTIST_NAMES.slice(i, i + BATCH);
      const fetched = await Promise.all(batch.map(async (name) => {
        try {
          const q = encodeURIComponent(name);
          const data = await amFetch(`/catalog/us/search?types=artists&term=${q}&limit=3`);
          const artists = data?.results?.artists?.data ?? [];
          const match = artists.find(a =>
            a.attributes?.name?.toLowerCase() === name.toLowerCase()
          ) ?? artists[0];
          if (!match) return null;
          return {
            id:         match.id,
            name:       match.attributes?.name ?? name,
            genre:      match.attributes?.genreNames?.[0] ?? '',
            artworkUrl: amArtwork(match.attributes?.artwork),
          };
        } catch { return null; }
      }));
      results.push(...fetched.filter(Boolean));
      if (i + BATCH < TOP_ARTIST_NAMES.length) await new Promise(r => setTimeout(r, DELAY));
    }

    cacheSet(CACHE_KEY, results, TTL_6H);
    await setCache(CACHE_KEY, results);
    res.json(results);
  } catch (err) {
    console.error('[/discover/top-artists]', err.message ?? err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /discover/top-songs ───────────────────────────────────────────────────
// Hardcoded 48 critically-acclaimed / highest-streamed songs searched via AM.

const TOP_SONGS = [
  { artist: 'The Beatles',              title: 'A Day in the Life' },
  { artist: 'Queen',                    title: 'Bohemian Rhapsody' },
  { artist: 'The Weeknd',               title: 'Blinding Lights' },
  { artist: 'Michael Jackson',          title: 'Billie Jean' },
  { artist: 'Nirvana',                  title: 'Smells Like Teen Spirit' },
  { artist: 'Aretha Franklin',          title: 'Respect' },
  { artist: 'Taylor Swift',             title: 'All Too Well (10 Minute Version) (Taylor\'s Version)' },
  { artist: 'Bob Dylan',                title: 'Like a Rolling Stone' },
  { artist: 'Ed Sheeran',               title: 'Shape of You' },
  { artist: 'Prince',                   title: 'Purple Rain' },
  { artist: 'Fleetwood Mac',            title: 'Dreams' },
  { artist: 'Beyoncé',                  title: 'Formation' },
  { artist: 'Marvin Gaye',              title: "What's Going On" },
  { artist: 'Billie Eilish',            title: 'bad guy' },
  { artist: 'Eagles',                   title: 'Hotel California' },
  { artist: 'The Rolling Stones',       title: "(I Can't Get No) Satisfaction" },
  { artist: 'Adele',                    title: 'Rolling in the Deep' },
  { artist: 'David Bowie',              title: 'Life on Mars?' },
  { artist: 'Drake',                    title: 'One Dance' },
  { artist: 'Led Zeppelin',             title: 'Stairway to Heaven' },
  { artist: 'Kendrick Lamar',           title: 'Alright' },
  { artist: 'Whitney Houston',          title: 'I Will Always Love You' },
  { artist: 'Harry Styles',             title: 'As It Was' },
  { artist: 'Pink Floyd',               title: 'Wish You Were Here' },
  { artist: 'Amy Winehouse',            title: 'Back to Black' },
  { artist: 'Outkast',                  title: 'Hey Ya!' },
  { artist: 'Bruce Springsteen',        title: 'Born to Run' },
  { artist: 'SZA',                      title: 'Kill Bill' },
  { artist: 'The Beach Boys',           title: 'God Only Knows' },
  { artist: 'Eminem',                   title: 'Lose Yourself' },
  { artist: 'Lorde',                    title: 'Royals' },
  { artist: 'Stevie Wonder',            title: 'Superstition' },
  { artist: 'Radiohead',                title: 'Paranoid Android' },
  { artist: 'Bruno Mars',               title: 'Uptown Funk' },
  { artist: 'The Killers',              title: 'Mr. Brightside' },
  { artist: 'Kate Bush',                title: 'Running Up That Hill (A Deal with God)' },
  { artist: 'Frank Ocean',              title: 'Pyramids' },
  { artist: 'Coldplay',                 title: 'Viva La Vida' },
  { artist: 'Arctic Monkeys',           title: 'Do I Wanna Know?' },
  { artist: "Guns N' Roses",            title: 'Sweet Child O\' Mine' },
  { artist: 'Rihanna',                  title: 'Umbrella' },
  { artist: 'Oasis',                    title: 'Wonderwall' },
  { artist: 'ABBA',                     title: 'Dancing Queen' },
  { artist: 'Lady Gaga',                title: 'Bad Romance' },
  { artist: 'Hozier',                   title: 'Take Me To Church' },
  { artist: 'Lana Del Rey',             title: 'Video Games' },
  { artist: 'The Police',               title: 'Every Breath You Take' },
  { artist: 'Bob Marley & The Wailers', title: 'No Woman, No Cry' },
];

app.get('/discover/top-songs', async (req, res) => {
  const CACHE_KEY = 'discover:top-songs';

  const mem = cacheGet(CACHE_KEY);
  if (mem) return res.json(mem);

  const db = await getCached(CACHE_KEY, TTL_7D);
  if (db) { cacheSet(CACHE_KEY, db, TTL_6H); return res.json(db); }

  try {
    const results = [];
    const BATCH = 4, DELAY = 500;

    for (let i = 0; i < TOP_SONGS.length; i += BATCH) {
      const batch = TOP_SONGS.slice(i, i + BATCH);
      const fetched = await Promise.all(batch.map(async ({ artist, title }) => {
        try {
          const q = encodeURIComponent(`${artist} ${title}`);
          const data = await amFetch(`/catalog/us/search?types=songs&term=${q}&limit=5`);
          const songs = data?.results?.songs?.data ?? [];
          const match = songs.find(s =>
            s.attributes?.name?.toLowerCase() === title.toLowerCase()
          ) ?? songs.find(s =>
            s.attributes?.name?.toLowerCase().includes(title.toLowerCase().slice(0, 10))
          ) ?? songs[0];
          if (!match) return null;
          return {
            id:          match.id,
            title:       match.attributes?.name ?? title,
            artist:      match.attributes?.artistName ?? artist,
            artworkUrl:  amArtwork(match.attributes?.artwork),
            releaseDate: match.attributes?.releaseDate ?? '',
          };
        } catch { return null; }
      }));
      results.push(...fetched.filter(Boolean));
      if (i + BATCH < TOP_SONGS.length) await new Promise(r => setTimeout(r, DELAY));
    }

    cacheSet(CACHE_KEY, results, TTL_6H);
    await setCache(CACHE_KEY, results);
    res.json(results);
  } catch (err) {
    console.error('[/discover/top-songs]', err.message ?? err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /lastfm/artist — ?artist=<name> ───────────────────────────────────────
// Switched from path params to query params to safely handle names with /&?# etc.

app.get('/lastfm/artist', [
  query('artist').trim().customSanitizer(stripHtml).isLength({ max: 200 }).withMessage('artist must be 200 characters or fewer'),
  validate,
], async (req, res) => {
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

app.get('/lastfm/album', [
  query('artist').trim().customSanitizer(stripHtml).isLength({ max: 200 }).withMessage('artist must be 200 characters or fewer'),
  query('album').trim().customSanitizer(stripHtml).isLength({ max: 200 }).withMessage('album must be 200 characters or fewer'),
  validate,
], async (req, res) => {
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
    const lfmUrl =
      `http://ws.audioscrobbler.com/2.0/?method=album.getinfo` +
      `&artist=${encodeURIComponent(artistName)}` +
      `&album=${encodeURIComponent(albumName)}` +
      `&api_key=${process.env.LASTFM_API_KEY}` +
      `&format=json`;

    // Fire Last.fm and Genius in parallel — no need to wait for Last.fm to
    // discover it has no wiki before starting the Genius request.
    console.log(`[/lastfm/album] fetching Last.fm + Genius in parallel for "${artistName} - ${albumName}"`);
    const [lfmResp, geniusDesc] = await Promise.all([
      fetch(lfmUrl),
      fetchGeniusAlbumDescription(artistName, albumName),
    ]);

    console.log(`[/lastfm/album] Last.fm HTTP status: ${lfmResp.status}`);
    if (!lfmResp.ok) throw new Error(`Last.fm album.getinfo → ${lfmResp.status}`);
    const json = await lfmResp.json();
    if (json.error) throw new Error(`Last.fm error ${json.error}: ${json.message}`);

    const al = json.album;
    const lfmDesc = al.wiki?.summary ?? al.wiki?.content ?? '';
    const payload = {
      name: al.name,
      artist: al.artist,
      listeners: parseInt(al.listeners ?? '0', 10),
      description: lfmDesc || geniusDesc || '',
      tags: (al.tags?.tag ?? []).map(t => t.name),
    };

    console.log(`[/lastfm/album] desc source=${lfmDesc ? 'lastfm' : geniusDesc ? 'genius' : 'none'} len=${payload.description.length} listeners=${payload.listeners} tags=${payload.tags.length}`);
    cacheSet(CACHE_KEY, payload, TTL_6H);
    await setCache(CACHE_KEY, payload);
    res.json(payload);
  } catch (err) {
    console.error('[/lastfm/album] ERROR:', err.message ?? err);
    res.status(500).json({ error: err.message ?? 'Internal server error' });
  }
});

// ── GET /album-tags — Apple Music + MusicBrainz genres ───────────────────────

const MAIN_GENRES = [
  'Hip-Hop / Rap', 'Pop', 'Rock', 'Latin', 'Afrobeats',
  'R&B / Soul', 'Electronic', 'Indie / Alternative', 'Metal',
  'Country', 'Jazz', 'Classical', 'Folk / Singer-Songwriter', 'Blues',
];

// Maps lowercased keyword substrings → main genre (order matters: more specific first)
const TAG_MAP = [
  // Hip-Hop / Rap
  ['hip-hop/rap',         'Hip-Hop / Rap'],
  ['hip hop',             'Hip-Hop / Rap'],
  ['hip-hop',             'Hip-Hop / Rap'],
  ['trap',                'Hip-Hop / Rap'],
  ['drill',               'Hip-Hop / Rap'],
  ['grime',               'Hip-Hop / Rap'],
  ['rap',                 'Hip-Hop / Rap'],
  // R&B / Soul — before generic 'pop' / 'rock'
  ['r&b/soul',            'R&B / Soul'],
  ['r&b',                 'R&B / Soul'],
  ['neo-soul',            'R&B / Soul'],
  ['neo soul',            'R&B / Soul'],
  ['soul',                'R&B / Soul'],
  ['motown',              'R&B / Soul'],
  ['funk',                'R&B / Soul'],
  ['gospel',              'R&B / Soul'],
  // Metal — before 'rock'
  ['metalcore',           'Metal'],
  ['heavy metal',         'Metal'],
  ['death metal',         'Metal'],
  ['black metal',         'Metal'],
  ['thrash metal',        'Metal'],
  ['doom metal',          'Metal'],
  ['nu-metal',            'Metal'],
  ['nu metal',            'Metal'],
  ['prog metal',          'Metal'],
  ['progressive metal',   'Metal'],
  ['metal',               'Metal'],
  // Indie / Alternative — before 'rock' and 'pop'
  ['singer/songwriter',   'Folk / Singer-Songwriter'],
  ['indie folk',          'Folk / Singer-Songwriter'],
  ['folk rock',           'Folk / Singer-Songwriter'],
  ['indie pop',           'Indie / Alternative'],
  ['indie rock',          'Indie / Alternative'],
  ['alternative rock',    'Indie / Alternative'],
  ['post-punk',           'Indie / Alternative'],
  ['post-rock',           'Indie / Alternative'],
  ['shoegaze',            'Indie / Alternative'],
  ['dream pop',           'Indie / Alternative'],
  ['art rock',            'Indie / Alternative'],
  ['noise rock',          'Indie / Alternative'],
  ['math rock',           'Indie / Alternative'],
  ['emo',                 'Indie / Alternative'],
  ['lo-fi',               'Indie / Alternative'],
  ['alternative',         'Indie / Alternative'],
  ['indie',               'Indie / Alternative'],
  // Rock
  ['psychedelic rock',    'Rock'],
  ['garage rock',         'Rock'],
  ['classic rock',        'Rock'],
  ['hard rock',           'Rock'],
  ['soft rock',           'Rock'],
  ['grunge',              'Rock'],
  ['rock',                'Rock'],
  // Electronic
  ['drum and bass',       'Electronic'],
  ['electropop',          'Pop'],
  ['synth-pop',           'Pop'],
  ['synthpop',            'Pop'],
  ['electronica',         'Electronic'],
  ['electronic',          'Electronic'],
  ['techno',              'Electronic'],
  ['house',               'Electronic'],
  ['ambient',             'Electronic'],
  ['trance',              'Electronic'],
  ['dubstep',             'Electronic'],
  ['idm',                 'Electronic'],
  ['electro',             'Electronic'],
  ['edm',                 'Electronic'],
  ['dance',               'Electronic'],
  // Pop
  ['k-pop',               'Pop'],
  ['teen pop',            'Pop'],
  ['dance pop',           'Pop'],
  ['pop',                 'Pop'],
  // Folk / Singer-Songwriter
  ['singer-songwriter',   'Folk / Singer-Songwriter'],
  ['freak folk',          'Folk / Singer-Songwriter'],
  ['new folk',            'Folk / Singer-Songwriter'],
  ['acoustic',            'Folk / Singer-Songwriter'],
  ['folk',                'Folk / Singer-Songwriter'],
  // Country
  ['bluegrass',           'Country'],
  ['americana',           'Country'],
  ['outlaw country',      'Country'],
  ['country pop',         'Country'],
  ['country',             'Country'],
  // Jazz
  ['jazz fusion',         'Jazz'],
  ['smooth jazz',         'Jazz'],
  ['free jazz',           'Jazz'],
  ['big band',            'Jazz'],
  ['bebop',               'Jazz'],
  ['jazz',                'Jazz'],
  // Classical
  ['contemporary classical', 'Classical'],
  ['chamber music',       'Classical'],
  ['orchestral',          'Classical'],
  ['baroque',             'Classical'],
  ['opera',               'Classical'],
  ['classical',           'Classical'],
  // Latin
  ['reggaeton',           'Latin'],
  ['dancehall',           'Latin'],
  ['reggae',              'Latin'],
  ['latin pop',           'Latin'],
  ['bossa nova',          'Latin'],
  ['salsa',               'Latin'],
  ['bachata',             'Latin'],
  ['cumbia',              'Latin'],
  ['latin',               'Latin'],
  // Blues
  ['blues rock',          'Blues'],
  ['delta blues',         'Blues'],
  ['chicago blues',       'Blues'],
  ['electric blues',      'Blues'],
  ['blues',               'Blues'],
  // Afrobeats
  ['afrobeats',           'Afrobeats'],
  ['afrobeat',            'Afrobeats'],
  ['afropop',             'Afrobeats'],
  ['afro pop',            'Afrobeats'],
  ['highlife',            'Afrobeats'],
];

function normalizeGenreTags(rawTags) {
  const seen = new Set();
  const result = [];
  for (const tag of rawTags) {
    const lower = tag.toLowerCase();
    for (const [keyword, main] of TAG_MAP) {
      if (lower.includes(keyword) && !seen.has(main)) {
        seen.add(main);
        result.push(main);
        break;
      }
    }
  }
  return result;
}

async function fetchAppleMusicGenres(amId) {
  if (!amId) return [];
  try {
    const data = await amFetch(`/catalog/us/albums/${amId}`);
    return (data?.data?.[0]?.attributes?.genreNames ?? []).filter(g => g !== 'Music');
  } catch { return []; }
}

async function fetchMusicBrainzGenres(artist, album) {
  if (!artist || !album) return [];
  try {
    const searchResp = await fetch(
      `https://musicbrainz.org/ws/2/release-group?query=artist:%22${encodeURIComponent(artist)}%22%20AND%20release:%22${encodeURIComponent(album)}%22&limit=1&fmt=json`,
      { headers: { 'User-Agent': 'Listend/1.0 (contact@listend.app)' } }
    );
    if (!searchResp.ok) return [];
    const rgId = (await searchResp.json())['release-groups']?.[0]?.id;
    if (!rgId) return [];
    const detailResp = await fetch(
      `https://musicbrainz.org/ws/2/release-group/${rgId}?inc=genres&fmt=json`,
      { headers: { 'User-Agent': 'Listend/1.0 (contact@listend.app)' } }
    );
    if (!detailResp.ok) return [];
    return ((await detailResp.json()).genres ?? []).map(g => g.name);
  } catch { return []; }
}

app.get('/album-tags', [
  query('artist').trim().customSanitizer(stripHtml).isLength({ max: 200 }).withMessage('artist required'),
  query('album').trim().customSanitizer(stripHtml).isLength({ max: 200 }).withMessage('album required'),
  query('amId').optional().trim().customSanitizer(stripHtml).isLength({ max: 100 }),
  validate,
], async (req, res) => {
  const artistName = (req.query.artist ?? '').trim();
  const albumName  = (req.query.album  ?? '').trim();
  const amId       = (req.query.amId   ?? '').trim();
  if (!artistName || !albumName) return res.status(400).json({ error: 'artist and album required' });

  const CACHE_KEY = `album_tags_${artistName.toLowerCase()}_${albumName.toLowerCase()}`;
  const mem = cacheGet(CACHE_KEY);
  if (mem) return res.json(mem);
  const db = await getCached(CACHE_KEY, TTL_7D);
  if (db) { cacheSet(CACHE_KEY, db, TTL_6H); return res.json(db); }

  try {
    const [amGenres, mbGenres] = await Promise.all([
      fetchAppleMusicGenres(amId),
      fetchMusicBrainzGenres(artistName, albumName),
    ]);
    // Merge raw tags (AM first), then normalize to main genres
    const seen = new Set();
    const rawTags = [...amGenres, ...mbGenres].filter(g => {
      const key = g.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const tags = normalizeGenreTags(rawTags);
    const payload = { tags };
    cacheSet(CACHE_KEY, payload, TTL_6H);
    await setCache(CACHE_KEY, payload);
    res.json(payload);
  } catch (err) {
    console.error('[/album-tags] ERROR:', err.message ?? err);
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

// ── Genius album description helper ──────────────────────────────────────────
// Searches Genius for the album, then fetches the album description.
// Returns a plain-text string or null on any failure / empty result.

async function fetchGeniusAlbumDescription(artistName, albumName) {
  try {
    if (!process.env.GENIUS_ACCESS_TOKEN) return null;
    const query = `${artistName} ${albumName}`;
    const searchResp = await fetch(
      `https://api.genius.com/search?q=${encodeURIComponent(query)}`,
      { headers: { Authorization: `Bearer ${process.env.GENIUS_ACCESS_TOKEN}` } }
    );
    if (!searchResp.ok) return null;
    const searchJson = await searchResp.json();
    const hits = searchJson.response?.hits ?? [];
    if (!hits.length) return null;

    // Prefer a hit that already has an album attached
    const albumHit = hits.find(h => h.result?.album?.id) ?? hits[0];
    const albumId = albumHit?.result?.album?.id;
    if (!albumId) return null;

    const albumResp = await fetch(
      `https://api.genius.com/albums/${albumId}?text_format=plain`,
      { headers: { Authorization: `Bearer ${process.env.GENIUS_ACCESS_TOKEN}` } }
    );
    if (!albumResp.ok) return null;
    const albumJson = await albumResp.json();
    const desc = albumJson.response?.album?.description?.plain;
    if (!desc || desc === '?' || desc.trim().length < 30) return null;
    return desc.trim();
  } catch {
    return null;
  }
}

// ── GET /genius/credits ───────────────────────────────────────────────────────
// ?artist=<name>&tracks=<t1>&tracks=<t2>&tracks=<t3>  (tracks repeated up to 3×)
// Tries each track in order, returns whichever has the most custom_performances
// data after filtering. Falls back to producer_artists/writer_artists if all
// tracks return empty custom_performances.

app.get('/genius/credits', [
  query('artist').trim().customSanitizer(stripHtml).isLength({ max: 200 }).withMessage('artist must be 200 characters or fewer'),
  query('tracks').optional().customSanitizer(v =>
    Array.isArray(v) ? v.map(t => stripHtml(t.trim())) : stripHtml(String(v ?? '').trim())
  ),
  query('track').optional().trim().customSanitizer(stripHtml).isLength({ max: 200 }),
  validate,
], async (req, res) => {
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

app.get('/spotify/track/:id', [
  param('id').trim().matches(/^[a-zA-Z0-9_-]+$/).withMessage('invalid id').isLength({ max: 50 }),
  validate,
], async (req, res) => {
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
      albumTitle:  t?.attributes?.albumName ?? '',
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

app.get('/spotify/album/:id/tracks', [
  param('id').trim().matches(/^[a-zA-Z0-9_-]+$/).withMessage('invalid id').isLength({ max: 50 }),
  validate,
], async (req, res) => {
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
      durationMs: t.attributes?.durationInMillis ?? 0,
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

app.get('/spotify/artist/:id/top-tracks', [
  param('id').trim().matches(/^[a-zA-Z0-9_-]+$/).withMessage('invalid id').isLength({ max: 50 }),
  validate,
], async (req, res) => {
  const { id } = req.params;
  const bust = req.query.bust === '1';
  console.log(`[/spotify/artist/top-tracks] ── START id="${id}" bust=${bust}`);

  if (!id || id === 'undefined') {
    return res.status(400).json({ error: 'artist id is required and must not be "undefined"' });
  }

  const CACHE_KEY = `am_artist_top_tracks_${id}`;

  try {
    if (!bust) {
      const mem = cacheGet(CACHE_KEY);
      if (mem) { console.log('[/spotify/artist/top-tracks] cache hit (memory)'); return res.json(mem); }

      const db = await getCached(CACHE_KEY, TTL_24H);
      if (db) { console.log('[/spotify/artist/top-tracks] cache hit (db)'); cacheSet(CACHE_KEY, db, TTL_6H); return res.json(db); }
    }

    // Fetch top songs directly from Apple Music — artwork and duration included
    console.log(`[/spotify/artist/top-tracks] fetching AM top-songs for artist id="${id}"`);
    const amData = await amFetch(`/catalog/us/artists/${id}?views=top-songs`);
    const rawSongs = amData.data?.[0]?.views?.['top-songs']?.data ?? [];
    console.log(`[/spotify/artist/top-tracks] AM returned ${rawSongs.length} songs`);

    const tracks = rawSongs.slice(0, 5).map((s, i) => {
      const attr = s.attributes ?? {};
      const ms = attr.durationInMillis ?? 0;
      const totalSec = Math.round(ms / 1000);
      const mins = Math.floor(totalSec / 60);
      const secs = totalSec % 60;
      const duration = ms ? `${mins}:${String(secs).padStart(2, '0')}` : null;
      return {
        number:     i + 1,
        id:         s.id ?? `${id}-${i}`,
        title:      attr.name ?? null,
        artworkUrl: amArtwork(attr.artwork) || null,
        albumTitle: attr.albumName ?? null,
        durationMs: ms || null,
        duration,
      };
    });

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

app.get('/spotify/artist/:id/albums', [
  param('id').trim().matches(/^[a-zA-Z0-9_-]+$/).withMessage('invalid id').isLength({ max: 50 }),
  validate,
], async (req, res) => {
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

    // Allowlist: these titles always go into EPs & Mixtapes regardless of other flags
    const TITLE_ALLOWLIST = [
      'members only, vol.',
      'a ghetto christmas carol',
    ];
    const inAllowlist = title => TITLE_ALLOWLIST.some(t => title.toLowerCase().includes(t));

    const LIVE_RE       = /\b(live|concert|tour|session|performance)\b|apple(?:\s+music)?\s+presents|chopnotslop|chopped\s+not\s+slopped/i;
    const COLLECTION_RE = /\b(greatest\s+hits?|highlights?|collection|deluxe)\b|best\s+of\b/i;
    const EP_MIX_RE     = /\b(ep|mixtape|acoustic|acapella|a\s+cappella|remixes?|instrumental|karaoke)\b/i;

    // Titles that match LIVE_RE by accident (word is part of the title, not a descriptor)
    const LIVE_FALSE_POSITIVES = [
      'live.love.a$ap',
      'long.live.a$ap',
    ];
    const isLiveFalsePositive = title => LIVE_FALSE_POSITIVES.some(t => title.toLowerCase().includes(t));

    // Returns which tab bucket an item belongs to
    const categorize = item => {
      const t = item.title;
      if (LIVE_RE.test(t) && !isLiveFalsePositive(t)) return 'live';
      if (inAllowlist(t)) return 'epsAndMixtapes';
      if (item.isCompilation === true || COLLECTION_RE.test(t)) return 'collections';
      if (EP_MIX_RE.test(t)) return 'epsAndMixtapes';
      if (item.url && item.url.toLowerCase().includes('/single/')) return 'epsAndMixtapes';
      if (item.trackCount !== null && item.trackCount < 6) return 'epsAndMixtapes';
      return 'albums';
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

    console.log(`[/spotify/artist/albums] ALL titles fetched (${allItems.length}):`, allItems.map(i => `"${i.title}" isSingle=${i.isSingle} isCompilation=${i.isCompilation} trackCount=${i.trackCount}`));

    // Global singles exclusion — runs before tab categorisation
    const isSingleRelease = item =>
      item.isSingle === true ||
      item.trackCount === 1 ||
      /\s*-\s*single\b/i.test(item.title);
    const nonSingles = allItems.filter(item => !isSingleRelease(item));
    console.log(`[/spotify/artist/albums] ${allItems.length} total → ${nonSingles.length} after singles exclusion`);

    // Bucket items into 4 tab categories
    const buckets = { albums: [], epsAndMixtapes: [], collections: [], live: [] };
    for (const item of nonSingles) buckets[categorize(item)].push(item);

    // Deduplicate each bucket: same title (case-insensitive) + same year → keep higher trackCount
    const dedupBucket = items => {
      const map = new Map();
      for (const item of items) {
        const key = `${item.title.toLowerCase()}::${item.year}`;
        const existing = map.get(key);
        if (!existing || (item.trackCount ?? 0) > (existing.trackCount ?? 0)) map.set(key, item);
      }
      return [...map.values()];
    };

    // Albums get additional base-title dedup (strips parenthetical suffixes across years)
    const albumBaseMap = new Map();
    for (const item of buckets.albums) {
      const key = baseTitle(item.title);
      const existing = albumBaseMap.get(key);
      if (!existing) { albumBaseMap.set(key, item); continue; }
      const itemHasSuffix     = /[\(\[]/.test(item.title);
      const existingHasSuffix = /[\(\[]/.test(existing.title);
      if (!itemHasSuffix && existingHasSuffix) { albumBaseMap.set(key, item); continue; }
      if (itemHasSuffix && !existingHasSuffix) continue;
      if ((item.trackCount ?? 0) > (existing.trackCount ?? 0)) { albumBaseMap.set(key, item); continue; }
      if (item.year < existing.year) { albumBaseMap.set(key, item); }
    }

    const grouped = {
      albums:         dedupBucket([...albumBaseMap.values()]),
      epsAndMixtapes: dedupBucket(buckets.epsAndMixtapes),
      collections:    dedupBucket(buckets.collections),
      live:           dedupBucket(buckets.live),
    };

    console.log(`[/spotify/artist/albums] success — albums:${grouped.albums.length} eps:${grouped.epsAndMixtapes.length} collections:${grouped.collections.length} live:${grouped.live.length}`);
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

app.get('/spotify/recommendations', [
  query('trackIds').optional().customSanitizer(v =>
    (Array.isArray(v) ? v : [v]).map(s => String(s ?? '').trim()).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)).slice(0, 2)
  ),
  query('excludeAlbumId').optional().trim().matches(/^[a-zA-Z0-9_-]*$/).isLength({ max: 50 }),
  validate,
], async (req, res) => {
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

// ── GET /api/album-durations?ids=id1,id2,... ─────────────────────────────────
// Batch endpoint: returns total duration in ms for each album ID.
// Reuses the existing per-album tracks cache so repeated calls are cheap.

app.get('/api/album-durations', [
  query('ids').optional().trim().isLength({ max: 2000 }).withMessage('ids too long'),
  validate,
], async (req, res) => {
  const raw = req.query.ids ?? '';
  const ids = String(raw).split(',').map(s => s.trim()).filter(s => /^[a-zA-Z0-9_-]+$/.test(s));
  if (ids.length === 0) return res.json({});

  const result = {};

  await Promise.all(ids.map(async (id) => {
    const CACHE_KEY = `spotify_album_tracks_${id}`;
    let tracks = cacheGet(CACHE_KEY);
    if (!tracks) tracks = await getCached(CACHE_KEY, TTL_24H);
    if (!tracks) {
      try {
        const data = await amFetch(`/catalog/us/albums/${id}/tracks`);
        tracks = (data.data ?? []).map((t, i) => ({
          number: t.attributes?.trackNumber ?? i + 1,
          id: t.id,
          title: t.attributes?.name ?? '',
          durationMs: t.attributes?.durationInMillis ?? 0,
          featuredArtists: [],
        }));
        cacheSet(CACHE_KEY, tracks, TTL_6H);
        await setCache(CACHE_KEY, tracks);
      } catch (err) {
        console.warn(`[/api/album-durations] failed for ${id}:`, err.message ?? err);
        return;
      }
    }
    const totalMs = (tracks ?? []).reduce((sum, t) => sum + (t.durationMs ?? 0), 0);
    if (totalMs > 0) result[id] = totalMs;
  }));

  res.json(result);
});

// ── PATCH /api/re-listens ─────────────────────────────────────────────────────
// Updates rating + review on the most recent re_listens row for the authed user.
// Uses the service-role client so it bypasses RLS.

app.patch('/api/re-listens', [
  requireAuth,
  body('spotify_id').trim().notEmpty().isLength({ max: 100 }),
  body('rating').isInt({ min: 0, max: 10 }),
  body('review').optional({ nullable: true }).trim().customSanitizer(stripHtml).isLength({ max: 5000 }),
  validate,
], async (req, res) => {
  const userId  = req.user.id;
  const { spotify_id, rating, review } = req.body;
  const trimmed = typeof review === 'string' ? review.trim() || null : null;

  // Find the most recent re-listen row first so we only edit that one.
  const { data: latest, error: selErr } = await supabase
    .from('re_listens')
    .select('listened_at')
    .eq('user_id', userId)
    .eq('spotify_id', spotify_id)
    .order('listened_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (selErr) return res.status(500).json({ error: selErr.message });
  if (!latest) return res.status(404).json({ error: 'No re-listen row found' });

  const { error } = await supabase
    .from('re_listens')
    .update({ rating, review: trimmed })
    .eq('user_id', userId)
    .eq('spotify_id', spotify_id)
    .eq('listened_at', latest.listened_at);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ── POST /api/flip-pool-artworks ──────────────────────────────────────────────
// Batch artwork lookup for the Flip a Record pool.
// Body: [{id, title, artist}]  →  returns {[id]: artworkUrl}
// Checks Supabase search cache first; only hits Apple Music for cache misses.

app.post('/api/flip-pool-artworks', [
  body('*.title').optional().trim().customSanitizer(stripHtml).isLength({ max: 200 }),
  body('*.artist').optional().trim().customSanitizer(stripHtml).isLength({ max: 200 }),
  body('*.id').optional().trim().isLength({ max: 50 }),
  validate,
], async (req, res) => {
  const albums = req.body;
  if (!Array.isArray(albums)) return res.status(400).json({ error: 'expected array' });

  const result = {};
  const uncached = [];

  // First pass: serve from cache
  for (const album of albums) {
    const key = `search:album:${(album.title + ' ' + album.artist).trim().toLowerCase()}`;
    const mem = cacheGet(key);
    if (mem?.[0]?.artworkUrl) { result[album.id] = mem[0].artworkUrl; continue; }
    const db = await getCached(key, TTL_24H);
    if (db?.[0]?.artworkUrl) { cacheSet(key, db, TTL_10M); result[album.id] = db[0].artworkUrl; continue; }
    uncached.push(album);
  }

  // Second pass: fetch uncached with concurrency limit of 5
  const CONCURRENCY = 5;
  for (let i = 0; i < uncached.length; i += CONCURRENCY) {
    await Promise.all(uncached.slice(i, i + CONCURRENCY).map(async (album) => {
      const key = `search:album:${(album.title + ' ' + album.artist).trim().toLowerCase()}`;
      try {
        const q    = encodeURIComponent(`${album.title} ${album.artist}`);
        const url  = `https://api.music.apple.com/v1/catalog/us/search?term=${q}&types=albums&limit=5`;
        const resp = await fetch(url, { headers: { Authorization: `Bearer ${generateAppleToken()}` } });
        if (!resp.ok) return;
        const data  = await resp.json();
        const toUrl = raw => (raw?.url ?? '').replace('{w}x{h}', '500x500');
        const items = (data.results?.albums?.data ?? []).map(item => ({
          id: item.id,
          title: item.attributes?.name ?? '',
          artist: item.attributes?.artistName ?? '',
          year: parseInt(item.attributes?.releaseDate?.slice(0, 4) ?? '0', 10),
          artworkUrl: toUrl(item.attributes?.artwork),
        }));
        cacheSet(key, items, TTL_10M);
        await setCache(key, items);
        if (items[0]?.artworkUrl) result[album.id] = items[0].artworkUrl;
      } catch { /* skip individual failures */ }
    }));
  }

  res.json(result);
});

// ── GET /refresh ──────────────────────────────────────────────────────────────

app.get('/refresh', requireAdmin, async (req, res) => {
  try {
    await runRefresh();
    cacheClear('home', 'genres', 'decades',
               'discover:new-releases', 'discover:popular', 'discover:coming-soon',
               'discover:classics', 'discover:top-rated', 'discover:recommended');
    console.log('[/refresh] Cache cleared after refresh.');
    res.json({ success: true });
  } catch (err) {
    console.error('[/refresh]', err.message ?? err);
    res.status(500).json({ success: false, error: err.message ?? 'Refresh failed' });
  }
});

// ── GET /api/admin/refresh-home-artists ───────────────────────────────────────

app.get('/api/admin/refresh-home-artists', requireAdmin, async (req, res) => {
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

// ── GET /api/admin/purge-home-cache ──────────────────────────────────────────

app.get('/api/admin/purge-home-cache', requireAdmin, async (req, res) => {
  try {
    cacheClear('home');
    await deleteCache('home');
    console.log('[/api/admin/purge-home-cache] done.');
    res.json({ success: true });
  } catch (err) {
    console.error('[/api/admin/purge-home-cache]', err.message ?? err);
    res.status(500).json({ success: false, error: err.message ?? 'Purge failed' });
  }
});

// ── GET /api/admin/purge-artist-album-cache ───────────────────────────────────

app.get('/api/admin/purge-artist-album-cache', requireAdmin, async (req, res) => {
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

// ── GET /api/admin/purge-discover-cache ──────────────────────────────────────

app.get('/api/admin/purge-discover-cache', requireAdmin, async (req, res) => {
  try {
    const keys = ['discover:new-releases', 'discover:popular', 'discover:coming-soon',
                  'discover:classics', 'discover:top-rated', 'discover:recommended',
                  'discover:community-popular', 'discover:community-top-rated',
                  'discover:community-top-artists', 'discover:community-top-songs'];
    cacheClear(...keys);
    await Promise.all(keys.map(k => deleteCache(k)));
    console.log('[/api/admin/purge-discover-cache] done.');
    res.json({ success: true });
  } catch (err) {
    console.error('[/api/admin/purge-discover-cache]', err.message ?? err);
    res.status(500).json({ success: false, error: err.message ?? 'Purge failed' });
  }
});

// ── GET /api/admin/purge-lastfm-cache ─────────────────────────────────────────

app.get('/api/admin/purge-lastfm-cache', requireAdmin, async (req, res) => {
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

// ── GET /api/admin/populate-genres ───────────────────────────────────────────
// Searches AM for every album in GENRE_ALBUMS, then replaces genre_albums rows.
// Run once after deploying a new genre list. Takes ~60–90 s for 576 albums.

app.get('/api/admin/populate-genres', requireAdmin, async (req, res) => {
  const BATCH = 4;   // smaller batches to stay under AM rate limit
  const DELAY = 500; // ms between batches

  const populated = [];
  const errors    = [];

  try {
    // Wipe existing rows for the genres we're about to insert.
    const genreNames = Object.keys(GENRE_ALBUMS);
    const { error: delErr } = await supabase.from('genre_albums').delete().in('genre_label', genreNames);
    if (delErr) throw delErr;

    for (const [genre, albums] of Object.entries(GENRE_ALBUMS)) {
      for (let i = 0; i < albums.length; i += BATCH) {
        const batch = albums.slice(i, i + BATCH);

        await Promise.all(batch.map(async ({ artist, title }) => {
          try {
            const q    = encodeURIComponent(`${artist} ${title}`);
            const data = await amFetch(`/catalog/us/search?term=${q}&types=albums&limit=1`);
            const item = data.results?.albums?.data?.[0];

            if (!item) {
              errors.push({ genre, artist, title, error: 'not found in AM catalog' });
              return;
            }

            const artworkUrl = amArtwork(item.attributes?.artwork);
            const year       = parseInt(item.attributes?.releaseDate?.slice(0, 4) ?? '0', 10);
            const amTitle    = item.attributes?.name    ?? title;
            const amArtist   = item.attributes?.artistName ?? artist;

            // ignoreDuplicates handles the case where two search queries resolve
            // to the same AM album ID within the same genre — just keep the first.
            const { error: insertErr } = await supabase.from('genre_albums').upsert({
              genre_label: genre,
              spotify_id:  item.id,
              title:       amTitle,
              artist:      amArtist,
              artwork_url: artworkUrl,
              year,
            }, { onConflict: 'genre_label,spotify_id', ignoreDuplicates: true });

            if (insertErr) {
              errors.push({ genre, artist, title, error: insertErr.message });
            } else {
              populated.push({ genre, title: amTitle, artist: amArtist, id: item.id });
            }
          } catch (e) {
            errors.push({ genre, artist, title, error: e.message });
          }
        }));

        if (i + BATCH < albums.length) {
          await new Promise(r => setTimeout(r, DELAY));
        }
      }

      console.log(`[populate-genres] ${genre}: done (${albums.length} albums)`);
    }

    // Bust the genres cache so the next client request fetches fresh data.
    cacheClear('genres');
    await deleteCache('genres');

    console.log(`[populate-genres] complete — ${populated.length} inserted, ${errors.length} errors`);
    res.json({ ok: true, inserted: populated.length, errors: errors.length, errorDetails: errors });
  } catch (err) {
    console.error('[populate-genres] fatal:', err.message ?? err);
    res.status(500).json({ ok: false, error: err.message ?? 'Failed' });
  }
});

// ── GET /api/admin/populate-decades ──────────────────────────────────────────
// Searches AM for every album in DECADE_ALBUMS, then replaces decade_albums rows.
// Run once after deploying a new decade list. Takes ~90–120 s for 384 albums.

app.get('/api/admin/populate-decades', requireAdmin, async (req, res) => {
  const BATCH = 4;
  const DELAY = 500;

  const populated = [];
  const errors    = [];

  try {
    const decadeNames = Object.keys(DECADE_ALBUMS);
    const { error: delErr } = await supabase.from('decade_albums').delete().in('decade_label', decadeNames);
    if (delErr) throw delErr;

    for (const [decade, albums] of Object.entries(DECADE_ALBUMS)) {
      for (let i = 0; i < albums.length; i += BATCH) {
        const batch = albums.slice(i, i + BATCH);

        await Promise.all(batch.map(async ({ artist, title }) => {
          try {
            const q    = encodeURIComponent(`${artist} ${title}`);
            const data = await amFetch(`/catalog/us/search?term=${q}&types=albums&limit=1`);
            const item = data.results?.albums?.data?.[0];

            if (!item) {
              errors.push({ decade, artist, title, error: 'not found in AM catalog' });
              return;
            }

            const artworkUrl = amArtwork(item.attributes?.artwork);
            const year       = parseInt(item.attributes?.releaseDate?.slice(0, 4) ?? '0', 10);
            const amTitle    = item.attributes?.name       ?? title;
            const amArtist   = item.attributes?.artistName ?? artist;

            const { error: insertErr } = await supabase.from('decade_albums').upsert({
              decade_label: decade,
              spotify_id:   item.id,
              title:        amTitle,
              artist:       amArtist,
              artwork_url:  artworkUrl,
              year,
            }, { onConflict: 'decade_label,spotify_id', ignoreDuplicates: true });

            if (insertErr) {
              errors.push({ decade, artist, title, error: insertErr.message });
            } else {
              populated.push({ decade, title: amTitle, artist: amArtist, id: item.id });
            }
          } catch (e) {
            errors.push({ decade, artist, title, error: e.message });
          }
        }));

        if (i + BATCH < albums.length) {
          await new Promise(r => setTimeout(r, DELAY));
        }
      }

      console.log(`[populate-decades] ${decade}: done (${albums.length} albums)`);
    }

    cacheClear('decades');
    await deleteCache('decades');

    console.log(`[populate-decades] complete — ${populated.length} inserted, ${errors.length} errors`);
    res.json({ ok: true, inserted: populated.length, errors: errors.length, errorDetails: errors });
  } catch (err) {
    console.error('[populate-decades] fatal:', err.message ?? err);
    res.status(500).json({ ok: false, error: err.message ?? 'Failed' });
  }
});

// ── Cron: refresh every 6 hours ───────────────────────────────────────────────

cron.schedule('0 */6 * * *', () => {
  console.log('[cron] Triggering scheduled refresh...');
  runRefresh().then(() => {
    cacheClear('home', 'genres', 'decades',
               'discover:new-releases', 'discover:popular', 'discover:coming-soon',
               'discover:classics', 'discover:top-rated', 'discover:recommended');
    console.log('[cron] Cache cleared after refresh.');
  });
});

// Weekly Monday 6 am — bust coming-soon so it re-fetches fresh pre-adds for the new week.
cron.schedule('0 6 * * 1', async () => {
  console.log('[cron:weekly] Refreshing coming-soon cache...');
  cacheClear('discover:coming-soon');
  await deleteCache('discover:coming-soon');
  console.log('[cron:weekly] coming-soon cache cleared — will re-fetch on next request.');
});

// ── POST /api/upload-avatar ───────────────────────────────────────────────────
// Accepts { user_id, image_base64 }, uploads to the 'avatars' bucket using the
// service-role key (bypasses RLS), returns { url }.

app.post('/api/upload-avatar', requireAuth, [
  body('user_id').trim().isUUID().withMessage('user_id must be a valid UUID'),
  validate,
], async (req, res) => {
  const { user_id, image_base64 } = req.body;
  if (!user_id || !image_base64) {
    return res.status(400).json({ error: 'Missing user_id or image_base64' });
  }
  if (req.user.id !== user_id) return res.status(403).json({ error: 'Forbidden' });

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

app.post('/api/upload-cover', requireAuth, [
  body('user_id').trim().isUUID().withMessage('user_id must be a valid UUID'),
  validate,
], async (req, res) => {
  const { user_id, image_base64 } = req.body;
  if (!user_id || !image_base64) {
    return res.status(400).json({ error: 'Missing user_id or image_base64' });
  }
  if (req.user.id !== user_id) return res.status(403).json({ error: 'Forbidden' });

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

app.post('/api/delete-cover', requireAuth, [
  body('user_id').trim().isUUID().withMessage('user_id must be a valid UUID'),
  validate,
], async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) {
    return res.status(400).json({ error: 'Missing user_id' });
  }
  if (req.user.id !== user_id) return res.status(403).json({ error: 'Forbidden' });

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

// ── Featured Playlists ────────────────────────────────────────────────────────

// Search Apple Music for a single album by artist + title. Returns a SpotifyAlbum-compatible object.
async function searchAMAlbum(artist, title, attempt = 0) {
  const term = encodeURIComponent(`${title} ${artist}`);
  const fallback = { id: `fp-${artist}-${title}`.replace(/\s+/g, '-').toLowerCase(), title, artist, year: 0, artworkUrl: '' };
  try {
    const data = await amFetch(`/catalog/us/search?types=albums&term=${term}&limit=1`);
    const item = data?.results?.albums?.data?.[0];
    if (!item) {
      if (attempt < 2) { await new Promise(r => setTimeout(r, 600 * (attempt + 1))); return searchAMAlbum(artist, title, attempt + 1); }
      return fallback;
    }
    const artworkUrl = amArtwork(item.attributes?.artwork);
    if (!artworkUrl && attempt < 2) { await new Promise(r => setTimeout(r, 600 * (attempt + 1))); return searchAMAlbum(artist, title, attempt + 1); }
    return {
      id: item.id,
      title: item.attributes?.name ?? title,
      artist: item.attributes?.artistName ?? artist,
      year: parseInt(item.attributes?.releaseDate?.slice(0, 4) ?? '0', 10),
      artworkUrl,
    };
  } catch {
    if (attempt < 2) { await new Promise(r => setTimeout(r, 800 * (attempt + 1))); return searchAMAlbum(artist, title, attempt + 1); }
    return fallback;
  }
}

// Deduplicate an album array by Apple Music ID, keeping first occurrence.
function dedupeAlbums(albums) {
  const seen = new Set();
  return albums.filter(a => {
    if (!a || seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });
}

// Fetch with limited concurrency to avoid Apple Music rate limiting.
async function fetchConcurrent(items, fn, limit = 5) {
  const results = [];
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    results.push(...await Promise.all(batch.map(fn)));
    if (i + limit < items.length) await new Promise(r => setTimeout(r, 250));
  }
  return results;
}

// Fetch the first 4 artwork URLs for a playlist (used for the mosaic thumbnail).
async function getPlaylistArtwork(id) {
  if (id === 'all-time-classics') {
    const first4 = CLASSIC_IDS.split(',').slice(0, 4).join(',');
    const data = await amFetch(`/catalog/us/albums?ids=${first4}`);
    return (data.data ?? []).map(item => amArtwork(item.attributes?.artwork));
  }
  const albums = PLAYLIST_ALBUMS[id] ?? [];
  return Promise.all(
    albums.slice(0, 4).map(({ artist, title }) =>
      searchAMAlbum(artist, title).then(r => r?.artworkUrl ?? '').catch(() => ''),
    ),
  );
}

// GET /api/featured-playlists — returns all 8 playlists with metadata + 4 artwork URLs each
app.get('/api/featured-playlists', async (req, res) => {
  const CACHE_KEY = 'featured-playlists:meta:v6';
  try {
    const mem = cacheGet(CACHE_KEY);
    if (mem) return res.json(mem);
    const db = await getCached(CACHE_KEY, TTL_24H);
    if (db) { cacheSet(CACHE_KEY, db, TTL_6H); return res.json(db); }

    const result = await Promise.all(
      FEATURED_PLAYLIST_META.map(async meta => {
        const artworkUrls = await getPlaylistArtwork(meta.id);
        const albumCount = meta.id === 'all-time-classics'
          ? 48
          : (PLAYLIST_ALBUMS[meta.id]?.length ?? 0);
        return { ...meta, albumCount, artworkUrls };
      }),
    );

    cacheSet(CACHE_KEY, result, TTL_6H);
    await setCache(CACHE_KEY, result);
    res.json(result);
  } catch (err) {
    console.error('[/api/featured-playlists] error:', err.message ?? err);
    res.status(500).json({ error: err.message ?? 'Internal server error' });
  }
});

// GET /api/featured-playlists/:id — returns full album list for one playlist
app.get('/api/featured-playlists/:id', [
  param('id').matches(/^[a-z0-9-]+$/).withMessage('Invalid playlist id'),
  validate,
], async (req, res) => {
  const { id } = req.params;
  const CACHE_KEY = `featured-playlist:v6:${id}`;
  try {
    const mem = cacheGet(CACHE_KEY);
    if (mem) {
      // Serve from memory cache but evict if artwork is missing so next request re-fetches
      const missingCount = mem.filter(a => !a.artworkUrl).length;
      if (missingCount > 0) {
        cacheClear(CACHE_KEY);
        deleteCache(CACHE_KEY).catch(() => {});
      } else {
        return res.json(mem);
      }
    }
    const db = await getCached(CACHE_KEY, TTL_24H);
    if (db) {
      const missingCount = db.filter(a => !a.artworkUrl).length;
      if (missingCount === 0) { cacheSet(CACHE_KEY, db, TTL_6H); return res.json(db); }
      // Cached data has missing artwork — fall through to re-fetch fresh
      console.log(`[featured-playlist:${id}] ${missingCount} albums missing artwork in cache, re-fetching`);
    }

    let albums;
    if (id === 'all-time-classics') {
      const resp = await fetch(`https://api.music.apple.com/v1/catalog/us/albums?ids=${CLASSIC_IDS}`, {
        headers: { Authorization: `Bearer ${generateAppleToken()}` },
      });
      if (!resp.ok) throw new Error(`AM albums → ${resp.status}`);
      const data = await resp.json();
      albums = dedupeAlbums((data.data ?? []).map(item => ({
        id: item.id,
        title: item.attributes?.name ?? '',
        artist: item.attributes?.artistName ?? '',
        year: parseInt(item.attributes?.releaseDate?.slice(0, 4) ?? '0', 10),
        artworkUrl: amArtwork(item.attributes?.artwork),
      })));
    } else {
      const list = PLAYLIST_ALBUMS[id];
      if (!list) return res.status(404).json({ error: 'Playlist not found' });
      albums = dedupeAlbums(await fetchConcurrent(list, ({ artist, title }) => searchAMAlbum(artist, title)));

      // Sequential fallback pass for any albums that still have no artwork
      const missing = albums.filter(a => !a.artworkUrl);
      if (missing.length > 0) {
        console.log(`[featured-playlist:${id}] retrying ${missing.length} albums without artwork sequentially`);
        const retried = new Map();
        for (const a of missing) {
          const fresh = await searchAMAlbum(a.artist, a.title);
          if (fresh.artworkUrl) retried.set(a.id, fresh);
          await new Promise(r => setTimeout(r, 300));
        }
        if (retried.size > 0) {
          albums = albums.map(a => retried.has(a.id) ? retried.get(a.id) : a);
        }
      }
    }

    cacheSet(CACHE_KEY, albums, TTL_6H);
    await setCache(CACHE_KEY, albums);
    res.json(albums);
  } catch (err) {
    console.error(`[/api/featured-playlists/${req.params.id}] error:`, err.message ?? err);
    res.status(500).json({ error: err.message ?? 'Internal server error' });
  }
});

// ── GET /apple-token ──────────────────────────────────────────────────────────

app.get('/apple-token', requireAuth, (req, res) => {
  res.json({ token: generateAppleToken() });
});

// ── DELETE /api/user/delete-account ───────────────────────────────────────────
// Deletes all user data then removes the auth user.
// Requires a valid Supabase JWT (requireAuth sets req.user).

app.delete('/api/user/delete-account', requireAuth, async (req, res) => {
  const userId = req.user.id;

  const tables = [
    'top5_changes',
    'want_to_listen',
    'notifications',
    'messages',
    'follows',
    'likes',
    'playlist_albums',
    'playlists',
    'user_albums',
    'profiles',
  ];

  for (const table of tables) {
    const col = table === 'messages' ? 'sender_id' : 'user_id';
    const { error } = await supabase.from(table).delete().eq(col, userId);
    if (error) {
      console.error(`[delete-account] failed on ${table}:`, error.message);
      return res.status(500).json({ error: `Failed to delete data from ${table}` });
    }
  }

  // messages also has a receiver_id side — clean that up too
  const { error: rcvErr } = await supabase.from('messages').delete().eq('receiver_id', userId);
  if (rcvErr) console.warn('[delete-account] receiver_id cleanup warning:', rcvErr.message);

  // follows also has a follower_id side
  const { error: followerErr } = await supabase.from('follows').delete().eq('follower_id', userId);
  if (followerErr) console.warn('[delete-account] follower_id cleanup warning:', followerErr.message);

  // Delete the auth user — requires service role key
  const { error: authErr } = await supabase.auth.admin.deleteUser(userId);
  if (authErr) {
    console.error('[delete-account] auth.admin.deleteUser failed:', authErr.message);
    return res.status(500).json({ error: 'Failed to delete auth user' });
  }

  console.log(`[delete-account] user ${userId} fully deleted`);
  return res.json({ success: true });
});

// ── GET /api/albums/streaming-links ──────────────────────────────────────────
// Returns Amazon Music direct link via Odesli. Cached 7 days.

app.get('/api/albums/streaming-links', [
  query('appleId').trim().matches(/^[a-zA-Z0-9_-]+$/).withMessage('invalid appleId').isLength({ max: 50 }),
  validate,
], async (req, res) => {
  const { appleId } = req.query;
  const CACHE_KEY = `streaming_links:${appleId}`;

  const mem = cacheGet(CACHE_KEY);
  if (mem) return res.json(mem);

  const db = await getCached(CACHE_KEY, TTL_7D);
  if (db) { cacheSet(CACHE_KEY, db, TTL_6H); return res.json(db); }

  try {
    const itunesUrl = `https://itunes.apple.com/us/album/id${appleId}`;
    const odesliResp = await fetch(
      `https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(itunesUrl)}`
    );
    if (!odesliResp.ok) throw new Error(`Odesli ${odesliResp.status}`);
    const odesli = await odesliResp.json();

    const payload = { amazonMusic: odesli.linksByPlatform?.amazonMusic?.url ?? null };

    cacheSet(CACHE_KEY, payload, TTL_6H);
    await setCache(CACHE_KEY, payload);
    res.json(payload);
  } catch (err) {
    console.error('[/api/albums/streaming-links]', err.message ?? err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/stats/artist-countries ──────────────────────────────────────────
// Looks up the country of origin for each artist via MusicBrainz.
// Results cached per artist — first load may be slow, repeat visits instant.

async function fetchArtistCountry(artistName) {
  const CACHE_KEY = `artist_country_${artistName.toLowerCase().replace(/\s+/g, '_')}`;
  const mem = cacheGet(CACHE_KEY);
  if (mem !== undefined) return (mem && mem.country) ? mem.country : null;
  const db = await getCached(CACHE_KEY, TTL_7D);
  if (db) { cacheSet(CACHE_KEY, db, TTL_7D); return db.country ?? null; }

  try {
    const resp = await fetch(
      `https://musicbrainz.org/ws/2/artist?query=artist:%22${encodeURIComponent(artistName)}%22&limit=1&fmt=json`,
      { headers: { 'User-Agent': 'Listend/1.0 (contact@listend.app)' } }
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    const country = data.artists?.[0]?.country ?? null;
    const payload = { country };
    cacheSet(CACHE_KEY, payload, TTL_7D);
    await setCache(CACHE_KEY, payload);
    return country;
  } catch { return null; }
}

app.get('/api/stats/artist-countries', requireAuth, [
  query('artists').trim().isLength({ max: 2000 }),
  validate,
], async (req, res) => {
  const raw = (req.query.artists ?? '').trim();
  if (!raw) return res.json({ countries: [], total: 0 });

  const artists = [...new Set(
    raw.split(',').map(a => a.trim()).filter(Boolean)
  )].slice(0, 100);

  // Process in batches of 5 with 1s between batches to stay within MB rate limit.
  // Cached artists resolve instantly so batching only applies to fresh lookups.
  const BATCH = 5;
  const countries = new Set();
  for (let i = 0; i < artists.length; i += BATCH) {
    const batch = artists.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(fetchArtistCountry));
    results.forEach(c => { if (c) countries.add(c); });
    if (i + BATCH < artists.length) await new Promise(r => setTimeout(r, 1000));
  }

  res.json({ countries: [...countries], total: countries.size });
});

// ── GET /api/stats/artist-images ──────────────────────────────────────────────
// Fetches Apple Music artist images for a list of artist names.
// Results cached per artist for 7 days.

async function fetchArtistImage(artistName) {
  const CACHE_KEY = `artist_img_${artistName.toLowerCase().replace(/\s+/g, '_')}`;
  const mem = cacheGet(CACHE_KEY);
  if (mem !== undefined) return mem || null;
  const db = await getCached(CACHE_KEY, TTL_7D);
  if (db) { cacheSet(CACHE_KEY, db, TTL_7D); return db; }

  try {
    const q = encodeURIComponent(artistName);
    const data = await amFetch(`/catalog/us/search?types=artists&term=${q}&limit=5`);
    const artists = data?.results?.artists?.data ?? [];
    // Prefer exact name match with artwork; fall back to any result with artwork
    const nameLower = artistName.toLowerCase();
    const exactWithArt = artists.find(a => a.attributes?.name?.toLowerCase() === nameLower && a.attributes?.artwork?.url);
    const anyWithArt   = artists.find(a => a.attributes?.artwork?.url);
    const match        = exactWithArt ?? anyWithArt ?? artists[0];
    const url = match ? amArtwork(match.attributes?.artwork) : null;
    cacheSet(CACHE_KEY, url, TTL_7D);
    if (url) await setCache(CACHE_KEY, url);
    return url;
  } catch { cacheSet(CACHE_KEY, null, TTL_7D); return null; }
}

app.get('/api/stats/artist-images', requireAuth, [
  query('artists').trim().isLength({ max: 2000 }),
  validate,
], async (req, res) => {
  const raw = (req.query.artists ?? '').trim();
  if (!raw) return res.json({ images: {} });
  const artistList = [...new Set(raw.split(',').map(a => a.trim()).filter(Boolean))].slice(0, 20);

  const pairs = await Promise.all(artistList.map(async name => [name, await fetchArtistImage(name)]));
  const images = {};
  for (const [name, url] of pairs) { if (url) images[name] = url; }
  res.json({ images });
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Listend server listening on port ${PORT}`);

  // Seed any genres in genreData.js that aren't yet in the DB.
  // Runs once on startup — safe to redeploy, upsert is idempotent.
  (async () => {
    try {
      const { data } = await supabase.from('genre_albums').select('genre_label').limit(1000);
      const seeded = new Set((data ?? []).map(r => r.genre_label));
      const missing = Object.keys(GENRE_ALBUMS).filter(g => !seeded.has(g));
      if (missing.length === 0) return;

      console.log('[startup] seeding missing genres:', missing);
      for (const genre of missing) {
        const albums = GENRE_ALBUMS[genre];
        for (let i = 0; i < albums.length; i += 4) {
          const batch = albums.slice(i, i + 4);
          await Promise.all(batch.map(async ({ artist, title }) => {
            try {
              const q    = encodeURIComponent(`${artist} ${title}`);
              const res  = await amFetch(`/catalog/us/search?term=${q}&types=albums&limit=1`);
              const item = res.results?.albums?.data?.[0];
              if (!item) return;
              await supabase.from('genre_albums').upsert({
                genre_label: genre,
                spotify_id:  item.id,
                title:       item.attributes?.name ?? title,
                artist:      item.attributes?.artistName ?? artist,
                artwork_url: amArtwork(item.attributes?.artwork),
                year:        parseInt(item.attributes?.releaseDate?.slice(0, 4) ?? '0', 10),
              }, { onConflict: 'genre_label,spotify_id', ignoreDuplicates: true });
            } catch (e) {
              console.error(`[startup] seed error ${genre} — ${artist} ${title}:`, e.message);
            }
          }));
          await new Promise(r => setTimeout(r, 500));
        }
        console.log(`[startup] seeded: ${genre}`);
      }
      cacheClear('genres');
      await deleteCache('genres');
      console.log('[startup] genre seed complete');
    } catch (e) {
      console.error('[startup] genre seed failed:', e.message);
    }
  })();

  // Pre-warm featured playlist caches so first user load is instant.
  (async () => {
    try {
      const ids = FEATURED_PLAYLIST_META.map(m => m.id);
      for (const id of ids) {
        const CACHE_KEY = `featured-playlist:v6:${id}`;
        const mem = cacheGet(CACHE_KEY);
        if (mem && mem.every(a => a.artworkUrl)) continue;
        const db = await getCached(CACHE_KEY, TTL_24H);
        if (db && db.every(a => a.artworkUrl)) { cacheSet(CACHE_KEY, db, TTL_6H); continue; }

        console.log(`[startup] pre-warming playlist: ${id}`);
        let albums;
        if (id === 'all-time-classics') {
          const resp = await fetch(`https://api.music.apple.com/v1/catalog/us/albums?ids=${CLASSIC_IDS}`, {
            headers: { Authorization: `Bearer ${generateAppleToken()}` },
          });
          if (!resp.ok) { console.warn(`[startup] all-time-classics AM fetch → ${resp.status}`); continue; }
          const data = await resp.json();
          albums = dedupeAlbums((data.data ?? []).map(item => ({
            id: item.id,
            title: item.attributes?.name ?? '',
            artist: item.attributes?.artistName ?? '',
            year: parseInt(item.attributes?.releaseDate?.slice(0, 4) ?? '0', 10),
            artworkUrl: amArtwork(item.attributes?.artwork),
          })));
        } else {
          const list = PLAYLIST_ALBUMS[id];
          if (!list) continue;
          albums = dedupeAlbums(await fetchConcurrent(list, ({ artist, title }) => searchAMAlbum(artist, title)));
          const missing = albums.filter(a => !a.artworkUrl);
          if (missing.length > 0) {
            console.log(`[startup:${id}] retrying ${missing.length} albums sequentially`);
            const retried = new Map();
            for (const a of missing) {
              const fresh = await searchAMAlbum(a.artist, a.title);
              if (fresh.artworkUrl) retried.set(a.id, fresh);
              await new Promise(r => setTimeout(r, 300));
            }
            if (retried.size > 0) albums = albums.map(a => retried.has(a.id) ? retried.get(a.id) : a);
          }
        }
        cacheSet(CACHE_KEY, albums, TTL_6H);
        await setCache(CACHE_KEY, albums);
        console.log(`[startup] cached playlist: ${id} (${albums.length} albums, ${albums.filter(a => a.artworkUrl).length} with artwork)`);
        await new Promise(r => setTimeout(r, 500));
      }
      console.log('[startup] featured playlist pre-warm complete');
    } catch (e) {
      console.error('[startup] featured playlist pre-warm failed:', e.message);
    }
  })();
});
