import { supabase } from '@/lib/supabase';
import { countOrNull, fetchAllRows } from '@/lib/supabaseQuery';
import { nameOrHandle } from '@/lib/userHandle';
import type { LoggedAlbum } from '@/context/AlbumsContext';

export type DMAlbum = {
  id: string;
  title: string;
  artist: string;
  artworkUrl: string;
  year?: number;
};

export type DMFriend = {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  isPro: boolean;
};

/**
 * One unread 'message' notification per sender is enough — skip the insert if
 * the recipient already has one from us.
 */
export async function notifyMessageRecipient(senderId: string, receiverId: string) {
  const count = countOrNull(await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', receiverId)
    .eq('type', 'message')
    .eq('actor_id', senderId)
    .eq('read', false));
  // null = the check itself failed. `?? 0` used to make that look like "no
  // existing notification", so during an outage every message sent inserted
  // another duplicate. Skip instead — a missed notification beats spam.
  if (count === 0) {
    supabase.from('notifications').insert({
      user_id:  receiverId,
      type:     'message',
      actor_id: senderId,
    }).then(({ error }) => {
      if (error) console.error('[DM] notification insert error:', error.message);
    });
  }
}

/** Sends an album card, carrying the sender's own rating/review if they've logged it. */
export async function sendAlbumMessage(
  senderId: string,
  receiverId: string,
  album: DMAlbum,
  loggedAlbums: LoggedAlbum[],
): Promise<boolean> {
  const loggedEntry = loggedAlbums.find(a => a.id === album.id)
    ?? loggedAlbums.find(a =>
        a.title.toLowerCase() === album.title.toLowerCase() &&
        a.artist.toLowerCase() === album.artist.toLowerCase()
      );
  const albumDataWithRating = {
    ...album,
    ...(loggedEntry && (loggedEntry.lastRating ?? loggedEntry.rating) > 0 ? { sender_rating: loggedEntry.lastRating ?? loggedEntry.rating } : {}),
    ...(loggedEntry && (loggedEntry.lastReview ?? loggedEntry.review) ? { sender_review: loggedEntry.lastReview ?? loggedEntry.review } : {}),
  };

  const { error } = await supabase.from('messages').insert({
    sender_id:   senderId,
    receiver_id: receiverId,
    content:     album.title,
    type:        'album',
    album_data:  albumDataWithRating,
  });

  if (error) {
    console.error('[DM] send album error:', error);
    return false;
  }
  notifyMessageRecipient(senderId, receiverId);
  return true;
}

/**
 * People you can DM: mutual follows who haven't turned DMs off — the same rule
 * user-profile uses to show its Message button. null = couldn't load.
 */
export async function fetchDMFriends(uid: string): Promise<DMFriend[] | null> {
  const [outRows, inRows] = await Promise.all([
    fetchAllRows<{ following_id: string }>(
      (from, to) => supabase.from('follows').select('following_id').eq('follower_id', uid).order('following_id').range(from, to),
      10,
    ),
    fetchAllRows<{ follower_id: string }>(
      (from, to) => supabase.from('follows').select('follower_id').eq('following_id', uid).order('follower_id').range(from, to),
      10,
    ),
  ]);
  if (!outRows || !inRows) return null;

  const followers = new Set(inRows.map(r => r.follower_id));
  const mutualIds = outRows.map(r => r.following_id).filter(id => followers.has(id));
  if (mutualIds.length === 0) return [];

  const friends: DMFriend[] = [];
  for (let i = 0; i < mutualIds.length; i += 200) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, username, avatar_url, is_pro, allow_dms')
      .in('id', mutualIds.slice(i, i + 200));
    if (error) return null;
    for (const p of data ?? []) {
      if (p.allow_dms === false) continue;
      friends.push({
        id:        p.id,
        name:      nameOrHandle(p.display_name, p.username, p.id, 'User'),
        username:  p.username ?? null,
        avatarUrl: p.avatar_url ?? null,
        isPro:     !!p.is_pro,
      });
    }
  }
  return friends.sort((a, b) => a.name.localeCompare(b.name));
}
