import {
  StyleSheet,
  View,
  Text,
  Image,
  Pressable,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAlbums, PendingAlbum } from '@/context/AlbumsContext';
import { spotifyGet, albumFromSpotify, SpotifyAlbum } from '@/context/SpotifyService';

// ─── Fetch strategies ─────────────────────────────────────────────────────────

function decadeToYearRange(decade: string): string {
  const start = parseInt(decade.replace('s', ''), 10);
  return `${start}-${start + 9}`;
}

async function fetchForCategory(category: string, value?: string): Promise<SpotifyAlbum[]> {
  switch (category) {
    case 'new-releases': {
      const data = await spotifyGet('/browse/new-releases?limit=25&country=US');
      return (data.albums?.items ?? []).map(albumFromSpotify);
    }
    case 'popular': {
      const data = await spotifyGet('/browse/new-releases?limit=50&country=US');
      return (data.albums?.items ?? []).map(albumFromSpotify);
    }
    case 'coming-soon': {
      const year = new Date().getFullYear();
      const data = await spotifyGet(`/search?q=year:${year}&type=album&limit=30`);
      return (data.albums?.items ?? []).map(albumFromSpotify);
    }
    case 'genre': {
      const q = encodeURIComponent(`genre:${value ?? ''}`);
      const data = await spotifyGet(`/search?q=${q}&type=album&limit=30`);
      return (data.albums?.items ?? []).map(albumFromSpotify);
    }
    case 'decade': {
      const range = decadeToYearRange(value ?? '');
      const data = await spotifyGet(`/search?q=year:${range}&type=album&limit=30`);
      return (data.albums?.items ?? []).map(albumFromSpotify);
    }
    default:
      return [];
  }
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DiscoverResultsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { setPendingAlbum } = useAlbums();

  const { category, value, title } = useLocalSearchParams<{
    category: string;
    value?: string;
    title: string;
  }>();

  const [albums, setAlbums] = useState<SpotifyAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetchForCategory(category ?? '', value)
      .then(setAlbums)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [category, value]);

  function handleLog(album: SpotifyAlbum) {
    const pending: PendingAlbum = {
      spotifyId: album.id,
      title: album.title,
      artist: album.artist,
      year: album.year,
      artworkUrl: album.artworkUrl,
    };
    setPendingAlbum(pending);
    router.push('/log-album');
  }

  const showRank = category === 'popular' || category === 'new-releases';

  return (
    <>
      <Stack.Screen options={{ title: title ?? 'Discover' }} />
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color="#FF3CAC" size="large" />
        </View>
      ) : error ? (
        <View style={[s.center, { backgroundColor: colors.background }]}>
          <Text style={[s.errorText, { color: colors.subtext }]}>Couldn't load results.</Text>
        </View>
      ) : (
        <FlatList
          style={{ backgroundColor: colors.background }}
          data={albums}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.list}
          ItemSeparatorComponent={() => (
            <View style={[s.separator, { backgroundColor: isDark ? '#222' : '#eee' }]} />
          )}
          ListEmptyComponent={() => (
            <View style={s.center}>
              <Text style={[s.errorText, { color: colors.subtext }]}>No results found.</Text>
            </View>
          )}
          renderItem={({ item, index }) => (
            <Pressable
              style={({ pressed }) => [
                s.row,
                { backgroundColor: pressed ? (isDark ? '#1a1a1a' : '#f5f5f5') : 'transparent' },
              ]}
              onPress={() => handleLog(item)}>
              {showRank && (
                <Text style={[s.rank, { color: colors.subtext }]}>{index + 1}</Text>
              )}
              {item.artworkUrl ? (
                <Image source={{ uri: item.artworkUrl }} style={s.artwork} />
              ) : (
                <View style={[s.artwork, { backgroundColor: isDark ? '#2a2a2a' : '#e0e0e0' }]} />
              )}
              <View style={s.info}>
                <Text style={[s.title, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
                <Text style={[s.artist, { color: colors.subtext }]} numberOfLines={1}>
                  {item.artist}{item.year ? ` · ${item.year}` : ''}
                </Text>
              </View>
              <Text style={s.logHint}>+ Log</Text>
            </Pressable>
          )}
        />
      )}
    </>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 15 },
  list: { paddingBottom: 40 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 80 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  rank: { width: 22, fontSize: 13, fontWeight: '700', textAlign: 'right' },
  artwork: { width: 52, height: 52, borderRadius: 4, flexShrink: 0 },
  info: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '600' },
  artist: { fontSize: 13 },
  logHint: { color: '#FF3CAC', fontSize: 13, fontWeight: '600' },
});
