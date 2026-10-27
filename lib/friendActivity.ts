import { supabase } from '@/lib/supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

export type FriendActivityEvent = 'log' | 'update' | 'relisten';

/**
 * Tells the server the user just logged / re-listened / first rated or
 * reviewed an album, so followers who rang their bell get a push. The server
 * reads the saved row, picks recipients and dedupes to one push per album —
 * this is fire-and-forget and never blocks or fails the user's own save.
 */
export function notifyFriendActivity(spotifyId: string, event: FriendActivityEvent) {
  supabase.auth.getSession()
    .then(({ data: { session } }) => {
      const token = session?.access_token;
      if (!token) return;
      return fetch(`${API_URL}/api/friend-activity`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ spotify_id: spotifyId, event }),
      });
    })
    .catch(() => {});
}

/** Whether the user rang the bell on this friend's profile. null = couldn't tell. */
export async function fetchFriendActivityBell(userId: string, friendId: string): Promise<boolean | null> {
  const { data, error } = await supabase
    .from('friend_activity_subscriptions')
    .select('target_id')
    .match({ subscriber_id: userId, target_id: friendId })
    .maybeSingle();
  if (error) return null;
  return !!data;
}

export async function setFriendActivityBell(userId: string, friendId: string, on: boolean): Promise<boolean> {
  const { error } = on
    ? await supabase
        .from('friend_activity_subscriptions')
        .upsert({ subscriber_id: userId, target_id: friendId }, { onConflict: 'subscriber_id,target_id', ignoreDuplicates: true })
    : await supabase
        .from('friend_activity_subscriptions')
        .delete()
        .match({ subscriber_id: userId, target_id: friendId });
  if (error) console.error('[friendActivity] bell update error:', error.message);
  return !error;
}
