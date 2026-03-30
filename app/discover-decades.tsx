import { StyleSheet, View, Text, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

const DECADES = ['1960s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s'];

// Subtle accent colors per decade
const ACCENT: Record<string, string> = {
  '1960s': '#c0392b',
  '1970s': '#d35400',
  '1980s': '#8e44ad',
  '1990s': '#27ae60',
  '2000s': '#2980b9',
  '2010s': '#16a085',
  '2020s': '#FF3CAC',
};

export default function DiscoverDecadesScreen() {
  const router = useRouter();

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}>
      {DECADES.map((decade, i) => (
        <View key={decade}>
          <Pressable
            style={({ pressed }) => [s.row, { opacity: pressed ? 0.6 : 1 }]}
            onPress={() =>
              router.push({
                pathname: '/discover-results',
                params: { category: 'decade', value: decade, title: decade },
              })
            }>
            <View style={[s.accent, { backgroundColor: ACCENT[decade] }]} />
            <Text style={s.decade}>{decade}</Text>
            <FontAwesome name="chevron-right" size={13} color="#555" />
          </Pressable>
          {i < DECADES.length - 1 && <View style={s.divider} />}
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d' },
  content: {
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 48,
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 14,
  },
  accent: {
    width: 4,
    height: 28,
    borderRadius: 2,
  },
  decade: {
    flex: 1,
    color: '#f0f0f0',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#2a2a2a',
    marginLeft: 34,
  },
});
