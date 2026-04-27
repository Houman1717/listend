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
import { SpotifyAlbum } from '@/context/SpotifyService';

// ─── Backend URL ──────────────────────────────────────────────────────────────

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

// ─── Fetch strategies ─────────────────────────────────────────────────────────

async function fetchForCategory(category: string, value?: string): Promise<SpotifyAlbum[]> {
  switch (category) {
    case 'new-releases': {
      const res = await fetch(`${API_URL}/discover/new-releases`);
      if (!res.ok) throw new Error(`/discover/new-releases → ${res.status}`);
      return res.json();
    }
    case 'popular': {
      const res = await fetch(`${API_URL}/discover/popular`);
      if (!res.ok) throw new Error(`/discover/popular → ${res.status}`);
      return res.json();
    }
    case 'coming-soon': {
      const res = await fetch(`${API_URL}/discover/coming-soon`);
      if (!res.ok) throw new Error(`/discover/coming-soon → ${res.status}`);
      return res.json();
    }
    case 'genre': {
      const res = await fetch(`${API_URL}/genres`);
      if (!res.ok) throw new Error(`/genres → ${res.status}`);
      const data: Record<string, SpotifyAlbum[]> = await res.json();
      return data[value ?? ''] ?? [];
    }
    case 'decade': {
      const res = await fetch(`${API_URL}/decades`);
      if (!res.ok) throw new Error(`/decades → ${res.status}`);
      const data: Record<string, SpotifyAlbum[]> = await res.json();
      return data[value ?? ''] ?? [];
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
    router.push({
      pathname: '/album-detail',
      params: { id: album.id, title: album.title, artist: album.artist, year: String(album.year), artworkUrl: album.artworkUrl },
    });
  }

  const showRank = category === 'popular' || category === 'new-releases';

  return (
    <>
      <Stack.Screen options={{ title: title ?? 'Discover' }} />
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color="#e8963a" size="large" />
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
            <View style={[s.separator, { backgroundColor: isDark ? '#2a1e14' : '#eee' }]} />
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
                { backgroundColor: pressed ? (isDark ? '#2e2018' : '#f5f5f5') : 'transparent' },
              ]}
              onPress={() => handleLog(item)}>
              {showRank && (
                <Text style={[s.rank, { color: colors.subtext }]}>{index + 1}</Text>
              )}
              {item.artworkUrl ? (
                <Image source={{ uri: item.artworkUrl }} style={s.artwork} />
              ) : (
                <View style={[s.artwork, { backgroundColor: isDark ? '#2a1e14' : '#e0e0e0' }]} />
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
  logHint: { color: '#e8963a', fontSize: 13, fontWeight: '600' },
});
