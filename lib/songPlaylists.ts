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
