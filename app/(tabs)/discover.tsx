import { StyleSheet, View, Text, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

type CategoryRow = {
  id: string;
  label: string;
  sub: string;
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  params: { pathname: string; params?: Record<string, string> };
};

const CATEGORIES: CategoryRow[] = [
  {
    id: 'new-releases',
    label: 'New Releases',
    sub: 'Latest drops across all genres',
    icon: 'bolt',
    params: { pathname: '/discover-results', params: { category: 'new-releases', title: 'New Releases' } },
  },
  {
    id: 'popular',
    label: 'Popular Albums',
    sub: 'Charts and trending right now',
    icon: 'fire',
    params: { pathname: '/discover-results', params: { category: 'popular', title: 'Popular Albums' } },
  },
  {
    id: 'genres',
    label: 'Genres',
    sub: 'Rap, Rock, R&B, Afrobeats and more',
    icon: 'music',
    params: { pathname: '/discover-genres' },
  },
  {
    id: 'coming-soon',
    label: 'Coming Soon',
    sub: 'Anticipated and upcoming albums',
    icon: 'calendar',
    params: { pathname: '/discover-results', params: { category: 'coming-soon', title: 'Coming Soon' } },
  },
  {
    id: 'by-decade',
    label: 'By Decade',
    sub: '1960s through 2020s',
    icon: 'clock-o',
    params: { pathname: '/discover-decades' },
  },
];

export default function DiscoverScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}>

      <Text style={[s.heading, { color: colors.text }]}>Discover</Text>
      <Text style={[s.subheading, { color: colors.subtext }]}>Browse music by category</Text>

      <View style={[s.group, { backgroundColor: isDark ? '#111' : '#fff', borderColor: isDark ? '#222' : '#e5e5e5' }]}>
        {CATEGORIES.map((cat, i) => (
          <View key={cat.id}>
            <Pressable
              style={({ pressed }) => [
                s.row,
                { opacity: pressed ? 0.6 : 1 },
              ]}
              onPress={() => router.push(cat.params as any)}>
              <View style={s.iconWrap}>
                <FontAwesome name={cat.icon} size={16} color="#FF3CAC" />
              </View>
              <View style={s.rowText}>
                <Text style={[s.rowLabel, { color: colors.text }]}>{cat.label}</Text>
                <Text style={[s.rowSub, { color: colors.subtext }]} numberOfLines={1}>{cat.sub}</Text>
              </View>
              <FontAwesome name="chevron-right" size={13} color={colors.subtext} />
            </Pressable>
            {i < CATEGORIES.length - 1 && (
              <View style={[s.divider, { backgroundColor: isDark ? '#222' : '#f0f0f0', marginLeft: 58 }]} />
            )}
          </View>
        ))}
      </View>

    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 48, paddingTop: 24 },

  heading: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  subheading: { fontSize: 14, marginTop: 4, marginBottom: 24 },

  group: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  iconWrap: {
    width: 28,
    alignItems: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 16, fontWeight: '600' },
  rowSub: { fontSize: 13 },
  divider: { height: StyleSheet.hairlineWidth },
});
