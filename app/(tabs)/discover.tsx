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
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { SpotifyAlbum, SpotifyTrack, SpotifyArtist } from '@/context/SpotifyService';
import { useFlip, FlippedRecord, FlipStatus } from '@/context/FlipContext';
import { useAlbums } from '@/context/AlbumsContext';

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

function formatCountdown(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

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

// ─── Flip helpers ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: FlipStatus }) {
  const config: Record<FlipStatus, { label: string; bg: string; text: string }> = {
    logged:       { label: 'Logged',          bg: '#0f2e1a', text: '#4ade80' },
    didnt_listen: { label: "Didn't Listen",   bg: '#1e1e1e', text: '#888'    },
    pending:      { label: 'Pending',          bg: '#2e1f00', text: '#f59e0b' },
  };
  const { label, bg, text } = config[status];
  return (
    <View style={[sf.badge, { backgroundColor: bg }]}>
      <Text style={[sf.badgeText, { color: text }]}>{label}</Text>
    </View>
  );
}

// ─── Flip a Record section ────────────────────────────────────────────────────

function FlipSection() {
  const colorScheme = useColorScheme();
  const colors      = Colors[colorScheme ?? 'light'];
  const isDark      = colorScheme === 'dark';
  const router      = useRouter();

  const { history, cooldownUntil, currentFlip, poolExhausted, flip, markLogged, markDidntListen } = useFlip();
  const { setPendingAlbum, addToWantToListen } = useAlbums();

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const cooldownActive  = cooldownUntil !== null && now < cooldownUntil;
  const remainingMs     = cooldownActive ? cooldownUntil - now : 0;
  const hasPendingFlip  = currentFlip?.status === 'pending';
  const showAlbumCard   = cooldownActive && hasPendingFlip;
  const showHowWas      = !cooldownActive && hasPendingFlip;
  const showFlipButton  = !poolExhausted && !showAlbumCard && !showHowWas;

  const cardBg     = isDark ? '#111' : '#f2f2f2';
  const borderCol  = isDark ? '#222' : '#e0e0e0';
  const subBg      = isDark ? '#1a1a1a' : '#fff';

  return (
    <View style={sf.wrapper}>

      {/* ── Main flip card ──────────────────────────────────────────────────── */}
      <View style={[sf.flipCard, { backgroundColor: cardBg, borderColor: borderCol }]}>

        {/* Pool exhausted */}
        {poolExhausted && (
          <View style={sf.centeredBlock}>
            <FontAwesome name="trophy" size={30} color="#FF3CAC" />
            <Text style={[sf.emptyTitle, { color: colors.text }]}>You've flipped every record!</Text>
            <Text style={[sf.emptySubtext, { color: colors.subtext }]}>
              Albums return to the pool once you dismiss or log them.
            </Text>
          </View>
        )}

        {/* Flip button */}
        {showFlipButton && (
          <Pressable
            style={({ pressed }) => [sf.flipBtn, { opacity: pressed ? 0.85 : 1 }]}
            onPress={flip}>
            <FontAwesome name="random" size={18} color="#fff" />
            <Text style={sf.flipBtnText}>Flip a Record</Text>
          </Pressable>
        )}

        {/* Active cooldown — show the flipped album */}
        {showAlbumCard && currentFlip && (
          <View style={sf.albumBlock}>
            <View style={[sf.albumArtwork, { backgroundColor: currentFlip.coverColor }]}>
              <Text style={sf.albumArtworkLetter}>{currentFlip.title.charAt(0)}</Text>
            </View>
            <Text style={[sf.albumTitle, { color: colors.text }]} numberOfLines={2}>
              {currentFlip.title}
            </Text>
            <Text style={[sf.albumArtist, { color: colors.subtext }]}>
              {currentFlip.artist} · {currentFlip.year}
            </Text>
            <View style={sf.albumActions}>
              <Pressable
                style={({ pressed }) => [sf.actionPrimary, { opacity: pressed ? 0.8 : 1 }]}
                onPress={() =>
                  addToWantToListen({
                    id: currentFlip.id,
                    title: currentFlip.title,
                    artist: currentFlip.artist,
                    year: currentFlip.year,
                    artworkUrl: '',
                  })
                }>
                <FontAwesome name="bookmark-o" size={13} color="#fff" />
                <Text style={sf.actionPrimaryText}>Want to Listen</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [sf.actionSecondary, { borderColor: borderCol, opacity: pressed ? 0.8 : 1 }]}>
                <FontAwesome name="headphones" size={13} color={colors.subtext} />
                <Text style={[sf.actionSecondaryText, { color: colors.subtext }]}>Open in Streaming</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Cooldown expired — ask how it was */}
        {showHowWas && currentFlip && (
          <View style={sf.howWasBlock}>
            <Text style={[sf.howWasHeading, { color: colors.text }]}>
              How was it?
            </Text>
            <Text style={[sf.howWasAlbum, { color: '#FF3CAC' }]} numberOfLines={1}>
              "{currentFlip.title}"
            </Text>
            <View style={sf.howWasActions}>
              <Pressable
                style={({ pressed }) => [sf.actionPrimary, sf.flex1, { opacity: pressed ? 0.8 : 1 }]}
                onPress={() => {
                  markLogged(currentFlip.id);
                  setPendingAlbum({
                    spotifyId: currentFlip.id,
                    title: currentFlip.title,
                    artist: currentFlip.artist,
                    year: currentFlip.year,
                    artworkUrl: '',
                  });
                  router.push('/log-album');
                }}>
                <FontAwesome name="plus" size={13} color="#fff" />
                <Text style={sf.actionPrimaryText}>Log It</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [sf.actionSecondary, sf.flex1, { borderColor: borderCol, opacity: pressed ? 0.8 : 1 }]}
                onPress={() => markDidntListen(currentFlip.id)}>
                <Text style={[sf.actionSecondaryText, { color: colors.subtext }]}>Didn't Listen</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Live countdown */}
        {cooldownActive && (
          <Text style={[sf.countdown, { color: colors.subtext }]}>
            Come back in {formatCountdown(remainingMs)}
          </Text>
        )}
      </View>

      {/* ── Previously Flipped ───────────────────────────────────────────────── */}
      {history.length > 0 && (
        <View style={sf.historySection}>
          <Text style={[sf.historyHeading, { color: colors.text }]}>Previously Flipped</Text>
          <View style={[sf.historyList, { backgroundColor: subBg, borderColor: borderCol }]}>
            {history.map((record, i) => (
              <View
                key={`${record.id}-${record.flippedAt}`}
                style={[
                  sf.historyRow,
                  { borderBottomColor: borderCol },
                  i === history.length - 1 && sf.historyRowLast,
                ]}>
                <View style={[sf.historyArt, { backgroundColor: record.coverColor }]}>
                  <Text style={sf.historyArtLetter}>{record.title.charAt(0)}</Text>
                </View>
                <View style={sf.historyInfo}>
                  <Text style={[sf.historyTitle, { color: colors.text }]} numberOfLines={1}>
                    {record.title}
                  </Text>
                  <Text style={[sf.historyArtist, { color: colors.subtext }]} numberOfLines={1}>
                    {record.artist} · {record.year}
                  </Text>
                </View>
                <StatusBadge status={record.status} />
              </View>
            ))}
          </View>
        </View>
      )}
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

      {/* ── Flip a Record ── */}
      <FlipSection />

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
                <SongCard item={item} index={index} isDark={isDark} />
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
  );
}

// ─── Discover screen styles ───────────────────────────────────────────────────

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

  placeholderCard: { width: CARD_SIZE, height: CARD_SIZE, borderRadius: 6 },
  artistPlaceholder: { width: ARTIST_SIZE, height: ARTIST_SIZE, borderRadius: ARTIST_SIZE / 2 },

  seeMoreBtn:  { justifyContent: 'center', alignItems: 'center' },
  seeMoreText: { fontSize: 13, fontWeight: '700', textAlign: 'center', letterSpacing: -0.2 },

  chip:     { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 100, borderWidth: StyleSheet.hairlineWidth },
  chipText: { fontSize: 15, fontWeight: '600' },
});

// ─── Flip section styles ──────────────────────────────────────────────────────

const sf = StyleSheet.create({
  wrapper: { paddingHorizontal: 16, gap: 16 },

  // Main card
  flipCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    alignItems: 'center',
    gap: 16,
  },

  // Centred empty/exhausted state
  centeredBlock: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  emptyTitle:    { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptySubtext:  { fontSize: 13, textAlign: 'center', lineHeight: 19 },

  // Flip button
  flipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FF3CAC',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
  },
  flipBtnText: { color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },

  // Album card (shown during cooldown)
  albumBlock:        { alignItems: 'center', gap: 10, width: '100%' },
  albumArtwork:      { width: 120, height: 120, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  albumArtworkLetter:{ color: 'rgba(255,255,255,0.7)', fontSize: 48, fontWeight: '700' },
  albumTitle:        { fontSize: 17, fontWeight: '700', textAlign: 'center', letterSpacing: -0.3 },
  albumArtist:       { fontSize: 14, textAlign: 'center' },
  albumActions:      { flexDirection: 'column', gap: 8, width: '100%', marginTop: 4 },

  // How was prompt
  howWasBlock:   { alignItems: 'center', gap: 8, width: '100%' },
  howWasHeading: { fontSize: 18, fontWeight: '700' },
  howWasAlbum:   { fontSize: 14, fontWeight: '500' },
  howWasActions: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 4 },

  // Shared action buttons
  actionPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#FF3CAC', borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 16,
  },
  actionPrimaryText:   { color: '#fff', fontSize: 14, fontWeight: '600' },
  actionSecondary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 12, borderWidth: 1,
    paddingVertical: 12, paddingHorizontal: 16,
  },
  actionSecondaryText: { fontSize: 14, fontWeight: '500' },
  flex1: { flex: 1 },

  // Countdown
  countdown: { fontSize: 13, fontWeight: '500', letterSpacing: -0.1 },

  // Previously Flipped
  historySection: { gap: 10 },
  historyHeading: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  historyList:    { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  historyRow:     {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  historyRowLast:   { borderBottomWidth: 0 },
  historyArt:       { width: 44, height: 44, borderRadius: 6, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  historyArtLetter: { color: 'rgba(255,255,255,0.7)', fontSize: 18, fontWeight: '700' },
  historyInfo:      { flex: 1, gap: 2 },
  historyTitle:     { fontSize: 14, fontWeight: '600' },
  historyArtist:    { fontSize: 12 },

  // Status badge
  badge:     { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
});
