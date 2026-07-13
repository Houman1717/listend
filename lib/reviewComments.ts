import { supabase } from '@/lib/supabase';
import { ReviewComment } from '@/components/ReviewComments';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function fetchReviewComments(reviewId: string): Promise<ReviewComment[]> {
  const { data: rows } = await supabase
    .from('review_comments')
    .select('id, review_id, user_id, parent_comment_id, body, created_at')
    .eq('review_id', reviewId)
    .order('created_at', { ascending: true });

  if (!rows?.length) return [];

  const userIds = [...new Set((rows as any[]).map(r => r.user_id as string))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, avatar_url, is_pro')
    .in('id', userIds);

  const profileMap = new Map(
    (profiles ?? []).map((p: any) => [
      p.id as string,
      { username: p.username as string, avatarUrl: p.avatar_url as string | null, isPro: !!(p.is_pro) },
    ])
  );

  return (rows as any[]).map(r => ({
    id:              r.id as string,
    reviewId:        r.review_id as string,
    userId:          r.user_id as string,
    username:        profileMap.get(r.user_id)?.username ?? 'user',
    avatarUrl:       profileMap.get(r.user_id)?.avatarUrl ?? null,
    isPro:           profileMap.get(r.user_id)?.isPro ?? false,
    body:            r.body as string,
    parentCommentId: r.parent_comment_id ?? undefined,
    replyToUsername: null,
    createdAt:       new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));
}

export async function insertReviewComment(
  reviewId: string,
  userId: string,
  body: string,
  parentCommentId?: string | null,
): Promise<string | null> {
  const validParent = parentCommentId && UUID_RE.test(parentCommentId) ? parentCommentId : null;
  const { data, error } = await supabase
    .from('review_comments')
    .insert({ review_id: reviewId, user_id: userId, body, parent_comment_id: validParent })
    .select('id')
    .single();
  if (error) { console.error('[insertReviewComment]', error.message); return null; }

  const newCommentId = (data as any)?.id ?? null;
  if (newCommentId) {
    notifyForComment(reviewId, userId, validParent, newCommentId).catch(e =>
      console.error('[insertReviewComment] notify error:', e)
    );
  }

  return newCommentId;
}

// Notifies the parent comment's author on a reply, or the review's owner on a
// top-level comment. Never notifies someone about their own action.
async function notifyForComment(reviewId: string, actorId: string, parentCommentId: string | null, commentId: string) {
  let recipientId: string | null = null;

  if (parentCommentId) {
    const { data: parent } = await supabase
      .from('review_comments')
      .select('user_id')
      .eq('id', parentCommentId)
      .maybeSingle();
    recipientId = parent?.user_id ?? null;
  } else {
    recipientId = reviewId.split('_')[0] || null;
  }

  if (!recipientId || recipientId === actorId) return;

  const { error } = await supabase.from('notifications').insert({
    user_id:    recipientId,
    type:       parentCommentId ? 'comment_reply' : 'comment',
    actor_id:   actorId,
    target_id:  reviewId,
    comment_id: commentId,
  });
  if (error) console.error('[notifyForComment]', error.message);
}

export async function countReviewComments(reviewIds: string[]): Promise<Map<string, number>> {
  if (!reviewIds.length) return new Map();
  try {
    const { data } = await supabase
      .from('review_comments')
      .select('review_id')
      .in('review_id', reviewIds);
    const counts = new Map<string, number>();
    for (const r of (data ?? []) as any[]) {
      counts.set(r.review_id, (counts.get(r.review_id) ?? 0) + 1);
    }
    return counts;
  } catch {
    return new Map();
  }
}
