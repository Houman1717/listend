import { useEffect, useState } from 'react';
import { View, Pressable } from 'react-native';
import type { ColorsShape } from '@/constants/Colors';
import { StreakSheet } from '@/components/StreakSheet';
import { supabase } from '@/lib/supabase';
import { StreakMedal } from '@/components/StreakMedal';
import { bestFlipStreak, currentFlipStreak, getStreakTier, STREAK_META } from '@/lib/flipStreak';

// The Flip a Record streak as a small animated coin beside a profile's
// @handle — no text, no extra rows, so the profile stays as simple as it
// was. Only there while a streak is going. Tapping opens the StreakSheet,
// which has the way into Flip a Record.
//
// Own profile passes its history from FlipContext; another profile passes a
// userId and the coin reads their recent flips (RLS: public profiles, or
// followers of private ones — anyone else gets nothing and no coin).

type StatusRow = { status: 'pending' | 'logged' | 'didnt_listen' };

// The current streak only needs the newest flips back to the first skip.
// A run longer than this is Legendary Collector either way.
const RECENT_FLIPS = 300;
export function ProfileStreakCoin({ history, userId, onOpenFlip, name, isOwn, colors, size = 18 }: {
  history?: StatusRow[];
  userId?: string;
  /** Navigate to Flip a Record — called after the sheet closes. */
  onOpenFlip: () => void;
  /** Whose streak, for the sheet's title. */
  name: string;
  isOwn: boolean;
  /** The profile's theme; the sheet wears it. */
  colors: ColorsShape;
  /** Coin diameter — sized to sit beside the handle's text. */
  size?: number;
}) {
  const [fetched, setFetched] = useState<StatusRow[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (history || !userId) return;
    let cancelled = false;
    setFetched(null);
    supabase
      .from('flip_records')
      .select('status')
      .eq('user_id', userId)
      .not('pool_id', 'is', null)
      .order('flipped_at', { ascending: false })
      .limit(RECENT_FLIPS)
      .then(({ data, error }) => {
        if (!cancelled) setFetched(error || !data ? [] : (data as StatusRow[]));
      });
    return () => { cancelled = true; };
  }, [history, userId]);

  const rows = history ?? fetched;
  if (!rows) return null;
  const streak = currentFlipStreak(rows);
  if (streak === 0) return null;
  const meta = STREAK_META[getStreakTier(streak)];

  return (
    <>
    <Pressable
      onPress={() => setOpen(true)}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`Flip a Record streak: ${streak} in a row, ${meta.label}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      {/* The medal's glow and rings reach past the coin; keep them inside. */}
      <View style={{ width: size + 2, height: size + 2, borderRadius: (size + 2) / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        <StreakMedal streak={streak} size={size} />
      </View>
    </Pressable>
    <StreakSheet
      visible={open}
      onClose={() => setOpen(false)}
      onOpenFlip={() => { setOpen(false); onOpenFlip(); }}
      streak={streak}
      best={bestFlipStreak(rows)}
      name={name}
      isOwn={isOwn}
      colors={colors}
    />
    </>
  );
}
