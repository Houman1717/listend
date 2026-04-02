import { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  Pressable,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { SpotifyAlbum } from '@/context/SpotifyService';
import { useAlbums, PendingAlbum } from '@/context/AlbumsContext';

// ─── Backend URL ──────────────────────────────────────────────────────────────

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

// ─── Display order for decade sections ───────────────────────────────────────

const DECADE_LABELS = ['1950s', '1960s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s'];

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
    for (const [label, albums] of Object.entries(data)) {
      cache[label] = albums;
    }
  })().catch((err) => {
    console.error('[Decades] loadDecades failed:', err?.message ?? err);
    loadPromise = null; // allow retry on next mount
  });

  return loadPromise;
}

// ─── Album card ───────────────────────────────────────────────────────────────

const CARD_SIZE = 120;

function AlbumCard({
  album,
  onPress,
  isDark,
}: {
  album: SpotifyAlbum;
  onPress: () => void;
  isDark: boolean;
}) {
  return (
    <Pressable style={({ pressed }) => [s.card, { opacity: pressed ? 0.7 : 1 }]} onPress={onPress}>
      {album.artworkUrl ? (
        <Image source={{ uri: album.artworkUrl }} style={s.cardImage} />
      ) : (
        <View style={[s.cardImage, { backgroundColor: isDark ? '#2a2a2a' : '#e0e0e0' }]} />
      )}
      <Text style={[s.cardTitle, { color: isDark ? '#f0f0f0' : '#111' }]} numberOfLines={1}>
        {album.title}
      </Text>
      <Text style={[s.cardArtist, { color: isDark ? '#888' : '#666' }]} numberOfLines={1}>
        {album.artist}
      </Text>
    </Pressable>
  );
}

// ─── Decade section ───────────────────────────────────────────────────────────

function DecadeSection({
  label,
  onAlbumPress,
  colors,
  isDark,
}: {
  label: string;
  onAlbumPress: (album: SpotifyAlbum) => void;
  colors: any;
  isDark: boolean;
}) {
  const [albums, setAlbums] = useState<SpotifyAlbum[]>(() => cache[label] ?? []);
  const [loading, setLoading] = useState(!cache[label]);

  useEffect(() => {
    if (cache[label]) {
      setAlbums(cache[label]);
      setLoading(false);
      return;
    }
    loadDecades().then(() => {
      setAlbums(cache[label] ?? []);
      setLoading(false);
    });
  }, [label]);

  return (
    <View style={s.section}>
      <Text style={[s.sectionLabel, { color: colors.text }]}>{label}</Text>
      {loading ? (
        <View style={s.sectionLoader}>
          <ActivityIndicator color="#FF3CAC" />
        </View>
      ) : albums.length === 0 ? (
        <View style={s.sectionLoader}>
          <Text style={[s.emptyText, { color: colors.subtext }]}>No results</Text>
        </View>
      ) : (
        <FlatList
          horizontal
          data={albums}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.albumRow}
          renderItem={({ item }) => (
            <AlbumCard album={item} onPress={() => onAlbumPress(item)} isDark={isDark} />
          )}
        />
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DiscoverDecadesScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const { setPendingAlbum } = useAlbums();

  useEffect(() => {
    loadDecades(); // prefetch all decades on mount
  }, []);

  function handleAlbumPress(album: SpotifyAlbum) {
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
      <Stack.Screen options={{ title: 'By Decade' }} />
      <FlatList
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={s.content}
        data={DECADE_LABELS}
        keyExtractor={(label) => label}
        initialNumToRender={1}
        windowSize={3}
        renderItem={({ item: label }) => (
          <DecadeSection
            label={label}
            onAlbumPress={handleAlbumPress}
            colors={colors}
            isDark={isDark}
          />
        )}
      />
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  content: { paddingBottom: 48 },

  section: { paddingTop: 24, paddingBottom: 8 },
  sectionLabel: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionLoader: {
    height: CARD_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: { fontSize: 14 },

  albumRow: { paddingHorizontal: 16, gap: 12 },
  card: { width: CARD_SIZE },
  cardImage: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 6,
    marginBottom: 6,
  },
  cardTitle: { fontSize: 12, fontWeight: '600' },
  cardArtist: { fontSize: 11 },
});
