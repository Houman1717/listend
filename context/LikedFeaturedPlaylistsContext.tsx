import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

export type LikedFeaturedPlaylist = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  artworkUrls: string[];
};

type ContextType = {
  likedPlaylists: LikedFeaturedPlaylist[];
  isLiked: (id: string) => boolean;
  toggleLike: (playlist: LikedFeaturedPlaylist) => void;
};

const Ctx = createContext<ContextType | null>(null);

export function LikedFeaturedPlaylistsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [likedPlaylists, setLikedPlaylists] = useState<LikedFeaturedPlaylist[]>([]);

  useEffect(() => {
    if (!user) { setLikedPlaylists([]); return; }

    supabase
      .from('likes')
      .select('target_id')
      .eq('user_id', user.id)
      .eq('target_type', 'playlist')
      .ilike('target_id', 'featured:%')
      .then(({ data: rows }) => {
        if (!rows || rows.length === 0) { setLikedPlaylists([]); return; }
        const ids = new Set(rows.map((r: any) => (r.target_id as string).replace('featured:', '')));
        fetch(`${API_URL}/api/featured-playlists`)
          .then(r => r.json())
          .then((all: LikedFeaturedPlaylist[]) => setLikedPlaylists(all.filter(p => ids.has(p.id))))
          .catch(() => {});
      })
      .catch(() => {});
  }, [user?.id]);

  function isLiked(id: string) {
    return likedPlaylists.some(p => p.id === id);
  }

  async function toggleLike(playlist: LikedFeaturedPlaylist) {
    if (!user) return;
    const already = isLiked(playlist.id);

    // Optimistic
    setLikedPlaylists(prev =>
      already ? prev.filter(p => p.id !== playlist.id) : [playlist, ...prev]
    );

    const storedId = `featured:${playlist.id}`;

    if (already) {
      const { error } = await supabase
        .from('likes')
        .delete()
        .eq('user_id', user.id)
        .eq('target_type', 'playlist')
        .eq('target_id', storedId);
      if (error) {
        console.error('[LikedFeaturedPlaylists] unlike error:', error.message);
        setLikedPlaylists(prev => [playlist, ...prev]);
      }
    } else {
      const { error } = await supabase
        .from('likes')
        .insert({
          user_id:         user.id,
          target_type:     'playlist',
          target_id:       storedId,
          target_owner_id: user.id,
        });
      if (error) {
        console.error('[LikedFeaturedPlaylists] like error:', error.message);
        setLikedPlaylists(prev => prev.filter(p => p.id !== playlist.id));
      }
    }
  }

  return (
    <Ctx.Provider value={{ likedPlaylists, isLiked, toggleLike }}>
      {children}
    </Ctx.Provider>
  );
}

export function useLikedFeaturedPlaylists() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLikedFeaturedPlaylists must be inside LikedFeaturedPlaylistsProvider');
  return ctx;
}
