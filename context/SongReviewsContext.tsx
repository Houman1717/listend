import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef, ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { fetchAllRows } from '@/lib/supabaseQuery';
import {
  SONG_REVIEW_COLUMNS, SONG_RE_LISTEN_COLUMNS, rowToSongReview, rowToSongReListen, applySongReListens, songKey,
  type SongMeta, type SongReview, type SongReListen,
} from '@/lib/songReviews';

type SaveInput = {
  song:    SongMeta;
  rating:  number;
  review?: string;
  /** Move an existing log of another version of this song onto this one. */
  preferThisVersion?: boolean;
  /** Internal: only move the first-listen row to this version, never touch re-listens. */
  moveOnly?: boolean;
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

type ReListenInput = {
  song:        SongMeta;
  rating:      number;
  review?:     string;
  listenedAt?: Date;
};

type SongReviewsContextType = {
  /**
   * The user's logged songs, newest first listen first. Empty until loaded.
   * rating/review are the current ones — see SongReview.reListenCount.
   */
  songReviews: SongReview[];
  /** Every re-listen of every song, newest first. */
  songReListens: SongReListen[];
  /** Re-listens of one song (any version), newest first. */
  reListensFor: (song: { title: string; artist: string }) => SongReListen[];
  /** False until the first successful load — don't treat [] as "none" before then. */
  songsLoaded: boolean;
  /**
   * Your log of a song. Pass the song (not just its id) to also find a log of
   * another version of it — the single vs the album track.
   */
  getSongReview: (song: SongRef) => SongReview | undefined;
  /** The user's logged songs on one album. */
  songsForAlbum: (albumId: string) => SongReview[];
  /**
   * Log/update a song. Editing keeps the original listened_at. On a song
   * you've re-listened, editing changes your latest listen, not the first.
   * Returns false on failure.
   */
  saveSongReview: (input: SaveInput) => Promise<boolean>;
  /**
   * A new listen of a song with its own rating/review; the first listen stays
   * as it was. Logs the song normally if it was never logged.
   */
  addSongReListen: (input: ReListenInput) => Promise<boolean>;
  /** Deletes one re-listen entry (by its id). */
  removeSongReListen: (id: string) => Promise<boolean>;
  removeSongReview: (song: SongRef) => Promise<boolean>;
  /** Mark (or unmark) a song as the favourite on its album. Logs the song if needed. */
  setFavoriteSong: (song: SongMeta, on: boolean) => Promise<boolean>;
  refreshSongReviews: () => Promise<void>;
};

const SongReviewsContext = createContext<SongReviewsContextType | null>(null);

export function SongReviewsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  // First-listen rows exactly as stored in song_reviews.
  const [baseSongs, setSongReviewsState] = useState<SongReview[]>([]);
  const [songsLoaded, setSongsLoaded] = useState(false);
  const [songReListens, setReListensState] = useState<SongReListen[]>([]);
  const reListenRef = useRef<SongReListen[]>([]);
  function setReListens(next: SongReListen[] | ((prev: SongReListen[]) => SongReListen[])) {
    reListenRef.current = (typeof next === 'function' ? next(reListenRef.current) : next)
      .slice().sort((a, b) => b.listenedAt.localeCompare(a.listenedAt));
    setReListensState(reListenRef.current);
  }
  const reListensOf = (s: { title: string; artist: string }) => {
    const k = songKey(s.title, s.artist);
    return reListenRef.current.filter(r => r.songKey === k);
  };
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
    const [rows, rlRows] = await Promise.all([
      fetchAllRows<any>(
        (from, to) => supabase
          .from('song_reviews')
          .select(SONG_REVIEW_COLUMNS)
          .eq('user_id', user.id)
          .order('listened_at', { ascending: false })
          .range(from, to),
        20,
      ),
      fetchAllRows<any>(
        (from, to) => supabase
          .from('song_re_listens')
          .select(SONG_RE_LISTEN_COLUMNS)
          .eq('user_id', user.id)
          .order('listened_at', { ascending: false })
          .order('id')
          .range(from, to),
        20,
      ),
    ]);
    // A failed read keeps whatever we already have — never overwrite with [].
    if (rlRows) setReListens(rlRows.map(rowToSongReListen));
    else console.warn('[SongReviews] re-listen read failed — keeping what we had');
    if (!rows) return;
    setSongReviews(rows.map(rowToSongReview));
    setSongsLoaded(true);
  }, [user?.id]);

  useEffect(() => {
    setSongReviews([]);
    setReListens([]);
    setSongsLoaded(false);
    if (user) load();
  }, [user?.id]);

  // What every screen reads: first listens with re-listens folded in.
  const songReviews = useMemo(
    () => applySongReListens(baseSongs, songReListens),
    [baseSongs, songReListens],
  );

  const reListensFor = useCallback((s: { title: string; artist: string }) => {
    const k = songKey(s.title, s.artist);
    return songReListens.filter(r => r.songKey === k);
  }, [songReListens]);

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

  /**
   * Editing a re-listened song edits the latest listen. The form shows the
   * current rating/review, which can come from an older listen when the latest
   * one left it blank — an unchanged value stays blank on the latest row.
   */
  async function editLatestReListen(existing: SongReview, rating: number, trimmed: string | undefined): Promise<boolean> {
    const rls = reListensOf(existing);
    const latest = rls[0];
    const [current] = applySongReListens([existing], rls);
    const nextRating = !latest.rating && rating === current.rating ? 0 : rating;
    const nextReview = !latest.review && trimmed === current.review ? undefined : trimmed;
    if (nextRating === latest.rating && nextReview === latest.review) return true;
    const before = latest;
    setReListens(prev => prev.map(r => r.id === latest.id ? { ...r, rating: nextRating, review: nextReview } : r));
    const { error } = await supabase
      .from('song_re_listens')
      .update({ rating: nextRating, review: nextReview ?? null })
      .eq('user_id', user!.id)
      .eq('id', latest.id);
    if (error) {
      console.error('[SongReviews] re-listen edit error:', error.message);
      setReListens(prev => prev.map(r => r.id === before.id ? before : r));
      return false;
    }
    return true;
  }

  async function saveSongReview({ song, rating, review, preferThisVersion, moveOnly }: SaveInput): Promise<boolean> {
    if (!user) return false;
    const existing = findSong(song);
    const trimmed  = review?.trim() || undefined;
    if (existing && !moveOnly && reListensOf(existing).length > 0) return editLatestReListen(existing, rating, trimmed);
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
    const key = songKey(existing.title, existing.artist);
    const rls = reListensOf(existing);
    setSongReviews(prev => prev.filter(s => s.songId !== songId));
    setReListens(prev => prev.filter(r => r.songKey !== key));
    // Re-listens first: if that fails nothing is gone, and a re-listen is
    // never left pointing at a song that's no longer logged.
    const { error: rlError } = rls.length > 0
      ? await supabase.from('song_re_listens').delete().eq('user_id', user.id).eq('song_key', key)
      : { error: null };
    const { error } = rlError ? { error: rlError } : await supabase
      .from('song_reviews')
      .delete()
      .eq('user_id', user.id)
      .eq('song_id', songId);
    if (error) {
      console.error('[SongReviews] delete error:', error.message);
      setSongReviews(prev => [existing, ...prev].sort((a, b) => b.listenedAt.localeCompare(a.listenedAt)));
      if (rlError) setReListens(prev => [...prev, ...rls]);
      return false;
    }
    return true;
  }

  async function addSongReListen({ song, rating, review, listenedAt }: ReListenInput): Promise<boolean> {
    if (!user) return false;
    const existing = findSong(song);
    if (!existing) return saveSongReview({ song, rating, review });
    const trimmed = review?.trim() || undefined;
    const at = (listenedAt ?? new Date()).toISOString();
    // Title/artist come from the logged row so song_key always matches it.
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const row: SongReListen = {
      id:         tempId,
      songId:     existing.songId,
      songKey:    songKey(existing.title, existing.artist),
      title:      existing.title,
      artist:     existing.artist,
      albumId:    existing.albumId,
      albumTitle: existing.albumTitle,
      artworkUrl: existing.artworkUrl ?? song.artworkUrl,
      rating,
      review:     trimmed,
      listenedAt: at,
    };
    setReListens(prev => [row, ...prev]);
    const { data, error } = await supabase
      .from('song_re_listens')
      .insert({
        user_id:     user.id,
        song_id:     row.songId,
        title:       row.title,
        artist:      row.artist,
        album_id:    row.albumId ?? null,
        album_title: row.albumTitle ?? null,
        artwork_url: row.artworkUrl ?? null,
        rating,
        review:      trimmed ?? null,
        listened_at: at,
      })
      .select('id')
      .single();
    if (error || !data) {
      console.error('[SongReviews] re-listen error:', error?.message);
      setReListens(prev => prev.filter(r => r.id !== tempId));
      return false;
    }
    setReListens(prev => prev.map(r => r.id === tempId ? { ...r, id: (data as any).id } : r));
    return true;
  }

  async function removeSongReListen(id: string): Promise<boolean> {
    if (!user) return false;
    const entry = reListenRef.current.find(r => r.id === id);
    if (!entry) return true;
    setReListens(prev => prev.filter(r => r.id !== id));
    const { error } = await supabase.from('song_re_listens').delete().eq('user_id', user.id).eq('id', id);
    if (error) {
      console.error('[SongReviews] re-listen delete error:', error.message);
      setReListens(prev => [...prev, entry]);
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
      const ok = await saveSongReview({ song, rating: row.rating, review: row.review, preferThisVersion: true, moveOnly: true });
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
      songReListens,
      reListensFor,
      songsLoaded,
      getSongReview,
      songsForAlbum,
      saveSongReview,
      addSongReListen,
      removeSongReListen,
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
