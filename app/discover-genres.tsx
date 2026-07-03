import { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { CatalogAlbum } from '@/context/CatalogService';

// ─── Backend URL ──────────────────────────────────────────────────────────────

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

// ─── Display order for genre sections ────────────────────────────────────────

const GENRE_LABELS = [
  'Pop', 'Hip-Hop / Rap', 'R&B / Soul', 'Rock', 'Electronic',
  'Reggaeton', 'Indie / Alternative', 'Country', 'Metal',
  'Afrobeats', 'Jazz', 'Folk / Singer-Songwriter', 'Classical', 'Blues',
];

const GENRE_DISPLAY_NAMES: Record<string, string> = {
  'Reggaeton': 'Latin',
};

// ─── Module-level cache + shared fetch promise ────────────────────────────────

const cache: Record<string, CatalogAlbum[]> = {};
let loadPromise: Promise<void> | null = null;

function loadGenres(): Promise<void> {
  if (Object.keys(cache).length > 0) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const res = await fetch(`${API_URL}/genres`);
    if (!res.ok) throw new Error(`/genres → ${res.status}`);
    const data: Record<string, CatalogAlbum[]> = await res.json();
    for (const [label, albums] of Object.entries(data)) {
      cache[label] = albums;
    }
  })().catch((err) => {
    console.error('[Genres] loadGenres failed:', err?.message ?? err);
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
  album: CatalogAlbum;
  onPress: () => void;
  isDark: boolean;
}) {
  return (
    <Pressable style={({ pressed }) => [s.card, { opacity: pressed ? 0.7 : 1 }]} onPress={onPress}>
      {album.artworkUrl ? (
        <ExpoImage source={{ uri: album.artworkUrl }} style={s.cardImage} 
            contentFit="cover" cachePolicy="disk"
          />
      ) : (
        <View style={[s.cardImage, { backgroundColor: isDark ? '#2a1e14' : '#e0e0e0' }]} />
      )}
      <Text style={[s.cardTitle, { color: isDark ? '#f5e6c8' : '#1c1410' }]} numberOfLines={1}>
        {album.title}
      </Text>
      <Text style={[s.cardArtist, { color: isDark ? '#a07850' : '#7a5535' }]} numberOfLines={1}>
        {album.artist}
      </Text>
    </Pressable>
  );
}

// ─── Genre section ────────────────────────────────────────────────────────────

function GenreSection({
  label,
  onAlbumPress,
  colors,
  isDark,
}: {
  label: string;
  onAlbumPress: (album: CatalogAlbum) => void;
  colors: any;
  isDark: boolean;
}) {
  const [albums, setAlbums] = useState<CatalogAlbum[]>(() => cache[label] ?? []);
  const [loading, setLoading] = useState(!cache[label]);

  useEffect(() => {
    if (cache[label]) {
      setAlbums(cache[label]);
      setLoading(false);
      return;
    }
    loadGenres().then(() => {
      setAlbums(cache[label] ?? []);
      setLoading(false);
    });
  }, [label]);

  return (
    <View style={s.section}>
      <Text style={[s.sectionLabel, { color: colors.text }]}>{GENRE_DISPLAY_NAMES[label] ?? label}</Text>
      {loading ? (
        <View style={s.sectionLoader}>
          <ActivityIndicator color="#D4A017" />
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

export default function DiscoverGenresScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  useEffect(() => {
    loadGenres(); // prefetch all genres on mount
  }, []);

  function handleAlbumPress(album: CatalogAlbum) {
    router.push({
      pathname: '/album-detail',
      params: { id: album.id, title: album.title, artist: album.artist, year: String(album.year), artworkUrl: album.artworkUrl },
    });
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Genres' }} />
      <FlatList
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={s.content}
        data={GENRE_LABELS}
        keyExtractor={(label) => label}
        initialNumToRender={1}
        windowSize={3}
        renderItem={({ item: label }) => (
          <GenreSection
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
