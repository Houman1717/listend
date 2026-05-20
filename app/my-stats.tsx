import { StyleSheet, View, Text, ScrollView, Pressable, Modal, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { useState, useEffect, Fragment } from 'react';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAlbums, LoggedAlbum } from '@/context/AlbumsContext';
import { supabase } from '@/lib/supabase';

const MAIN_GENRES = new Set([
  'Hip-Hop / Rap', 'Pop', 'Rock', 'Latin', 'Afrobeats',
  'R&B / Soul', 'Electronic', 'Indie / Alternative', 'Metal',
  'Country', 'Jazz', 'Classical', 'Folk / Singer-Songwriter', 'Blues',
]);

const CARD_BG  = '#2E2018';
const BORDER   = '#2a1e14';
const TEXT     = '#f5e6c8';
const SUBTEXT  = '#A08060';
const ACCENT   = '#D4A017';

const TAG_COLORS = ['#7a5018', '#8B6914', '#5c3a10', '#6B4422', '#9a7020', '#4a3218'];

// ─── Rated Albums Modal ───────────────────────────────────────────────────────

function RatedAlbumsModal({
  rating,
  albums,
  onClose,
  onAlbumPress,
}: {
  rating: number | null;
  albums: LoggedAlbum[];
  onClose: () => void;
  onAlbumPress: (album: LoggedAlbum) => void;
}) {
  const insets = useSafeAreaInsets();
  const visible = rating !== null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={rm.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[rm.sheet, { paddingBottom: Math.max(insets.bottom + 16, 32) }]}>
          <View style={rm.handle} />
          <View style={rm.header}>
            <Text style={rm.title}>Rated {rating}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <FontAwesome name="times" size={16} color={SUBTEXT} />
            </Pressable>
          </View>
          <Text style={rm.subtitle}>{albums.length} album{albums.length !== 1 ? 's' : ''}</Text>
          <FlatList
            data={albums}
            keyExtractor={a => a.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8 }}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [rm.row, { opacity: pressed ? 0.7 : 1 }]}
                onPress={() => { onClose(); setTimeout(() => onAlbumPress(item), 300); }}>
                {item.artworkUrl ? (
                  <ExpoImage
                    source={{ uri: item.artworkUrl }}
                    style={rm.artwork}
                    contentFit="cover"
                    cachePolicy="disk"
                  />
                ) : (
                  <View style={[rm.artwork, rm.artworkFallback]}>
                    <Text style={rm.artworkInitial}>{item.title.charAt(0)}</Text>
                  </View>
                )}
                <View style={rm.info}>
                  <Text style={rm.albumTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={rm.albumArtist} numberOfLines={1}>{item.artist}</Text>
                </View>
                <Text style={rm.ratingBadge}>{item.rating}</Text>
              </Pressable>
            )}
            ItemSeparatorComponent={() => <View style={rm.separator} />}
          />
        </View>
      </View>
    </Modal>
  );
}

const rm = StyleSheet.create({
  overlay:  { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet:    { backgroundColor: '#161616', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BORDER, maxHeight: '80%' },
  handle:   { width: 36, height: 4, borderRadius: 2, backgroundColor: '#4a3020', alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  header:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  title:    { color: TEXT, fontSize: 18, fontWeight: '700' },
  subtitle: { color: SUBTEXT, fontSize: 13, paddingHorizontal: 16, marginBottom: 4 },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  artwork:  { width: 48, height: 48, borderRadius: 6 },
  artworkFallback: { backgroundColor: CARD_BG, alignItems: 'center', justifyContent: 'center' },
  artworkInitial:  { color: ACCENT, fontSize: 18, fontWeight: '700' },
  info:     { flex: 1 },
  albumTitle:  { color: TEXT,   fontSize: 15, fontWeight: '600' },
  albumArtist: { color: SUBTEXT, fontSize: 13, marginTop: 2 },
  ratingBadge: { color: ACCENT, fontSize: 16, fontWeight: '700', width: 28, textAlign: 'right' },
  separator:   { height: StyleSheet.hairlineWidth, backgroundColor: BORDER },
});

// ─── Hero Stats ───────────────────────────────────────────────────────────────

function StatRow({ stats }: { stats: { label: string; value: string | number }[] }) {
  return (
    <View style={hs.row}>
      {stats.map((stat, i) => (
        <Fragment key={stat.label}>
          <View style={hs.box}>
            <Text style={hs.value}>{stat.value}</Text>
            <Text style={hs.label}>{stat.label}</Text>
          </View>
          {i < stats.length - 1 && <View style={hs.divider} />}
        </Fragment>
      ))}
    </View>
  );
}

const hs = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 8 },
  box:     { flex: 1, alignItems: 'center', gap: 3 },
  value:   { color: TEXT,    fontSize: 20, fontWeight: '700' },
  label:   { color: SUBTEXT, fontSize: 11, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'center' },
  divider: { width: StyleSheet.hairlineWidth, height: 32, backgroundColor: BORDER },
});

// ─── Rating distribution ──────────────────────────────────────────────────────

function RatingDistribution({
  loggedAlbums,
  onRatingPress,
}: {
  loggedAlbums: LoggedAlbum[];
  onRatingPress: (rating: number, albums: LoggedAlbum[]) => void;
}) {
  const distribution = Array.from({ length: 10 }, (_, i) => ({
    rating: i + 1,
    count: loggedAlbums.filter(a => a.rating === i + 1).length,
  }));
  const maxCount = Math.max(...distribution.map(d => d.count), 1);

  return (
    <View style={rd.wrap}>
      {[...distribution].reverse().map(({ rating, count }) => {
        const filled = count > 0 ? Math.max(count / maxCount, 0.02) : 0;
        const albums = loggedAlbums.filter(a => a.rating === rating);
        return (
          <Pressable
            key={rating}
            style={({ pressed }) => [rd.row, count > 0 && { opacity: pressed ? 0.7 : 1 }]}
            onPress={() => { if (count > 0) onRatingPress(rating, albums); }}
            disabled={count === 0}>
            <Text style={rd.ratingLabel}>{rating}</Text>
            <View style={rd.track}>
              <View style={[rd.fill, {
                flex: filled,
                opacity: 0.4 + (count / maxCount) * 0.6,
              }]} />
              {filled < 1 && <View style={{ flex: 1 - filled }} />}
            </View>
            <Text style={rd.countLabel}>{count}</Text>
          </Pressable>
        );
      })}
      <Text style={rd.hint}>Tap a bar to see albums</Text>
    </View>
  );
}

const rd = StyleSheet.create({
  wrap:        { gap: 8 },
  row:         { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ratingLabel: { color: SUBTEXT, fontSize: 13, fontWeight: '600', width: 18, textAlign: 'right' },
  track:       { flex: 1, height: 6, borderRadius: 3, backgroundColor: BORDER, overflow: 'hidden', flexDirection: 'row' },
  fill:        { height: 6, borderRadius: 3, backgroundColor: ACCENT },
  countLabel:  { color: TEXT, fontSize: 13, fontWeight: '600', width: 28, textAlign: 'right' },
  hint:        { color: SUBTEXT, fontSize: 12, marginTop: 6 },
});

// ─── Shared bar row ───────────────────────────────────────────────────────────

function BarRow({
  label,
  count,
  maxCount,
  colorIdx,
  pill = false,
}: {
  label: string;
  count: number;
  maxCount: number;
  colorIdx: number;
  pill?: boolean;
}) {
  const pct = maxCount > 0 ? Math.max(count / maxCount, 0.02) : 0;
  return (
    <View style={br.row}>
      {pill ? (
        <View style={[br.pill, { backgroundColor: TAG_COLORS[colorIdx % TAG_COLORS.length] }]}>
          <Text style={br.pillText} numberOfLines={1}>{label}</Text>
        </View>
      ) : (
        <Text style={br.label} numberOfLines={1}>{label}</Text>
      )}
      <View style={br.track}>
        <View style={[br.fill, { flex: pct, opacity: 0.45 + pct * 0.55 }]} />
        <View style={{ flex: 1 - pct }} />
      </View>
      <Text style={br.count}>{count}</Text>
    </View>
  );
}

const br = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  pill:     { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, minWidth: 110, alignItems: 'center' },
  pillText: { color: TEXT, fontSize: 13, fontWeight: '600' },
  label:    { color: TEXT, fontSize: 13, fontWeight: '500', width: 110 },
  track:    { flex: 1, height: 6, borderRadius: 3, backgroundColor: BORDER, overflow: 'hidden', flexDirection: 'row' },
  fill:     { height: 6, borderRadius: 3, backgroundColor: ACCENT },
  count:    { color: SUBTEXT, fontSize: 13, fontWeight: '600', width: 28, textAlign: 'right' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MyStatsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { loggedAlbums, isLoaded } = useAlbums();

  const [selectedRating, setSelectedRating]   = useState<number | null>(null);
  const [selectedAlbums, setSelectedAlbums]   = useState<LoggedAlbum[]>([]);
  const [countryCount,   setCountryCount]     = useState<number | '...' >('...');

  const cardBg = isDark ? CARD_BG : colors.card;

  // ── Hero stats ────────────────────────────────────────────────────────────
  const ratedAlbums    = loggedAlbums.filter(a => a.rating > 0);
  const avgRating      = ratedAlbums.length > 0
    ? (ratedAlbums.reduce((sum, a) => sum + a.rating, 0) / ratedAlbums.length).toFixed(1)
    : '—';
  const uniqueArtists  = new Set(loggedAlbums.map(a => a.artist)).size;
  const totalMs        = loggedAlbums.reduce((sum, a) => sum + (a.durationMs ?? 0), 0);
  const totalHours     = totalMs > 0 ? Math.round(totalMs / 3_600_000) : '—';

  // Current listening streak — consecutive calendar days with at least one log
  const listenDayKeys = new Set(
    loggedAlbums.map(a => {
      const d = new Date(a.dateLogged);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    })
  );
  let streakDays = 0;
  const today = new Date();
  for (let i = 0; i <= 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (listenDayKeys.has(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`)) {
      streakDays++;
    } else {
      break;
    }
  }

  const heroStats = [
    { label: 'Albums Logged',   value: loggedAlbums.length },
    { label: 'Listening Hours', value: totalHours },
    { label: 'Unique Artists',  value: uniqueArtists },
    { label: 'Countries',       value: countryCount },
    { label: 'Flip Streak',     value: '—' },
    { label: 'Streak Days',     value: streakDays > 0 ? streakDays : '—' },
  ];

  // ── Most logged artists ───────────────────────────────────────────────────
  const artistCounts = new Map<string, number>();
  for (const album of loggedAlbums) {
    if (!album.artist) continue;
    artistCounts.set(album.artist, (artistCounts.get(album.artist) ?? 0) + 1);
  }
  const topArtists     = [...artistCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxArtistCount = topArtists[0]?.[1] ?? 1;

  // ── Favourite genres ──────────────────────────────────────────────────────
  const genreCounts = new Map<string, number>();
  for (const album of loggedAlbums) {
    for (const tag of album.genreTags ?? []) {
      if (!MAIN_GENRES.has(tag)) continue;
      genreCounts.set(tag, (genreCounts.get(tag) ?? 0) + 1);
    }
  }
  const topGenres     = [...genreCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxGenreCount = topGenres[0]?.[1] ?? 1;
  const totalTagged   = loggedAlbums.filter(a => (a.genreTags?.length ?? 0) > 0).length;

  // Fetch country count — waits for albums to load, then runs once
  useEffect(() => {
    if (!isLoaded) return;
    if (loggedAlbums.length === 0) { setCountryCount(0); return; }
    const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
    const uniqueArtistList = [...new Set(loggedAlbums.map(a => a.artist).filter(Boolean))].slice(0, 100);
    supabase.auth.getSession().then(({ data: { session } }) => {
      const token = session?.access_token;
      if (!token) { setCountryCount(0); return; }
      fetch(`${API_URL}/api/stats/artist-countries?artists=${encodeURIComponent(uniqueArtistList.join(','))}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.ok ? r.json() : null)
        .then(data => setCountryCount(data?.total ?? 0))
        .catch(() => setCountryCount(0));
    });
  }, [isLoaded]);

  function handleRatingPress(rating: number, albums: LoggedAlbum[]) {
    setSelectedAlbums(albums);
    setSelectedRating(rating);
  }

  function handleAlbumPress(album: LoggedAlbum) {
    router.push({
      pathname: '/album-detail',
      params: { id: album.id, title: album.title, artist: album.artist, year: String(album.year ?? ''), artworkUrl: album.artworkUrl ?? '' },
    } as any);
  }

  return (
    <>
      <RatedAlbumsModal
        rating={selectedRating}
        albums={selectedAlbums}
        onClose={() => setSelectedRating(null)}
        onAlbumPress={handleAlbumPress}
      />

      <ScrollView
        style={[s.container, { backgroundColor: colors.background }]}
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}>

        {/* ── Hero Stats ────────────────────────────────────────────────── */}
        <View style={[s.card, { backgroundColor: cardBg, borderColor: BORDER, padding: 0, overflow: 'hidden' }]}>
          <Text style={[s.cardTitle, { color: colors.textMuted, paddingHorizontal: 18, paddingTop: 18, marginBottom: 0 }]}>MY STATS</Text>
          <StatRow stats={heroStats.slice(0, 3)} />
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: BORDER, marginHorizontal: 8 }} />
          <StatRow stats={heroStats.slice(3)} />
        </View>

        {/* ── Rating Distribution ────────────────────────────────────────── */}
        <View style={[s.card, { backgroundColor: cardBg, borderColor: BORDER }]}>
          <View style={s.cardTitleRow}>
            <Text style={[s.cardTitle, { color: colors.textMuted, marginBottom: 0 }]}>RATING BREAKDOWN</Text>
            {ratedAlbums.length > 0 && <Text style={s.cardTitleValue}>{avgRating} avg</Text>}
          </View>
          {ratedAlbums.length > 0 ? (
            <RatingDistribution loggedAlbums={loggedAlbums} onRatingPress={handleRatingPress} />
          ) : (
            <EmptyState text="Rate some albums to see your breakdown." />
          )}
        </View>

        {/* ── Most Logged Artists ────────────────────────────────────────── */}
        <View style={[s.card, { backgroundColor: cardBg, borderColor: BORDER }]}>
          <Text style={[s.cardTitle, { color: colors.textMuted }]}>MOST LOGGED ARTISTS</Text>
          {topArtists.length > 0 ? (
            topArtists.map(([artist, count], i) => (
              <BarRow key={artist} label={artist} count={count} maxCount={maxArtistCount} colorIdx={i} />
            ))
          ) : (
            <EmptyState text="Log some albums to see your top artists." />
          )}
        </View>

        {/* ── Favourite Genres ───────────────────────────────────────────── */}
        <View style={[s.card, { backgroundColor: cardBg, borderColor: BORDER }]}>
          <Text style={[s.cardTitle, { color: colors.textMuted }]}>FAVOURITE GENRES</Text>
          {topGenres.length > 0 ? (
            <>
              {topGenres.map(([genre, count], i) => (
                <BarRow key={genre} label={genre} count={count} maxCount={maxGenreCount} colorIdx={i} pill />
              ))}
              <Text style={s.footnote}>Based on {totalTagged} of {loggedAlbums.length} logged albums</Text>
            </>
          ) : (
            <EmptyState text="Log more albums to see your top genres here." />
          )}
        </View>

      </ScrollView>
    </>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={s.emptyWrap}>
      <Text style={s.emptyText}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content:   { padding: 20, gap: 16 },

  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 18,
    flexShrink: 1,
  },

  cardTitleRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  cardTitleValue: { color: TEXT, fontSize: 15, fontWeight: '700' },

  footnote:  { color: SUBTEXT, fontSize: 12, marginTop: 6 },
  emptyWrap: { alignItems: 'center', paddingVertical: 16 },
  emptyText: { color: SUBTEXT, fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
