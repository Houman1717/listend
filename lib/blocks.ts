import { supabase } from '@/lib/supabase';

/**
 * Everyone the user has blocked or been blocked by — their content should be
 * hidden both ways (App Store guideline 1.2). Empty on failure: a failed
 * lookup must not hide the whole list, and RLS still protects private data.
 */
export async function fetchBlockedIds(userId: string | null | undefined): Promise<Set<string>> {
  if (!userId) return new Set();
  const [byMe, byThem] = await Promise.all([
    supabase.from('blocked_users').select('blocked_id').eq('blocker_id', userId),
    supabase.from('blocked_users').select('blocker_id').eq('blocked_id', userId),
  ]);
  return new Set([
    ...((byMe.data ?? []) as any[]).map(r => r.blocked_id as string),
    ...((byThem.data ?? []) as any[]).map(r => r.blocker_id as string),
  ]);
}
