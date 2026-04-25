import { useState, useCallback } from 'react';
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
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { SpotifyAlbum, SpotifyTrack, SpotifyArtist } from '@/context/SpotifyService';
import { discoverSections } from '@/context/discoverSections';
import { SongInfoModal, SongInfo } from '@/components/SongInfoModal';

// ─── Backend URL ──────────────────────────────────────────────────────────────

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

// ─── Static lists ─────────────────────────────────────────────────────────────

const DECADES = ['2020s', '2010s', '2000s', '1990s', '1980s', '1970s', '1960s', '1950s'];
const GENRES = [
  'Hip-Hop / Rap', 'Pop', 'Rock', 'Reggaeton', 'Afrobeats',
  'R&B / Soul', 'Electronic', 'Indie / Alternative', 'Metal',
  'Country', 'Jazz', 'Folk / Singer-Songwriter',
];

async function fetchSections(): Promise<void> {
  const safe = (p: Promise<SpotifyAlbum[]>) => p.catch(() => [] as SpotifyAlbum[]);
  const fetchJson = (path: string): Promise<SpotifyAlbum[]> =>
    fetch(`${API_URL}${path}`).then(r => { if (!r.ok) throw new Error(`${path} → ${r.status}`); return r.json(); });

  const fetchTyped = <T,>(path: string): Promise<T[]> =>
    fetch(`${API_URL}${path}`).then(r => { if (!r.ok) throw new Error(`${path} → ${r.status}`); return r.json(); });

  const [newReleases, popular, classics, topRated, topArtists, topSongs] = await Promise.all([
    safe(fetchJson('/discover/new-releases')),
    safe(fetchJson('/discover/popular')),
    safe(fetchJson('/discover/classics')),
    safe(fetchJson('/discover/top-rated')),
    fetchTyped<SpotifyArtist>('/discover/top-artists').catch(() => [] as SpotifyArtist[]),
    fetchTyped<SpotifyTrack>('/discover/top-songs').catch(() => [] as SpotifyTrack[]),
  ]);

  discoverSections.newReleases  = newReleases;
  discoverSections.popular      = popular;
  discoverSections.classics     = classics;
  discoverSections.topRated     = topRated;
  discoverSections.topArtists   = topArtists;
  discoverSections.topSongs     = topSongs;
}

// ─── Card sizes ───────────────────────────────────────────────────────────────

const CARD_SIZE   = 120;
const ARTIST_SIZE = 90;
const FALLBACK_BG = '#1e1e2e';

const PLACEHOLDER_COLORS = ['#1e1e2e', '#1a1a2e', '#16213e', '#0f3460', '#1b1b2f', '#12122a', '#1c1c3a', '#0d1b2a', '#131328', '#0e1f3a'];

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

function AlbumCard({ item, isDark, onPress }: { item: SpotifyAlbum; isDark: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.card, { width: CARD_SIZE, opacity: pressed ? 0.7 : 1 }]}>
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

function SongCard({ item, index, isDark, onPress }: { item: SpotifyTrack; index: number; isDark: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.card, { width: CARD_SIZE, opacity: pressed ? 0.7 : 1 }]}>
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

function ArtistCard({ item, isDark, onPress }: { item: SpotifyArtist; isDark: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.card, { width: ARTIST_SIZE, alignItems: 'center', opacity: pressed ? 0.7 : 1 }]}>
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

// ─── See More button ──────────────────────────────────────────────────────────

function SeeMoreButton({ onPress, isDark, size = CARD_SIZE, circular = false }: { onPress: () => void; isDark: boolean; size?: number; circular?: boolean }) {
  return (
    <Pressable
      style={({ pressed }) => [
        s.seeMoreBtn,
        {
          width: size,
          height: size,
          borderRadius: circular ? size / 2 : 6,
          backgroundColor: isDark ? '#1a1a1a' : '#ebebeb',
          opacity: pressed ? 0.7 : 1,
        },
      ]}
      onPress={onPress}>
      <Text style={[s.seeMoreText, { color: isDark ? '#f0f0f0' : '#111' }]}>See{'\n'}More</Text>
    </Pressable>
  );
}

// ─── Placeholder row ─────────────────────────────────────────────────────────

function PlaceholderRow({ isDark, onSeeMore }: { isDark: boolean; onSeeMore: () => void }) {
  return (
    <FlatList
      horizontal
      data={PLACEHOLDER_COLORS}
      keyExtractor={(_, i) => String(i)}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.row}
      renderItem={({ index }) => (
        <View style={[s.placeholderCard, { backgroundColor: isDark ? PLACEHOLDER_COLORS[index] : '#e5e5e5' }]} />
      )}
      ListFooterComponent={<SeeMoreButton onPress={onSeeMore} isDark={isDark} />}
      ListFooterComponentStyle={{ marginLeft: 12 }}
    />
  );
}

// ─── Album row (real data) ────────────────────────────────────────────────────

function AlbumRow({
  data,
  isDark,
  onAlbumPress,
  onSeeMore,
}: {
  data: SpotifyAlbum[];
  isDark: boolean;
  onAlbumPress: (album: SpotifyAlbum) => void;
  onSeeMore: () => void;
}) {
  if (data.length === 0) return <PlaceholderRow isDark={isDark} onSeeMore={onSeeMore} />;
  return (
    <FlatList
      horizontal
      data={data.slice(0, 10)}
      keyExtractor={item => item.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.row}
      renderItem={({ item }) => (
        <AlbumCard item={item} isDark={isDark} onPress={() => onAlbumPress(item)} />
      )}
      ListFooterComponent={<SeeMoreButton onPress={onSeeMore} isDark={isDark} />}
      ListFooterComponentStyle={{ marginLeft: 12 }}
    />
  );
}

// ─── Chip ────────────────────────────────────────────────────────────────────

function Chip({ label, onPress, isDark }: { label: string; onPress: () => void; isDark: boolean }) {
  return (
    <Pressable
      style={({ pressed }) => [
        s.chip,
        { backgroundColor: isDark ? '#1a1a1a' : '#f0f0f0', borderColor: isDark ? '#333' : '#ddd', opacity: pressed ? 0.7 : 1 },
      ]}
      onPress={onPress}>
      <Text style={[s.chipText, { color: isDark ? '#f0f0f0' : '#111' }]}>{label}</Text>
    </Pressable>
  );
}

// ─── Bird's-eye turntable icon ────────────────────────────────────────────────

function TurntableIcon() {
  return (
    <View style={{ width: 40, height: 40 }}>
      <View style={{
        position: 'absolute', top: 0, left: 0, width: 40, height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.13)',
        borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.55)',
      }} />
      <View style={{
        position: 'absolute', top: 6, left: 6, width: 28, height: 28,
        borderRadius: 14, borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)', backgroundColor: 'transparent',
      }} />
      <View style={{
        position: 'absolute', top: 14, left: 14, width: 12, height: 12,
        borderRadius: 6, backgroundColor: '#FF3CAC', opacity: 0.9,
      }} />
      <View style={{
        position: 'absolute', top: 18.5, left: 18.5, width: 3, height: 3,
        borderRadius: 1.5, backgroundColor: 'rgba(0,0,0,0.55)',
      }} />
      <View style={{
        position: 'absolute', top: 2, left: 28, width: 2, height: 20,
        borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.9)',
        transform: [{ rotate: '37deg' }],
      }} />
      <View style={{
        position: 'absolute', top: 1, left: 32, width: 6, height: 6,
        borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.85)',
      }} />
    </View>
  );
}

// ─── Flip entry card ─────────────────────────────────────────────────────────

function FlipEntryCard({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [se.card, { opacity: pressed ? 0.88 : 1 }]}>

      <LinearGradient
        colors={['#0d0d14', '#131325', '#1a1035']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={se.accentBar} />

      <View style={se.topRow}>
        <View style={se.iconWrap}>
          <TurntableIcon />
        </View>
        <View style={se.badge}>
          <Text style={se.badgeText}>1001 Albums</Text>
        </View>
      </View>

      <View style={se.textBlock}>
        <Text style={se.title}>Flip a Record</Text>
        <Text style={se.subtitle}>Discover a random album from the 1001 list</Text>
      </View>

      <View style={se.bottomRow}>
        <Text style={se.cta}>Try it →</Text>
      </View>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DiscoverScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  const [newReleases,  setNewReleases]  = useState<SpotifyAlbum[]>(discoverSections.newReleases);
  const [popular,      setPopular]      = useState<SpotifyAlbum[]>(discoverSections.popular);
  const [classics,     setClassics]     = useState<SpotifyAlbum[]>(discoverSections.classics);
  const [topRated,     setTopRated]     = useState<SpotifyAlbum[]>(discoverSections.topRated);
  const [topArtists,   setTopArtists]   = useState<SpotifyArtist[]>(discoverSections.topArtists);
  const [topSongs,     setTopSongs]     = useState<SpotifyTrack[]>(discoverSections.topSongs);

  const [sectionsLoading,  setSectionsLoading]  = useState(discoverSections.newReleases.length === 0);
  const [activeSong, setActiveSong] = useState<SongInfo | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (discoverSections.newReleases.length === 0) {
        fetchSections()
          .then(() => {
            setNewReleases([...discoverSections.newReleases]);
            setPopular([...discoverSections.popular]);
            setClassics([...discoverSections.classics]);
            setTopRated([...discoverSections.topRated]);
            setTopArtists([...discoverSections.topArtists]);
            setTopSongs([...discoverSections.topSongs]);
          })
          .catch((err) => console.error('[Discover] fetchSections failed:', err?.message ?? err))
          .finally(() => setSectionsLoading(false));
      }
    }, [])
  );

  function goToAlbum(album: SpotifyAlbum) {
    router.push({ pathname: '/album-detail', params: { id: album.id, title: album.title, artist: album.artist, year: String(album.year), artworkUrl: album.artworkUrl } } as any);
  }

  return (
    <>
    <SongInfoModal
        song={activeSong}
        onClose={() => setActiveSong(null)}
        onArtistPress={(name) => router.push({ pathname: '/artist-detail', params: { name } })}
        onAlbumPress={(p) => router.push({ pathname: '/album-detail', params: p } as any)}
      />
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}>

      <Text style={[s.heading, { color: colors.text }]}>Discover</Text>

      {/* ── Flip a Record entry ── */}
      <View style={{ paddingHorizontal: 16 }}>
        <FlipEntryCard onPress={() => router.push('/flip-a-record' as any)} />
      </View>

      {/* ── New Releases ── */}
      <Section title="New Releases">
        {sectionsLoading && newReleases.length === 0 ? (
          <PlaceholderRow isDark={isDark} onSeeMore={() => router.push('/discover-new-releases' as any)} />
        ) : (
          <AlbumRow
            data={newReleases}
            isDark={isDark}
            onAlbumPress={goToAlbum}
            onSeeMore={() => router.push('/discover-new-releases' as any)}
          />
        )}
      </Section>

      {/* ── Top Rated Albums ── */}
      <Section title="Top Rated Albums">
        {sectionsLoading && topRated.length === 0 ? (
          <PlaceholderRow isDark={isDark} onSeeMore={() => router.push('/discover-top-rated' as any)} />
        ) : (
          <AlbumRow
            data={topRated}
            isDark={isDark}
            onAlbumPress={goToAlbum}
            onSeeMore={() => router.push('/discover-top-rated' as any)}
          />
        )}
      </Section>

      {/* ── Popular Albums ── */}
      <Section title="Popular Albums">
        {sectionsLoading && popular.length === 0 ? (
          <PlaceholderRow isDark={isDark} onSeeMore={() => router.push('/discover-most-popular' as any)} />
        ) : (
          <AlbumRow
            data={popular}
            isDark={isDark}
            onAlbumPress={goToAlbum}
            onSeeMore={() => router.push('/discover-most-popular' as any)}
          />
        )}
      </Section>

      {/* ── All-Time Classics ── */}
      <Section title="All-Time Classics">
        {sectionsLoading && classics.length === 0 ? (
          <PlaceholderRow isDark={isDark} onSeeMore={() => router.push('/discover-all-time-classics' as any)} />
        ) : (
          <AlbumRow
            data={classics}
            isDark={isDark}
            onAlbumPress={goToAlbum}
            onSeeMore={() => router.push('/discover-all-time-classics' as any)}
          />
        )}
      </Section>

      {/* ── Top Artists ── */}
      <Section title="Top Artists">
        {sectionsLoading && topArtists.length === 0 ? (
          <View style={s.loader}><ActivityIndicator color="#FF3CAC" /></View>
        ) : (
          <FlatList
            horizontal
            data={topArtists.slice(0, 10)}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.row}
            renderItem={({ item }) => (
              <ArtistCard
                item={item}
                isDark={isDark}
                onPress={() => router.push({ pathname: '/artist-detail', params: { id: item.id, name: item.name, artworkUrl: item.artworkUrl } } as any)}
              />
            )}
            ListFooterComponent={<SeeMoreButton onPress={() => router.push('/discover-top-artists' as any)} isDark={isDark} size={ARTIST_SIZE} circular />}
            ListFooterComponentStyle={{ marginLeft: 12 }}
          />
        )}
      </Section>

      {/* ── Top Songs ── */}
      <Section title="Top Songs">
        {sectionsLoading && topSongs.length === 0 ? (
          <View style={s.loader}><ActivityIndicator color="#FF3CAC" /></View>
        ) : (
          <FlatList
            horizontal
            data={topSongs.slice(0, 10)}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.row}
            renderItem={({ item, index }) => (
              <SongCard
                item={item}
                index={index}
                isDark={isDark}
                onPress={() => setActiveSong({ id: item.id, title: item.title, artist: item.artist, artworkUrl: item.artworkUrl, releaseDate: item.releaseDate })}
              />
            )}
            ListFooterComponent={<SeeMoreButton onPress={() => router.push('/discover-top-songs' as any)} isDark={isDark} />}
            ListFooterComponentStyle={{ marginLeft: 12 }}
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
            <Chip label={item} isDark={isDark} onPress={() => router.push({ pathname: '/discover-decade-grid', params: { decade: item } } as any)} />
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
            <Chip label={item} isDark={isDark} onPress={() => router.push({ pathname: '/discover-genre-grid', params: { genre: item } } as any)} />
          )}
        />
      </Section>

    </ScrollView>
    </>
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

  card: { gap: 5 },

  fallback:     { backgroundColor: FALLBACK_BG, justifyContent: 'center', alignItems: 'center' },
  fallbackText: { color: 'rgba(255,255,255,0.4)', fontWeight: '700' },

  cardTitle: { fontSize: 12, fontWeight: '600' },
  cardSub:   { fontSize: 11 },

  rankBadge: { position: 'absolute', bottom: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  rankText:  { color: '#fff', fontSize: 10, fontWeight: '700' },

  placeholderCard:   { width: CARD_SIZE, height: CARD_SIZE, borderRadius: 6 },
  artistPlaceholder: { width: ARTIST_SIZE, height: ARTIST_SIZE, borderRadius: ARTIST_SIZE / 2 },

  seeMoreBtn:  { justifyContent: 'center', alignItems: 'center' },
  seeMoreText: { fontSize: 13, fontWeight: '700', textAlign: 'center', letterSpacing: -0.2 },

  chip:     { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 100, borderWidth: StyleSheet.hairlineWidth },
  chipText: { fontSize: 15, fontWeight: '600' },
});

// ─── Flip entry card styles ───────────────────────────────────────────────────

const se = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 14,
    shadowColor: '#FF3CAC',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },

  accentBar: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: 4,
    backgroundColor: '#FF3CAC',
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(255,60,172,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,60,172,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    backgroundColor: 'rgba(255,60,172,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,60,172,0.3)',
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#FF3CAC', letterSpacing: 0.2 },

  textBlock: { gap: 5 },
  title:     { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.4 },
  subtitle:  { fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 18 },

  bottomRow: { flexDirection: 'row', alignItems: 'center' },
  cta:       { fontSize: 13, fontWeight: '700', color: '#FF3CAC', letterSpacing: 0.1 },
});
