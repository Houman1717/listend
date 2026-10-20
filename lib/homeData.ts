import { supabase } from '@/lib/supabase';
import { handleOrName } from '@/lib/userHandle';
import { ReviewTarget, parseReviewTargetId } from '@/lib/reviewTargets';
import { CatalogAlbum, CatalogTrack, CatalogArtist } from '@/context/CatalogService';
import { songKey, stripSameRecording } from '@/lib/songReviews';

export type PopularReview = {
  id: string;
  userId: string;
  username: string;
  /** "@handle" when the account picked one, else their display name. */
  handle: string;
  avatarUrl?: string | null;
  isPro: boolean;
  albumTitle: string;
  albumArtist: string;
  albumYear: string;
  artworkUrl: string;
  rating: number;
  review: string;
  likeCount: number;
  commentCount: number;
};

function weekAgo(): string {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
}

// fetch() with a hard timeout — a slow/cold backend must never wedge a home
// section (or, via pull-to-refresh, leave the RefreshControl spinning forever).
async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Strips accents/diacritics (e.g. "Björk" → "Bjork") so title/artist grouping
// keys aren't split just because different catalog sources spell a name
// differently.
function fold(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export async function fetchTopAlbumsThisWeek(): Promise<CatalogAlbum[]> {
  const [{ data }, { data: relistenData }] = await Promise.all([
    supabase
      .from('user_albums')
      .select('spotify_id, user_id, title, artist, year, artwork_url')
      .gte('listened_at', weekAgo())
      .limit(500),
    supabase
      .from('re_listens')
      .select('spotify_id, user_id, title, artist, year, artwork_url')
      .gte('listened_at', weekAgo())
      .limit(500),
  ]);

  if (!data?.length && !relistenData?.length) return [];

  // Cap each user's contribution to an album at 2 (one base log + one re-listen
  // bonus) regardless of how many times they actually re-listen — otherwise a
  // single user could spam re-listens to push an album to the top on their own.
  //
  // Grouped by normalized title+artist rather than spotify_id — the same
  // release often gets logged under different catalog IDs (reissues,
  // remasters), which used to split its listener count into separate buckets
  // (and could even show the same album twice in the list). Mirrors the same
  // fix applied to /api/discover/community-popular on the server.
  const entries = new Map<string, { album: CatalogAlbum; baseUsers: Set<string>; relistenUsers: Set<string> }>();
  const getEntry = (r: any) => {
    const key = `${fold(r.title ?? '')}::${fold(r.artist ?? '')}`;
    let e = entries.get(key);
    if (!e) {
      e = { album: { id: r.spotify_id, title: r.title ?? '', artist: r.artist ?? '', year: r.year ?? 0, artworkUrl: r.artwork_url ?? '' }, baseUsers: new Set(), relistenUsers: new Set() };
      entries.set(key, e);
    }
    return e;
  };

  for (const r of (data ?? []) as any[]) {
    if (!r.spotify_id || !r.user_id || !r.title || !r.artist) continue;
    getEntry(r).baseUsers.add(r.user_id);
  }
  for (const r of (relistenData ?? []) as any[]) {
    if (!r.spotify_id || !r.user_id || !r.title || !r.artist) continue;
    getEntry(r).relistenUsers.add(r.user_id);
  }

  return Array.from(entries.values())
    .sort((a, b) => (b.baseUsers.size + b.relistenUsers.size) - (a.baseUsers.size + a.relistenUsers.size))
    .map(e => e.album);
}

// Fallback for /api/home/this-week's songs: who logged each song in the last
// 7 days, one per person, pooled across versions and remasters of the same
// recording. At most 3 songs per album so one tracklist rated in a sitting
// can't fill the row. The server's computeTopSongsThisWeek does the same.
export async function fetchTopSongsThisWeek(): Promise<CatalogTrack[]> {
  const { data } = await supabase
    .from('song_reviews')
    .select('user_id, song_id, song_key, title, artist, album_id, album_title, artwork_url, duration_ms, listened_at')
    .gte('listened_at', weekAgo())
    .order('listened_at', { ascending: false })
    .limit(2000);

  if (!data?.length) return [];

  const songs = new Map<string, { versions: Map<string, { row: any; users: Set<string> }>; users: Set<string>; lastAt: string }>();
  for (const r of data as any[]) {
    if (!r.song_id || !r.user_id || !r.title || !r.artist) continue;
    const key = songKey(stripSameRecording(r.title), r.artist);
    let e = songs.get(key);
    if (!e) { e = { versions: new Map(), users: new Set(), lastAt: r.listened_at ?? '' }; songs.set(key, e); }
    e.users.add(r.user_id);
    const vKey = r.song_key ?? r.song_id;
    let v = e.versions.get(vKey);
    if (!v) { v = { row: r, users: new Set() }; e.versions.set(vKey, v); }
    v.users.add(r.user_id);
    if (!v.row.album_id && r.album_id) v.row = r;
  }

  const ranked = Array.from(songs.values())
    .sort((a, b) => b.users.size - a.users.size || b.lastAt.localeCompare(a.lastAt));
  const perAlbum = new Map<string, number>();
  const out: CatalogTrack[] = [];
  for (const e of ranked) {
    let rep: any = null, most = -1;
    e.versions.forEach(v => { if (v.users.size > most) { most = v.users.size; rep = v.row; } });
    const album = `${(rep.album_title ?? rep.song_id).toLowerCase()}|${rep.artist.toLowerCase()}`;
    const n = perAlbum.get(album) ?? 0;
    if (n >= 3) continue;
    perAlbum.set(album, n + 1);
    out.push({
      id: rep.song_id, title: rep.title, artist: rep.artist, artworkUrl: rep.artwork_url ?? '',
      albumId: rep.album_id ?? undefined, albumTitle: rep.album_title ?? undefined, durationMs: rep.duration_ms ?? undefined,
    });
    if (out.length >= 21) break;
  }
  return out;
}

// Fallback for /api/home/this-week's artists (computeTopArtistsThisWeek on the
// server): different people who logged anything by the artist this week — an
// album, a re-listen or a song — one per person. Each artist is identified
// through an album people logged, not a name search, which could open a
// different artist with the same name.
export async function fetchTopArtistsThisWeek(): Promise<CatalogArtist[]> {
  const since = weekAgo();
  const [{ data: albumRows }, { data: relistenRows }, { data: songRows }] = await Promise.all([
    supabase.from('user_albums').select('user_id, spotify_id, artist').gte('listened_at', since).limit(2000),
    supabase.from('re_listens').select('user_id, spotify_id, artist').gte('listened_at', since).limit(1000),
    supabase.from('song_reviews').select('user_id, album_id, artist').gte('listened_at', since).limit(2000),
  ]);

  const byName = new Map<string, { name: string; users: Set<string>; albums: Map<string, number> }>();
  const add = (userId: string, artist: string, albumId: string | null) => {
    const name = artist?.trim();
    const key = fold(name ?? '');
    if (!userId || !key) return;
    let e = byName.get(key);
    if (!e) { e = { name, users: new Set(), albums: new Map() }; byName.set(key, e); }
    e.users.add(userId);
    if (albumId && !albumId.startsWith('lst-')) e.albums.set(albumId, (e.albums.get(albumId) ?? 0) + 1);
  };
  for (const r of (albumRows ?? []) as any[])    add(r.user_id, r.artist, r.spotify_id);
  for (const r of (relistenRows ?? []) as any[]) add(r.user_id, r.artist, r.spotify_id);
  for (const r of (songRows ?? []) as any[])     add(r.user_id, r.artist, r.album_id);

  const ranked = Array.from(byName.values()).sort((a, b) => b.users.size - a.users.size).slice(0, 21);

  const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
  const getJson = (path: string) =>
    fetchWithTimeout(`${API_URL}${path}`, 4000).then(r => (r.ok ? r.json() : null)).catch(() => null);

  return Promise.all(ranked.map(async (e): Promise<CatalogArtist> => {
    const albumId = [...e.albums.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    let id = '', artworkUrl = '';
    if (albumId) {
      const credit = await getJson(`/catalog/album/${encodeURIComponent(albumId)}/artist?name=${encodeURIComponent(e.name)}`);
      if (credit?.id) {
        id = credit.id;
        artworkUrl = (await getJson(`/catalog/artist/${credit.id}`))?.artworkUrl ?? '';
      }
    }
    if (!id) {
      const results = await getJson(`/search?q=${encodeURIComponent(e.name)}&type=artist`);
      id = results?.[0]?.id ?? '';
      artworkUrl = results?.[0]?.artworkUrl ?? '';
    }
    return { id: id || `name:${fold(e.name)}`, name: e.name, genre: '', artworkUrl };
  }));
}

// Popularity is based on likes/comments *received* this week, regardless of
// when the review itself was written (matches Letterboxd's "Popular Reviews"
// model) — an old review that suddenly gets a wave of new engagement can
// resurface here, rather than only ever showing reviews from the last 7 days.
// The weekly counts drive ranking only; the *displayed* likeCount is the
// review's all-time total (matching the count shown on the album detail
// page), fetched separately below so the two screens never disagree.
// `currentUserId`, when passed, is excluded from the returned `likeCount` — the
// caller's own like is applied client-side via the optimistic `likedReviews` set
// (`likeCount + (liked ? 1 : 0)`), so leaving it in the server count here would
// double-count it once a refetch picks up the now-persisted like row.
// Popular Reviews only considers reviews written within this window — keep in
// sync with POPULAR_REVIEW_MAX_AGE_MS in listend-server.
const POPULAR_REVIEW_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
// Reviews rated this or lower (out of 10) are left out of Popular Reviews.
const POPULAR_REVIEW_LOW_RATING_MAX = 3;

export async function fetchPopularReviewsThisWeek(currentUserId?: string): Promise<PopularReview[]> {
  const since = weekAgo();
  const reviewCutoff = Date.now() - POPULAR_REVIEW_MAX_AGE_MS;

  const [{ data: likeRows }, { data: commentRows }] = await Promise.all([
    supabase.from('likes').select('target_id, user_id').eq('target_type', 'review').gte('created_at', since),
    supabase.from('review_comments').select('review_id').gte('created_at', since),
  ]);

  const weeklyLikeCounts = new Map<string, number>();
  for (const l of (likeRows ?? []) as any[]) {
    weeklyLikeCounts.set(l.target_id, (weeklyLikeCounts.get(l.target_id) ?? 0) + 1);
  }
  const commentCounts = new Map<string, number>();
  for (const c of (commentRows ?? []) as any[]) {
    commentCounts.set(c.review_id, (commentCounts.get(c.review_id) ?? 0) + 1);
  }

  const candidateIds = new Set([...weeklyLikeCounts.keys(), ...commentCounts.keys()]);
  if (candidateIds.size === 0) return [];

  // Weekly comments decide ranking, but the card shows the all-time total —
  // same as likes. Showing only this week's comments made a review with older
  // comments read "0 comments" on the card, then "2" once opened.
  const [{ data: totalLikeRows }, { data: totalCommentRows }] = await Promise.all([
    supabase
      .from('likes')
      .select('target_id, user_id')
      .eq('target_type', 'review')
      .in('target_id', [...candidateIds]),
    supabase
      .from('review_comments')
      .select('review_id')
      .in('review_id', [...candidateIds]),
  ]);

  const totalCommentCounts = new Map<string, number>();
  for (const c of (totalCommentRows ?? []) as any[]) {
    totalCommentCounts.set(c.review_id, (totalCommentCounts.get(c.review_id) ?? 0) + 1);
  }

  const likeCounts = new Map<string, number>();
  const currentUserLikedIds = new Set<string>();
  for (const l of (totalLikeRows ?? []) as any[]) {
    likeCounts.set(l.target_id, (likeCounts.get(l.target_id) ?? 0) + 1);
    if (currentUserId && l.user_id === currentUserId) currentUserLikedIds.add(l.target_id);
  }

  const pairs = Array.from(candidateIds)
    .map(parseReviewTargetId)
    .filter((p): p is ReviewTarget => p !== null);
  if (pairs.length === 0) return [];

  const userIds    = [...new Set(pairs.map(p => p.userId))];
  const spotifyIds = [...new Set(pairs.map(p => p.spotifyId))];

  const [{ data: reviewRows }, { data: relistenRows }, { data: profiles }] = await Promise.all([
    supabase
      .from('user_albums')
      .select('user_id, spotify_id, title, artist, year, artwork_url, rating, review, is_relistened, created_at')
      .in('user_id', userIds)
      .in('spotify_id', spotifyIds),
    supabase
      .from('re_listens')
      .select('user_id, spotify_id, title, artist, year, artwork_url, rating, review, listened_at, created_at')
      .in('user_id', userIds)
      .in('spotify_id', spotifyIds)
      .order('listened_at', { ascending: false }),
    supabase.from('profiles').select('id, username, display_name, avatar_url, is_pro').in('id', userIds),
  ]);

  const rowMap = new Map<string, any>();
  for (const r of (reviewRows ?? []) as any[]) {
    rowMap.set(`${r.user_id}_${r.spotify_id}`, r);
  }
  // Latest re-listen rating/review per user+album — a review written on a
  // re-listen (with the original log unrated/unreviewed) must still surface.
  const latestReListenRating = new Map<string, number>();
  const latestReListenReview = new Map<string, string>();
  const latestReListenReviewAt = new Map<string, string>();
  // Also keyed by the exact re-listen target_id, so a like on one specific
  // re-listen review resolves to that re-listen's own rating/review.
  const reListenMap = new Map<string, any>();
  for (const rl of (relistenRows ?? []) as any[]) {
    const key = `${rl.user_id}_${rl.spotify_id}`;
    if (!latestReListenRating.has(key) && rl.rating) latestReListenRating.set(key, rl.rating);
    if (!latestReListenReview.has(key) && rl.review) {
      latestReListenReview.set(key, rl.review);
      latestReListenReviewAt.set(key, rl.created_at);
    }
    reListenMap.set(`relisten_${key}_${rl.listened_at}`, rl);
  }
  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id as string, { username: p.username as string | null, handle: handleOrName(p.username, p.display_name, p.id), avatarUrl: p.avatar_url as string | null, isPro: !!(p.is_pro) }]));

  const reviews: (PopularReview & { weeklyScore: number; writtenAt: string })[] = [];
  for (const { targetId, userId, spotifyId, listenedAt } of pairs) {
    const baseKey = `${userId}_${spotifyId}`;
    const base    = rowMap.get(baseKey);
    const rl      = listenedAt ? reListenMap.get(targetId) : undefined;
    if (!base && !rl) continue;
    const review = listenedAt
      ? (rl?.review ?? '')
      : ((base.is_relistened ? latestReListenReview.get(baseKey) : undefined) ?? base.review ?? '');
    if (!review) continue;
    // Only reviews written in the last two weeks qualify, so a handful of old
    // reviews can't camp at the top just because they're the most seen.
    const writtenAt = listenedAt
      ? rl?.created_at
      : (base.is_relistened && latestReListenReview.has(baseKey) ? latestReListenReviewAt.get(baseKey) : base.created_at);
    if (!writtenAt || Date.parse(writtenAt) < reviewCutoff) continue;
    const rating = listenedAt
      ? (rl?.rating ?? 0)
      : ((base.is_relistened ? latestReListenRating.get(baseKey) : undefined) ?? base.rating ?? 0);
    // Home doesn't lead with takedowns: rated 1–3 is left out of this row (still
    // shown everywhere else). 0 means unrated, which still qualifies.
    if (rating >= 1 && rating <= POPULAR_REVIEW_LOW_RATING_MAX) continue;
    const r = base ?? rl;
    const prof = profileMap.get(userId);
    const weeklyLikes = weeklyLikeCounts.get(targetId) ?? 0;
    const weeklyComments = commentCounts.get(targetId) ?? 0;
    reviews.push({
      id: targetId,
      userId,
      username: prof?.username ?? 'user',
      handle: prof?.handle ?? 'User',
      avatarUrl: prof?.avatarUrl ?? null,
      isPro: prof?.isPro ?? false,
      albumTitle: r.title ?? '',
      albumArtist: r.artist ?? '',
      albumYear: String(r.year ?? ''),
      artworkUrl: r.artwork_url ?? '',
      rating,
      review,
      likeCount: (likeCounts.get(targetId) ?? 0) - (currentUserLikedIds.has(targetId) ? 1 : 0),
      commentCount: totalCommentCounts.get(targetId) ?? 0,
      weeklyScore: weeklyLikes + weeklyComments,
      writtenAt,
    });
  }

  // Equal engagement → newer review first.
  reviews.sort((a, b) => (b.weeklyScore - a.weeklyScore) || (Date.parse(b.writtenAt) - Date.parse(a.writtenAt)));
  return reviews.slice(0, 30).map(({ weeklyScore, writtenAt, ...r }) => r);
}

// Each section is the fetched array, or `undefined` if that section failed to
// load (so the caller can keep whatever it already had rather than blank the
// row). An empty array means the section genuinely has nothing this week.
export type HomeThisWeek = {
  albums?: CatalogAlbum[];
  songs?: CatalogTrack[];
  artists?: CatalogArtist[];
  popularReviews?: PopularReview[];
};

/**
 * Fill in the `handle` the server doesn't send.
 *
 * /api/home/this-week returns each reviewer's `username` but not their display
 * name, so a card built from that payload has no way to tell a real handle from
 * an auto-generated placeholder. One small lookup on the reviewers' ids gives us
 * both. If it fails, every card falls back to its plain "@username" — a stale
 * handle is bad, a blank byline is worse.
 */
async function withHandles(reviews: PopularReview[]): Promise<PopularReview[]> {
  if (!reviews.length) return reviews;
  const userIds = [...new Set(reviews.map(r => r.userId).filter(Boolean))];
  if (!userIds.length) return reviews.map(r => ({ ...r, handle: r.handle ?? `@${r.username}` }));

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, username, display_name')
    .in('id', userIds);

  if (error || !profiles) {
    console.warn('[Home] handle lookup failed, falling back to raw usernames:', error?.message);
    return reviews.map(r => ({ ...r, handle: r.handle ?? `@${r.username}` }));
  }

  const handleById = new Map(
    (profiles as any[]).map(p => [p.id as string, handleOrName(p.username, p.display_name, p.id)]),
  );
  return reviews.map(r => ({ ...r, handle: handleById.get(r.userId) ?? `@${r.username}` }));
}

// The full Popular Reviews list for the See More screen. Reads the same server
// ranking Home's preview row comes from, so the first ten line up exactly — the
// on-device version uses unpaged queries that truncate once there's enough
// weekly activity, and ranks a different set. Falls back to it only if the
// endpoint is unavailable.
export async function fetchPopularReviews(currentUserId?: string): Promise<PopularReview[]> {
  const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
  const qs = currentUserId ? `?userId=${encodeURIComponent(currentUserId)}` : '';
  try {
    const res = await fetchWithTimeout(`${API_URL}/api/home/this-week${qs}`, 8000);
    if (!res.ok) throw new Error(`home/this-week → ${res.status}`);
    const data = await res.json();
    return await withHandles(Array.isArray(data?.popularReviews) ? data.popularReviews : []);
  } catch (err) {
    console.warn('[PopularReviews] this-week endpoint failed, using on-device fallback:', (err as Error).message);
    return fetchPopularReviewsThisWeek(currentUserId);
  }
}

// Single call for the four "This Week" home sections. The server aggregates and
// caches them (rolling 7-day window), so the app no longer pulls ~2,000 raw rows
// and de-dupes on-device every time Home gains focus. Falls back to the
// per-section on-device queries if the endpoint is unavailable (older server,
// network error) so Home still populates.
export async function fetchHomeThisWeek(currentUserId?: string): Promise<HomeThisWeek> {
  const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
  const qs = currentUserId ? `?userId=${encodeURIComponent(currentUserId)}` : '';
  try {
    const res = await fetchWithTimeout(`${API_URL}/api/home/this-week${qs}`, 8000);
    if (!res.ok) throw new Error(`home/this-week → ${res.status}`);
    const data = await res.json();
    // Endpoint response is authoritative — trust all four arrays verbatim,
    // including empties.
    return {
      albums:         Array.isArray(data?.albums)         ? data.albums         : [],
      songs:          Array.isArray(data?.songs)          ? data.songs          : [],
      artists:        Array.isArray(data?.artists)        ? data.artists        : [],
      popularReviews: await withHandles(Array.isArray(data?.popularReviews) ? data.popularReviews : []),
    };
  } catch (err) {
    console.warn('[Home] this-week endpoint failed, using on-device fallback:', (err as Error).message);
    // allSettled, not all — one failing section must not wipe the others. A
    // rejected section stays `undefined` so the caller keeps its cached value.
    const [albs, sngs, arts, revs] = await Promise.allSettled([
      fetchTopAlbumsThisWeek(),
      fetchTopSongsThisWeek(),
      fetchTopArtistsThisWeek(),
      fetchPopularReviewsThisWeek(currentUserId),
    ]);
    return {
      albums:         albs.status === 'fulfilled' ? albs.value : undefined,
      songs:          sngs.status === 'fulfilled' ? sngs.value : undefined,
      artists:        arts.status === 'fulfilled' ? arts.value : undefined,
      popularReviews: revs.status === 'fulfilled' ? revs.value : undefined,
    };
  }
}
