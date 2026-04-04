import { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  Pressable,
  FlatList,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { SpotifyAlbum } from '@/context/SpotifyService';
import { useAlbums, PendingAlbum } from '@/context/AlbumsContext';

// ─── Backend URL ──────────────────────────────────────────────────────────────

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

// ─── Module-level cache + shared fetch promise ────────────────────────────────

const cache: Record<string, SpotifyAlbum[]> = {};
let loadPromise: Promise<void> | null = null;

function loadGenres(): Promise<void> {
  if (Object.keys(cache).length > 0) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const res = await fetch(`${API_URL}/genres`);
    if (!res.ok) throw new Error(`/genres → ${res.status}`);
    const data: Record<string, SpotifyAlbum[]> = await res.json();
    for (const [k, v] of Object.entries(data)) cache[k] = v;
  })().catch((err) => {
    console.error('[GenreGrid] loadGenres failed:', err?.message ?? err);
    loadPromise = null;
  });

  return loadPromise;
}

// ─── Grid constants ───────────────────────────────────────────────────────────

const COLS = 3;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function GenreGridScreen() {
  const { genre } = useLocalSearchParams<{ genre: string }>();
  const { width } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { setPendingAlbum } = useAlbums();

  const cardSize = width / COLS;

  const [albums,  setAlbums]  = useState<SpotifyAlbum[]>(() => cache[genre ?? ''] ?? []);
  const [loading, setLoading] = useState(!cache[genre ?? '']);

  useEffect(() => {
    if (!genre) return;
    if (cache[genre]) {
      setAlbums(cache[genre]);
      setLoading(false);
      return;
    }
    loadGenres().then(() => {
      setAlbums(cache[genre] ?? []);
      setLoading(false);
    });
  }, [genre]);

  function handlePress(album: SpotifyAlbum) {
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

  return (
    <>
      <Stack.Screen options={{ title: genre ?? 'Genre' }} />

      {loading ? (
        <View style={[s.centered, { backgroundColor: colors.background }]}>
          <ActivityIndicator color="#FF3CAC" size="large" />
        </View>
      ) : albums.length === 0 ? (
        <View style={[s.centered, { backgroundColor: colors.background }]}>
          <Text style={{ color: colors.subtext, fontSize: 15 }}>No albums found.</Text>
        </View>
      ) : (
        <FlatList
          style={{ backgroundColor: colors.background }}
          data={albums}
          keyExtractor={(item) => item.id}
          numColumns={COLS}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={s.columnWrapper}
          contentContainerStyle={{ paddingBottom: 48 }}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
              onPress={() => handlePress(item)}>
              {item.artworkUrl ? (
                <Image
                  source={{ uri: item.artworkUrl }}
                  style={{ width: cardSize, height: cardSize }}
                />
              ) : (
                <View
                  style={{
                    width: cardSize,
                    height: cardSize,
                    backgroundColor: isDark ? '#1e1e1e' : '#e0e0e0',
                  }}
                />
              )}
            </Pressable>
          )}
        />
      )}
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  centered:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  columnWrapper: { gap: 0 },
});
