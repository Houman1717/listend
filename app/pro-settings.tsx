import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useNavigation } from 'expo-router';
import { useEffect } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { usePro } from '@/context/ProContext';
import { PRO_THEMES, type ProThemeKey } from '@/lib/proThemes';

export default function ProSettingsScreen() {
  const navigation       = useNavigation();
  const { proTheme, setProTheme } = usePro();

  useEffect(() => {
    navigation.setOptions({ title: 'Listend Pro', headerStyle: { backgroundColor: '#1c1410' }, headerTintColor: '#f5e6c8' });
  }, [navigation]);

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

      {/* Badge info */}
      <View style={s.infoCard}>
        <View style={s.infoIconWrap}>
          <FontAwesome name="star" size={20} color="#D4A017" />
        </View>
        <View style={s.infoText}>
          <Text style={s.infoTitle}>Pro Badge Active</Text>
          <Text style={s.infoSub}>Your gold PRO badge is visible on your profile and reviews.</Text>
        </View>
      </View>

      {/* Theme picker */}
      <Text style={s.sectionLabel}>PROFILE THEME</Text>
      <Text style={s.sectionSub}>Choose a theme that visitors see when they open your profile.</Text>

      <View style={s.themeGrid}>
        {PRO_THEMES.map(theme => {
          const active = proTheme === theme.key;
          return (
            <Pressable
              key={theme.key}
              style={({ pressed }) => [
                s.themeCard,
                { backgroundColor: theme.surface, borderColor: active ? theme.accent : theme.border },
                active && s.themeCardActive,
                { opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={() => setProTheme(theme.key as ProThemeKey)}>

              {/* Background preview strip */}
              <View style={[s.themePreview, { backgroundColor: theme.background }]}>
                <View style={[s.themeAccentDot, { backgroundColor: theme.accent }]} />
                <View style={[s.themeSubDot,    { backgroundColor: theme.subtext }]} />
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
            </Pressable>
          );
        })}
      </View>

      <Text style={s.footer}>Changes are visible to anyone who visits your profile.</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0A07' },
  content:   { padding: 20, paddingBottom: 40 },

  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1200',
    borderRadius: 14,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: '#3A2818',
    marginBottom: 28,
  },
  infoIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2A1E00',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#D4A017',
  },
  infoText:  { flex: 1 },
  infoTitle: { color: '#F5ECD8', fontSize: 15, fontWeight: '700', marginBottom: 3 },
  infoSub:   { color: '#A08060', fontSize: 13, lineHeight: 18 },

  sectionLabel: {
    color: '#6B4C35',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 6,
  },
  sectionSub: {
    color: '#A08060',
    fontSize: 13,
    marginBottom: 18,
    lineHeight: 18,
  },

  themeGrid: { gap: 12 },

  themeCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
  },
  themeCardActive: { borderWidth: 2 },

  themePreview: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  themeAccentDot: { width: 18, height: 18, borderRadius: 9 },
  themeSubDot:    { width: 10, height: 4,  borderRadius: 2 },

  themeInfo: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 16,
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

  footer: {
    color: '#6B4C35',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 18,
  },
});
