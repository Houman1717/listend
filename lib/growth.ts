import { supabase } from '@/lib/supabase';

// People-to-follow suggestions and the onboarding "who invited you?" claim.
// Both are Postgres functions (supabase/add-growth-follows-reengagement.sql)
// called straight from the app, so there's no server round trip.

export type SuggestedUser = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_pro: boolean;
  shared_count: number;
  followers: number;
  /** "12 albums in common" / "Popular on Listend" / "Active this week" / "Active this month" */
  reason: string;
};

// The query reads every log (~0.3s), and the answer barely moves within a
// session, so it's fetched once per user per app run and shared by the
// onboarding screen and the Home card.
let cache: { userId: string; at: number; rows: SuggestedUser[] } | null = null;
const CACHE_MS = 30 * 60 * 1000;

/**
 * Accounts to suggest following, best first. Returns [] on any failure — a
 * missing suggestion list should never show as an error.
 */
export async function fetchSuggestedFollows(userId: string, limit = 20): Promise<SuggestedUser[]> {
  if (cache && cache.userId === userId && Date.now() - cache.at < CACHE_MS) return cache.rows;
  const { data, error } = await supabase.rpc('suggested_follows', { p_limit: limit });
  if (error) {
    console.warn('[growth] suggested_follows failed:', error.message);
    return [];
  }
  const rows = (data ?? []) as SuggestedUser[];
  // Never cache an empty answer: it may just mean the network blipped.
  if (rows.length) cache = { userId, at: Date.now(), rows };
  return rows;
}

/** Drop someone from the cached list once they've been followed. */
export function forgetSuggestion(id: string) {
  if (cache) cache = { ...cache, rows: cache.rows.filter(r => r.id !== id) };
}

export type FollowResult = 'following' | 'requested' | 'error';

/** follow_user decides server-side: private accounts get a request. */
export async function followUser(targetId: string): Promise<FollowResult> {
  const { data, error } = await supabase.rpc('follow_user', { p_target: targetId });
  if (error) {
    console.warn('[growth] follow_user failed:', error.message);
    return 'error';
  }
  forgetSuggestion(targetId);
  return data === 'requested' ? 'requested' : 'following';
}

export type InviteResult =
  | 'following' | 'requested' | 'not_found' | 'self'
  | 'already_claimed' | 'too_late' | 'error';

/**
 * "Who invited you?" — follows the inviter and tells them the invite worked.
 * One per account, within 14 days of signing up.
 */
export async function claimInviter(username: string): Promise<InviteResult> {
  const { data, error } = await supabase.rpc('claim_inviter', { p_username: username });
  if (error) {
    console.warn('[growth] claim_inviter failed:', error.message);
    return 'error';
  }
  return (data as InviteResult) ?? 'error';
}

/** Accounts newer than this can still say who invited them. */
export const INVITE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
