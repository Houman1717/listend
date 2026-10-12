import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef, ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { fetchAllRows } from '@/lib/supabaseQuery';
import { SONG_REVIEW_COLUMNS, rowToSongReview, songKey, type SongMeta, type SongReview } from '@/lib/songReviews';

type SaveInput = {
  song:    SongMeta;
  rating:  number;
  review?: string;
  /** Move an existing log of another version of this song onto this one. */
  preferThisVersion?: boolean;
};

/** A song id, or a song we can also match by title + artist (any version). */
type SongRef = string | { id: string; title: string; artist: string };

/**
 * A log that came from a single / EP rather than the album: when the same song
 * is later logged from its album, the log moves to the album version.
 */
function isWeakVersion(s: { title: string; albumId?: string; albumTitle?: string }): boolean {
  if (!s.albumId || !s.albumTitle) return true;
  const album = s.albumTitle.trim().toLowerCase();
  return / - (single|ep)$/.test(album) || album === s.title.trim().toLowerCase();
}

type SongReviewsContextType = {
  /** The user's logged songs, newest listen first. Empty until loaded. */
  songReviews: SongReview[];
  /** False until the first successful load — don't treat [] as "none" before then. */
  songsLoaded: boolean;
  /**
   * Your log of a song. Pass the song (not just its id) to also find a log of
   * another version of it — the single vs the album track.
   */
  getSongReview: (song: SongRef) => SongReview | undefined;
  /** The user's logged songs on one album. */
  songsForAlbum: (albumId: string) => SongReview[];
  /** Log/update a song. Editing keeps the original listened_at. Returns false on failure. */
  saveSongReview: (input: SaveInput) => Promise<boolean>;
  removeSongReview: (song: SongRef) => Promise<boolean>;
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
  // By id first, then any version of the same song.
  const findSong = (ref: SongRef) => {
    const id = typeof ref === 'string' ? ref : ref.id;
    const hit = listRef.current.find(s => s.songId === id);
    if (hit || typeof ref === 'string') return hit;
    const key = songKey(ref.title, ref.artist);
    return listRef.current.find(s => songKey(s.title, s.artist) === key);
  };

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

  const byId  = useMemo(() => new Map(songReviews.map(s => [s.songId, s])), [songReviews]);
  const byKey = useMemo(() => {
    const m = new Map<string, SongReview>();
    for (const s of songReviews) {
      const k = songKey(s.title, s.artist);
      if (!m.has(k)) m.set(k, s); // newest first → keep the latest
    }
    return m;
  }, [songReviews]);

  const getSongReview = useCallback((ref: SongRef) => {
    if (typeof ref === 'string') return byId.get(ref);
    return byId.get(ref.id) ?? byKey.get(songKey(ref.title, ref.artist));
  }, [byId, byKey]);

  const songsForAlbum = useCallback(
    (albumId: string) => songReviews.filter(s => s.albumId === albumId),
    [songReviews],
  );

  async function saveSongReview({ song, rating, review, preferThisVersion }: SaveInput): Promise<boolean> {
    if (!user) return false;
    const existing = findSong(song);
    const trimmed  = review?.trim() || undefined;
    const listenedAt = existing?.listenedAt ?? new Date().toISOString();

    // Already logged as another version of this song: keep one log per song.
    // It moves to this version when this one is the album track (or asked
    // to); otherwise the existing version's details stay.
    const otherVersion = !!existing && existing.songId !== song.id;
    const moveHere = !otherVersion
      || (!!song.albumId && (preferThisVersion || (isWeakVersion(existing!) && !isWeakVersion(song))));
    const base = moveHere ? song : {
      id: existing!.songId, title: existing!.title, artist: existing!.artist, albumId: existing!.albumId,
      albumTitle: existing!.albumTitle, artworkUrl: existing!.artworkUrl, durationMs: existing!.durationMs,
    };
    const albumChanged = !!existing && (base.albumId ?? existing.albumId) !== existing.albumId;

    const next: SongReview = {
      songId:     base.id,
      title:      base.title,
      artist:     base.artist,
      albumId:    base.albumId ?? existing?.albumId,
      albumTitle: base.albumTitle ?? existing?.albumTitle,
      artworkUrl: base.artworkUrl ?? existing?.artworkUrl,
      durationMs: base.durationMs ?? existing?.durationMs,
      rating,
      review:     trimmed,
      // A favourite belongs to an album; moving albums drops it.
      isFavorite: albumChanged ? false : (existing?.isFavorite ?? false),
      listenedAt,
    };

    // Optimistic
    setSongReviews(prev => existing
      ? prev.map(s => s.songId === existing.songId ? next : s)
      : [next, ...prev]);

    // listened_at is only sent for a new row, so editing never bumps it.
    const payload: Record<string, any> = {
      user_id:     user.id,
      song_id:     next.songId,
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
    if (albumChanged) payload.is_favorite = false;

    // Moving to another version rewrites song_id, which an upsert can't do.
    const { error } = existing && existing.songId !== next.songId
      ? await supabase.from('song_reviews').update(payload).eq('user_id', user.id).eq('song_id', existing.songId)
      : await supabase.from('song_reviews').upsert(payload, { onConflict: 'user_id,song_id' });
    if (error) {
      console.error('[SongReviews] save error:', error.message);
      setSongReviews(prev => existing
        ? prev.map(s => s.songId === next.songId ? existing : s)
        : prev.filter(s => s.songId !== next.songId));
      return false;
    }
    return true;
  }

  async function removeSongReview(ref: SongRef): Promise<boolean> {
    if (!user) return false;
    const existing = findSong(ref);
    if (!existing) return true;
    const songId = existing.songId;
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
    const row = findSong(song);
    if (!row) {
      if (!on) return true;
      const ok = await saveSongReview({ song, rating: 0 });
      if (!ok) return false;
    } else if (row.songId !== song.id && on) {
      // Logged as another version (e.g. the single): move it onto this album's track.
      const ok = await saveSongReview({ song, rating: row.rating, review: row.review, preferThisVersion: true });
      if (!ok) return false;
    }
    const songId = findSong(song)?.songId ?? song.id;

    const before = listRef.current;
    setSongReviews(prev => prev.map(s => {
      if (s.songId === songId) return { ...s, isFavorite: on };
      if (on && s.albumId === albumId && s.isFavorite) return { ...s, isFavorite: false };
      return s;
    }));

    const { error } = await supabase.rpc('set_favorite_song', {
      p_album_id: albumId,
      p_song_id:  songId,
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
