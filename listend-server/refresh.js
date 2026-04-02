// Full data refresh: fetch from Spotify, upsert into Supabase.
// Called on server startup and by the 6-hour cron job.

const { spotifyGet, albumFromItem, trackFromItem, artistFromItem, delay } = require('./spotify');
const supabase = require('./db');
const { PLACEHOLDER_ARTISTS, GENRES, DECADES } = require('./seed-data');

async function refreshHome() {
  console.log('[refresh] home — fetching albums, songs, artists...');
  const now = new Date().toISOString();

  // New releases
  const albumData = await spotifyGet('/search?q=tag:new&type=album&limit=10&market=US').catch(() => null);
  const albums = (albumData?.albums?.items ?? []).map(albumFromItem);

  await delay(120);

  // Trending tracks
  const songData = await spotifyGet('/search?q=year:2025&type=track&limit=10&market=US').catch(() => null);
  const songs = (songData?.tracks?.items ?? []).map(trackFromItem);

  // Artists — one search per entry
  const artists = [];
  for (const p of PLACEHOLDER_ARTISTS) {
    await delay(120);
    const q = encodeURIComponent(p.name);
    const data = await spotifyGet(`/search?q=${q}&type=artist&limit=1&market=US`).catch(() => null);
    const item = data?.artists?.items?.[0];
    if (item) artists.push(artistFromItem(item, p.genre));
  }

  // Upsert — update updated_at so ORDER BY updated_at DESC always returns the latest batch first
  if (albums.length) {
    const { error } = await supabase
      .from('home_albums')
      .upsert(albums.map(a => ({ ...a, updated_at: now })), { onConflict: 'spotify_id' });
    if (error) console.error('[refresh] home_albums upsert error:', error.message);
  }

  if (songs.length) {
    const { error } = await supabase
      .from('home_songs')
      .upsert(songs.map(s => ({ ...s, updated_at: now })), { onConflict: 'spotify_id' });
    if (error) console.error('[refresh] home_songs upsert error:', error.message);
  }

  if (artists.length) {
    const { error } = await supabase
      .from('home_artists')
      .upsert(artists.map(a => ({ ...a, updated_at: now })), { onConflict: 'spotify_id' });
    if (error) console.error('[refresh] home_artists upsert error:', error.message);
  }

  console.log(`[refresh] home — ${albums.length} albums, ${songs.length} songs, ${artists.length} artists`);
}

async function refreshGenres() {
  console.log('[refresh] genres — fetching curated albums...');
  const now = new Date().toISOString();

  for (const genre of GENRES) {
    const rows = [];
    for (const entry of genre.albums) {
      await delay(120);
      const q = encodeURIComponent(`album:${entry.album} artist:${entry.artist}`);
      const data = await spotifyGet(`/search?q=${q}&type=album&limit=1&market=US`).catch(() => null);
      const item = data?.albums?.items?.[0];
      if (item) {
        rows.push({ ...albumFromItem(item), genre_label: genre.label, updated_at: now });
      }
    }
    if (rows.length) {
      const { error } = await supabase
        .from('genre_albums')
        .upsert(rows, { onConflict: 'genre_label,spotify_id' });
      if (error) console.error(`[refresh] genre_albums "${genre.label}" error:`, error.message);
    }
    console.log(`[refresh] genre "${genre.label}" — ${rows.length} albums`);
  }
}

async function refreshDecades() {
  console.log('[refresh] decades — fetching curated albums...');
  const now = new Date().toISOString();

  for (const decade of DECADES) {
    const rows = [];
    for (const entry of decade.albums) {
      await delay(120);
      const q = encodeURIComponent(`album:${entry.album} artist:${entry.artist}`);
      const data = await spotifyGet(`/search?q=${q}&type=album&limit=1&market=US`).catch(() => null);
      const item = data?.albums?.items?.[0];
      if (item) {
        rows.push({ ...albumFromItem(item), decade_label: decade.label, updated_at: now });
      }
    }
    if (rows.length) {
      const { error } = await supabase
        .from('decade_albums')
        .upsert(rows, { onConflict: 'decade_label,spotify_id' });
      if (error) console.error(`[refresh] decade_albums "${decade.label}" error:`, error.message);
    }
    console.log(`[refresh] decade "${decade.label}" — ${rows.length} albums`);
  }
}

async function runRefresh() {
  console.log('[refresh] ── Starting full refresh ──');
  try {
    await refreshHome();
    await refreshGenres();
    await refreshDecades();
    console.log('[refresh] ── Complete ──');
  } catch (err) {
    console.error('[refresh] Unhandled error:', err.message ?? err);
  }
}

module.exports = { runRefresh };
