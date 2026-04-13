import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAlbums, TopAlbum, TopSong, TopArtist } from '@/context/AlbumsContext';
import { supabase } from '@/lib/supabase';

type Snapshot = { albums: TopAlbum[]; songs: TopSong[]; artists: TopArtist[] };

/**
 * Invisible component that syncs the current user's Top 5 albums/songs/artists
 * to the `profiles` table in Supabase whenever they change.
 *
 * Also detects newly-added items and logs them to `top5_changes` so they
 * appear in the Recent Activity feed.
 *
 * Requires these JSONB columns on the profiles table:
 *   top_albums  JSONB DEFAULT '[]'
 *   top_songs   JSONB DEFAULT '[]'
 *   top_artists JSONB DEFAULT '[]'
 *
 * And a top5_changes table (create in Supabase SQL editor):
 *   id             UUID PRIMARY KEY DEFAULT gen_random_uuid()
 *   user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
 *   category       TEXT NOT NULL  -- 'albums' | 'songs' | 'artists'
 *   position       INTEGER NOT NULL
 *   item_id        TEXT NOT NULL
 *   item_name      TEXT NOT NULL
 *   item_image_url TEXT
 *   changed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
 */
export function FavoritesSyncer() {
  const { user } = useAuth();
  const { topAlbums, topSongs, topArtists, isLoaded } = useAlbums();

  // Debounce writes — wait 800 ms after the last change before hitting Supabase
  const debounceRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Baseline snapshot used to detect additions (null = not yet initialised)
  const prevRef        = useRef<Snapshot | null>(null);
  // Skip change-logging on the very first sync (initial data load)
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!user || !isLoaded) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      const payload = { top_albums: topAlbums, top_songs: topSongs, top_artists: topArtists };
      console.log('[Top5] saving for user:', user.id, payload);

      const { error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', user.id);

      if (error) {
        console.error('[FavoritesSyncer] sync error:', error.message);
        return;
      }
      console.log('[Top5] saved successfully for user:', user.id);

      // ── Change detection ────────────────────────────────────────────────────
      // First fire after load: establish baseline, don't log anything
      if (!initializedRef.current) {
        initializedRef.current = true;
        prevRef.current = { albums: topAlbums, songs: topSongs, artists: topArtists };
        return;
      }

      const prev = prevRef.current;
      if (!prev) {
        prevRef.current = { albums: topAlbums, songs: topSongs, artists: topArtists };
        return;
      }

      type ChangeRow = {
        user_id:       string;
        category:      string;
        item_id:       string;
        item_name:     string;
        item_image_url: string | null;
        position:      number;
      };

      const changes: ChangeRow[] = [];

      // New albums
      topAlbums.forEach((a, i) => {
        if (!prev.albums.find(p => p.id === a.id)) {
          changes.push({
            user_id:        user.id,
            category:       'albums',
            item_id:        a.id,
            item_name:      a.title,
            item_image_url: a.artworkUrl || null,
            position:       i + 1,
          });
        }
      });

      // New songs
      topSongs.forEach((s, i) => {
        if (!prev.songs.find(p => p.id === s.id)) {
          changes.push({
            user_id:        user.id,
            category:       'songs',
            item_id:        s.id,
            item_name:      s.title,
            item_image_url: s.artworkUrl || null,
            position:       i + 1,
          });
        }
      });

      // New artists
      topArtists.forEach((a, i) => {
        if (!prev.artists.find(p => p.id === a.id)) {
          changes.push({
            user_id:        user.id,
            category:       'artists',
            item_id:        a.id,
            item_name:      a.name,
            item_image_url: a.artworkUrl || null,
            position:       i + 1,
          });
        }
      });

      if (changes.length > 0) {
        const { error: changeErr } = await supabase.from('top5_changes').insert(changes);
        if (changeErr) console.error('[FavoritesSyncer] top5_changes insert error:', changeErr.message);
        else console.log('[Top5] logged', changes.length, 'change(s) to top5_changes');
      }

      prevRef.current = { albums: topAlbums, songs: topSongs, artists: topArtists };
    }, 800);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [topAlbums, topSongs, topArtists, user?.id, isLoaded]);

  return null;
}
