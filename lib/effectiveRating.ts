/**
 * The rating that should represent an album *today*.
 *
 * `user_albums.rating` is deliberately frozen at the first listen — the rating
 * evolution charts need that original value. When a user re-listens they rate
 * again, and that newer score lands in `re_listens` (surfaced as `lastRating`).
 *
 * Every stat that answers "how does this user rate things" — averages, rating
 * breakdowns, per-artist/decade/genre averages — must use the latest rating, or
 * a re-listened album is counted under a score the user has since changed.
 */
export type RatedAlbum = { rating: number; lastRating?: number };

export const effectiveRating = (a: RatedAlbum): number => a.lastRating ?? a.rating ?? 0;
