import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef, ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { fetchAllRows } from '@/lib/supabaseQuery';
import { SONG_REVIEW_COLUMNS, rowToSongReview, type SongMeta, type SongReview } from '@/lib/songReviews';

type SaveInput = {
  song:    SongMeta;
  rating:  number;
  review?: string;
};

type SongReviewsContextType = {
  /** The user's logged songs, newest listen first. Empty until loaded. */
  songReviews: SongReview[];
  /** False until the first successful load — don't treat [] as "none" before then. */
  songsLoaded: boolean;
  getSongReview: (songId: string) => SongReview | undefined;
  /** The user's logged songs on one album. */
  songsForAlbum: (albumId: string) => SongReview[];
  /** Log/update a song. Editing keeps the original listened_at. Returns false on failure. */
  saveSongReview: (input: SaveInput) => Promise<boolean>;
  removeSongReview: (songId: string) => Promise<boolean>;
  /** Mark (or unmark) a song as the favourite on its album. Logs the song if needed. */
  setFavoriteSong: (song: SongMeta, on: boolean) => Promise<boolean>;
  refreshSongReviews: () => Promise<void>;
};

const SongReviewsContext = createContext<SongReviewsContextType | null>(null);

export function SongReviewsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [songReviews, setSongReviewsState] = useState<SongReview[]>([]);
  const [songsLoaded, setSongsLoaded] = useState(false);
  // Mirror of the latest list, updated synchronously, so several writes fired
  // back to back (e.g. rating a whole tracklist + a favourite on log) each see
  // the others' optimistic rows instead of a stale render's.
  const listRef = useRef<SongReview[]>([]);
  function setSongReviews(next: SongReview[] | ((prev: SongReview[]) => SongReview[])) {
    listRef.current = typeof next === 'function' ? next(listRef.current) : next;
    setSongReviewsState(listRef.current);
  }
  const findSong = (songId: string) => listRef.current.find(s => s.songId === songId);

  const load = useCallback(async () => {
    if (!user) return;
    const rows = await fetchAllRows<any>(
      (from, to) => supabase
        .from('song_reviews')
        .select(SONG_REVIEW_COLUMNS)
        .eq('user_id', user.id)
        .order('listened_at', { ascending: false })
        .range(from, to),
      20,
    );
    // A failed read keeps whatever we already have — never overwrite with [].
    if (!rows) return;
    setSongReviews(rows.map(rowToSongReview));
    setSongsLoaded(true);
  }, [user?.id]);

  useEffect(() => {
    setSongReviews([]);
    setSongsLoaded(false);
    if (user) load();
  }, [user?.id]);

  const byId = useMemo(() => new Map(songReviews.map(s => [s.songId, s])), [songReviews]);

  const getSongReview = useCallback((songId: string) => byId.get(songId), [byId]);

  const songsForAlbum = useCallback(
    (albumId: string) => songReviews.filter(s => s.albumId === albumId),
    [songReviews],
  );

  async function saveSongReview({ song, rating, review }: SaveInput): Promise<boolean> {
    if (!user) return false;
    const existing = findSong(song.id);
    const trimmed  = review?.trim() || undefined;
    const listenedAt = existing?.listenedAt ?? new Date().toISOString();

    const next: SongReview = {
      songId:     song.id,
      title:      song.title,
      artist:     song.artist,
      albumId:    song.albumId ?? existing?.albumId,
      albumTitle: song.albumTitle ?? existing?.albumTitle,
      artworkUrl: song.artworkUrl ?? existing?.artworkUrl,
      durationMs: song.durationMs ?? existing?.durationMs,
      rating,
      review:     trimmed,
      isFavorite: existing?.isFavorite ?? false,
      listenedAt,
    };

    // Optimistic
    setSongReviews(prev => existing
      ? prev.map(s => s.songId === song.id ? next : s)
      : [next, ...prev]);

    // listened_at is only sent for a new row, so editing never bumps it.
    const payload: Record<string, any> = {
      user_id:     user.id,
      song_id:     song.id,
      title:       next.title,
      artist:      next.artist,
      album_id:    next.albumId ?? null,
      album_title: next.albumTitle ?? null,
      artwork_url: next.artworkUrl ?? null,
      duration_ms: next.durationMs ?? null,
      rating,
      review:      trimmed ?? null,
      updated_at:  new Date().toISOString(),
    };
    if (!existing) payload.listened_at = listenedAt;

    const { error } = await supabase
      .from('song_reviews')
      .upsert(payload, { onConflict: 'user_id,song_id' });
    if (error) {
      console.error('[SongReviews] save error:', error.message);
      setSongReviews(prev => existing
        ? prev.map(s => s.songId === song.id ? existing : s)
        : prev.filter(s => s.songId !== song.id));
      return false;
    }
    return true;
  }

  async function removeSongReview(songId: string): Promise<boolean> {
    if (!user) return false;
    const existing = findSong(songId);
    if (!existing) return true;
    setSongReviews(prev => prev.filter(s => s.songId !== songId));
    const { error } = await supabase
      .from('song_reviews')
      .delete()
      .eq('user_id', user.id)
      .eq('song_id', songId);
    if (error) {
      console.error('[SongReviews] delete error:', error.message);
      setSongReviews(prev => [existing, ...prev].sort((a, b) => b.listenedAt.localeCompare(a.listenedAt)));
      return false;
    }
    return true;
  }

  async function setFavoriteSong(song: SongMeta, on: boolean): Promise<boolean> {
    if (!user || !song.albumId) return false;
    const albumId = song.albumId;
    if (!findSong(song.id)) {
      if (!on) return true;
      const ok = await saveSongReview({ song, rating: 0 });
      if (!ok) return false;
    }

    const before = listRef.current;
    setSongReviews(prev => prev.map(s => {
      if (s.songId === song.id) return { ...s, isFavorite: on };
      if (on && s.albumId === albumId && s.isFavorite) return { ...s, isFavorite: false };
      return s;
    }));

    const { error } = await supabase.rpc('set_favorite_song', {
      p_album_id: albumId,
      p_song_id:  song.id,
      p_on:       on,
    });
    if (error) {
      console.error('[SongReviews] favourite error:', error.message);
      // Roll back just the favourite flags; the row itself (if just created) stays.
      const prevFav = new Map(before.map(s => [s.songId, s.isFavorite]));
      setSongReviews(prev => prev.map(s => ({ ...s, isFavorite: prevFav.get(s.songId) ?? false })));
      return false;
    }
    return true;
  }

  return (
    <SongReviewsContext.Provider value={{
      songReviews,
      songsLoaded,
      getSongReview,
      songsForAlbum,
      saveSongReview,
      removeSongReview,
      setFavoriteSong,
      refreshSongReviews: load,
    }}>
      {children}
    </SongReviewsContext.Provider>
  );
}

export function useSongReviews() {
  const ctx = useContext(SongReviewsContext);
  if (!ctx) throw new Error('useSongReviews must be used inside SongReviewsProvider');
  return ctx;
}
