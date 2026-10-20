// Song ratings/reviews — the secondary, track-level companion to album logs.
// Rows live in `song_reviews` (supabase/add-song-reviews.sql), never in
// user_albums, so nothing album-shaped changes when a song is logged.

import { supabase } from '@/lib/supabase';
import { fetchAllRows, fetchAllRowsIn, rowsOrNull } from '@/lib/supabaseQuery';
import { fetchBlockedIds } from '@/lib/blocks';

/**
 * Groups versions of the same song (the single and the album track have
 * different Apple Music ids): title without "(feat. …)" credits + artist,
 * lower-cased. Must match public.song_key() in supabase/add-song-keys.sql.
 */
export function songKey(title: string, artist: string): string {
  const t = (title ?? '').replace(/\s*[\(\[](feat|ft|with)\.?\s[^\)\]]*[\)\]]/gi, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const a = (artist ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  return `${t}|${a}`;
}

type SongRef = { id: string; title: string; artist: string };

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
 * Like albums, a song's Listend average stays hidden until this many people
 * rate it. Lower than albums (10): song ratings spread across far more items,
 * so per-song counts grow much slower. 3 is the least that's more than one
 * or two people's opinion (often your own, which is counted).
 */
export const SONG_MIN_RATINGS = 3;

/**
 * Community rating sum/count per song, excluding the caller (combine with the
 * user's own rating via `withOwnRating`), pooled across versions of the same
 * song. Keyed by the song ids passed in. Returns null if the request failed —
 * an empty Map is a real "nobody has rated these".
 */
export async function fetchSongCommunityRatings(songs: SongRef[]): Promise<Map<string, SongRatingStats> | null> {
  const out = new Map<string, SongRatingStats>();
  const idsByKey = new Map<string, string[]>();
  for (const s of songs) {
    if (!s.id) continue;
    const k = songKey(s.title, s.artist);
    const list = idsByKey.get(k);
    if (list) list.push(s.id); else idsByKey.set(k, [s.id]);
  }
  const keys = [...idsByKey.keys()];
  for (let i = 0; i < keys.length; i += 300) {
    const { data, error } = await supabase.rpc('song_community_ratings_by_key', { p_keys: keys.slice(i, i + 300) });
    if (error) {
      console.warn('[songReviews] community ratings error:', error.message);
      return null;
    }
    for (const r of (data ?? []) as any[]) {
      const stats = { sum: Number(r.rating_sum) || 0, count: Number(r.rating_count) || 0 };
      for (const id of idsByKey.get(r.song_key) ?? []) out.set(id, stats);
    }
  }
  return out;
}

/**
 * Average rating (1 decimal) including the user's own, plus how many ratings
 * it's from. `revealed` is false until SONG_MIN_RATINGS people have rated —
 * show the average only when it's true. Null if nobody has rated.
 */
export function withOwnRating(stats: SongRatingStats | undefined, ownRating: number | undefined): { avg: number; count: number; revealed: boolean } | null {
  let sum   = stats?.sum ?? 0;
  let count = stats?.count ?? 0;
  if (ownRating && ownRating > 0) { sum += ownRating; count += 1; }
  if (count === 0) return null;
  return { avg: Math.round((sum / count) * 10) / 10, count, revealed: count >= SONG_MIN_RATINGS };
}

/**
 * Other users' reviews of a song (rated or written), newest first, with
 * profile info — across every version of the song, one per person. Leaves out
 * the viewer and anyone they've blocked or been blocked by. Null on failure.
 */
export async function fetchCommunitySongReviews(song: SongRef, viewerId?: string): Promise<CommunitySongReview[] | null> {
  let q = supabase
    .from('song_reviews')
    .select(`user_id, ${SONG_REVIEW_COLUMNS}`)
    .eq('song_key', songKey(song.title, song.artist))
    .or('rating.gt.0,review.neq.')
    .order('listened_at', { ascending: false })
    .limit(200);
  if (viewerId) q = q.neq('user_id', viewerId);
  const [res, blocked] = await Promise.all([q, fetchBlockedIds(viewerId)]);
  const all = rowsOrNull(res);
  if (!all) return null;
  // Newest first, so the first row per person is their latest version.
  const seen = new Set<string>();
  const rows = all.filter((r: any) => {
    if (blocked.has(r.user_id) || seen.has(r.user_id)) return false;
    seen.add(r.user_id);
    return true;
  });
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

/**
 * One user's song reviews for one album. Matches on album_id, and on album
 * title + artist too — logging can canonicalise the album id (another
 * edition), so the review card's id and the songs' album_id can differ.
 * Null on failure.
 */
export async function fetchUserAlbumSongReviews(
  userId: string,
  album: { id?: string; title: string; artist: string },
): Promise<SongReview[] | null> {
  const byId = album.id
    ? supabase.from('song_reviews').select(SONG_REVIEW_COLUMNS).eq('user_id', userId).eq('album_id', album.id).limit(200)
    : null;
  const byTitle = album.title
    ? supabase.from('song_reviews').select(SONG_REVIEW_COLUMNS).eq('user_id', userId).ilike('album_title', escapeLike(album.title)).limit(200)
    : null;
  const [a, b] = await Promise.all([byId, byTitle]);
  const rowsA = a ? rowsOrNull(a) : [];
  const rowsB = b ? rowsOrNull(b) : [];
  if (!rowsA || !rowsB) return null;
  const artist = album.artist.trim().toLowerCase();
  const out = new Map<string, SongReview>();
  for (const r of rowsA) out.set(r.song_id, rowToSongReview(r));
  for (const r of rowsB) {
    if (artist && (r.artist ?? '').trim().toLowerCase() !== artist) continue;
    out.set(r.song_id, rowToSongReview(r));
  }
  return [...out.values()];
}

/** Same matching as fetchUserAlbumSongReviews, over an in-memory list. */
export function songsMatchingAlbum(list: SongReview[], album: { id?: string; title: string; artist: string }): SongReview[] {
  const title  = album.title.trim().toLowerCase();
  const artist = album.artist.trim().toLowerCase();
  return list.filter(s =>
    (album.id && s.albumId === album.id) ||
    (!!title && (s.albumTitle ?? '').trim().toLowerCase() === title && s.artist.trim().toLowerCase() === artist),
  );
}

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, m => `\\${m}`);
}

/**
 * Number of people with a written review per song (any version), keyed by the
 * song ids passed in. Leaves out the viewer and anyone blocked either way.
 * Null on failure.
 */
export async function fetchSongReviewCounts(songs: SongRef[], viewerId?: string): Promise<Map<string, number> | null> {
  const out = new Map<string, number>();
  const idsByKey = new Map<string, string[]>();
  for (const s of songs) {
    if (!s.id) continue;
    const k = songKey(s.title, s.artist);
    const list = idsByKey.get(k);
    if (list) list.push(s.id); else idsByKey.set(k, [s.id]);
  }
  if (idsByKey.size === 0) return out;
  const [rows, blocked] = await Promise.all([
    fetchAllRowsIn<any>(
      [...idsByKey.keys()],
      (chunk, from, to) => supabase
        .from('song_reviews')
        .select('song_key, user_id')
        .in('song_key', chunk)
        .not('review', 'is', null)
        .neq('review', '')
        .range(from, to),
      5,
    ),
    fetchBlockedIds(viewerId),
  ]);
  if (!rows) return null;
  const people = new Map<string, Set<string>>();
  for (const r of rows) {
    if (r.user_id === viewerId || blocked.has(r.user_id)) continue;
    const set = people.get(r.song_key) ?? new Set<string>();
    set.add(r.user_id);
    people.set(r.song_key, set);
  }
  for (const [k, set] of people) {
    for (const id of idsByKey.get(k) ?? []) out.set(id, set.size);
  }
  return out;
}

/** One of an artist's songs with its Listend numbers, for the artist page. */
export type ArtistTopSong = {
  songId:      string;
  title:       string;
  artist:      string;
  albumId?:    string;
  albumTitle?: string;
  artworkUrl?: string;
  durationMs?: number;
  /** Average of the ratings (0 if nobody rated). */
  avg:         number;
  /** How many people rated it. */
  ratingCount: number;
  /** How many people logged it, rated or not. */
  listenCount: number;
};

export type ArtistTopSongs = {
  /** Most-logged first. */
  mostListend: ArtistTopSong[];
  /** Highest average first — only songs with at least SONG_MIN_RATINGS ratings. */
  topRated:    ArtistTopSong[];
};

// Same recording, re-released: "(Remastered 2009)", "(2019 Mix)", "- Remastered",
// "(50th Anniversary)". Mirrors stripSameContentQualifier on the server (album
// reviews pool editions the same way), plus the dash form track titles use.
// Remixes, live and acoustic versions stay separate songs.
export function stripSameRecording(title: string): string {
  return (title ?? '')
    .replace(/[([][^)\]]*\b(?:remaster(?:ed)?|anniversary|reissue|\d{4}\s+(?:stereo\s+)?(?:re)?mix(?:ed)?)\b[^)\]]*[)\]]/gi, '')
    .replace(/\s+-\s+(?:\d{4}\s+)?(?:remaster(?:ed)?|\d{4}\s+(?:stereo\s+)?(?:re)?mix)\b.*$/i, '')
    .trim();
}

// An artist with a big following can have thousands of song logs; ten pages
// covers that without letting one artist page pull an unbounded amount.
const ARTIST_SONG_PAGES = 10;

/**
 * An artist's most-logged and highest-rated songs on Listend. One entry per
 * person per song (their latest log), pooled across versions by song_key like
 * the song page, and also across remasters and dated mixes of the same
 * recording — otherwise "Oh! Darling (2019 Mix)" ranked as its own song next
 * to the remaster. Each song shows as its most-logged version. Matched on the credited artist, so collaborations
 * credited to "A & B" don't count toward A. Null if the request failed.
 */
export async function fetchArtistTopSongs(artist: string, limit = 5): Promise<ArtistTopSongs | null> {
  const name = artist.trim();
  if (!name) return { mostListend: [], topRated: [] };
  // ilike without wildcards is a case-insensitive equals — escape any the name contains.
  const pattern = name.replace(/[\\%_]/g, c => `\\${c}`);
  const rows = await fetchAllRows<any>((from, to) => supabase
    .from('song_reviews')
    .select('user_id, song_id, song_key, title, artist, album_id, album_title, artwork_url, duration_ms, rating, listened_at')
    .ilike('artist', pattern)
    .range(from, to), ARTIST_SONG_PAGES);
  if (!rows) return null;

  type Version = { meta: any; users: Set<string> };
  const bySong = new Map<string, { versions: Map<string, Version>; latest: Map<string, { rating: number; at: string }> }>();
  for (const r of rows) {
    if (!r.song_key || !r.user_id) continue;
    const key = songKey(stripSameRecording(r.title), r.artist);
    let e = bySong.get(key);
    if (!e) { e = { versions: new Map(), latest: new Map() }; bySong.set(key, e); }
    let v = e.versions.get(r.song_key);
    if (!v) { v = { meta: r, users: new Set() }; e.versions.set(r.song_key, v); }
    v.users.add(r.user_id);
    // Show the album version when there is one, not the single.
    if (!v.meta.album_id && r.album_id) v.meta = r;
    const prev = e.latest.get(r.user_id);
    if (!prev || (r.listened_at ?? '') > prev.at) e.latest.set(r.user_id, { rating: r.rating ?? 0, at: r.listened_at ?? '' });
  }

  const songs: ArtistTopSong[] = [];
  bySong.forEach(({ versions, latest }) => {
    let meta: any = null, most = -1;
    versions.forEach(v => { if (v.users.size > most) { most = v.users.size; meta = v.meta; } });
    let sum = 0, rated = 0;
    latest.forEach(v => { if (v.rating > 0) { sum += v.rating; rated++; } });
    songs.push({
      songId:      meta.song_id,
      title:       meta.title,
      artist:      meta.artist,
      albumId:     meta.album_id ?? undefined,
      albumTitle:  meta.album_title ?? undefined,
      artworkUrl:  meta.artwork_url ?? undefined,
      durationMs:  meta.duration_ms ?? undefined,
      avg:         rated > 0 ? Math.round((sum / rated) * 10) / 10 : 0,
      ratingCount: rated,
      listenCount: latest.size,
    });
  });

  const mostListend = [...songs]
    .sort((a, b) => b.listenCount - a.listenCount || b.avg - a.avg)
    .slice(0, limit);
  const topRated = songs
    .filter(s => s.ratingCount >= SONG_MIN_RATINGS)
    .sort((a, b) => b.avg - a.avg || b.ratingCount - a.ratingCount)
    .slice(0, limit);
  return { mostListend, topRated };
}
