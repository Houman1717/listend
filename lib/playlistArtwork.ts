import { supabase } from '@/lib/supabase';
import { fetchAllRows } from '@/lib/supabaseQuery';

// Loaders for other people's playlist mosaics (the 2×2 cover grid).

export type PlaylistAlbumRow = { playlist_id: string; spotify_id: string; position: number };

/** Every album in these playlists, in order. Paged — one select stops at 1000 rows. */
export async function fetchPlaylistAlbums(playlistIds: string[]): Promise<PlaylistAlbumRow[]> {
  if (playlistIds.length === 0) return [];
  const rows = await fetchAllRows<PlaylistAlbumRow>(
    (from, to) => supabase
      .from('playlist_albums')
      .select('playlist_id, spotify_id, position')
      .in('playlist_id', playlistIds)
      .order('playlist_id')
      .order('position', { ascending: true })
      .range(from, to),
    20,
  );
  return rows ?? [];
}

/**
 * Covers for the mosaics: the first four albums of each playlist, looked up in
 * the owners' own logs. Screens used to read either the owner's whole library
 * or every user's log of every album in one select, and a select stops at 1000
 * rows — so a big library or a popular album left blank tiles for whatever
 * fell past the cut. Albums the owner never logged fall back to anyone else's
 * log of the same album.
 */
export async function fetchMosaicArtwork(
  playlists: { albumIds: string[] }[],
  ownerIds: string[],
): Promise<Map<string, string>> {
  const artMap = new Map<string, string>();
  const ids = [...new Set(playlists.flatMap(p => p.albumIds.slice(0, 4)))];
  if (ids.length === 0) return artMap;

  for (let i = 0; ownerIds.length > 0 && i < ids.length; i += 100) {
    const { data } = await supabase
      .from('user_albums')
      .select('spotify_id, artwork_url')
      .in('spotify_id', ids.slice(i, i + 100))
      .in('user_id', ownerIds)
      .not('artwork_url', 'is', null);
    for (const a of (data ?? []) as { spotify_id: string; artwork_url: string }[]) {
      if (!artMap.has(a.spotify_id)) artMap.set(a.spotify_id, a.artwork_url);
    }
  }

  const missing = ids.filter(id => !artMap.has(id));
  for (let i = 0; i < missing.length; i += 100) {
    const chunk = missing.slice(i, i + 100);
    const { data } = await supabase
      .from('user_albums')
      .select('spotify_id, artwork_url')
      .in('spotify_id', chunk)
      .not('artwork_url', 'is', null)
      .limit(chunk.length * 5);
    for (const a of (data ?? []) as { spotify_id: string; artwork_url: string }[]) {
      if (!artMap.has(a.spotify_id)) artMap.set(a.spotify_id, a.artwork_url);
    }
  }
  return artMap;
}

/** Up to four cover URLs per playlist, for screens that only have playlist ids. */
export async function fetchPlaylistCovers(playlistIds: string[]): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (playlistIds.length === 0) return result;

  const [pas, { data: pls }] = await Promise.all([
    fetchPlaylistAlbums(playlistIds),
    supabase.from('playlists').select('id, user_id').in('id', playlistIds),
  ]);
  const playlists = playlistIds.map(id => ({
    id,
    albumIds: pas.filter(a => a.playlist_id === id).map(a => a.spotify_id),
  }));
  const ownerIds = [...new Set(((pls ?? []) as { user_id: string }[]).map(p => p.user_id))];
  const artMap = await fetchMosaicArtwork(playlists, ownerIds);

  for (const p of playlists) {
    result.set(p.id, p.albumIds.slice(0, 4).map(id => artMap.get(id) ?? '').filter(Boolean));
  }
  return result;
}
