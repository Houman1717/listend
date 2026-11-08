import { useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { getProTheme, themeToColors } from '@/lib/proThemes';
import { ShareCardSheet } from '@/components/share/ShareCardSheet';
import {
  CardColors, DEFAULT_CARD_COLORS, ReviewCard, ReviewCardAlbum, reviewCardImages, useOwnCardColors,
} from '@/components/share/ShareCards';
import { ShareIcon } from '@/components/share/ShareIcon';

// Share icon + card sheet for any review, yours or someone else's.
//
// Someone else's review is credited to them: their @handle and their Pro theme
// (else the default Listend look) go on the card, never the sharer's. Private
// accounts and blocked users (either direction) get no button — a private
// account chose who sees its reviews, so we don't hand out images of them.
// Until that check has loaded (or if it fails) the button stays hidden.

type Reviewer = { handle: string; colors: CardColors };

function useReviewerForShare(reviewerId: string, enabled: boolean): Reviewer | null {
  const { user } = useAuth();
  const [reviewer, setReviewer] = useState<Reviewer | null>(null);

  useEffect(() => {
    setReviewer(null);
    if (!enabled || !user?.id || !reviewerId) return;
    let cancelled = false;
    Promise.all([
      supabase.from('profiles').select('username, is_private, is_pro, pro_theme').eq('id', reviewerId).maybeSingle(),
      supabase.from('blocked_users').select('blocker_id')
        .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${reviewerId}),and(blocker_id.eq.${reviewerId},blocked_id.eq.${user.id})`)
        .limit(1),
    ]).then(([p, b]) => {
      if (cancelled || p.error || b.error) return;
      const prof = p.data as { username?: string; is_private?: boolean; is_pro?: boolean; pro_theme?: string } | null;
      if (!prof?.username || prof.is_private || (b.data?.length ?? 0) > 0) return;
      const t = prof.is_pro && prof.pro_theme && prof.pro_theme !== 'default'
        ? themeToColors(getProTheme(prof.pro_theme))
        : null;
      setReviewer({
        handle: prof.username,
        colors: t
          ? { background: t.background, surface: t.surface, text: t.text, subtext: t.subtext, tint: t.tint }
          : DEFAULT_CARD_COLORS,
      });
    });
    return () => { cancelled = true; };
  }, [reviewerId, enabled, user?.id]);

  return reviewer;
}

export function ReviewShareButton({ reviewerId, album, rating, review, color, size = 19 }: {
  reviewerId: string;
  album: ReviewCardAlbum;
  rating: number;
  review?: string | null;
  /** Icon colour. */
  color: string;
  size?: number;
}) {
  const { user } = useAuth();
  const isOwn = !!user?.id && reviewerId === user.id;
  const hasContent = rating > 0 || !!review?.trim();
  const ownColors = useOwnCardColors();
  const other = useReviewerForShare(reviewerId, !isOwn && hasContent);
  const [open, setOpen] = useState(false);

  if (!hasContent || (!isOwn && !other)) return null;

  return (
    <>
      <ShareCardSheet
        visible={open}
        onClose={() => setOpen(false)}
        kind={isOwn ? 'review' : 'review_other'}
        images={reviewCardImages(album)}
        renderCard={ownHandle => (
          <ReviewCard
            album={album}
            rating={rating}
            review={review ?? undefined}
            colors={isOwn ? ownColors : other!.colors}
            handle={isOwn ? ownHandle : other!.handle} />
        )}
      />
      <Pressable onPress={() => setOpen(true)} hitSlop={12}>
        <ShareIcon size={size} color={color} />
      </Pressable>
    </>
  );
}
