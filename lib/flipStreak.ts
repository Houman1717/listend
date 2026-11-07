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

/** The streak each tier starts at. */
export const TIER_START: Record<StreakTier, number> = { 0: 0, 1: 1, 2: 4, 3: 7, 4: 14, 5: 30, 6: 100 };

/** The next tier up and how far through the current one you are (0–1). Null at the top tier. */
export function nextTierProgress(streak: number): { next: StreakTier; remaining: number; progress: number } | null {
  const tier = getStreakTier(streak);
  if (tier === 6) return null;
  const next = (tier + 1) as StreakTier;
  const from = TIER_START[tier], to = TIER_START[next];
  return { next, remaining: to - streak, progress: (streak - from) / (to - from) };
}

// Relative luminance (0 dark – 1 light) of a #rrggbb colour; anything else
// counts as dark, the app's default.
function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const lin = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}

export const isLightColor = (hex: string) => luminance(hex) > 0.5;

/**
 * A tier colour you can read as text. The bright golds are made for dark
 * backgrounds; on a light one (pink, cream themes) they're darkened until
 * they hold up as text.
 */
export function readableTierColor(color: string, onLight: boolean): string {
  if (!onLight) return color;
  const n = parseInt(color.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  for (let i = 0; i < 20; i++) {
    const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
    if (luminance(hex) <= 0.12) return hex;
    r = Math.round(r * 0.9); g = Math.round(g * 0.9); b = Math.round(b * 0.9);
  }
  return color;
}
