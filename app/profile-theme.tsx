import { Text, StyleSheet, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { usePro } from '@/context/ProContext';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { getProTheme, themeToColors } from '@/lib/proThemes';
import ProThemePicker from '@/components/ProThemePicker';

const ACCENT = '#D4A017';

export default function ProfileThemeScreen() {
  const colorScheme = useColorScheme();
  const colors      = Colors[colorScheme ?? 'light'];
  const { isPro, proLoaded, proTheme } = usePro();
  const proColors = (isPro && proTheme !== 'default') ? themeToColors(getProTheme(proTheme)) : null;

  const bg         = proColors ? proColors.background : colors.background;
  const textColor  = proColors ? proColors.text       : colors.text;
  const subColor   = proColors ? proColors.subtext    : colors.subtext;
  const mutedColor = proColors ? proColors.textMuted : colors.textMuted;
  const accent     = proColors ? proColors.tint       : ACCENT;

  return (
    <>
    <Stack.Screen options={{
      headerStyle: { backgroundColor: bg },
      headerTintColor: textColor,
      headerShadowVisible: false,
    }} />
    <ScrollView style={[s.container, { backgroundColor: bg }]} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <Text style={[s.sectionSub, { color: subColor }]}>Choose a theme that visitors see when they open your profile.</Text>
      {proLoaded && !isPro && (
        <Text style={[s.proHint, { color: accent }]}>Unlock every theme with Listend Pro.</Text>
      )}
      <ProThemePicker />
      <Text style={[s.footer, { color: mutedColor }]}>Changes are visible to anyone who visits your profile.</Text>
    </ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content:   { padding: 20, paddingBottom: 40 },

  sectionSub: {
    fontSize: 13,
    marginBottom: 18,
    lineHeight: 18,
  },
  proHint: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: -10,
    marginBottom: 18,
  },

  footer: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 18,
  },
});
