import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@liked_artists';

export type LikedArtist = {
  id: string;
  name: string;
  artworkUrl: string | null;
};

type LikedArtistsContextType = {
  likedArtists: LikedArtist[];
  isLiked: (id: string) => boolean;
  toggleLike: (artist: LikedArtist) => void;
  unlike: (id: string) => void;
};

const LikedArtistsContext = createContext<LikedArtistsContextType | null>(null);

export function LikedArtistsProvider({ children }: { children: ReactNode }) {
  const [likedArtists, setLikedArtists] = useState<LikedArtist[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) setLikedArtists(JSON.parse(raw));
    });
  }, []);

  function save(artists: LikedArtist[]) {
    setLikedArtists(artists);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(artists));
  }

  function isLiked(id: string) {
    return likedArtists.some(a => a.id === id);
  }

  function toggleLike(artist: LikedArtist) {
    const already = isLiked(artist.id);
    const next = already
      ? likedArtists.filter(a => a.id !== artist.id)
      : [...likedArtists, artist];
    save(next);
  }

  function unlike(id: string) {
    save(likedArtists.filter(a => a.id !== id));
  }

  return (
    <LikedArtistsContext.Provider value={{ likedArtists, isLiked, toggleLike, unlike }}>
      {children}
    </LikedArtistsContext.Provider>
  );
}

export function useLikedArtists() {
  const ctx = useContext(LikedArtistsContext);
  if (!ctx) throw new Error('useLikedArtists must be used inside LikedArtistsProvider');
  return ctx;
}
