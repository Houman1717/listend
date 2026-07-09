import { supabase } from '@/lib/supabase';

export type CommunityStats = { avg: number; count: number };

// Same threshold as Discover Top Rated and the album-detail page — an album
// needs at least this many community ratings before its average counts for
// sorting, otherwise a single 9/10 outranks an album with 8 ratings at 8.8.
const MIN_RATINGS = 5;

// Strips accents/diacritics (e.g. "Björk" → "Bjork") so matches aren't missed
// when the same artist/title comes back spelled differently across catalog
// sources — different Apple Music search results can return either form.
function fold(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function communityStatsKey(title: string, artist: string): string {
  return `${fold(title)}::${fold(artist)}`;
}

// Community average rating + popularity (distinct listeners, re-listens
// capped at +1/user) for a set of albums — matched by title+artist rather
// than catalog ID, same as the Discover ranking endpoints, so an album
// logged under multiple catalog IDs (reissues/remasters) isn't undercounted.
export async function fetchCommunityStats(
  items: { title: string; artist: string }[]
): Promise<Map<string, CommunityStats>> {
  const titles = [...new Set(items.map(i => i.title).filter(Boolean))];
  if (titles.length === 0) return new Map();

  const [{ data: logs }, { data: relistens }] = await Promise.all([
    supabase
      .from('user_albums')
      .select('title, artist, rating, user_id')
      .in('title', titles)
      .not('listened_at', 'is', null),
    supabase
      .from('re_listens')
      .select('title, artist, user_id')
      .in('title', titles)
      .not('listened_at', 'is', null),
  ]);

  const acc = new Map<string, { sum: number; ratedCount: number; baseUsers: Set<string>; relistenUsers: Set<string> }>();
  const getEntry = (title: string, artist: string) => {
    const key = communityStatsKey(title, artist);
    let e = acc.get(key);
    if (!e) { e = { sum: 0, ratedCount: 0, baseUsers: new Set(), relistenUsers: new Set() }; acc.set(key, e); }
    return e;
  };

  for (const row of (logs ?? []) as any[]) {
    if (!row.title || !row.artist || !row.user_id) continue;
    const e = getEntry(row.title, row.artist);
    e.baseUsers.add(row.user_id);
    if (row.rating > 0) { e.sum += row.rating; e.ratedCount++; }
  }
  for (const row of (relistens ?? []) as any[]) {
    if (!row.title || !row.artist || !row.user_id) continue;
    getEntry(row.title, row.artist).relistenUsers.add(row.user_id);
  }

  const result = new Map<string, CommunityStats>();
  acc.forEach((e, key) => {
    result.set(key, {
      avg: e.ratedCount >= MIN_RATINGS ? e.sum / e.ratedCount : 0,
      count: e.baseUsers.size + e.relistenUsers.size,
    });
  });
  return result;
}
