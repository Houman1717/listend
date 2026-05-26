export type ProThemeKey = 'default' | 'ocean' | 'ocean-light' | 'rose' | 'rose-light' | 'violet' | 'violet-light' | 'midnight' | 'midnight-light';

export interface ProTheme {
  key: ProThemeKey;
  name: string;
  background: string;
  surface: string;
  elevated: string;
  border: string;
  accent: string;
  accentLight: string;
  text: string;
  subtext: string;
  textMuted: string;
  isDark: boolean;
}

export const PRO_THEMES: ProTheme[] = [
  {
    key: 'default',
    name: 'Warm Gold',
    background: '#0F0A07',
    surface:    '#2E2018',
    elevated:   '#3A2820',
    border:     '#3A2818',
    accent:     '#D4A017',
    accentLight:'#E8B830',
    text:       '#F5ECD8',
    subtext:    '#A08060',
    textMuted:  '#6B4C35',
    isDark:     true,
  },
  {
    key: 'ocean',
    name: 'Deep Ocean',
    background: '#060810',
    surface:    '#0C1E42',
    elevated:   '#112852',
    border:     '#1A3460',
    accent:     '#4A9EE8',
    accentLight:'#6AB8F0',
    text:       '#D8EBF5',
    subtext:    '#5A88B0',
    textMuted:  '#3A5878',
    isDark:     true,
  },
  {
    key: 'ocean-light',
    name: 'Ocean Light',
    background: '#EEF4FB',
    surface:    '#D8E8F5',
    elevated:   '#C2D8EE',
    border:     '#A8C8E8',
    accent:     '#1A6EBE',
    accentLight:'#4A9EE8',
    text:       '#040C1C',
    subtext:    '#1A5080',
    textMuted:  '#4A78A8',
    isDark:     false,
  },
  {
    key: 'rose',
    name: 'Deep Rose',
    background: '#100406',
    surface:    '#3A0C1A',
    elevated:   '#481222',
    border:     '#5C1A2E',
    accent:     '#E8607A',
    accentLight:'#F07A92',
    text:       '#F5D8DF',
    subtext:    '#C06080',
    textMuted:  '#804058',
    isDark:     true,
  },
  {
    key: 'rose-light',
    name: 'Rose Light',
    background: '#FBF0F2',
    surface:    '#F5D8DF',
    elevated:   '#EEC0CC',
    border:     '#E4A8BA',
    accent:     '#B83050',
    accentLight:'#E8607A',
    text:       '#1E0408',
    subtext:    '#883050',
    textMuted:  '#C07090',
    isDark:     false,
  },
  {
    key: 'violet',
    name: 'Midnight Violet',
    background: '#080610',
    surface:    '#1C0A32',
    elevated:   '#251040',
    border:     '#341850',
    accent:     '#9B6AE8',
    accentLight:'#B488F8',
    text:       '#EAD8F5',
    subtext:    '#9060C0',
    textMuted:  '#603880',
    isDark:     true,
  },
  {
    key: 'violet-light',
    name: 'Violet Light',
    background: '#F2EEF9',
    surface:    '#E2D8F5',
    elevated:   '#CEC0EC',
    border:     '#B8A4E0',
    accent:     '#6030B8',
    accentLight:'#9B6AE8',
    text:       '#0C0818',
    subtext:    '#503090',
    textMuted:  '#8060C0',
    isDark:     false,
  },
  {
    key: 'midnight',
    name: 'Teal',
    background: '#050E0D',
    surface:    '#0A2A24',
    elevated:   '#0E342C',
    border:     '#164238',
    accent:     '#2AB8A8',
    accentLight:'#45CEC0',
    text:       '#D5F5F2',
    subtext:    '#4EA898',
    textMuted:  '#2E7068',
    isDark:     true,
  },
  {
    key: 'midnight-light',
    name: 'Teal Light',
    background: '#EEF8F7',
    surface:    '#D2EDE8',
    elevated:   '#B8E2DC',
    border:     '#98D2CA',
    accent:     '#1A8878',
    accentLight:'#2AB8A8',
    text:       '#041412',
    subtext:    '#1A6860',
    textMuted:  '#3A9888',
    isDark:     false,
  },
];

export function getProTheme(key?: string | null): ProTheme {
  return PRO_THEMES.find(t => t.key === key) ?? PRO_THEMES[0];
}

export function themeToColors(theme: ProTheme) {
  return {
    text:            theme.text,
    background:      theme.background,
    tint:            theme.accent,
    tabIconDefault:  theme.textMuted,
    tabIconSelected: theme.accent,
    card:            theme.surface,
    surface:         theme.surface,
    elevated:        theme.elevated,
    border:          theme.border,
    subtext:         theme.subtext,
    textMuted:       theme.textMuted,
    isDark:          theme.isDark,
  };
}
