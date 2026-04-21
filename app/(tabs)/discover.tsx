import { useEffect, useState, useCallback } from 'react';
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
import { SongInfoModal, SongInfo } from '@/components/SongInfoModal';

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
// Pure RN views — no SVG dependency needed.
// Layout (40×40): platter circle → groove ring → pink label → tonearm shaft → pivot dot

function TurntableIcon() {
  return (
    <View style={{ width: 40, height: 40 }}>
      {/* Platter */}
      <View style={{
        position: 'absolute', top: 0, left: 0, width: 40, height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.13)',
        borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.55)',
      }} />
      {/* Groove ring */}
      <View style={{
        position: 'absolute', top: 6, left: 6, width: 28, height: 28,
        borderRadius: 14, borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)', backgroundColor: 'transparent',
      }} />
      {/* Label (centre circle, pink) */}
      <View style={{
        position: 'absolute', top: 14, left: 14, width: 12, height: 12,
        borderRadius: 6, backgroundColor: '#FF3CAC', opacity: 0.9,
      }} />
      {/* Spindle dot */}
      <View style={{
        position: 'absolute', top: 18.5, left: 18.5, width: 3, height: 3,
        borderRadius: 1.5, backgroundColor: 'rgba(0,0,0,0.55)',
      }} />
      {/* Tonearm shaft — top end = pivot (upper-right), bottom end = needle (near label) */}
      {/* Center of 2×20 rect at (29,12); rotate +37° → top end ≈(35,4), bottom end ≈(23,20) */}
      <View style={{
        position: 'absolute', top: 2, left: 28, width: 2, height: 20,
        borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.9)',
        transform: [{ rotate: '37deg' }],
      }} />
      {/* Pivot dot */}
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

      {/* Dark gradient background — always dark regardless of color scheme */}
      <LinearGradient
        colors={['#0d0d14', '#131325', '#1a1035']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Pink left-edge accent bar */}
      <View style={se.accentBar} />

      {/* Top row: icon + badge */}
      <View style={se.topRow}>
        <View style={se.iconWrap}>
          <TurntableIcon />
        </View>
        <View style={se.badge}>
          <Text style={se.badgeText}>1001 Albums</Text>
        </View>
      </View>

      {/* Title + subtitle */}
      <View style={se.textBlock}>
        <Text style={se.title}>Flip a Record</Text>
        <Text style={se.subtitle}>Discover a random album from the 1001 list</Text>
      </View>

      {/* Bottom CTA */}
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

  const [songs,   setSongs]   = useState<SpotifyTrack[]>(homeCache.songs   ?? []);
  const [artists, setArtists] = useState<SpotifyArtist[]>(homeCache.artists ?? []);
  const [loading, setLoading] = useState(!homeCache.songs);
  const [activeSong, setActiveSong] = useState<SongInfo | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchHome()
        .then((data) => {
          homeCache.songs   = data.songs;
          homeCache.artists = data.artists;
          setSongs(data.songs);
          setArtists(data.artists);
        })
        .catch((err) => console.error('[Discover] fetchHome failed:', err?.message ?? err))
        .finally(() => setLoading(false));
    }, [])
  );

  return (
    <>
    <SongInfoModal
        song={activeSong}
        onClose={() => setActiveSong(null)}
        onArtistPress={(name) => router.push({ pathname: '/artist-detail', params: { name } })}
        onAlbumPress={(id) => router.push({ pathname: '/album-detail', params: { id } })}
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
        <PlaceholderRow isDark={isDark} onSeeMore={() => router.push('/discover-new-releases' as any)} />
      </Section>

      {/* ── Coming Soon ── */}
      <Section title="Coming Soon">
        <PlaceholderRow isDark={isDark} onSeeMore={() => router.push('/discover-coming-soon' as any)} />
      </Section>

      {/* ── Top Rated Albums ── */}
      <Section title="Top Rated Albums">
        <PlaceholderRow isDark={isDark} onSeeMore={() => router.push('/discover-top-rated' as any)} />
      </Section>

      {/* ── Most Popular Albums ── */}
      <Section title="Most Popular Albums">
        <PlaceholderRow isDark={isDark} onSeeMore={() => router.push('/discover-most-popular' as any)} />
      </Section>

      {/* ── All-Time Classics ── */}
      <Section title="All-Time Classics">
        <PlaceholderRow isDark={isDark} onSeeMore={() => router.push('/discover-all-time-classics' as any)} />
      </Section>

      {/* ── Based on Your Taste ── */}
      <Section title="Based on Your Taste">
        <PlaceholderRow isDark={isDark} onSeeMore={() => router.push('/discover-recommended' as any)} />
      </Section>

      {/* ── Top Artists ── */}
      <Section title="Top Artists">
        {loading ? (
          <View style={s.loader}><ActivityIndicator color="#FF3CAC" /></View>
        ) : (
          <FlatList
            horizontal
            data={Array.from({ length: 10 }, (_, i) => artists[i] ?? null) as (SpotifyArtist | null)[]}
            keyExtractor={(item, index) => item?.id ?? `artist-placeholder-${index}`}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.row}
            renderItem={({ item }) =>
              item ? (
                <ArtistCard
                  item={item}
                  isDark={isDark}
                  onPress={() => router.push({ pathname: '/artist-detail', params: { id: item.id, name: item.name, artworkUrl: item.artworkUrl } } as any)}
                />
              ) : (
                <View style={[s.artistPlaceholder, { backgroundColor: isDark ? '#1e1e2e' : '#e5e5e5' }]} />
              )
            }
            ListFooterComponent={<SeeMoreButton onPress={() => router.push('/discover-top-artists' as any)} isDark={isDark} size={ARTIST_SIZE} circular />}
            ListFooterComponentStyle={{ marginLeft: 12 }}
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
            data={Array.from({ length: 10 }, (_, i) => songs[i] ?? null) as (SpotifyTrack | null)[]}
            keyExtractor={(item, index) => item?.id ?? `song-placeholder-${index}`}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.row}
            renderItem={({ item, index }) =>
              item ? (
                <SongCard item={item} index={index} isDark={isDark} onPress={() => setActiveSong({ id: item.id, title: item.title, artist: item.artist, artworkUrl: item.artworkUrl, releaseDate: item.releaseDate })} />
              ) : (
                <View style={[s.placeholderCard, { backgroundColor: isDark ? '#1e1e2e' : '#e5e5e5' }]} />
              )
            }
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
    // Glow shadow using pink
    shadowColor: '#FF3CAC',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },

  // Vertical pink accent bar on the left edge
  accentBar: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: 4,
    backgroundColor: '#FF3CAC',
  },

  // Top row: icon on left, badge on right
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

  // Title + subtitle
  textBlock: { gap: 5 },
  title:     { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.4 },
  subtitle:  { fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 18 },

  // Bottom CTA row
  bottomRow: { flexDirection: 'row', alignItems: 'center' },
  cta:       { fontSize: 13, fontWeight: '700', color: '#FF3CAC', letterSpacing: 0.1 },
});
