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

/** What a bell on a friend's profile pushes for. All false = no bell. */
export type BellPrefs = { reviews: boolean; ratings: boolean; listens: boolean };

export const BELL_OFF: BellPrefs = { reviews: false, ratings: false, listens: false };

export function bellIsOn(p: BellPrefs | null | undefined): boolean {
  return !!p && (p.reviews || p.ratings || p.listens);
}

/** The bell's options for this friend (BELL_OFF if none). null = couldn't tell. */
export async function fetchFriendActivityBell(userId: string, friendId: string): Promise<BellPrefs | null> {
  const { data, error } = await supabase
    .from('friend_activity_subscriptions')
    .select('reviews, ratings, listens')
    .match({ subscriber_id: userId, target_id: friendId })
    .maybeSingle();
  if (error) return null;
  return data ? { reviews: !!data.reviews, ratings: !!data.ratings, listens: !!data.listens } : BELL_OFF;
}

/** Saves the bell's options; all off removes the bell row. */
export async function setFriendActivityBell(userId: string, friendId: string, prefs: BellPrefs): Promise<boolean> {
  const { error } = bellIsOn(prefs)
    ? await supabase
        .from('friend_activity_subscriptions')
        .upsert({ subscriber_id: userId, target_id: friendId, ...prefs }, { onConflict: 'subscriber_id,target_id' })
    : await supabase
        .from('friend_activity_subscriptions')
        .delete()
        .match({ subscriber_id: userId, target_id: friendId });
  if (error) console.error('[friendActivity] bell update error:', error.message);
  return !error;
}
