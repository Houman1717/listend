// Flip a Record streaks — shared by the Flip a Record screen and My Stats so
// the two can never disagree. A streak is consecutive *logged* flips; pending
// flips (still waiting on a verdict) are skipped over, a "didn't listen" ends it.

type StreakRecord = { status: 'pending' | 'logged' | 'didnt_listen' };

export type StreakTier = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export function getStreakTier(n: number): StreakTier {
  if (n === 0) return 0;
  if (n < 4)   return 1;
  if (n < 7)   return 2;
  if (n < 14)  return 3;
  if (n < 30)  return 4;
  if (n < 100) return 5;
  return 6;
}

export const STREAK_META: Record<StreakTier, { label: string; caption: string; color: string; icon: string }> = {
  0: { label: '',                    caption: '',                            color: '#6B4C35', icon: 'fire'     },
  1: { label: 'Ember Run',           caption: 'Just getting started',        color: '#C8601A', icon: 'fire'     },
  2: { label: 'Vinyl Run',           caption: 'The needle is dropping',      color: '#D4A017', icon: 'dot-circle-o' },
  3: { label: 'Discovery Streak',    caption: 'Deep in the crates',          color: '#D4A017', icon: 'compass'  },
  4: { label: 'Collector Run',       caption: 'Serious about the dig',       color: '#E8C547', icon: 'star'     },
  5: { label: 'Digging Streak',      caption: 'Rare finds, daily ritual',    color: '#F0D060', icon: 'diamond'  },
  6: { label: 'Legendary Collector', caption: 'You are the record store',    color: '#FFE57A', icon: 'trophy'   },
};

/** The run you're on now. `history` is newest first. */
export function currentFlipStreak(history: StreakRecord[]): number {
  let count = 0;
  for (const r of history) {
    if (r.status === 'pending') continue;
    if (r.status === 'logged') count++;
    else break;
  }
  return count;
}

/** The longest run ever, anywhere in the history. */
export function bestFlipStreak(history: StreakRecord[]): number {
  let best = 0, current = 0;
  for (const r of history) {
    if (r.status === 'pending') continue;
    if (r.status === 'logged') { current++; if (current > best) best = current; }
    else current = 0;
  }
  return best;
}
