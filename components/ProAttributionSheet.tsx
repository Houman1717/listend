import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { getProTheme, type ProThemeKey } from '@/lib/proThemes';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

const ACCENT = '#D4A017';

/**
 * Explains the gold tick / custom theme a viewer just tapped on someone else's
 * profile, and offers the upgrade. This is the only place Pro sells itself off
 * the back of another user's purchase, so it stays short and non-pushy.
 *
 * `onGetPro` is a callback rather than a router push on purpose — router
 * navigation from inside a React Native Modal silently no-ops.
 */
export function ProAttributionSheet({
  visible,
  onClose,
  onGetPro,
  displayName,
  themeKey,
}: {
  visible: boolean;
  onClose: () => void;
  onGetPro: () => void;
  displayName: string;
  themeKey?: ProThemeKey | null;
}) {
  const theme = themeKey && themeKey !== 'default' ? getProTheme(themeKey) : null;
  // Sheet follows the viewer's own light/dark setting, not the profile's theme —
  // StyleSheet.create() is evaluated once at load, so every colour is inline.
  const colorScheme = useColorScheme();
  const c = Colors[colorScheme ?? 'light'];
  const goldTint = 'rgba(212,160,23,0.14)';

  const PERKS = [
    { icon: 'bar-chart',  label: 'My Stats',        sub: 'Genres, decades, streaks and community comparisons' },
    { icon: 'paint-brush', label: 'Profile themes',  sub: 'Nine looks, including the one you just tapped' },
    { icon: 'list',        label: 'Unlimited playlists', sub: 'Free accounts stop at three' },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <SafeAreaProvider>
        <View style={s.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          <SafeAreaView edges={['bottom']} style={[s.sheet, { backgroundColor: c.background, borderTopColor: c.border }]}>
            <View style={[s.handle, { backgroundColor: c.border }]} />

            {/* Header — the tick, named */}
            <View style={s.header}>
              <View style={[s.tickCircle, { backgroundColor: goldTint }]}>
                <Ionicons name="checkmark-circle" size={30} color={ACCENT} />
              </View>
              <Text style={[s.title, { color: c.text }]}>{displayName} has Listend Pro</Text>
              <Text style={[s.subtitle, { color: c.subtext }]}>
                {theme
                  ? `That gold tick and the ${theme.name} colours come with it.`
                  : 'That gold tick comes with it.'}
              </Text>
            </View>

            {/* The theme they actually tapped, shown as a real swatch */}
            {theme && (
              <View style={[s.themeRow, { backgroundColor: c.card, borderColor: c.border }]}>
                <View style={[s.swatch, { backgroundColor: theme.background, borderColor: theme.border }]}>
                  <View style={[s.swatchDot, { backgroundColor: theme.accent }]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.themeName, { color: c.text }]}>{theme.name}</Text>
                  <Text style={[s.themeSub, { color: c.subtext }]}>1 of 9 Pro profile themes</Text>
                </View>
              </View>
            )}

            {/* Perks */}
            <View style={s.perks}>
              {PERKS.map(p => (
                <View key={p.label} style={s.perkRow}>
                  <View style={[s.perkIcon, { backgroundColor: goldTint }]}>
                    <FontAwesome name={p.icon as any} size={13} color={ACCENT} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.perkLabel, { color: c.text }]}>{p.label}</Text>
                    <Text style={[s.perkSub, { color: c.subtext }]}>{p.sub}</Text>
                  </View>
                </View>
              ))}
            </View>

            <Pressable
              onPress={onGetPro}
              style={({ pressed }) => [s.cta, { opacity: pressed ? 0.85 : 1 }]}>
              <Text style={s.ctaText}>Get Listend Pro</Text>
            </Pressable>

            <Pressable onPress={onClose} style={({ pressed }) => [s.dismiss, { opacity: pressed ? 0.6 : 1 }]}>
              <Text style={[s.dismissText, { color: c.subtext }]}>Not now</Text>
            </Pressable>
          </SafeAreaView>
        </View>
      </SafeAreaProvider>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20, paddingBottom: 12,
  },
  handle: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10 },

  header:     { alignItems: 'center', paddingTop: 18, paddingBottom: 6 },
  tickCircle: {
    width: 58, height: 58, borderRadius: 29, marginBottom: 12,
    borderWidth: 1.5, borderColor: ACCENT,
    alignItems: 'center', justifyContent: 'center',
  },
  title:    { fontSize: 19, fontWeight: '800', letterSpacing: -0.3, textAlign: 'center' },
  subtitle: { fontSize: 13.5, lineHeight: 20, textAlign: 'center', marginTop: 6 },

  themeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18,
    borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 12,
  },
  swatch: {
    width: 42, height: 42, borderRadius: 21, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  swatchDot: { width: 15, height: 15, borderRadius: 8 },
  themeName: { fontSize: 14.5, fontWeight: '700' },
  themeSub:  { fontSize: 12, marginTop: 2 },

  perks:    { marginTop: 16, gap: 14 },
  perkRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  perkIcon: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  perkLabel: { fontSize: 14, fontWeight: '700' },
  perkSub:   { fontSize: 12, marginTop: 1 },

  cta: { backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 22 },
  ctaText: { color: '#0F0A07', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },

  dismiss:     { alignItems: 'center', paddingVertical: 14 },
  dismissText: { fontSize: 13.5, fontWeight: '600' },
});
