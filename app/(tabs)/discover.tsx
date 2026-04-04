import { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  FlatList,
  Pressable,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { SpotifyAlbum, SpotifyTrack, SpotifyArtist } from '@/context/SpotifyService';

// ─── Backend URL ──────────────────────────────────────────────────────────────

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

// ─── Static lists ─────────────────────────────────────────────────────────────

const DECADES = ['2020s', '2010s', '2000s', '1990s', '1980s', '1970s', '1960s', '1950s'];
const GENRES  = ['Rap', 'R&B', 'Pop', 'Rock', 'House', 'Jazz', 'Soul', 'Country'];

// ─── Module-level home cache ──────────────────────────────────────────────────

const homeCache: {
  songs?:   SpotifyTrack[];
  artists?: SpotifyArtist[];
} = {};

async function fetchHome(): Promise<{ albums: SpotifyAlbum[]; songs: SpotifyTrack[]; artists: SpotifyArtist[] }> {
  const res = await fetch(`${API_URL}/home`);
  if (!res.ok) throw new Error(`/home → ${res.status}`);
  return res.json();
}

// ─── Card sizes ───────────────────────────────────────────────────────────────

const CARD_SIZE   = 120;
const ARTIST_SIZE = 90;
const FALLBACK_BG = '#1e1e2e';

const PLACEHOLDER_COLORS = ['#1e1e2e', '#1a1a2e', '#16213e', '#0f3460', '#1b1b2f', '#12122a', '#1c1c3a', '#0d1b2a'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  return (
    <View style={s.section}>
      <Text style={[s.sectionLabel, { color: colors.text }]}>{title}</Text>
      {children}
    </View>
  );
}

function ArtFallback({ size, radius, label }: { size: number; radius: number; label: string }) {
  return (
    <View style={[s.fallback, { width: size, height: size, borderRadius: radius }]}>
      <Text style={[s.fallbackText, { fontSize: size * 0.32 }]}>{label[0]?.toUpperCase()}</Text>
    </View>
  );
}

// ─── Cards ────────────────────────────────────────────────────────────────────

function AlbumCard({ item, isDark }: { item: SpotifyAlbum; isDark: boolean }) {
  return (
    <Pressable style={({ pressed }) => [s.card, { width: CARD_SIZE, opacity: pressed ? 0.7 : 1 }]}>
      {item.artworkUrl ? (
        <Image source={{ uri: item.artworkUrl }} style={{ width: CARD_SIZE, height: CARD_SIZE, borderRadius: 6 }} />
      ) : (
        <ArtFallback size={CARD_SIZE} radius={6} label={item.title} />
      )}
      <Text style={[s.cardTitle, { color: isDark ? '#f0f0f0' : '#111' }]} numberOfLines={1}>{item.title}</Text>
      <Text style={[s.cardSub,   { color: isDark ? '#888'   : '#666' }]} numberOfLines={1}>{item.artist}</Text>
    </Pressable>
  );
}

function SongCard({ item, index, isDark }: { item: SpotifyTrack; index: number; isDark: boolean }) {
  return (
    <Pressable style={({ pressed }) => [s.card, { width: CARD_SIZE, opacity: pressed ? 0.7 : 1 }]}>
      <View>
        {item.artworkUrl ? (
          <Image source={{ uri: item.artworkUrl }} style={{ width: CARD_SIZE, height: CARD_SIZE, borderRadius: 6 }} />
        ) : (
          <ArtFallback size={CARD_SIZE} radius={6} label={item.title} />
        )}
        <View style={s.rankBadge}>
          <Text style={s.rankText}>#{index + 1}</Text>
        </View>
      </View>
      <Text style={[s.cardTitle, { color: isDark ? '#f0f0f0' : '#111' }]} numberOfLines={1}>{item.title}</Text>
      <Text style={[s.cardSub,   { color: isDark ? '#888'   : '#666' }]} numberOfLines={1}>{item.artist}</Text>
    </Pressable>
  );
}

function ArtistCard({ item, isDark }: { item: SpotifyArtist; isDark: boolean }) {
  return (
    <Pressable style={({ pressed }) => [s.card, { width: ARTIST_SIZE, alignItems: 'center', opacity: pressed ? 0.7 : 1 }]}>
      {item.artworkUrl ? (
        <Image source={{ uri: item.artworkUrl }} style={{ width: ARTIST_SIZE, height: ARTIST_SIZE, borderRadius: ARTIST_SIZE / 2 }} />
      ) : (
        <ArtFallback size={ARTIST_SIZE} radius={ARTIST_SIZE / 2} label={item.name} />
      )}
      <Text style={[s.cardTitle, { color: isDark ? '#f0f0f0' : '#111', textAlign: 'center' }]} numberOfLines={1}>{item.name}</Text>
      <Text style={[s.cardSub,   { color: isDark ? '#888'   : '#666', textAlign: 'center' }]} numberOfLines={1}>{item.genre}</Text>
    </Pressable>
  );
}

// ─── Placeholder row (sections with no live data yet) ─────────────────────────

function PlaceholderRow({ isDark }: { isDark: boolean }) {
  return (
    <FlatList
      horizontal
      data={PLACEHOLDER_COLORS}
      keyExtractor={(_, i) => String(i)}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.row}
      renderItem={({ index }) => (
        <View
          style={[
            s.placeholderCard,
            { backgroundColor: isDark ? PLACEHOLDER_COLORS[index] : '#e5e5e5' },
          ]}
        />
      )}
    />
  );
}

// ─── Chip (decade / genre) ────────────────────────────────────────────────────

function Chip({
  label,
  onPress,
  isDark,
}: {
  label: string;
  onPress: () => void;
  isDark: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        s.chip,
        {
          backgroundColor: isDark ? '#1a1a1a' : '#f0f0f0',
          borderColor: isDark ? '#333' : '#ddd',
          opacity: pressed ? 0.7 : 1,
        },
      ]}
      onPress={onPress}>
      <Text style={[s.chipText, { color: isDark ? '#f0f0f0' : '#111' }]}>{label}</Text>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DiscoverScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  const [songs,   setSongs]   = useState<SpotifyTrack[]>(homeCache.songs   ?? []);
  const [artists, setArtists] = useState<SpotifyArtist[]>(homeCache.artists ?? []);
  const [loading, setLoading] = useState(!homeCache.songs);

  useEffect(() => {
    if (homeCache.songs) return;
    fetchHome()
      .then((data) => {
        homeCache.songs   = data.songs;
        homeCache.artists = data.artists;
        setSongs(data.songs);
        setArtists(data.artists);
      })
      .catch((err) => console.error('[Discover] fetchHome failed:', err?.message ?? err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}>

      <Text style={[s.heading, { color: colors.text }]}>Discover</Text>

      {/* ── New Releases ── */}
      <Section title="New Releases">
        <PlaceholderRow isDark={isDark} />
      </Section>

      {/* ── Coming Soon ── */}
      <Section title="Coming Soon">
        <PlaceholderRow isDark={isDark} />
      </Section>

      {/* ── Top Rated Albums ── */}
      <Section title="Top Rated Albums">
        <PlaceholderRow isDark={isDark} />
      </Section>

      {/* ── Most Popular Albums ── */}
      <Section title="Most Popular Albums">
        <PlaceholderRow isDark={isDark} />
      </Section>

      {/* ── Recommended For You ── */}
      <Section title="Recommended For You">
        <PlaceholderRow isDark={isDark} />
      </Section>

      {/* ── Top Artists ── */}
      <Section title="Top Artists">
        {loading ? (
          <View style={s.loader}><ActivityIndicator color="#FF3CAC" /></View>
        ) : (
          <FlatList
            horizontal
            data={artists}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.row}
            renderItem={({ item }) => <ArtistCard item={item} isDark={isDark} />}
          />
        )}
      </Section>

      {/* ── Top Songs ── */}
      <Section title="Top Songs">
        {loading ? (
          <View style={s.loader}><ActivityIndicator color="#FF3CAC" /></View>
        ) : (
          <FlatList
            horizontal
            data={songs}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.row}
            renderItem={({ item, index }) => <SongCard item={item} index={index} isDark={isDark} />}
          />
        )}
      </Section>

      {/* ── By Decade chips ── */}
      <Section title="By Decade">
        <FlatList
          horizontal
          data={DECADES}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.row}
          renderItem={({ item }) => (
            <Chip
              label={item}
              isDark={isDark}
              onPress={() =>
                router.push({
                  pathname: '/discover-decade-grid',
                  params: { decade: item },
                } as any)
              }
            />
          )}
        />
      </Section>

      {/* ── Genre chips ── */}
      <Section title="Genres">
        <FlatList
          horizontal
          data={GENRES}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.row}
          renderItem={({ item }) => (
            <Chip
              label={item}
              isDark={isDark}
              onPress={() =>
                router.push({
                  pathname: '/discover-genre-grid',
                  params: { genre: item },
                } as any)
              }
            />
          )}
        />
      </Section>

    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  content: { paddingTop: 20, paddingBottom: 48, gap: 32 },

  heading:      { fontSize: 28, fontWeight: '700', letterSpacing: -0.5, paddingHorizontal: 16 },

  section:      { gap: 12 },
  sectionLabel: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3, paddingHorizontal: 16 },
  loader:       { height: CARD_SIZE, justifyContent: 'center', alignItems: 'center' },
  row:          { paddingHorizontal: 16, gap: 12 },

  card:         { gap: 5 },

  fallback: {
    backgroundColor: FALLBACK_BG,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackText: {
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '700',
  },

  cardTitle: { fontSize: 12, fontWeight: '600' },
  cardSub:   { fontSize: 11 },

  rankBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  rankText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  placeholderCard: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 6,
  },

  chip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 100,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: { fontSize: 15, fontWeight: '600' },
});
