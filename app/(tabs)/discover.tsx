import { StyleSheet, View, Text, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

type NavItem = {
  id: string;
  label: string;
  sub: string;
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  pathname: string;
};

const NAV_ITEMS: NavItem[] = [
  {
    id: 'new-releases',
    label: 'New Releases',
    sub: 'Latest drops',
    icon: 'star',
    pathname: '/discover-new-releases',
  },
  {
    id: 'coming-soon',
    label: 'Coming Soon',
    sub: 'Coming soon to streaming',
    icon: 'calendar',
    pathname: '/discover-coming-soon',
  },
  {
    id: 'top-rated',
    label: 'Top Rated Albums',
    sub: 'Critically acclaimed albums',
    icon: 'trophy',
    pathname: '/discover-top-rated',
  },
  {
    id: 'most-popular',
    label: 'Most Popular Albums',
    sub: 'Most streamed right now',
    icon: 'fire',
    pathname: '/discover-most-popular',
  },
  {
    id: 'recommended',
    label: 'Recommended For You',
    sub: 'Based on your logged albums',
    icon: 'thumbs-up',
    pathname: '/discover-recommended',
  },
  {
    id: 'top-artists',
    label: 'Top Artists',
    sub: 'The most acclaimed artists',
    icon: 'microphone',
    pathname: '/discover-top-artists',
  },
  {
    id: 'top-songs',
    label: 'Top Songs',
    sub: 'The most acclaimed tracks',
    icon: 'headphones',
    pathname: '/discover-top-songs',
  },
  {
    id: 'genres',
    label: 'Genres',
    sub: 'Rap, Rock, R&B, Afrobeats and more',
    icon: 'music',
    pathname: '/discover-genres',
  },
  {
    id: 'by-decade',
    label: 'By Decade',
    sub: '1950s through 2020s',
    icon: 'clock-o',
    pathname: '/discover-decades',
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
        {NAV_ITEMS.map((item, i) => (
          <View key={item.id}>
            <Pressable
              style={({ pressed }) => [s.row, { opacity: pressed ? 0.6 : 1 }]}
              onPress={() => router.push(item.pathname as any)}>
              <View style={s.iconWrap}>
                <FontAwesome name={item.icon} size={16} color="#FF3CAC" />
              </View>
              <View style={s.rowText}>
                <Text style={[s.rowLabel, { color: colors.text }]}>{item.label}</Text>
                <Text style={[s.rowSub, { color: colors.subtext }]} numberOfLines={1}>{item.sub}</Text>
              </View>
              <FontAwesome name="chevron-right" size={13} color={colors.subtext} />
            </Pressable>
            {i < NAV_ITEMS.length - 1 && (
              <View style={[s.divider, { backgroundColor: isDark ? '#222' : '#f0f0f0' }]} />
            )}
          </View>
        ))}
      </View>

    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 48, paddingTop: 24 },

  heading:    { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
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
  iconWrap: { width: 28, alignItems: 'center' },
  rowText:  { flex: 1, gap: 2 },
  rowLabel: { fontSize: 16, fontWeight: '600' },
  rowSub:   { fontSize: 13 },
  divider:  { height: StyleSheet.hairlineWidth, marginLeft: 58 },
});
