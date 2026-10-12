import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { openSongPage } from '@/lib/openSong';
import { SongReviewDetailModal, type SongReviewAuthor } from '@/components/SongReviewDetailModal';
import type { SongReview } from '@/lib/songReviews';

/**
 * One person's review card for a song they logged — what My Songs, Top 5
 * Songs and the like open, the way My Listend opens your album review card.
 * Tapping the song goes to its Song page; Edit (your own) opens the Song page
 * in edit mode.
 *
 * Render this from a screen, not inside another Modal: it navigates with the
 * router after closing the card.
 */
export function SongReviewCard({ userId, review, onClose, isDark, colors }: {
  userId:  string | null | undefined;
  review:  SongReview | null;
  onClose: () => void;
  isDark:  boolean;
  colors?: any;
}) {
  const router = useRouter();
  const [author, setAuthor] = useState<SongReviewAuthor | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase.from('profiles').select('username, display_name, avatar_url').eq('id', userId).maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setAuthor({ userId, username: (data as any).username, displayName: (data as any).display_name, avatarUrl: (data as any).avatar_url });
      });
    return () => { cancelled = true; };
  }, [userId]);

  if (!review || !userId) return null;

  const song = {
    id:         review.songId,
    title:      review.title,
    artist:     review.artist,
    albumId:    review.albumId,
    albumTitle: review.albumTitle,
    artworkUrl: review.artworkUrl,
    durationMs: review.durationMs,
  };

  return (
    <SongReviewDetailModal
      song={song}
      entry={{
        ...(author ?? { userId }),
        rating:     review.rating,
        review:     review.review,
        isFavorite: review.isFavorite,
        listenedAt: review.listenedAt,
      }}
      isDark={isDark}
      colors={colors}
      onClose={onClose}
      onSongPress={() => { onClose(); openSongPage(router, song); }}
      onUserPress={(id) => { onClose(); router.push({ pathname: '/user-profile', params: { userId: id } }); }}
      onEdit={() => { onClose(); openSongPage(router, song, { edit: true }); }}
    />
  );
}
