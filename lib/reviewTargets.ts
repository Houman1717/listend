// A review's like/comment target_id comes in two shapes:
//
//   `{userId}_{spotifyId}`                            — the original log
//   `relisten_{userId}_{spotifyId}_{listenedAt}`      — a review written on a re-listen
//
// Splitting on the first "_" therefore reads a re-listen's owner as the literal
// string "relisten". Written into a uuid column (likes.target_owner_id,
// notifications.user_id) Postgres rejects it with 22P02, and passed into
// `.in('user_id', …)` it rejects the whole batch — so one re-listen id used to
// take out a like, a notification, or an entire section. Parse through here.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ReviewTarget = {
  targetId:   string;
  userId:     string;
  spotifyId:  string;
  /** Set only for re-listen reviews — identifies which re-listen was liked. */
  listenedAt: string | null;
};

export function parseReviewTargetId(targetId: string): ReviewTarget | null {
  if (targetId.startsWith('relisten_')) {
    const rest       = targetId.slice('relisten_'.length);
    const userId     = rest.slice(0, 36);
    const tail       = rest.slice(37);
    const idx        = tail.indexOf('_');
    if (idx === -1) return null;
    const spotifyId  = tail.slice(0, idx);
    const listenedAt = tail.slice(idx + 1);
    if (!UUID_RE.test(userId) || !spotifyId || !listenedAt) return null;
    return { targetId, userId, spotifyId, listenedAt };
  }
  const idx = targetId.indexOf('_');
  if (idx === -1) return null;
  const userId    = targetId.slice(0, idx);
  const spotifyId = targetId.slice(idx + 1);
  if (!UUID_RE.test(userId) || !spotifyId) return null;
  return { targetId, userId, spotifyId, listenedAt: null };
}

/** The uuid of the user who wrote the review, or null if the id is malformed. */
export function reviewOwnerId(targetId: string): string | null {
  return parseReviewTargetId(targetId)?.userId ?? null;
}
