import { View, Text, Pressable, StyleSheet } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Ionicons from '@expo/vector-icons/Ionicons';
import { usePro } from '@/context/ProContext';
import { PRO_THEMES, type ProTheme, type ProThemeKey } from '@/lib/proThemes';

// Single row inside a group — no individual border, corners handled by the wrapper
function ThemeHalf({
  theme,
  active,
  locked,
  onPress,
  position,
}: {
  theme: ProTheme;
  active: boolean;
  locked: boolean;
  onPress: () => void;
  position: 'top' | 'bottom' | 'solo';
}) {
  const topRadius    = position === 'bottom' ? 0 : 13;
  const bottomRadius = position === 'top'    ? 0 : 13;

  return (
    <Pressable
      style={({ pressed }) => [{
        backgroundColor: theme.surface,
        borderTopLeftRadius:     topRadius,
        borderTopRightRadius:    topRadius,
        borderBottomLeftRadius:  bottomRadius,
        borderBottomRightRadius: bottomRadius,
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        opacity: pressed ? 0.85 : 1,
      }]}
      onPress={onPress}>

      {/* Colour preview strip */}
      <View style={[s.themePreview, {
        backgroundColor: theme.background,
        borderTopLeftRadius: topRadius,
        borderBottomLeftRadius: bottomRadius,
      }]}>
        <View style={[s.themeAccentDot, { backgroundColor: theme.accent }]} />
        <View style={[s.themeSubDot,    { backgroundColor: theme.subtext }]} />
        <Ionicons
          name={theme.isDark ? 'moon' : 'sunny'}
          size={9}
          color={theme.subtext}
          style={{ marginTop: 2 }}
        />
      </View>

      <View style={s.themeInfo}>
        <Text style={[s.themeName, { color: theme.text }]}>{theme.name}</Text>
        {active && (
          <View style={[s.activeChip, { backgroundColor: theme.accent }]}>
            <Text style={[s.activeChipText, { color: theme.background }]}>Active</Text>
          </View>
        )}
      </View>

      {active && (
        <View style={[s.checkWrap, { backgroundColor: theme.accent }]}>
          <FontAwesome name="check" size={10} color={theme.background} />
        </View>
      )}
      {locked && (
        <View style={s.lockWrap}>
          <FontAwesome name="lock" size={14} color={theme.subtext} />
        </View>
      )}
    </Pressable>
  );
}

// Free users see every theme, but only the default is theirs — the rest are
// locked and open the paywall.
export default function ProThemePicker() {
  const { isPro, proTheme, setProTheme, showPaywall } = usePro();
  const currentTheme = isPro ? proTheme : PRO_THEMES[0].key;

  const choose = (key: ProThemeKey) => {
    if (isPro) setProTheme(key);
    else if (key !== PRO_THEMES[0].key) showPaywall();
  };
  const isLocked = (key: ProThemeKey) => !isPro && key !== PRO_THEMES[0].key;

  return (
    <View style={s.themeGrid}>

      {/* Warm Gold — solo card */}
      {(() => {
        const theme = PRO_THEMES[0];
        const active = currentTheme === theme.key;
        return (
          <View style={[s.groupCard, { borderColor: active ? theme.accent : theme.border }]}>
            <ThemeHalf theme={theme} active={active} locked={false} onPress={() => choose(theme.key)} position="solo" />
          </View>
        );
      })()}

      {/* Paired colour families */}
      {(['ocean', 'rose', 'violet', 'midnight'] as ProThemeKey[]).map(baseKey => {
        const dark      = PRO_THEMES.find(t => t.key === baseKey)!;
        const light     = PRO_THEMES.find(t => t.key === `${baseKey}-light`)!;
        const darkActive  = currentTheme === dark.key;
        const lightActive = currentTheme === light.key;
        const borderColor = darkActive ? dark.accent : lightActive ? light.accent : dark.border;

        return (
          <View key={baseKey} style={[s.groupCard, { borderColor }]}>
            <ThemeHalf theme={dark}  active={darkActive}  locked={isLocked(dark.key)}  onPress={() => choose(dark.key)}  position="top" />
            <View style={[s.divider, { backgroundColor: borderColor }]} />
            <ThemeHalf theme={light} active={lightActive} locked={isLocked(light.key)} onPress={() => choose(light.key)} position="bottom" />
          </View>
        );
      })}

    </View>
  );
}

const s = StyleSheet.create({
  themeGrid: { gap: 12 },

  groupCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    overflow: 'hidden',
  },

  divider: { height: 1, opacity: 0.3 },

  themePreview: {
    width: 56,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  themeAccentDot: { width: 16, height: 16, borderRadius: 8 },
  themeSubDot:    { width: 10, height: 4,  borderRadius: 2 },

  themeInfo: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  themeName: { fontSize: 15, fontWeight: '700' },

  activeChip: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  activeChipText: { fontSize: 11, fontWeight: '700' },

  checkWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  lockWrap: {
    width: 24,
    alignItems: 'center',
    marginRight: 14,
  },
});
