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
    text:            '#3D2B1A',
    background:      '#F5F0E8',
    tint:            PALETTE.accent,
    tabIconDefault:  '#A0896C',
    tabIconSelected: PALETTE.accent,
    card:            '#EDE9E3',
    surface:         '#EDE9E3',
    border:          '#DDD5C8',
    subtext:         '#7A5535',
    textMuted:       '#A0896C',
  },
  dark: {
    text:            PALETTE.textPrimary,
    background:      PALETTE.background,
    tint:            PALETTE.accent,
    tabIconDefault:  PALETTE.textMuted,
    tabIconSelected: PALETTE.accent,
    card:            PALETTE.surface,
    surface:         PALETTE.surface,
    border:          PALETTE.border,
    subtext:         PALETTE.textSecondary,
    textMuted:       PALETTE.textMuted,
  },
};
