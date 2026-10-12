// Song playlists — separate from album playlists (supabase/add-song-playlists.sql).

import { supabase } from '@/lib/supabase';
import { fetchAllRowsIn, rowsOrNull } from '@/lib/supabaseQuery';
import type { SongMeta } from '@/lib/songReviews';

export type SongPlaylist = {
  id:           string;
  userId:       string;
  name:         string;
  description?: string;
  createdAt:    string;
  /** In playlist order. */
  songs:        SongMeta[];
};

export const SONG_ITEM_COLUMNS =
  'playlist_id, song_id, position, title, artist, album_id, album_title, artwork_url, duration_ms';

export function itemRowToSong(r: any): SongMeta {
  return {
    id:         r.song_id,
    title:      r.title,
    artist:     r.artist,
    albumId:    r.album_id ?? undefined,
    albumTitle: r.album_title ?? undefined,
    artworkUrl: r.artwork_url ?? undefined,
    durationMs: r.duration_ms ?? undefined,
  };
}

export function songToItemRow(playlistId: string, song: SongMeta, position: number) {
  return {
    playlist_id: playlistId,
    song_id:     song.id,
    position,
    title:       song.title,
    artist:      song.artist,
    album_id:    song.albumId ?? null,
    album_title: song.albumTitle ?? null,
    artwork_url: song.artworkUrl ?? null,
    duration_ms: song.durationMs ?? null,
  };
}

/** A user's song playlists with their songs. Null on failure. */
export async function fetchUserSongPlaylists(userId: string): Promise<SongPlaylist[] | null> {
  const pls = rowsOrNull(
    await supabase
      .from('song_playlists')
      .select('id, user_id, name, description, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  );
  if (!pls) return null;
  if (pls.length === 0) return [];

  const items = await fetchAllRowsIn<any>(
    pls.map((p: any) => p.id),
    (chunk, from, to) => supabase
      .from('song_playlist_items')
      .select(SONG_ITEM_COLUMNS)
      .in('playlist_id', chunk)
      .order('position', { ascending: true })
      .range(from, to),
    10,
  );
  if (!items) return null;

  const byPlaylist = new Map<string, any[]>();
  for (const it of items) {
    const list = byPlaylist.get(it.playlist_id);
    if (list) list.push(it); else byPlaylist.set(it.playlist_id, [it]);
  }
  return pls.map((p: any) => ({
    id:          p.id,
    userId:      p.user_id,
    name:        p.name,
    description: p.description ?? undefined,
    createdAt:   p.created_at,
    songs:       (byPlaylist.get(p.id) ?? [])
      .sort((a, b) => a.position - b.position)
      .map(itemRowToSong),
  }));
}

/** One song playlist by id (any owner the caller can see). Null on failure or not found. */
export async function fetchSongPlaylist(id: string): Promise<SongPlaylist | null> {
  const [pl, items] = await Promise.all([
    supabase.from('song_playlists').select('id, user_id, name, description, created_at').eq('id', id).maybeSingle(),
    supabase.from('song_playlist_items').select(SONG_ITEM_COLUMNS).eq('playlist_id', id).order('position', { ascending: true }).limit(1000),
  ]);
  if (pl.error || !pl.data || items.error) return null;
  const p: any = pl.data;
  return {
    id:          p.id,
    userId:      p.user_id,
    name:        p.name,
    description: p.description ?? undefined,
    createdAt:   p.created_at,
    songs:       (items.data ?? []).map(itemRowToSong),
  };
}

export function totalDurationMs(songs: SongMeta[]): number {
  return songs.reduce((sum, x) => sum + (x.durationMs ?? 0), 0);
}

// ─── Likes ───────────────────────────────────────────────────────────────────
// Song playlists reuse the likes table (target_type 'playlist') with a
// 'song:' prefix on target_id, the way featured playlists use 'featured:'.
// Anything reading playlist likes must route 'song:' ids to song_playlists.

export const SONG_PLAYLIST_LIKE_PREFIX = 'song:';

export function songPlaylistLikeId(playlistId: string): string {
  return `${SONG_PLAYLIST_LIKE_PREFIX}${playlistId}`;
}

export function isSongPlaylistLikeId(targetId: string): boolean {
  return targetId.startsWith(SONG_PLAYLIST_LIKE_PREFIX);
}

/** Like count and whether `viewerId` has liked it. Null on failure. */
export async function fetchSongPlaylistLikes(playlistId: string, viewerId?: string): Promise<{ count: number; liked: boolean } | null> {
  const rows = rowsOrNull(
    await supabase
      .from('likes')
      .select('user_id')
      .eq('target_type', 'playlist')
      .eq('target_id', songPlaylistLikeId(playlistId)),
  );
  if (!rows) return null;
  return { count: rows.length, liked: !!viewerId && rows.some((r: any) => r.user_id === viewerId) };
}

/** Likes or unlikes; notifies the owner on a like. Returns false on failure. */
export async function setSongPlaylistLiked(playlist: { id: string; userId: string }, viewerId: string, like: boolean): Promise<boolean> {
  const targetId = songPlaylistLikeId(playlist.id);
  if (!like) {
    const { error } = await supabase.from('likes').delete()
      .eq('user_id', viewerId).eq('target_type', 'playlist').eq('target_id', targetId);
    return !error;
  }
  const { error } = await supabase.from('likes').insert({
    user_id: viewerId, target_type: 'playlist', target_id: targetId, target_owner_id: playlist.userId,
  });
  if (error) return false;
  if (playlist.userId !== viewerId) {
    supabase.from('notifications').insert({
      user_id: playlist.userId, type: 'like_playlist', actor_id: viewerId, target_id: targetId,
    }).then(({ error: e }) => { if (e) console.error('[SongPlaylists] like notification error:', e.message); });
  }
  return true;
}

/** Several song playlists by id, with songs. Missing/private ones are left out. Null on failure. */
export async function fetchSongPlaylistsByIds(ids: string[]): Promise<SongPlaylist[] | null> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];
  const pls = await fetchAllRowsIn<any>(
    unique,
    (chunk, from, to) => supabase.from('song_playlists').select('id, user_id, name, description, created_at').in('id', chunk).range(from, to),
    2,
  );
  if (!pls) return null;
  if (pls.length === 0) return [];
  const items = await fetchAllRowsIn<any>(
    pls.map((p: any) => p.id),
    (chunk, from, to) => supabase.from('song_playlist_items').select(SONG_ITEM_COLUMNS).in('playlist_id', chunk).order('position', { ascending: true }).range(from, to),
    10,
  );
  if (!items) return null;
  return pls.map((p: any) => ({
    id: p.id, userId: p.user_id, name: p.name, description: p.description ?? undefined, createdAt: p.created_at,
    songs: items.filter((it: any) => it.playlist_id === p.id).sort((a: any, b: any) => a.position - b.position).map(itemRowToSong),
  }));
}

/** First four distinct covers, for mosaics outside the song playlist screens. */
export function songPlaylistCovers(playlist: SongPlaylist): string[] {
  const covers: string[] = [];
  for (const s of playlist.songs) {
    if (s.artworkUrl && !covers.includes(s.artworkUrl)) covers.push(s.artworkUrl);
    if (covers.length === 4) break;
  }
  return covers;
}
