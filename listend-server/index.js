// listend backend server
require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const supabase = require('./db');
const { runRefresh } = require('./refresh');

const app = express();
const PORT = process.env.PORT || 8080;

// Allow any origin — the client is a mobile app, not a browser page
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

// ── GET /health ───────────────────────────────────────────────────────────────

app.get('/health', (req, res) => res.json({ ok: true }));

// ── GET /home ─────────────────────────────────────────────────────────────────
// Returns { albums, songs, artists } from Supabase cache.

app.get('/home', async (req, res) => {
  try {
    const [albumsRes, songsRes, artistsRes] = await Promise.all([
      supabase.from('home_albums').select('*').order('updated_at', { ascending: false }).limit(10),
      supabase.from('home_songs').select('*').order('updated_at', { ascending: false }).limit(10),
      supabase.from('home_artists').select('*').order('updated_at', { ascending: false }).limit(8),
    ]);

    if (albumsRes.error) throw albumsRes.error;
    if (songsRes.error) throw songsRes.error;
    if (artistsRes.error) throw artistsRes.error;

    res.json({
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
    });
  } catch (err) {
    console.error('[/home]', err.message ?? err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /genres ───────────────────────────────────────────────────────────────
// Returns albums grouped by genre_label: { Rap: [...], 'R&B': [...], ... }

app.get('/genres', async (req, res) => {
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

    res.json(grouped);
  } catch (err) {
    console.error('[/genres]', err.message ?? err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /decades ──────────────────────────────────────────────────────────────
// Returns albums grouped by decade_label: { '1950s': [...], '1960s': [...], ... }

app.get('/decades', async (req, res) => {
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

    res.json(grouped);
  } catch (err) {
    console.error('[/decades]', err.message ?? err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /refresh ──────────────────────────────────────────────────────────────
// Manual trigger for seeding or forcing a data update outside the cron schedule.

app.get('/refresh', async (req, res) => {
  try {
    await runRefresh();
    res.json({ success: true });
  } catch (err) {
    console.error('[/refresh]', err.message ?? err);
    res.status(500).json({ success: false, error: err.message ?? 'Refresh failed' });
  }
});

// ── Cron: refresh every 6 hours ───────────────────────────────────────────────

cron.schedule('0 */6 * * *', () => {
  console.log('[cron] Triggering scheduled refresh...');
  runRefresh();
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Listend server listening on port ${PORT}`);
});
