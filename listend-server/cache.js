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

module.exports = { getCached, setCache, TTL_7D, TTL_24H };
