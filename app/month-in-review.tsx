import { useState, useEffect, Fragment } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Pressable, FlatList, Modal, useWindowDimensions,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { usePro } from '@/context/ProContext';
import { getProTheme, themeToColors } from '@/lib/proThemes';
import { useAlbums, LoggedAlbum } from '@/context/AlbumsContext';
import { supabase } from '@/lib/supabase';
import { AlbumReviewModal } from '@/components/AlbumReviewModal';

const CARD_BG = '#2E2018';
const BORDER  = '#2a1e14';
const TEXT    = '#f5e6c8';
const SUBTEXT = '#A08060';
const ACCENT  = '#D4A017';

const INITIAL_COLORS = ['#7a5018', '#5c3a10', '#6B4422', '#4a3218', '#8B6914', '#3d2a0e'];

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const DOW_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

const MAIN_GENRES = new Set([
  'Hip-Hop / Rap', 'Pop', 'Rock', 'Latin', 'Afrobeats',
  'R&B / Soul', 'Electronic', 'Indie / Alternative', 'Metal',
  'Country', 'Jazz', 'Classical', 'Folk / Singer-Songwriter', 'Blues',
]);

// ─── Stats computation ────────────────────────────────────────────────────────

function computeMonthStats(albums: LoggedAlbum[], selectedYear: number) {
  const rated = albums.filter(a => a.rating > 0);
  const avgRating = rated.length > 0
    ? (rated.reduce((s, a) => s + a.rating, 0) / rated.length).toFixed(1) : '—';
  const totalMs = albums.reduce((s, a) => s + (a.durationMs ?? 0), 0);
  const hours = totalMs > 0 ? Math.round(totalMs / 3_600_000) : 0;
  const artistSet = new Set(albums.map(a => a.artist));

  // Top artists by count + avg rating
  const artistCountMap = new Map<string, number>();
  const artistRatingsMap = new Map<string, number[]>();
  for (const a of albums) {
    artistCountMap.set(a.artist, (artistCountMap.get(a.artist) ?? 0) + 1);
    if (a.rating > 0) {
      if (!artistRatingsMap.has(a.artist)) artistRatingsMap.set(a.artist, []);
      artistRatingsMap.get(a.artist)!.push(a.rating);
    }
  }
  const topArtists = [...artistCountMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([artist, count]) => {
      const ratings = artistRatingsMap.get(artist) ?? [];
      const avg = ratings.length > 0 ? ratings.reduce((s, r) => s + r, 0) / ratings.length : null;
      return { artist, count, avg };
    });

  const topArtistsByRating = [...artistRatingsMap.entries()]
    .filter(([, ratings]) => ratings.length >= 2)
    .map(([artist, ratings]) => ({
      artist,
      count: artistCountMap.get(artist) ?? 0,
      avg: ratings.reduce((s, r) => s + r, 0) / ratings.length,
    }))
    .sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))
    .slice(0, 12);

  // Top genres
  const genreCountMap = new Map<string, number>();
  for (const a of albums) {
    const g = (a.genreTags ?? []).find(t => MAIN_GENRES.has(t));
    if (g) genreCountMap.set(g, (genreCountMap.get(g) ?? 0) + 1);
  }
  const topGenres = [...genreCountMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  // First album
  const sorted = [...albums].sort((a, b) => new Date(a.dateLogged).getTime() - new Date(b.dateLogged).getTime());
  const firstAlbum = sorted[0] ?? null;
  const lastAlbum  = sorted.length > 1 ? sorted[sorted.length - 1] : null;

  // Day of week counts (Mon=0 … Sun=6)
  const dowCounts: number[] = Array(7).fill(0);
  for (const a of albums) {
    const d = new Date(a.dateLogged);
    dowCounts[(d.getDay() + 6) % 7]++;
  }

  // Highest rated — split by release year
  const buildTop = (list: LoggedAlbum[]) => {
    const seen = new Set<string>();
    return [...list]
      .filter(a => a.rating > 0)
      .sort((a, b) => b.rating - a.rating)
      .filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true; })
      .slice(0, 20);
  };
  const highestRatedThisYear = buildTop(albums.filter(a => a.year === selectedYear));
  const highestRatedPrevious = buildTop(albums.filter(a => a.year < selectedYear));

  const reviewCount = albums.filter(a => a.review && a.review.trim().length > 0).length;

  return {
    avgRating, hours, artistCount: artistSet.size, reviewCount,
    topArtists, topArtistsByRating, topGenres, firstAlbum, lastAlbum, dowCounts,
    highestRatedThisYear, highestRatedPrevious,
  };
}

// ─── StatRow ─────────────────────────────────────────────────────────────────

function StatRow({ stats, textColor = TEXT, subtextColor = SUBTEXT, borderColor = BORDER }: {
  stats: { label: string; value: string | number; onPress?: () => void }[];
  textColor?: string; subtextColor?: string; borderColor?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 8 }}>
      {stats.map((stat, i) => (
        <Fragment key={stat.label}>
          <Pressable
            style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 3, opacity: stat.onPress && pressed ? 0.6 : 1 })}
            onPress={stat.onPress}
            disabled={!stat.onPress}>
            <Text style={{ color: textColor, fontSize: 20, fontWeight: '700' }}>{stat.value}</Text>
            <Text style={{ color: subtextColor, fontSize: 11, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'center' }}>{stat.label}</Text>
          </Pressable>
          {i < stats.length - 1 && <View style={{ width: StyleSheet.hairlineWidth, height: 32, backgroundColor: borderColor }} />}
        </Fragment>
      ))}
    </View>
  );
}

// ─── RatingDistribution ───────────────────────────────────────────────────────

function RatingDistribution({ albums, onRatingPress, tint = ACCENT, textColor = TEXT, subtextColor = SUBTEXT, trackColor = BORDER }: {
  albums: LoggedAlbum[];
  onRatingPress: (rating: number, list: LoggedAlbum[]) => void;
  tint?: string; textColor?: string; subtextColor?: string; trackColor?: string;
}) {
  const dist = Array.from({ length: 10 }, (_, i) => ({
    rating: i + 1,
    count: albums.filter(a => a.rating === i + 1).length,
  }));
  const maxCount = Math.max(...dist.map(d => d.count), 1);
  return (
    <View style={{ gap: 8 }}>
      {[...dist].reverse().map(({ rating, count }) => {
        const filled = count > 0 ? Math.max(count / maxCount, 0.02) : 0;
        return (
          <Pressable
            key={rating}
            style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 10 }, count > 0 && { opacity: pressed ? 0.7 : 1 }]}
            onPress={() => { if (count > 0) onRatingPress(rating, albums.filter(a => a.rating === rating)); }}
            disabled={count === 0}>
            <Text style={{ color: subtextColor, fontSize: 13, fontWeight: '600', width: 18, textAlign: 'right' }}>{rating}</Text>
            <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: trackColor, overflow: 'hidden', flexDirection: 'row' }}>
              <View style={{ flex: filled, height: 6, borderRadius: 3, backgroundColor: tint, opacity: 0.4 + (count / maxCount) * 0.6 }} />
              {filled < 1 && <View style={{ flex: 1 - filled }} />}
            </View>
            <Text style={{ color: textColor, fontSize: 13, fontWeight: '600', width: 28, textAlign: 'right' }}>{count}</Text>
          </Pressable>
        );
      })}
      <Text style={{ color: subtextColor, fontSize: 12, marginTop: 6 }}>Tap a bar to see albums</Text>
    </View>
  );
}

// ─── Album list modal ─────────────────────────────────────────────────────────

function AlbumListModal({ title, albums, onClose, onAlbumPress, onReviewPress, themeColors }: {
  title: string | null; albums: LoggedAlbum[];
  onClose: () => void; onAlbumPress: (a: LoggedAlbum) => void;
  onReviewPress?: (a: LoggedAlbum) => void;
  themeColors?: { background: string; surface: string; text: string; subtext: string; tint: string; border: string };
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const COLS = 3; const GAP = 10; const PAD = 16;
  const cw = (width - PAD * 2 - GAP * (COLS - 1)) / COLS;
  const bg     = themeColors?.background ?? '#161616';
  const txt    = themeColors?.text       ?? TEXT;
  const sub    = themeColors?.subtext    ?? SUBTEXT;
  const tint   = themeColors?.tint       ?? ACCENT;
  const border = themeColors?.border     ?? BORDER;
  const surface= themeColors?.surface    ?? CARD_BG;
  return (
    <Modal visible={title !== null} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={{ backgroundColor: bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border, maxHeight: '85%', paddingBottom: Math.max(insets.bottom + 16, 32) }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: border, alignSelf: 'center', marginTop: 10, marginBottom: 4 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 }}>
            <Text style={{ color: txt, fontSize: 18, fontWeight: '700', flex: 1 }}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={12}><FontAwesome name="times" size={16} color={sub} /></Pressable>
          </View>
          <Text style={{ color: sub, fontSize: 13, paddingHorizontal: 16, marginBottom: 8 }}>
            {albums.length} album{albums.length !== 1 ? 's' : ''}
          </Text>
          <FlatList
            data={albums}
            keyExtractor={a => a.id + a.dateLogged}
            numColumns={COLS}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: PAD, paddingTop: 12, paddingBottom: 8 }}
            columnWrapperStyle={{ gap: GAP, marginBottom: GAP }}
            renderItem={({ item }) => (
              <Pressable style={({ pressed }) => [{ width: cw, opacity: pressed ? 0.7 : 1 }]}
                onPress={() => {
                  if (onReviewPress) { onReviewPress(item); }
                  else { onClose(); setTimeout(() => onAlbumPress(item), 300); }
                }}>
                {item.artworkUrl
                  ? <ExpoImage source={{ uri: item.artworkUrl }} style={{ width: cw, height: cw, borderRadius: 8 }} contentFit="cover" cachePolicy="disk" />
                  : <View style={{ width: cw, height: cw, borderRadius: 8, backgroundColor: surface, justifyContent: 'center', alignItems: 'center' }}>
                      <FontAwesome name="music" size={cw * 0.28} color={sub} />
                    </View>}
                <Text style={{ color: txt, fontSize: 12, fontWeight: '600', marginTop: 4 }} numberOfLines={1}>{item.title}</Text>
                <Text style={{ color: sub, fontSize: 11, marginTop: 1 }} numberOfLines={1}>{item.artist}</Text>
                {item.rating > 0 && <View style={{ marginTop: 4 }}><VolumeBadge rating={item.rating} tint={tint} /></View>}
              </Pressable>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

// ─── Volume badge ─────────────────────────────────────────────────────────────

function VolumeBadge({ rating, tint = ACCENT }: { rating: number; tint?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
      <FontAwesome name="volume-up" size={9} color={tint} />
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 1 }}>
        {Array.from({ length: 10 }, (_, i) => {
          const h = Math.round(3 + i * 1);
          return <View key={i} style={{ width: 2, height: h, borderRadius: 1, backgroundColor: i + 1 <= rating ? tint : '#2a1e14' }} />;
        })}
      </View>
      <Text style={{ color: tint, fontSize: 10, fontWeight: '700' }}>{rating}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MonthInReviewScreen() {
  const colorScheme = useColorScheme();
  const { isPro, proTheme: ownProTheme } = usePro();
  const params = useLocalSearchParams<{ year?: string; month?: string; userId?: string; displayName?: string; proTheme?: string }>();
  const viewedUserId = params.userId ?? null;
  const activeThemeKey = viewedUserId
    ? (params.proTheme || 'default')
    : (isPro ? ownProTheme : 'default');
  const colors = (activeThemeKey && activeThemeKey !== 'default')
    ? themeToColors(getProTheme(activeThemeKey))
    : Colors[colorScheme ?? 'dark'];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { loggedAlbums: ownAlbums } = useAlbums();

  // Fetch other user's albums if viewing someone else
  const [otherAlbums, setOtherAlbums] = useState<LoggedAlbum[]>([]);
  const [otherLoaded, setOtherLoaded] = useState(false);
  useEffect(() => {
    if (!viewedUserId) return;
    setOtherLoaded(false);
    supabase
      .from('user_albums')
      .select('spotify_id, title, artist, artwork_url, rating, year, listened_at, duration_ms, genre_tags, re_listen_count, is_relistened')
      .eq('user_id', viewedUserId)
      .not('listened_at', 'is', null)
      .order('listened_at', { ascending: false })
      .then(({ data }) => {
        setOtherAlbums((data ?? []).map(r => ({
          id: r.spotify_id, title: r.title ?? '', artist: r.artist ?? '',
          year: r.year ?? 0, rating: r.rating ?? 0,
          dateLogged: r.listened_at ?? new Date().toISOString(),
          artworkUrl: r.artwork_url ?? undefined, coverColor: '#2E2018',
          durationMs: r.duration_ms ?? undefined, genreTags: r.genre_tags ?? [],
          reListenCount: r.re_listen_count ?? 0, isRelistened: r.is_relistened ?? false,
        })));
        setOtherLoaded(true);
      });
  }, [viewedUserId]);

  const loggedAlbums = viewedUserId ? otherAlbums : ownAlbums;

  const { width: screenWidth } = useWindowDimensions();
  const cardBg = colors.surface;
  const cardBorder = colors.border;
  const tint = colors.tint;
  const txt = colors.text;
  const sub = colors.subtext;
  const muted = colors.textMuted;

  // Build months with data
  const monthsWithData = (() => {
    const seen = new Set<string>();
    const list: { year: number; month: number }[] = [];
    for (const a of loggedAlbums) {
      const d = new Date(a.dateLogged);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!seen.has(key)) { seen.add(key); list.push({ year: d.getFullYear(), month: d.getMonth() }); }
    }
    return list.sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month);
  })();

  const defaultMonth = monthsWithData[0] ?? { year: new Date().getFullYear(), month: new Date().getMonth() };
  const initYear  = params.year  ? parseInt(params.year)  : defaultMonth.year;
  const initMonth = params.month !== undefined ? parseInt(params.month) : defaultMonth.month;

  const [selectedYear,  setSelectedYear]  = useState(initYear);
  const [selectedMonth, setSelectedMonth] = useState(initMonth);
  const [highestRatedView, setHighestRatedView] = useState<'thisYear' | 'previous'>('thisYear');
  const [artistView, setArtistView] = useState<'listend' | 'rated'>('listend');
  const [modal, setModal] = useState<{ title: string; albums: LoggedAlbum[] } | null>(null);
  const [reviewAlbum, setReviewAlbum] = useState<LoggedAlbum | null>(null);
  const [ownUsername, setOwnUsername] = useState('');
  const [artistImages, setArtistImages] = useState<Record<string, string>>({});

  const monthAlbums = loggedAlbums.filter(a => {
    const d = new Date(a.dateLogged);
    return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
  });

  const stats = computeMonthStats(monthAlbums, selectedYear);
  const maxDow = Math.max(...stats.dowCounts, 1);

  // Fetch artist images
  useEffect(() => {
    const allArtists = [...stats.topArtists, ...stats.topArtistsByRating];
    if (allArtists.length === 0) return;
    const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
    const uniqueNames = [...new Set(allArtists.map(a => a.artist))];
    const names = uniqueNames;
    Promise.allSettled(
      names.map(name =>
        fetch(`${API_URL}/search?q=${encodeURIComponent(name)}&type=artist`)
          .then(r => r.ok ? r.json() : [])
          .then((results: { artworkUrl: string }[]) => ({ name, url: results[0]?.artworkUrl ?? '' }))
          .catch(() => ({ name, url: '' }))
      )
    ).then(results => {
      const images: Record<string, string> = {};
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.url) images[r.value.name] = r.value.url;
      }
      if (Object.keys(images).length > 0) setArtistImages(prev => ({ ...prev, ...images }));
    });
  }, [selectedYear, selectedMonth, loggedAlbums.length]);
  const maxGenre = stats.topGenres[0]?.[1] ?? 1;
  const maxArtist = stats.topArtists[0]?.count ?? 1;

  useEffect(() => {
    if (viewedUserId) return;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user?.id) return;
      const { data } = await supabase.from('profiles').select('username').eq('id', session.user.id).single();
      if (data?.username) setOwnUsername(data.username);
    });
  }, [viewedUserId]);

  function goToAlbum(a: LoggedAlbum) {
    router.push({ pathname: '/album-detail', params: { id: a.id, title: a.title, artist: a.artist, year: String(a.year), artworkUrl: a.artworkUrl ?? '' } } as any);
  }

  return (
    <>
      <Stack.Screen options={{
        title: viewedUserId && params.displayName ? `${params.displayName}'s Monthly Stats` : 'Monthly Stats',
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }} />

      <AlbumListModal
        title={modal?.title ?? null}
        albums={modal?.albums ?? []}
        onClose={() => setModal(null)}
        onAlbumPress={a => { setModal(null); setTimeout(() => goToAlbum(a), 300); }}
        onReviewPress={modal?.title?.includes('Review') ? a => { setModal(null); setReviewAlbum(a); } : undefined}
        themeColors={colors}
      />

      {reviewAlbum && (
        <AlbumReviewModal
          album={reviewAlbum}
          username={viewedUserId ? (params.displayName ?? '') : ownUsername}
          onClose={() => setReviewAlbum(null)}
          onAlbumPress={() => { setReviewAlbum(null); setTimeout(() => goToAlbum(reviewAlbum), 300); }}
          isDark={colorScheme === 'dark'}
          colors={colors}
        />
      )}

      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 48, gap: 16 }}
        showsVerticalScrollIndicator={false}>

        {viewedUserId && !otherLoaded ? (
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <Text style={{ color: sub, fontSize: 15 }}>Loading...</Text>
          </View>
        ) : monthsWithData.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <Text style={{ color: sub, fontSize: 15 }}>No listening history yet.</Text>
          </View>
        ) : (
          <>
            {/* Month picker */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              {monthsWithData.map(({ year, month }) => {
                const isSelected = year === selectedYear && month === selectedMonth;
                return (
                  <Pressable
                    key={`${year}-${month}`}
                    onPress={() => { setSelectedYear(year); setSelectedMonth(month); }}
                    style={{
                      paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
                      backgroundColor: isSelected ? tint : cardBg,
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: isSelected ? tint : cardBorder,
                    }}>
                    <Text style={{ color: isSelected ? '#fff' : sub, fontSize: 13, fontWeight: '700' }}>
                      {MONTH_NAMES[month].slice(0, 3)} {year}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {monthAlbums.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Text style={{ color: sub, fontSize: 15 }}>
                  No albums logged in {MONTH_NAMES[selectedMonth]} {selectedYear}.
                </Text>
              </View>
            ) : (
              <>
                {/* ── Hero ── */}
                <View style={[st.card, { backgroundColor: cardBg, borderColor: cardBorder, alignItems: 'center', gap: 6 }]}>
                  <Text style={{ color: muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' }}>
                    {MONTH_NAMES[selectedMonth]} {selectedYear}
                  </Text>
                  <Text style={{ color: tint, fontSize: 64, fontWeight: '800', letterSpacing: -3 }}>{monthAlbums.length}</Text>
                  <Text style={{ color: sub, fontSize: 14 }}>albums logged</Text>
                </View>

                {/* ── Stats strip ── */}
                <View style={[st.card, { backgroundColor: cardBg, borderColor: cardBorder, padding: 0, overflow: 'hidden' }]}>
                  <StatRow
                    stats={[
                      { label: 'Albums', value: monthAlbums.length, onPress: monthAlbums.length > 0 ? () => setModal({ title: `${MONTH_NAMES[selectedMonth]} Albums`, albums: monthAlbums }) : undefined },
                      { label: 'Reviews', value: stats.reviewCount || '—', onPress: stats.reviewCount > 0 ? () => setModal({ title: `${MONTH_NAMES[selectedMonth]} Reviews`, albums: monthAlbums.filter(a => a.review && a.review.trim().length > 0) }) : undefined },
                      { label: 'Hours', value: stats.hours || '—' },
                    ]}
                    textColor={txt} subtextColor={sub} borderColor={cardBorder}
                  />
                </View>

                {/* ── Day of Week ── */}
                <View style={[st.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                  <Text style={[st.label, { color: muted, marginBottom: 14 }]}>MOST ACTIVE DAY</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
                    {DOW_LABELS.map((lbl, i) => {
                      const h = maxDow > 0 ? Math.max((stats.dowCounts[i] / maxDow) * 60, stats.dowCounts[i] > 0 ? 4 : 0) : 0;
                      const isTop = stats.dowCounts[i] === maxDow && maxDow > 0;
                      return (
                        <View key={i} style={{ flex: 1, alignItems: 'center', gap: 5 }}>
                          {stats.dowCounts[i] > 0 && (
                            <Text style={{ color: isTop ? tint : sub, fontSize: 10, fontWeight: '700' }}>{stats.dowCounts[i]}</Text>
                          )}
                          <View style={{ height: Math.max(h, 4), width: '100%', borderRadius: 3, backgroundColor: isTop ? tint : '#4a3020' }} />
                          <Text style={{ color: isTop ? tint : sub, fontSize: 10, fontWeight: isTop ? '700' : '500' }}>{lbl}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>

                {/* ── Highest Rated ── */}
                {(stats.highestRatedThisYear.length > 0 || stats.highestRatedPrevious.length > 0) && (
                  <View style={[st.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <Text style={[st.label, { color: muted, flexShrink: 1, marginRight: 10 }]}>HIGHEST RATED</Text>
                      <View style={{ flexDirection: 'row', backgroundColor: cardBorder, borderRadius: 8, padding: 2 }}>
                        {(['thisYear', 'previous'] as const).map(v => (
                          <Pressable
                            key={v}
                            style={[{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 7 }, highestRatedView === v && { backgroundColor: tint }]}
                            onPress={() => setHighestRatedView(v)}>
                            <Text style={[{ color: sub, fontSize: 12, fontWeight: '600' }, highestRatedView === v && { color: '#0F0A07', fontWeight: '700' }]}>
                              {v === 'thisYear' ? String(selectedYear) : 'Previous'}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                    {(() => {
                      const list = highestRatedView === 'thisYear' ? stats.highestRatedThisYear : stats.highestRatedPrevious;
                      if (list.length === 0) {
                        return (
                          <Text style={{ color: sub, fontSize: 13, textAlign: 'center', paddingVertical: 12 }}>
                            {highestRatedView === 'thisYear' ? `No rated ${selectedYear} releases this month.` : 'No rated albums from previous years this month.'}
                          </Text>
                        );
                      }
                      return (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                          {list.map(album => (
                            <Pressable key={album.id + album.dateLogged} onPress={() => goToAlbum(album)}
                              style={({ pressed }) => ({ width: 90, opacity: pressed ? 0.7 : 1 })}>
                              {album.artworkUrl
                                ? <ExpoImage source={{ uri: album.artworkUrl }} style={{ width: 90, height: 90, borderRadius: 8 }} contentFit="cover" cachePolicy="disk" />
                                : <View style={{ width: 90, height: 90, borderRadius: 8, backgroundColor: CARD_BG, alignItems: 'center', justifyContent: 'center' }}>
                                    <FontAwesome name="music" size={28} color={SUBTEXT} />
                                  </View>}
                              <VolumeBadge rating={album.rating} tint={tint} />
                              <Text style={{ color: txt, fontSize: 11, fontWeight: '600', marginTop: 4 }} numberOfLines={1}>{album.title}</Text>
                              <Text style={{ color: sub, fontSize: 10, marginTop: 1 }} numberOfLines={1}>{album.artist}</Text>
                              <Text style={{ color: muted, fontSize: 10, marginTop: 1 }}>{album.year}</Text>
                            </Pressable>
                          ))}
                        </ScrollView>
                      );
                    })()}
                  </View>
                )}

                {/* ── Rating Distribution ── */}
                {monthAlbums.filter(a => a.rating > 0).length > 0 && (
                  <View style={[st.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                    <Text style={[st.label, { color: muted, marginBottom: 14 }]}>RATING DISTRIBUTION</Text>
                    <RatingDistribution
                      albums={monthAlbums}
                      onRatingPress={(rating, list) => setModal({ title: `Rated ${rating}`, albums: list })}
                      tint={tint} textColor={txt} subtextColor={sub} trackColor={cardBorder}
                    />
                  </View>
                )}

                {/* ── Top Artists ── */}
                {(stats.topArtists.length > 0 || stats.topArtistsByRating.length > 0) && (
                  <View style={[st.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <Text style={[st.label, { color: muted, flexShrink: 1, marginRight: 10 }]}>TOP ARTISTS</Text>
                      <View style={{ flexDirection: 'row', backgroundColor: cardBorder, borderRadius: 8, padding: 2 }}>
                        {(['listend', 'rated'] as const).map(v => (
                          <Pressable
                            key={v}
                            style={[{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 7 }, artistView === v && { backgroundColor: tint }]}
                            onPress={() => setArtistView(v)}>
                            <Text style={[{ color: sub, fontSize: 12, fontWeight: '600' }, artistView === v && { color: '#0F0A07', fontWeight: '700' }]}>
                              {v === 'listend' ? 'Most Listend' : 'Highest Rated'}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                    {(() => {
                      const activeList = artistView === 'listend' ? stats.topArtists : stats.topArtistsByRating;
                      if (activeList.length === 0) {
                        return (
                          <Text style={{ color: sub, fontSize: 13, textAlign: 'center', paddingVertical: 12 }}>
                            Not enough rated data yet.
                          </Text>
                        );
                      }
                      const GAP = 10;
                      const cardW = Math.floor((screenWidth - 40 - 36 - GAP * 2) / 3);
                      const imgSize = cardW - 20;
                      const rows: typeof activeList[] = [];
                      for (let i = 0; i < activeList.length; i += 3) rows.push(activeList.slice(i, i + 3));
                      return (
                        <View style={{ gap: 16 }}>
                          {rows.map((row, ri) => (
                            <View key={ri} style={{ flexDirection: 'row', gap: GAP }}>
                              {row.map(({ artist, count, avg }) => {
                                const imgUrl = artistImages[artist];
                                const initial = artist.trim().charAt(0).toUpperCase();
                                const bgColor = INITIAL_COLORS[artist.charCodeAt(0) % INITIAL_COLORS.length];
                                const sublabel = artistView === 'rated' && avg !== null
                                  ? `avg ${(avg as number).toFixed(1)}`
                                  : `${count} album${count !== 1 ? 's' : ''}`;
                                return (
                                  <Pressable
                                    key={artist}
                                    onPress={() => setModal({ title: artist, albums: monthAlbums.filter(a => a.artist === artist) })}
                                    style={({ pressed }) => ({ width: cardW, alignItems: 'center', gap: 6, opacity: pressed ? 0.7 : 1 })}>
                                    {imgUrl
                                      ? <ExpoImage source={{ uri: imgUrl }} style={{ width: imgSize, height: imgSize, borderRadius: imgSize / 2 }} contentFit="cover" cachePolicy="disk" />
                                      : <View style={{ width: imgSize, height: imgSize, borderRadius: imgSize / 2, backgroundColor: bgColor, alignItems: 'center', justifyContent: 'center' }}>
                                          <Text style={{ color: '#f5e6c8', fontSize: imgSize * 0.38, fontWeight: '700' }}>{initial}</Text>
                                        </View>}
                                    <Text style={{ color: txt, fontSize: 12, fontWeight: '600', textAlign: 'center' }} numberOfLines={2}>{artist}</Text>
                                    <Text style={{ color: sub, fontSize: 11, fontWeight: '500', textAlign: 'center' }}>{sublabel}</Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                          ))}
                        </View>
                      );
                    })()}
                  </View>
                )}

                {/* ── Top Genres ── */}
                {stats.topGenres.length > 0 && (
                  <View style={[st.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                    <Text style={[st.label, { color: muted, marginBottom: 14 }]}>TOP GENRES</Text>
                    {stats.topGenres.map(([genre, count]) => (
                      <Pressable
                        key={genre}
                        onPress={() => setModal({ title: genre, albums: monthAlbums.filter(a => (a.genreTags ?? []).find(t => MAIN_GENRES.has(t)) === genre) })}
                        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, opacity: pressed ? 0.7 : 1 })}>
                        <Text style={{ color: txt, fontSize: 13, fontWeight: '500', width: 110 }} numberOfLines={1}>{genre}</Text>
                        <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: cardBorder, overflow: 'hidden', flexDirection: 'row' }}>
                          <View style={{ flex: Math.max(count / maxGenre, 0.02), height: 6, borderRadius: 3, backgroundColor: tint, opacity: 0.45 + (count / maxGenre) * 0.55 }} />
                          <View style={{ flex: 1 - Math.max(count / maxGenre, 0.02) }} />
                        </View>
                        <Text style={{ color: sub, fontSize: 13, fontWeight: '600', width: 28, textAlign: 'right' }}>{count}</Text>
                      </Pressable>
                    ))}
                    <Text style={{ color: sub, fontSize: 12, marginTop: 4 }}>Tap a genre to see albums</Text>
                  </View>
                )}

                {/* ── First album of the month ── */}
                {stats.firstAlbum && (
                  <Pressable
                    onPress={() => goToAlbum(stats.firstAlbum!)}
                    style={({ pressed }) => [st.card, { backgroundColor: cardBg, borderColor: cardBorder, flexDirection: 'row', gap: 14, alignItems: 'center', opacity: pressed ? 0.7 : 1 }]}>
                    {stats.firstAlbum.artworkUrl
                      ? <ExpoImage source={{ uri: stats.firstAlbum.artworkUrl }} style={{ width: 64, height: 64, borderRadius: 8 }} contentFit="cover" />
                      : <View style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: CARD_BG, alignItems: 'center', justifyContent: 'center' }}><FontAwesome name="music" size={24} color={SUBTEXT} /></View>}
                    <View style={{ flex: 1 }}>
                      <Text style={[st.label, { color: muted, marginBottom: 6 }]}>FIRST ALBUM THIS MONTH</Text>
                      <Text style={{ color: txt, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>{stats.firstAlbum.title}</Text>
                      <Text style={{ color: sub, fontSize: 13 }} numberOfLines={1}>{stats.firstAlbum.artist}</Text>
                    </View>
                    {stats.firstAlbum.rating > 0 && (
                      <Text style={{ color: tint, fontSize: 22, fontWeight: '800' }}>{stats.firstAlbum.rating}</Text>
                    )}
                  </Pressable>
                )}

                {/* ── Last album of the month ── */}
                {stats.lastAlbum && (
                  <Pressable
                    onPress={() => goToAlbum(stats.lastAlbum!)}
                    style={({ pressed }) => [st.card, { backgroundColor: cardBg, borderColor: cardBorder, flexDirection: 'row', gap: 14, alignItems: 'center', opacity: pressed ? 0.7 : 1 }]}>
                    {stats.lastAlbum.artworkUrl
                      ? <ExpoImage source={{ uri: stats.lastAlbum.artworkUrl }} style={{ width: 64, height: 64, borderRadius: 8 }} contentFit="cover" />
                      : <View style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: CARD_BG, alignItems: 'center', justifyContent: 'center' }}><FontAwesome name="music" size={24} color={SUBTEXT} /></View>}
                    <View style={{ flex: 1 }}>
                      <Text style={[st.label, { color: muted, marginBottom: 6 }]}>LAST ALBUM THIS MONTH</Text>
                      <Text style={{ color: txt, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>{stats.lastAlbum.title}</Text>
                      <Text style={{ color: sub, fontSize: 13 }} numberOfLines={1}>{stats.lastAlbum.artist}</Text>
                    </View>
                    {stats.lastAlbum.rating > 0 && (
                      <Text style={{ color: tint, fontSize: 22, fontWeight: '800' }}>{stats.lastAlbum.rating}</Text>
                    )}
                  </Pressable>
                )}

                {/* ── All albums ── */}
                <View style={[st.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                  <Text style={[st.label, { color: muted }]}>ALL {monthAlbums.length} ALBUMS</Text>
                  <View style={{ marginTop: 12, gap: 0 }}>
                    {monthAlbums
                      .slice()
                      .sort((a, b) => new Date(b.dateLogged).getTime() - new Date(a.dateLogged).getTime())
                      .map((album, index) => (
                        <Pressable
                          key={album.id + album.dateLogged}
                          onPress={() => goToAlbum(album)}
                          style={({ pressed }) => ({
                            flexDirection: 'row', alignItems: 'center', gap: 12,
                            paddingVertical: 10,
                            borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
                            borderTopColor: cardBorder,
                            opacity: pressed ? 0.7 : 1,
                          })}>
                          {album.artworkUrl
                            ? <ExpoImage source={{ uri: album.artworkUrl }} style={{ width: 44, height: 44, borderRadius: 6 }} contentFit="cover" />
                            : <View style={{ width: 44, height: 44, borderRadius: 6, backgroundColor: CARD_BG }} />}
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: txt, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>{album.title}</Text>
                            <Text style={{ color: sub, fontSize: 12 }} numberOfLines={1}>{album.artist}</Text>
                          </View>
                          {album.rating > 0 && (
                            <Text style={{ color: tint, fontSize: 14, fontWeight: '800' }}>{album.rating}</Text>
                          )}
                        </Pressable>
                      ))}
                  </View>
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </>
  );
}

const st = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 18 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },
});
