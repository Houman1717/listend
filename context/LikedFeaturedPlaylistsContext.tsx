import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/context/AuthContext';

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
const STORAGE_KEY = '@listend_liked_featured_playlists';

export function LikedFeaturedPlaylistsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [likedPlaylists, setLikedPlaylists] = useState<LikedFeaturedPlaylist[]>([]);

  useEffect(() => {
    if (!user) { setLikedPlaylists([]); return; }
    AsyncStorage.getItem(`${STORAGE_KEY}:${user.id}`)
      .then(raw => { if (raw) setLikedPlaylists(JSON.parse(raw)); })
      .catch(() => {});
  }, [user?.id]);

  async function save(list: LikedFeaturedPlaylist[]) {
    if (!user) return;
    setLikedPlaylists(list);
    await AsyncStorage.setItem(`${STORAGE_KEY}:${user.id}`, JSON.stringify(list));
  }

  function isLiked(id: string) {
    return likedPlaylists.some(p => p.id === id);
  }

  function toggleLike(playlist: LikedFeaturedPlaylist) {
    const already = isLiked(playlist.id);
    save(already ? likedPlaylists.filter(p => p.id !== playlist.id) : [playlist, ...likedPlaylists]);
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
