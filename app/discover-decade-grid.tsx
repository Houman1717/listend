import { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { SpotifyAlbum } from '@/context/SpotifyService';
import { AlbumGridCard, AlbumGridCardPlaceholder, cardWidth, GAP, PADDING } from '@/components/AlbumGridCard';

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

const TOTAL = 48;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DecadeGridScreen() {
  const { decade } = useLocalSearchParams<{ decade: string }>();
  const { width } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const cw = cardWidth(width);

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
                <AlbumGridCard
                  key={item.id}
                  album={item}
                  width={cw}
                  onPress={() => handlePress(item)}
                  textColor={colors.text}
                  subColor={colors.subtext}
                  isDark={isDark}
                />
              ) : (
                <AlbumGridCardPlaceholder key={`placeholder-${i}`} width={cw} isDark={isDark} />
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
  gridWrap: { padding: PADDING, paddingBottom: 48 },
  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
});
