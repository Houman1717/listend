// ─── Warm & Earthy Palette ────────────────────────────────────────────────────

export const PALETTE = {
  background:    '#1c1410',
  surface:       '#2e2018',
  elevated:      '#3a2818',
  border:        '#2a1e14',
  textPrimary:   '#f5e6c8',
  textSecondary: '#a07850',
  textMuted:     '#7a5535',
  accent:        '#e8963a',
  accentSoft:    '#c8722a',
  tabActive:     '#e8963a',
  tabInactive:   '#4a3020',
} as const;

export default {
  light: {
    text:            '#1a1a1a',
    background:      '#f8f8f8',
    tint:            PALETTE.accent,
    tabIconDefault:  '#a07850',
    tabIconSelected: PALETTE.accent,
    card:            '#fff',
    subtext:         '#666',
  },
  dark: {
    text:            PALETTE.textPrimary,
    background:      PALETTE.background,
    tint:            PALETTE.accent,
    tabIconDefault:  PALETTE.textMuted,
    tabIconSelected: PALETTE.accent,
    card:            PALETTE.surface,
    subtext:         PALETTE.textSecondary,
  },
};
