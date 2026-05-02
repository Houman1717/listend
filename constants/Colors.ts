// ─── Warm & Earthy Palette ────────────────────────────────────────────────────

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
  },
};
