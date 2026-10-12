// Song ratings/reviews — the secondary, track-level companion to album logs.
// Rows live in `song_reviews` (supabase/add-song-reviews.sql), never in
// user_albums, so nothing album-shaped changes when a song is logged.

import { supabase } from '@/lib/supabase';
import { fetchAllRowsIn, rowsOrNull } from '@/lib/supabaseQuery';

export type SongReview = {
  songId:      string;
  title:       string;
  artist:      string;
  albumId?:    string;
  albumTitle?: string;
  artworkUrl?: string;
  durationMs?: number;
  /** 1–10, or 0 for "listened, not rated". */
  rating:      number;
  review?:     string;
  isFavorite:  boolean;
  listenedAt:  string;
};

/** What the app knows about a song when the user logs it. */
export type SongMeta = {
  id:          string;
  title:       string;
  artist:      string;
  albumId?:    string;
  albumTitle?: string;
  artworkUrl?: string;
  durationMs?: number;
};

/** Another user's review of a song, for the community list. */
export type CommunitySongReview = SongReview & {
  userId:    string;
  username:    string;
  displayName: string | null;
  avatarUrl:   string | null;
};

export const SONG_REVIEW_COLUMNS =
  'song_id, title, artist, album_id, album_title, artwork_url, duration_ms, rating, review, is_favorite, listened_at';

export function rowToSongReview(r: any): SongReview {
  return {
    songId:     r.song_id,
    title:      r.title,
    artist:     r.artist,
    albumId:    r.album_id ?? undefined,
    albumTitle: r.album_title ?? undefined,
    artworkUrl: r.artwork_url ?? undefined,
    durationMs: r.duration_ms ?? undefined,
    rating:     r.rating ?? 0,
    review:     r.review || undefined,
    isFavorite: !!r.is_favorite,
    listenedAt: r.listened_at,
  };
}

export type SongRatingStats = { sum: number; count: number };

/**
 * Community rating sum/count per song, excluding the caller (combine with the
 * user's own rating via `withOwnRating`). Returns null if the request failed —
 * an empty Map is a real "nobody has rated these".
 */
export async function fetchSongCommunityRatings(songIds: string[]): Promise<Map<string, SongRatingStats> | null> {
  const out = new Map<string, SongRatingStats>();
  const ids = [...new Set(songIds.filter(Boolean))];
  if (ids.length === 0) return out;
  for (let i = 0; i < ids.length; i += 300) {
    const { data, error } = await supabase.rpc('song_community_ratings', { p_song_ids: ids.slice(i, i + 300) });
    if (error) {
      console.warn('[songReviews] community ratings error:', error.message);
      return null;
    }
    for (const r of (data ?? []) as any[]) {
      out.set(r.song_id, { sum: Number(r.rating_sum) || 0, count: Number(r.rating_count) || 0 });
    }
  }
  return out;
}

/** Average rating (1 decimal) including the user's own, or null if nobody has rated. */
export function withOwnRating(stats: SongRatingStats | undefined, ownRating: number | undefined): { avg: number; count: number } | null {
  let sum   = stats?.sum ?? 0;
  let count = stats?.count ?? 0;
  if (ownRating && ownRating > 0) { sum += ownRating; count += 1; }
  if (count === 0) return null;
  return { avg: Math.round((sum / count) * 10) / 10, count };
}

/**
 * Other users' reviews of a song (rated or written), newest first, with
 * profile info. Returns null on failure.
 */
export async function fetchCommunitySongReviews(songId: string, excludeUserId?: string): Promise<CommunitySongReview[] | null> {
  let q = supabase
    .from('song_reviews')
    .select(`user_id, ${SONG_REVIEW_COLUMNS}`)
    .eq('song_id', songId)
    .or('rating.gt.0,review.neq.')
    .order('listened_at', { ascending: false })
    .limit(200);
  if (excludeUserId) q = q.neq('user_id', excludeUserId);
  const rows = rowsOrNull(await q);
  if (!rows) return null;
  if (rows.length === 0) return [];

  const userIds = [...new Set(rows.map((r: any) => r.user_id as string))];
  const profiles = await fetchAllRowsIn<any>(
    userIds,
    (chunk, from, to) => supabase.from('profiles').select('id, username, display_name, avatar_url').in('id', chunk).range(from, to),
    1,
  );
  const byId = new Map((profiles ?? []).map((p: any) => [p.id, p]));

  return rows.map((r: any) => {
    const p = byId.get(r.user_id);
    return {
      ...rowToSongReview(r),
      userId:    r.user_id,
      username:    p?.username ?? '',
      displayName: p?.display_name ?? null,
      avatarUrl:   p?.avatar_url ?? null,
    };
  });
}

/** Another user's song reviews (for their profile / My Songs view). Null on failure. */
export async function fetchUserSongReviews(userId: string): Promise<SongReview[] | null> {
  const rows = rowsOrNull(
    await supabase
      .from('song_reviews')
      .select(SONG_REVIEW_COLUMNS)
      .eq('user_id', userId)
      .order('listened_at', { ascending: false })
      .limit(1000),
  );
  return rows ? rows.map(rowToSongReview) : null;
}
