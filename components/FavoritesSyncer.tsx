import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAlbums } from '@/context/AlbumsContext';
import { supabase } from '@/lib/supabase';

/**
 * Invisible component that syncs the current user's Top 5 albums/songs/artists
 * to the `profiles` table in Supabase whenever they change.
 *
 * Requires these JSONB columns on the profiles table:
 *   top_albums  JSONB DEFAULT '[]'
 *   top_songs   JSONB DEFAULT '[]'
 *   top_artists JSONB DEFAULT '[]'
 */
export function FavoritesSyncer() {
  const { user } = useAuth();
  const { topAlbums, topSongs, topArtists, isLoaded } = useAlbums();

  // Debounce writes — wait 800ms after the last change before hitting Supabase
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user || !isLoaded) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      const payload = { top_albums: topAlbums, top_songs: topSongs, top_artists: topArtists };
      console.log('[Top5] saving for user:', user.id, payload);
      supabase
        .from('profiles')
        .update(payload)
        .eq('id', user.id)
        .then(({ error }) => {
          if (error) console.error('[FavoritesSyncer] sync error:', error.message);
          else console.log('[Top5] saved successfully for user:', user.id);
        });
    }, 800);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [topAlbums, topSongs, topArtists, user?.id, isLoaded]);

  return null;
}
