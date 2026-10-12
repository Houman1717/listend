import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { fetchUserSongPlaylists, songToItemRow, type SongPlaylist } from '@/lib/songPlaylists';
import type { SongMeta } from '@/lib/songReviews';

type SongPlaylistsContextType = {
  songPlaylists: SongPlaylist[];
  /** False until the first successful load. */
  songPlaylistsLoaded: boolean;
  getSongPlaylist: (id: string) => SongPlaylist | undefined;
  createSongPlaylist: (name: string, description?: string) => Promise<string | null>;
  updateSongPlaylist: (id: string, name: string, description?: string) => Promise<boolean>;
  deleteSongPlaylist: (id: string) => Promise<boolean>;
  /** Appends songs not already in the playlist, in the order given. */
  addSongsToPlaylist: (id: string, songs: SongMeta[]) => Promise<boolean>;
  removeSongFromPlaylist: (id: string, songId: string) => Promise<boolean>;
  reorderSongPlaylist: (id: string, songIds: string[]) => Promise<boolean>;
  refreshSongPlaylists: () => Promise<void>;
};

const SongPlaylistsContext = createContext<SongPlaylistsContextType | null>(null);

export function SongPlaylistsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [songPlaylists, setState] = useState<SongPlaylist[]>([]);
  const [songPlaylistsLoaded, setLoaded] = useState(false);
  // Synchronous mirror so back-to-back writes see each other's optimistic state.
  const ref = useRef<SongPlaylist[]>([]);
  function set(next: SongPlaylist[] | ((prev: SongPlaylist[]) => SongPlaylist[])) {
    ref.current = typeof next === 'function' ? next(ref.current) : next;
    setState(ref.current);
  }
  const find = (id: string) => ref.current.find(p => p.id === id);
  const patch = (id: string, fn: (p: SongPlaylist) => SongPlaylist) =>
    set(prev => prev.map(p => (p.id === id ? fn(p) : p)));

  const load = useCallback(async () => {
    if (!user) return;
    const list = await fetchUserSongPlaylists(user.id);
    if (!list) return; // a failed read keeps what we have
    set(list);
    setLoaded(true);
  }, [user?.id]);

  useEffect(() => {
    set([]);
    setLoaded(false);
    if (user) load();
  }, [user?.id]);

  const getSongPlaylist = useCallback((id: string) => songPlaylists.find(p => p.id === id), [songPlaylists]);

  async function createSongPlaylist(name: string, description?: string): Promise<string | null> {
    if (!user) return null;
    const pl: SongPlaylist = {
      id: uuidv4(),
      userId: user.id,
      name: name.trim(),
      description: description?.trim() || undefined,
      createdAt: new Date().toISOString(),
      songs: [],
    };
    set(prev => [pl, ...prev]);
    const { error } = await supabase.from('song_playlists').insert({
      id: pl.id, user_id: user.id, name: pl.name, description: pl.description ?? null,
    });
    if (error) {
      console.error('[SongPlaylists] create error:', error.message);
      set(prev => prev.filter(p => p.id !== pl.id));
      return null;
    }
    return pl.id;
  }

  async function updateSongPlaylist(id: string, name: string, description?: string): Promise<boolean> {
    const before = find(id);
    if (!before) return false;
    patch(id, p => ({ ...p, name: name.trim(), description: description?.trim() || undefined }));
    const { error } = await supabase.from('song_playlists')
      .update({ name: name.trim(), description: description?.trim() || null, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      console.error('[SongPlaylists] update error:', error.message);
      patch(id, () => before);
      return false;
    }
    return true;
  }

  async function deleteSongPlaylist(id: string): Promise<boolean> {
    const before = ref.current;
    set(prev => prev.filter(p => p.id !== id));
    const { error } = await supabase.from('song_playlists').delete().eq('id', id);
    if (error) {
      console.error('[SongPlaylists] delete error:', error.message);
      set(before);
      return false;
    }
    return true;
  }

  async function addSongsToPlaylist(id: string, songs: SongMeta[]): Promise<boolean> {
    const pl = find(id);
    if (!pl) return false;
    const have = new Set(pl.songs.map(s => s.id));
    const fresh = songs.filter((s, i) => !have.has(s.id) && songs.findIndex(x => x.id === s.id) === i);
    if (fresh.length === 0) return true;
    const start = pl.songs.length;
    patch(id, p => ({ ...p, songs: [...p.songs, ...fresh] }));
    const { error } = await supabase.from('song_playlist_items')
      .insert(fresh.map((s, i) => songToItemRow(id, s, start + i)));
    if (error) {
      console.error('[SongPlaylists] add error:', error.message);
      const added = new Set(fresh.map(s => s.id));
      patch(id, p => ({ ...p, songs: p.songs.filter(s => !added.has(s.id)) }));
      return false;
    }
    return true;
  }

  async function removeSongFromPlaylist(id: string, songId: string): Promise<boolean> {
    const pl = find(id);
    if (!pl) return false;
    const before = pl.songs;
    patch(id, p => ({ ...p, songs: p.songs.filter(s => s.id !== songId) }));
    const { error } = await supabase.from('song_playlist_items').delete().eq('playlist_id', id).eq('song_id', songId);
    if (error) {
      console.error('[SongPlaylists] remove error:', error.message);
      patch(id, p => ({ ...p, songs: before }));
      return false;
    }
    return true;
  }

  async function reorderSongPlaylist(id: string, songIds: string[]): Promise<boolean> {
    const pl = find(id);
    if (!pl) return false;
    const before = pl.songs;
    const byId = new Map(before.map(s => [s.id, s]));
    const next = songIds.map(sid => byId.get(sid)).filter((s): s is SongMeta => !!s);
    patch(id, p => ({ ...p, songs: next }));
    const { error } = await supabase.from('song_playlist_items')
      .upsert(next.map((s, i) => songToItemRow(id, s, i)), { onConflict: 'playlist_id,song_id' });
    if (error) {
      console.error('[SongPlaylists] reorder error:', error.message);
      patch(id, p => ({ ...p, songs: before }));
      return false;
    }
    return true;
  }

  return (
    <SongPlaylistsContext.Provider value={{
      songPlaylists,
      songPlaylistsLoaded,
      getSongPlaylist,
      createSongPlaylist,
      updateSongPlaylist,
      deleteSongPlaylist,
      addSongsToPlaylist,
      removeSongFromPlaylist,
      reorderSongPlaylist,
      refreshSongPlaylists: load,
    }}>
      {children}
    </SongPlaylistsContext.Provider>
  );
}

export function useSongPlaylists() {
  const ctx = useContext(SongPlaylistsContext);
  if (!ctx) throw new Error('useSongPlaylists must be used inside SongPlaylistsProvider');
  return ctx;
}
