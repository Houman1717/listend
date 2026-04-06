import { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Image,
  Pressable,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { SpotifyAlbum } from '@/context/SpotifyService';

// ─── Backend URL ──────────────────────────────────────────────────────────────

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

// ─── Module-level cache + shared fetch promise ────────────────────────────────

const cache: Record<string, SpotifyAlbum[]> = {};
let loadPromise: Promise<void> | null = null;

function loadDecades(): Promise<void> {
  if (Object.keys(cache).length > 0) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const res = await fetch(`${API_URL}/decades`);
    if (!res.ok) throw new Error(`/decades → ${res.status}`);
    const data: Record<string, SpotifyAlbum[]> = await res.json();
    for (const [k, v] of Object.entries(data)) cache[k] = v;
  })().catch((err) => {
    console.error('[DecadeGrid] loadDecades failed:', err?.message ?? err);
    loadPromise = null;
  });

  return loadPromise;
}

// ─── Grid constants ───────────────────────────────────────────────────────────

const GAP = 12;
const COLS = 3;
const TOTAL = 48;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DecadeGridScreen() {
  const { decade } = useLocalSearchParams<{ decade: string }>();
  const { width } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const cardSize = (width - 32 - GAP * (COLS - 1)) / COLS;

  const [albums,  setAlbums]  = useState<SpotifyAlbum[]>(() => cache[decade ?? ''] ?? []);
  const [loading, setLoading] = useState(!cache[decade ?? '']);

  useEffect(() => {
    if (!decade) return;
    if (cache[decade]) {
      setAlbums(cache[decade]);
      setLoading(false);
      return;
    }
    loadDecades().then(() => {
      setAlbums(cache[decade] ?? []);
      setLoading(false);
    });
  }, [decade]);

  function handlePress(album: SpotifyAlbum) {
    router.push({
      pathname: '/album-detail',
      params: { id: album.id, title: album.title, artist: album.artist, year: String(album.year), artworkUrl: album.artworkUrl },
    });
  }

  const padded = Array.from({ length: TOTAL }, (_, i) => albums[i] ?? null) as (SpotifyAlbum | null)[];

  return (
    <>
      <Stack.Screen options={{ title: decade ?? 'Decade' }} />

      {loading ? (
        <View style={[s.centered, { backgroundColor: colors.background }]}>
          <ActivityIndicator color="#FF3CAC" size="large" />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1, backgroundColor: colors.background }}
          contentContainerStyle={s.gridWrap}
          showsVerticalScrollIndicator={false}>
          <View style={s.grid}>
            {padded.map((item, i) =>
              item ? (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [{ width: cardSize, height: cardSize, borderRadius: 8, overflow: 'hidden', opacity: pressed ? 0.8 : 1 }]}
                  onPress={() => handlePress(item)}>
                  {item.artworkUrl ? (
                    <Image source={{ uri: item.artworkUrl }} style={{ width: cardSize, height: cardSize }} />
                  ) : (
                    <View style={{ flex: 1, backgroundColor: isDark ? '#1e1e1e' : '#e0e0e0' }} />
                  )}
                </Pressable>
              ) : (
                <View
                  key={`placeholder-${i}`}
                  style={{ width: cardSize, height: cardSize, borderRadius: 8, backgroundColor: isDark ? '#1e1e1e' : '#e0e0e0' }}
                />
              )
            )}
          </View>
        </ScrollView>
      )}
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  gridWrap: { padding: 16, paddingBottom: 48 },
  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
});
