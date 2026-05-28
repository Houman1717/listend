import { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
  Text,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { SpotifyAlbum } from '@/context/SpotifyService';
import { AlbumGridCard, AlbumGridCardPlaceholder, cardWidth, GAP, PADDING } from '@/components/AlbumGridCard';
import { useAlbums } from '@/context/AlbumsContext';

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

const TOTAL = 48;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function GenreGridScreen() {
  const { genre } = useLocalSearchParams<{ genre: string }>();
  const { width } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const cw = cardWidth(width);

  const { loggedAlbums } = useAlbums();
  const loggedIds = new Set(loggedAlbums.map((a) => a.id));

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
    router.push({
      pathname: '/album-detail',
      params: { id: album.id, title: album.title, artist: album.artist, year: String(album.year), artworkUrl: album.artworkUrl },
    });
  }

  const padded = Array.from({ length: TOTAL }, (_, i) => albums[i] ?? null) as (SpotifyAlbum | null)[];

  const loggedInGrid = albums.filter(a => loggedIds.has(a.id)).length;
  const listenedPct  = albums.length > 0 ? Math.round(loggedInGrid / albums.length * 100) : 0;

  return (
    <>
      <Stack.Screen options={{ title: genre ?? 'Genre' }} />

      {loading ? (
        <View style={[s.centered, { backgroundColor: colors.background }]}>
          <ActivityIndicator color="#D4A017" size="large" />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1, backgroundColor: colors.background }}
          contentContainerStyle={s.gridWrap}
          showsVerticalScrollIndicator={false}>

          <View style={s.statsHeader}>
            <View style={s.listenedRow}>
              <FontAwesome name="headphones" size={13} color="#D4A017" />
              <Text style={s.listenedPct}>{listenedPct}%</Text>
            </View>
            <Text style={[s.listenedSub, { color: isDark ? '#a07850' : '#7a5535' }]}>
              {loggedInGrid} of {albums.length} albums listened
            </Text>
          </View>

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
                  isLogged={loggedIds.has(item.id)}
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
  centered:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  gridWrap:    { padding: PADDING, paddingBottom: 48 },
  grid:        { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  statsHeader: { alignItems: 'center', paddingTop: 8, paddingBottom: 16, gap: 4 },
  listenedRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  listenedPct: { color: '#D4A017', fontSize: 15, fontWeight: '700' },
  listenedSub: { fontSize: 13 },
});
