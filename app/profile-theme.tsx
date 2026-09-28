import { Text, StyleSheet, ScrollView } from 'react-native';
import { usePro } from '@/context/ProContext';
import ProThemePicker from '@/components/ProThemePicker';

export default function ProfileThemeScreen() {
  const { isPro, proLoaded } = usePro();

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <Text style={s.sectionSub}>Choose a theme that visitors see when they open your profile.</Text>
      {proLoaded && !isPro && (
        <Text style={s.proHint}>Unlock every theme with Listend Pro.</Text>
      )}
      <ProThemePicker />
      <Text style={s.footer}>Changes are visible to anyone who visits your profile.</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0A07' },
  content:   { padding: 20, paddingBottom: 40 },

  sectionSub: {
    color: '#A08060',
    fontSize: 13,
    marginBottom: 18,
    lineHeight: 18,
  },
  proHint: {
    color: '#D4A017',
    fontSize: 13,
    fontWeight: '700',
    marginTop: -10,
    marginBottom: 18,
  },

  footer: {
    color: '#6B4C35',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 18,
  },
});
