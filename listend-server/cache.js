// Supabase-backed persistent cache
// Table schema (run once in Supabase SQL editor):
//   CREATE TABLE IF NOT EXISTS api_cache (
//     key        TEXT PRIMARY KEY,
//     data       JSONB NOT NULL,
//     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
//   );

const supabase = require('./db');

const TTL_7D  = 7  * 24 * 60 * 60 * 1000;
const TTL_24H = 24 * 60 * 60 * 1000;

async function getCached(key, ttlMs) {
  try {
    const { data, error } = await supabase
      .from('api_cache')
      .select('data, created_at')
      .eq('key', key)
      .single();

    if (error || !data) return null;

    const age = Date.now() - new Date(data.created_at).getTime();
    if (age > ttlMs) return null;

    return data.data;
  } catch {
    return null;
  }
}

async function setCache(key, payload) {
  try {
    await supabase
      .from('api_cache')
      .upsert(
        { key, data: payload, created_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
  } catch (err) {
    console.warn('[cache] setCache error:', err.message ?? err);
  }
}

async function deleteCache(key) {
  try {
    await supabase.from('api_cache').delete().eq('key', key);
  } catch (err) {
    console.warn('[cache] deleteCache error:', err.message ?? err);
  }
}

async function deleteCachePrefix(prefix) {
  try {
    const { error } = await supabase
      .from('api_cache')
      .delete()
      .ilike('key', `${prefix}%`);
    if (error) throw error;
  } catch (err) {
    console.warn('[cache] deleteCachePrefix error:', err.message ?? err);
  }
}

// getCached ignores any row older than the TTL it's asked for, and the longest
// TTL any caller uses is 7 days — so past that a row is never served again. Nothing
// ever deleted them, though: by Sept 2026 api_cache held 114k rows / 147 MB (63%
// of the whole database), 69% of them expired, which added memory pressure on a
// small compute tier. PRUNE_AGE keeps a day of margin over the longest TTL.
//
// Deletes go in small batches — keys are listed 1,000 at a time and deleted 100
// per request, since a long `.in()` list overflows the URL (see fetchAllRowsIn in
// index.js) and one giant DELETE would hold locks and hit the statement timeout.
const PRUNE_AGE = TTL_7D + TTL_24H;

async function pruneExpiredCache(maxBatches = 200) {
  const cutoff = new Date(Date.now() - PRUNE_AGE).toISOString();
  let deleted = 0;
  try {
    for (let batch = 0; batch < maxBatches; batch++) {
      const { data, error } = await supabase
        .from('api_cache')
        .select('key')
        .lt('created_at', cutoff)
        .limit(1000);
      if (error) throw error;
      if (!data?.length) break;

      const keys = data.map(r => r.key);
      for (let i = 0; i < keys.length; i += 100) {
        const { error: delErr } = await supabase
          .from('api_cache')
          .delete()
          .in('key', keys.slice(i, i + 100));
        if (delErr) throw delErr;
        deleted += Math.min(100, keys.length - i);
      }
      if (data.length < 1000) break;
    }
  } catch (err) {
    console.warn('[cache] pruneExpiredCache error:', err.message ?? err);
  }
  return deleted;
}

module.exports = { getCached, setCache, deleteCache, deleteCachePrefix, pruneExpiredCache, TTL_7D, TTL_24H };
