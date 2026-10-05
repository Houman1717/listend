// Member search shared by the Search tab and My Stats → Compare, so both find
// and order people the same way.
import { supabase } from '@/lib/supabase';

export type MemberRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_pro?: boolean | null;
};

/** Lowercased query without a leading @ — what ranking compares against. */
export const memberQuery = (text: string) => text.trim().replace(/^@/, '').toLowerCase();

// Best match first: exact > name starts with the text > a word in the name
// starts with it > anywhere. Ties go to `preferIds` (e.g. people you follow),
// then real accounts (a name set), then Pro, then a profile photo, then the
// shorter name.
export function rankMembers<T extends MemberRow>(users: T[], q: string, preferIds?: Set<string>): T[] {
  const tier = (u: T) => {
    const names = [u.username, u.display_name].filter(Boolean).map(n => n!.toLowerCase());
    if (names.some(n => n === q)) return 0;
    if (names.some(n => n.startsWith(q))) return 1;
    if (names.some(n => n.split(/[\s._-]+/).some(w => w.startsWith(q)))) return 2;
    return 3;
  };
  const len = (u: T) => (u.display_name || u.username || '').length;
  const preferred = (u: T) => (preferIds?.has(u.id) ? 1 : 0);
  return users
    .map(u => ({ u, t: tier(u) }))
    .sort((a, b) =>
      a.t - b.t
      || preferred(b.u) - preferred(a.u)
      || Number(!(a.u.display_name || a.u.username)) - Number(!(b.u.display_name || b.u.username))
      || Number(!!b.u.is_pro) - Number(!!a.u.is_pro)
      || Number(!!b.u.avatar_url) - Number(!!a.u.avatar_url)
      || len(a.u) - len(b.u))
    .map(x => x.u);
}

/**
 * Profiles matching `text`, unranked. Two queries: names that START with the
 * text, then names that merely contain it — one substring query returned an
 * arbitrary 30, so the exact match ("willi" → WilliWillsWissen) could land
 * 9th or not at all. Throws if the prefix query fails.
 */
export async function fetchMembers(text: string, limit = 30): Promise<MemberRow[]> {
  // Characters that would break the PostgREST .or() filter syntax.
  const safe = memberQuery(text).replace(/[%_,()*\\]/g, '');
  if (!safe) return [];
  const cols = 'id, username, display_name, avatar_url, is_pro';
  const [prefixRes, containsRes] = await Promise.all([
    supabase.from('profiles').select(cols)
      .or(`username.ilike.${safe}%,display_name.ilike.${safe}%`).limit(limit),
    supabase.from('profiles').select(cols)
      .or(`username.ilike.%${safe}%,display_name.ilike.%${safe}%`).limit(limit),
  ]);
  if (prefixRes.error) throw prefixRes.error;
  const byId = new Map<string, MemberRow>();
  for (const u of [...(prefixRes.data ?? []), ...(containsRes.data ?? [])]) byId.set(u.id, u as MemberRow);
  return [...byId.values()];
}
