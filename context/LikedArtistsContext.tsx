import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

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
  const { user } = useAuth();
  const [likedArtists, setLikedArtists] = useState<LikedArtist[]>([]);

  useEffect(() => {
    if (!user) {
      setLikedArtists([]);
      return;
    }
    supabase
      .from('liked_artists')
      .select('artist_id, name, artwork_url')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) {
          setLikedArtists(data.map((r: any) => ({
            id:         r.artist_id,
            name:       r.name,
            artworkUrl: r.artwork_url ?? null,
          })));
        }
      });
  }, [user?.id]);

  function isLiked(id: string) {
    return likedArtists.some(a => a.id === id);
  }

  async function toggleLike(artist: LikedArtist) {
    if (!user) return;
    const already = isLiked(artist.id);

    // Optimistic update
    setLikedArtists(prev =>
      already
        ? prev.filter(a => a.id !== artist.id)
        : [artist, ...prev]
    );

    if (already) {
      const { error } = await supabase
        .from('liked_artists')
        .delete()
        .eq('user_id', user.id)
        .eq('artist_id', artist.id);
      if (error) {
        console.error('[LikedArtists] unlike error:', error.message);
        setLikedArtists(prev => [artist, ...prev]); // revert
      }
    } else {
      const { error } = await supabase
        .from('liked_artists')
        .insert({
          user_id:    user.id,
          artist_id:  artist.id,
          name:       artist.name,
          artwork_url: artist.artworkUrl ?? null,
        });
      if (error) {
        console.error('[LikedArtists] like error:', error.message);
        setLikedArtists(prev => prev.filter(a => a.id !== artist.id)); // revert
      }
    }
  }

  function unlike(id: string) {
    const artist = likedArtists.find(a => a.id === id);
    if (artist) toggleLike(artist);
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
