import {
  StyleSheet,
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { CatalogAlbum } from '@/context/CatalogService';
import { useAlbums } from '@/context/AlbumsContext';

// ─── Backend URL ──────────────────────────────────────────────────────────────

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

// ─── Fetch strategies ─────────────────────────────────────────────────────────

async function fetchForCategory(category: string, value?: string): Promise<CatalogAlbum[]> {
  switch (category) {
    case 'new-releases': {
      const res = await fetch(`${API_URL}/discover/new-releases`);
      if (!res.ok) throw new Error(`/discover/new-releases → ${res.status}`);
      return res.json();
    }
    case 'popular': {
      const res = await fetch(`${API_URL}/api/discover/community-popular`);
      if (!res.ok) throw new Error(`/api/discover/community-popular → ${res.status}`);
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
      const data: Record<string, CatalogAlbum[]> = await res.json();
      return data[value ?? ''] ?? [];
    }
    case 'decade': {
      const res = await fetch(`${API_URL}/decades`);
      if (!res.ok) throw new Error(`/decades → ${res.status}`);
      const data: Record<string, CatalogAlbum[]> = await res.json();
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
  const { loggedAlbums } = useAlbums();
  const { category, value, title } = useLocalSearchParams<{
    category: string;
    value?: string;
    title: string;
  }>();

  const [albums, setAlbums] = useState<CatalogAlbum[]>([]);
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

  function handleLog(album: CatalogAlbum) {
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
          <ActivityIndicator color="#D4A017" size="large" />
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
          renderItem={({ item, index }) => {
            const isLogged = !!loggedAlbums.find((a) => a.id === item.id);
            return (
              <Pressable
                style={({ pressed }) => [
                  s.row,
                  { backgroundColor: pressed ? (isDark ? '#2e2018' : '#f5f5f5') : 'transparent' },
                ]}
                onPress={() => handleLog(item)}>
                {showRank && (
                  <Text style={[s.rank, { color: colors.subtext }]}>{index + 1}</Text>
                )}
                <View>
                  {item.artworkUrl ? (
                    <ExpoImage source={{ uri: item.artworkUrl }} style={s.artwork} 
            contentFit="cover" cachePolicy="disk"
          />
                  ) : (
                    <View style={[s.artwork, { backgroundColor: isDark ? '#2a1e14' : '#e0e0e0' }]} />
                  )}
                  {isLogged && (
                    <Ionicons name="headset" size={12} color="#D4A017" style={s.loggedBadge} />
                  )}
                </View>
                <View style={s.info}>
                  <Text style={[s.title, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
                  <Text style={[s.artist, { color: colors.subtext }]} numberOfLines={1}>
                    {item.artist}{item.year ? ` · ${item.year}` : ''}
                  </Text>
                  {isLogged && (
                    <Text style={s.loggedLabel}>Listend</Text>
                  )}
                </View>
                {!isLogged && <Text style={s.logHint}>+ Log</Text>}
              </Pressable>
            );
          }}
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
  loggedBadge: { position: 'absolute', bottom: 3, right: 3 },
  loggedLabel: { fontSize: 11, fontWeight: '600', color: '#D4A017' },
  info: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '600' },
  artist: { fontSize: 13 },
  logHint: { color: '#D4A017', fontSize: 13, fontWeight: '600' },
});
