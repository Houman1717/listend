import { Router } from 'expo-router';
import { supabase } from '@/lib/supabase';

/**
 * Notifications only store target_id (`{userId}_{spotifyId}`), so a bare
 * `id` param isn't enough for album-detail to reliably find the review —
 * older comments/likes can carry a spotify_id that no longer matches how
 * the album is keyed in the reviewer's own library. Fetching the real
 * title/artist/year lets album-detail's existing title+artist fallback
 * matching find the right album regardless of ID drift.
 */
export async function navigateToReviewNotification(
  router: Router,
  targetId: string,
  openComments: boolean,
) {
  const [userId, spotifyId] = targetId.split('_');

  let title: string | undefined;
  let artist: string | undefined;
  let year: string | undefined;
  let artworkUrl: string | undefined;

  if (userId && spotifyId) {
    const { data } = await supabase
      .from('user_albums')
      .select('title, artist, year, artwork_url')
      .eq('user_id', userId)
      .eq('spotify_id', spotifyId)
      .maybeSingle();
    if (data) {
      title      = data.title      ?? undefined;
      artist     = data.artist     ?? undefined;
      year       = data.year ? String(data.year) : undefined;
      artworkUrl = data.artwork_url ?? undefined;
    }
  }

  router.push({
    pathname: '/album-detail',
    params: {
      id: spotifyId ?? targetId.split('_')[1],
      title, artist, year, artworkUrl,
      reviewId: targetId,
      openComments: openComments ? '1' : undefined,
    },
  } as any);
}
