import { StyleSheet, View, Text, ScrollView, Image, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAlbums } from '@/context/AlbumsContext';

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const { loggedAlbums } = useAlbums();
  const router = useRouter();

  const avgRating = loggedAlbums.length
    ? (loggedAlbums.reduce((s, a) => s + a.rating, 0) / loggedAlbums.length).toFixed(1)
    : '—';

  const now = new Date();
  const currentMonth = now.toLocaleDateString('en-US', { month: 'short' });
  const currentYear = now.getFullYear().toString();
  const thisMonth = loggedAlbums.filter(
    (a) => a.dateLogged.includes(currentMonth) && a.dateLogged.includes(currentYear)
  ).length;

  const recent = loggedAlbums.slice(0, 6);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.statNum, { color: colors.text }]}>{loggedAlbums.length}</Text>
          <Text style={[styles.statLabel, { color: colors.subtext }]}>Albums</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.statNum, { color: '#FF3CAC' }]}>{avgRating}</Text>
          <Text style={[styles.statLabel, { color: colors.subtext }]}>Avg Rating</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.statNum, { color: colors.text }]}>{thisMonth}</Text>
          <Text style={[styles.statLabel, { color: colors.subtext }]}>This Month</Text>
        </View>
      </View>

      {recent.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recently Logged</Text>
            <Pressable onPress={() => router.push('/(tabs)/listend')}>
              <Text style={[styles.seeAll, { color: '#FF3CAC' }]}>See all</Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recentRow}>
            {recent.map((album) => (
              <Pressable
                key={album.id}
                style={styles.recentItem}
                onPress={() => router.push({ pathname: '/album-detail', params: { id: album.id } })}>
                {album.artworkUrl ? (
                  <Image source={{ uri: album.artworkUrl }} style={styles.recentArt} />
                ) : (
                  <View style={[styles.recentArt, { backgroundColor: album.coverColor, justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={styles.recentInitial}>{album.title.charAt(0)}</Text>
                  </View>
                )}
                <Text style={[styles.recentTitle, { color: colors.text }]} numberOfLines={1}>
                  {album.title}
                </Text>
                <Text style={[styles.recentArtist, { color: colors.subtext }]} numberOfLines={1}>
                  {album.artist}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>What are you listening to?</Text>
        <Pressable
          style={[styles.logButton, { backgroundColor: '#FF3CAC' }]}
          onPress={() => router.push('/(tabs)/search')}>
          <Text style={styles.logButtonText}>+ Log an Album</Text>
        </Pressable>
        <Pressable
          style={[styles.discoverButton, { backgroundColor: isDark ? '#1a1a1a' : '#f0f0f0' }]}
          onPress={() => router.push('/(tabs)/discover')}>
          <Text style={[styles.discoverButtonText, { color: colors.text }]}>Browse Top Charts</Text>
        </Pressable>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
    gap: 24,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 4,
  },
  statNum: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 12,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '500',
  },
  recentRow: {
    gap: 12,
    paddingRight: 4,
  },
  recentItem: {
    width: 90,
  },
  recentArt: {
    width: 90,
    height: 90,
    borderRadius: 6,
  },
  recentInitial: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 28,
    fontWeight: '700',
  },
  recentTitle: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
  },
  recentArtist: {
    fontSize: 11,
    marginTop: 1,
  },
  logButton: {
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  discoverButton: {
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  discoverButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
