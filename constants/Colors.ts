// ─── Warm & Earthy Palette ────────────────────────────────────────────────────

// Unlit volume-rating bars. Translucent rather than a fixed grey/brown so the
// empty bars always sit a step off whatever is behind them — page, card, or
// any pro theme's tinted surface. On plain white the light one is exactly the
// old #e0e0e0, so the default theme looks unchanged.
export const VOLUME_EMPTY_DARK = 'rgba(255,255,255,0.14)';
export const VOLUME_EMPTY_LIGHT = 'rgba(0,0,0,0.12)';

export const PALETTE = {
  background:    '#0F0A07',  // deep espresso
  surface:       '#2E2018',  // walnut
  elevated:      '#3A2820',  // mocha
  border:        '#3A2818',
  textPrimary:   '#F5ECD8',
  textSecondary: '#A08060',  // muted tan
  textMuted:     '#6B4C35',  // warm brown
  accent:        '#D4A017',  // Warm Gold
  accentLight:   '#E8B830',  // lighter gold (hover / soft tints)
  accentDark:    '#B8880F',  // darker gold (gradients / pressed states)
  tabActive:     '#D4A017',
  tabInactive:   '#4a3020',
} as const;

export type ColorsShape = {
  text: string;
  background: string;
  tint: string;
  tabIconDefault: string;
  tabIconSelected: string;
  card: string;
  surface: string;
  elevated: string;
  border: string;
  subtext: string;
  textMuted: string;
  isDark: boolean;
};

export default {
  light: {
    text:            '#1A0F0A',  // dark coffee
    background:      '#F2EBE0',  // warm ivory
    tint:            PALETTE.accent,
    tabIconDefault:  '#A08060',
    tabIconSelected: PALETTE.accent,
    card:            '#FFFFFF',
    surface:         '#FFFFFF',
    elevated:        '#EDE9E3',
    border:          '#DDD5C8',
    subtext:         '#6B4C35',
    textMuted:       '#A08060',
    isDark:          false,
  },
  dark: {
    text:            PALETTE.textPrimary,
    background:      PALETTE.background,
    tint:            PALETTE.accent,
    tabIconDefault:  PALETTE.textMuted,
    tabIconSelected: PALETTE.accent,
    card:            PALETTE.surface,
    surface:         PALETTE.surface,
    elevated:        PALETTE.elevated,
    border:          PALETTE.border,
    subtext:         PALETTE.textSecondary,
    textMuted:       PALETTE.textMuted,
    isDark:          true,
  },
};
