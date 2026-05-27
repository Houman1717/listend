import { useState, useEffect, Fragment } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Pressable, FlatList,
  Modal, useWindowDimensions,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Svg, { Circle, Path } from 'react-native-svg';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { usePro } from '@/context/ProContext';
import { getProTheme, themeToColors } from '@/lib/proThemes';
import { useAlbums, LoggedAlbum } from '@/context/AlbumsContext';

// ─── Style constants (match my-stats.tsx) ─────────────────────────────────────

const CARD_BG  = '#2E2018';
const BORDER   = '#2a1e14';
const TEXT     = '#f5e6c8';
const SUBTEXT  = '#A08060';
const ACCENT   = '#D4A017';

const INITIAL_COLORS = ['#7a5018', '#5c3a10', '#6B4422', '#4a3218', '#8B6914', '#3d2a0e'];

const MAIN_GENRES = new Set([
  'Hip-Hop / Rap', 'Pop', 'Rock', 'Latin', 'Afrobeats',
  'R&B / Soul', 'Electronic', 'Indie / Alternative', 'Metal',
  'Country', 'Jazz', 'Classical', 'Folk / Singer-Songwriter', 'Blues',
]);

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DOW_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// ─── Data helpers ──────────────────────────────────────────────────────────────

function computeYearStats(albums: LoggedAlbum[]) {
  const sorted = [...albums].sort(
    (a, b) => new Date(a.dateLogged).getTime() - new Date(b.dateLogged).getTime(),
  );

  const rated = albums.filter(a => a.rating > 0);
  const avgRating = rated.length > 0
    ? (rated.reduce((s, a) => s + a.rating, 0) / rated.length).toFixed(1)
    : '—';
  const totalMs = albums.reduce((s, a) => s + (a.durationMs ?? 0), 0);
  const hours = totalMs > 0 ? Math.round(totalMs / 3_600_000) : 0;
  const reviewCount = albums.filter(a => a.review && a.review.trim().length > 0).length;

  // Monthly counts
  const monthlyCounts: number[] = Array(12).fill(0);
  const dowCounts: number[] = Array(7).fill(0); // Mon=0 … Sun=6
  for (const a of albums) {
    const d = new Date(a.dateLogged);
    monthlyCounts[d.getMonth()]++;
    // JS: 0=Sun … 6=Sat → remap to Mon=0 … Sun=6
    dowCounts[(d.getDay() + 6) % 7]++;
  }

  // Milestones
  const firstAlbum = sorted[0] ?? null;
  const lastAlbum = sorted[sorted.length - 1] ?? null;
  const album10 = sorted[9] ?? null;
  const album25 = sorted[24] ?? null;
  const album50 = sorted[49] ?? null;
  const album100 = sorted[99] ?? null;

  // Highest rated (top 12, deduplicated by id)
  const seen = new Set<string>();
  const highestRated = [...rated]
    .sort((a, b) => b.rating - a.rating || new Date(b.dateLogged).getTime() - new Date(a.dateLogged).getTime())
    .filter(a => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    })
    .slice(0, 12);

  // New releases vs older (album.year === selectedYear)
  // We pass the year in separately
  const relistens = albums.filter(a => a.isRelistened).length;
  const firstListens = albums.length - relistens;

  // Most re-listened albums this year (only those flagged as re-listens)
  const mostRelistened = albums
    .filter(a => a.isRelistened && (a.reListenCount ?? 0) > 0)
    .sort((a, b) => (b.reListenCount ?? 0) - (a.reListenCount ?? 0))
    .slice(0, 10);

  // Rating distribution
  const ratingDist = Array.from({ length: 10 }, (_, i) => ({
    rating: i + 1,
    count: albums.filter(a => a.rating === i + 1).length,
  }));

  // Top artists by count
  const artistCountMap = new Map<string, number>();
  const artistRatingMap = new Map<string, number[]>();
  for (const a of albums) {
    artistCountMap.set(a.artist, (artistCountMap.get(a.artist) ?? 0) + 1);
    if (a.rating > 0) {
      if (!artistRatingMap.has(a.artist)) artistRatingMap.set(a.artist, []);
      artistRatingMap.get(a.artist)!.push(a.rating);
    }
  }
  const topArtistsByCount = [...artistCountMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([artist, count]) => ({ artist, count }));
  const topArtistsByRating = [...artistRatingMap.entries()]
    .filter(([, ratings]) => ratings.length >= 2)
    .map(([artist, ratings]) => ({
      artist,
      count: artistCountMap.get(artist) ?? 0,
      avg: ratings.reduce((s, r) => s + r, 0) / ratings.length,
    }))
    .sort((a, b) => b.avg - a.avg || b.count - a.count)
    .slice(0, 12);

  // Top genres
  const genreCountMap = new Map<string, number>();
  for (const a of albums) {
    const g = (a.genreTags ?? []).find(t => MAIN_GENRES.has(t));
    if (g) genreCountMap.set(g, (genreCountMap.get(g) ?? 0) + 1);
  }
  const topGenres = [...genreCountMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([genre, count]) => ({ genre, count }));

  return {
    avgRating, hours, reviewCount, monthlyCounts, dowCounts,
    firstAlbum, lastAlbum, album10, album25, album50, album100,
    highestRated, relistens, firstListens, mostRelistened,
    ratingDist, topArtistsByCount, topArtistsByRating, topGenres,
  };
}

// ─── StatRow ─────────────────────────────────────────────────────────────────

function StatRow({ stats, textColor = TEXT, subtextColor = SUBTEXT, borderColor = BORDER }: {
  stats: { label: string; value: string | number }[];
  textColor?: string; subtextColor?: string; borderColor?: string;
}) {
  return (
    <View style={hs.row}>
      {stats.map((stat, i) => (
        <Fragment key={stat.label}>
          <View style={hs.box}>
            <Text style={[hs.value, { color: textColor }]}>{stat.value}</Text>
            <Text style={[hs.lbl, { color: subtextColor }]}>{stat.label}</Text>
          </View>
          {i < stats.length - 1 && <View style={[hs.divider, { backgroundColor: borderColor }]} />}
        </Fragment>
      ))}
    </View>
  );
}

const hs = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 8 },
  box: { flex: 1, alignItems: 'center', gap: 3 },
  value: { color: TEXT, fontSize: 20, fontWeight: '700' },
  lbl: { color: SUBTEXT, fontSize: 11, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'center' },
  divider: { width: StyleSheet.hairlineWidth, height: 32, backgroundColor: BORDER },
});

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

// ─── BarRow ───────────────────────────────────────────────────────────────────

function BarRow({ label, count, maxCount, tint = ACCENT, textColor = TEXT, subtextColor = SUBTEXT, trackColor = BORDER }: {
  label: string; count: number; maxCount: number;
  tint?: string; textColor?: string; subtextColor?: string; trackColor?: string;
}) {
  const pct = maxCount > 0 ? Math.max(count / maxCount, 0.02) : 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <Text style={{ color: textColor, fontSize: 13, fontWeight: '500', width: 110 }} numberOfLines={1}>{label}</Text>
      <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: trackColor, overflow: 'hidden', flexDirection: 'row' }}>
        <View style={{ flex: pct, height: 6, borderRadius: 3, backgroundColor: tint, opacity: 0.45 + pct * 0.55 }} />
        <View style={{ flex: 1 - pct }} />
      </View>
      <Text style={{ color: subtextColor, fontSize: 13, fontWeight: '600', width: 28, textAlign: 'right' }}>{count}</Text>
    </View>
  );
}

// ─── ArtistGridCard ───────────────────────────────────────────────────────────

function ArtistGridCard({ artist, label, imageUrl, onPress, cardW, textColor = TEXT, subtextColor = SUBTEXT }: {
  artist: string; label: string; imageUrl?: string; onPress: () => void; cardW: number;
  textColor?: string; subtextColor?: string;
}) {
  const imgSize = cardW - 20;
  const initial = artist.trim().charAt(0).toUpperCase();
  const bgColor = INITIAL_COLORS[artist.charCodeAt(0) % INITIAL_COLORS.length];
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ width: cardW, alignItems: 'center', gap: 6, opacity: pressed ? 0.7 : 1 }]}>
      {imageUrl ? (
        <ExpoImage
          source={{ uri: imageUrl }}
          style={{ width: imgSize, height: imgSize, borderRadius: imgSize / 2 }}
          contentFit="cover"
          cachePolicy="disk"
        />
      ) : (
        <View style={{ width: imgSize, height: imgSize, borderRadius: imgSize / 2, backgroundColor: bgColor, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#f5e6c8', fontSize: imgSize * 0.38, fontWeight: '700' }}>{initial}</Text>
        </View>
      )}
      <Text style={{ color: textColor, fontSize: 12, fontWeight: '600', textAlign: 'center' }} numberOfLines={2}>{artist}</Text>
      <Text style={{ color: subtextColor, fontSize: 11, fontWeight: '500', textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );
}

// ─── Solid pie chart ──────────────────────────────────────────────────────────

function PieChart({ aCount, bCount, aColor, bColor, size = 110 }: {
  aCount: number; bCount: number;
  aColor: string; bColor: string;
  size?: number;
}) {
  const total = aCount + bCount;
  const aPct = total > 0 ? aCount / total : 0;
  const r = size / 2;
  const cx = r;
  const cy = r;

  // Start from the top (–90°) going clockwise
  const startAngle = -Math.PI / 2;
  const sweepAngle = aPct * 2 * Math.PI;
  const endAngle   = startAngle + sweepAngle;

  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy + r * Math.sin(endAngle);

  const largeArc = aPct > 0.5 ? 1 : 0;

  // Accent wedge (slice A)
  const slicePath = aPct >= 1
    ? `M ${cx} ${cy} m -${r} 0 a ${r} ${r} 0 1 1 ${r * 2} 0 a ${r} ${r} 0 1 1 -${r * 2} 0`
    : aPct <= 0
    ? ''
    : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;

  return (
    <Svg width={size} height={size}>
      {/* Full background circle */}
      <Circle cx={cx} cy={cy} r={r} fill={bColor} />
      {/* Accent slice on top */}
      {slicePath ? <Path d={slicePath} fill={aColor} /> : null}
    </Svg>
  );
}

// ─── Album list modal ─────────────────────────────────────────────────────────

function AlbumListModal({ title, albums, onClose, onAlbumPress, onTitlePress, themeColors }: {
  title: string | null; albums: LoggedAlbum[];
  onClose: () => void; onAlbumPress: (a: LoggedAlbum) => void;
  onTitlePress?: () => void;
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
            <Pressable onPress={onTitlePress} disabled={!onTitlePress} style={{ flex: 1, marginRight: 12 }}>
              <Text style={{ color: onTitlePress ? tint : txt, fontSize: 18, fontWeight: '700' }}>{title}</Text>
              {onTitlePress && <Text style={{ color: sub, fontSize: 12, marginTop: 2 }}>View artist profile →</Text>}
            </Pressable>
            <Pressable onPress={onClose} hitSlop={12}>
              <FontAwesome name="times" size={16} color={sub} />
            </Pressable>
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
              <Pressable
                style={({ pressed }) => [{ width: cw, opacity: pressed ? 0.7 : 1 }]}
                onPress={() => { onClose(); setTimeout(() => onAlbumPress(item), 300); }}>
                {item.artworkUrl
                  ? <ExpoImage source={{ uri: item.artworkUrl }} style={{ width: cw, height: cw, borderRadius: 8 }} contentFit="cover" cachePolicy="disk" />
                  : <View style={{ width: cw, height: cw, borderRadius: 8, backgroundColor: surface, justifyContent: 'center', alignItems: 'center' }}>
                      <FontAwesome name="music" size={cw * 0.28} color={sub} />
                    </View>}
                <Text style={{ color: txt, fontSize: 12, fontWeight: '600', marginTop: 4 }} numberOfLines={1}>{item.title}</Text>
                <Text style={{ color: sub, fontSize: 11, marginTop: 1 }} numberOfLines={1}>{item.artist}</Text>
                {item.rating > 0 && <VolumeBadge rating={item.rating} tint={tint} />}
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

// ─── Milestone card ───────────────────────────────────────────────────────────

function MilestoneCard({ album, label, onPress, colors }: {
  album: LoggedAlbum; label: string;
  onPress: () => void; colors: any;
}) {
  const d = new Date(album.dateLogged);
  const dateStr = `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ width: 130, opacity: pressed ? 0.7 : 1 })}>
      {album.artworkUrl
        ? <ExpoImage source={{ uri: album.artworkUrl }} style={{ width: 130, height: 130, borderRadius: 10 }} contentFit="cover" cachePolicy="disk" />
        : <View style={{ width: 130, height: 130, borderRadius: 10, backgroundColor: CARD_BG, alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome name="music" size={36} color={SUBTEXT} />
          </View>}
      <View style={{ marginTop: 8, gap: 2 }}>
        <Text style={{ color: colors.tint, fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>{label}</Text>
        <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }} numberOfLines={2}>{album.title}</Text>
        <Text style={{ color: colors.subtext, fontSize: 11 }} numberOfLines={1}>{album.artist}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 11 }}>{dateStr}</Text>
      </View>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function YearInReviewScreen() {
  const colorScheme = useColorScheme();
  const { isPro, proTheme } = usePro();
  const activeThemeKey = isPro ? proTheme : 'default';
  const colors = (activeThemeKey && activeThemeKey !== 'default')
    ? themeToColors(getProTheme(activeThemeKey))
    : Colors[colorScheme ?? 'dark'];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { loggedAlbums } = useAlbums();
  const { width: screenWidth } = useWindowDimensions();

  const cardBg = colors.surface;
  const cardBorder = colors.border;
  const tint = colors.tint;
  const txt = colors.text;
  const sub = colors.subtext;
  const muted = colors.textMuted;

  // ── Year list ──
  const availYears = [...new Set(loggedAlbums.map(a => new Date(a.dateLogged).getFullYear()))]
    .filter(y => y > 2000)
    .sort((a, b) => b - a);

  const [selectedYear, setSelectedYear] = useState<number>(availYears[0] ?? new Date().getFullYear());
  const [artistView, setArtistView] = useState<'listend' | 'rated'>('listend');
  const [highestRatedView, setHighestRatedView] = useState<'thisYear' | 'previous'>('thisYear');
  const [modal, setModal] = useState<{ title: string; albums: LoggedAlbum[]; onTitlePress?: () => void } | null>(null);
  const [artistImages, setArtistImages] = useState<Record<string, string>>({});

  const yearAlbums = loggedAlbums.filter(a => new Date(a.dateLogged).getFullYear() === selectedYear);
  const stats = computeYearStats(yearAlbums);

  // Fetch artist images — same /search?type=artist call as all-time stats
  useEffect(() => {
    if (yearAlbums.length === 0) return;
    const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
    const allNames = [...new Set([
      ...stats.topArtistsByCount.map(a => a.artist),
      ...stats.topArtistsByRating.map(a => a.artist),
    ])];
    if (allNames.length === 0) return;
    Promise.allSettled(
      allNames.map(name =>
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
  }, [selectedYear, loggedAlbums.length]);

  // All-time avg
  const allRated = loggedAlbums.filter(a => a.rating > 0);
  const allTimeAvg = allRated.length > 0
    ? (allRated.reduce((s, a) => s + a.rating, 0) / allRated.length)
    : null;

  function goToAlbum(a: LoggedAlbum) {
    router.push({
      pathname: '/album-detail',
      params: { id: a.id, title: a.title, artist: a.artist, year: String(a.year), artworkUrl: a.artworkUrl ?? '' },
    } as any);
  }

  function goToArtist(name: string) {
    router.push({ pathname: '/artist', params: { name } } as any);
  }

  // New releases vs older
  const newReleasesCount = yearAlbums.filter(a => a.year === selectedYear).length;
  const olderCount = yearAlbums.length - newReleasesCount;

  // Highest rated — split by release year vs previous
  const buildHighestRated = (albums: LoggedAlbum[]) => {
    const seen = new Set<string>();
    return [...albums]
      .filter(a => a.rating > 0)
      .sort((a, b) => b.rating - a.rating || new Date(b.dateLogged).getTime() - new Date(a.dateLogged).getTime())
      .filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true; })
      .slice(0, 20);
  };
  const highestRatedThisYear = buildHighestRated(loggedAlbums.filter(a => a.year === selectedYear));
  const highestRatedPrevious = buildHighestRated(loggedAlbums.filter(a => a.year < selectedYear));

  const maxMonthly = Math.max(...stats.monthlyCounts, 1);
  const avgPerMonth = yearAlbums.length > 0
    ? (yearAlbums.length / stats.monthlyCounts.filter(c => c > 0).length).toFixed(1)
    : '0';
  const maxDow = Math.max(...stats.dowCounts, 1);

  return (
    <>
      <Stack.Screen options={{
        title: 'Year in Review',
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }} />

      <AlbumListModal
        title={modal?.title ?? null}
        albums={modal?.albums ?? []}
        onClose={() => setModal(null)}
        onAlbumPress={a => { setModal(null); setTimeout(() => goToAlbum(a), 300); }}
        onTitlePress={modal?.onTitlePress}
        themeColors={colors}
      />

      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 48, gap: 16 }}
        showsVerticalScrollIndicator={false}>

        {availYears.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <Text style={{ color: sub, fontSize: 15 }}>No listening history yet.</Text>
          </View>
        ) : (
          <>
            {/* ── Year picker ── */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              {availYears.map(y => (
                <Pressable
                  key={y}
                  onPress={() => setSelectedYear(y)}
                  style={{
                    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20,
                    backgroundColor: selectedYear === y ? tint : cardBg,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: selectedYear === y ? tint : cardBorder,
                  }}>
                  <Text style={{ color: selectedYear === y ? '#fff' : sub, fontSize: 15, fontWeight: '700' }}>{y}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {yearAlbums.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Text style={{ color: sub, fontSize: 15 }}>No albums logged in {selectedYear}.</Text>
              </View>
            ) : (
              <>
                {/* ── Hero ── */}
                <View style={[st.card, { backgroundColor: cardBg, borderColor: cardBorder, alignItems: 'center', paddingVertical: 24 }]}>
                  <Text style={{ color: muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>
                    {selectedYear}
                  </Text>
                  <Text style={{ color: tint, fontSize: 80, fontWeight: '800', letterSpacing: -4, lineHeight: 88 }}>{yearAlbums.length}</Text>
                  <Text style={{ color: sub, fontSize: 14 }}>albums logged</Text>
                </View>

                {/* ── Stats strip ── */}
                <View style={[st.card, { backgroundColor: cardBg, borderColor: cardBorder, padding: 0, overflow: 'hidden' }]}>
                  <StatRow
                    stats={[
                      { label: 'Albums', value: yearAlbums.length },
                      { label: 'Reviews', value: stats.reviewCount || '—' },
                      { label: 'Hours', value: stats.hours || '—' },
                    ]}
                    textColor={txt}
                    subtextColor={sub}
                    borderColor={cardBorder}
                  />
                </View>

                {/* ── Monthly Activity ── */}
                <View style={[st.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                  <Text style={[st.label, { color: muted }]}>MONTHLY ACTIVITY</Text>

                  {/* Vertical bar chart — all 12 months */}
                  {(() => {
                    const BAR_AREA_H = 140;
                    return (
                      <View style={{ marginTop: 16, gap: 4 }}>
                        {/* Count labels row — fixed height so bars never clip them */}
                        <View style={{ flexDirection: 'row', gap: 5, height: 14 }}>
                          {stats.monthlyCounts.map((count, i) => {
                            const isTop = count === maxMonthly && maxMonthly > 0;
                            return (
                              <Text
                                key={i}
                                style={{ flex: 1, color: count > 0 ? (isTop ? tint : sub) : 'transparent', fontSize: 10, fontWeight: '700', textAlign: 'center' }}>
                                {count}
                              </Text>
                            );
                          })}
                        </View>

                        {/* Bars row */}
                        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: BAR_AREA_H }}>
                          {stats.monthlyCounts.map((count, i) => {
                            const barH = maxMonthly > 0 ? Math.max((count / maxMonthly) * BAR_AREA_H, count > 0 ? 8 : 0) : 0;
                            const isTop = count === maxMonthly && maxMonthly > 0;
                            return (
                              <Pressable
                                key={i}
                                onPress={() => count > 0 && router.push({ pathname: '/month-in-review', params: { year: selectedYear, month: i } } as any)}
                                disabled={count === 0}
                                style={({ pressed }) => ({ flex: 1, height: BAR_AREA_H, justifyContent: 'flex-end', opacity: pressed ? 0.7 : 1 })}>
                                <View style={{ height: barH, width: '100%', borderRadius: 4, backgroundColor: isTop ? tint : '#4a3020' }} />
                              </Pressable>
                            );
                          })}
                        </View>

                        {/* Month label row */}
                        <View style={{ flexDirection: 'row', gap: 5 }}>
                          {stats.monthlyCounts.map((count, i) => {
                            const isTop = count === maxMonthly && maxMonthly > 0;
                            return (
                              <Text key={i} style={{ flex: 1, color: isTop ? tint : sub, fontSize: 10, fontWeight: isTop ? '700' : '500', textAlign: 'center' }}>
                                {MONTH_NAMES[i][0]}
                              </Text>
                            );
                          })}
                        </View>
                      </View>
                    );
                  })()}

                  {/* Avg per month */}
                  <Text style={{ color: sub, fontSize: 13, marginTop: 14, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: cardBorder }}>
                    Avg <Text style={{ color: tint, fontWeight: '700' }}>{avgPerMonth}</Text> albums/month
                  </Text>
                </View>

                {/* ── Highest Rated ── */}
                {(highestRatedThisYear.length > 0 || highestRatedPrevious.length > 0) && (
                  <View style={[st.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                    {/* Header + toggle */}
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
                      const list = highestRatedView === 'thisYear' ? highestRatedThisYear : highestRatedPrevious;
                      if (list.length === 0) {
                        return (
                          <Text style={{ color: sub, fontSize: 13, textAlign: 'center', paddingVertical: 16 }}>
                            {highestRatedView === 'thisYear'
                              ? `No rated albums released in ${selectedYear} yet.`
                              : 'No rated albums from previous years.'}
                          </Text>
                        );
                      }
                      return (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                          {list.map(album => (
                            <Pressable
                              key={album.id + album.dateLogged}
                              onPress={() => goToAlbum(album)}
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

                {/* ── Most Re-Listened ── */}
                {stats.mostRelistened.length > 0 && (
                  <View style={[st.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                    <Text style={[st.label, { color: muted }]}>MOST RE-LISTENED</Text>
                    <View style={{ marginTop: 12, gap: 0 }}>
                      {stats.mostRelistened.map((album, index) => (
                        <Pressable
                          key={album.id}
                          onPress={() => goToAlbum(album)}
                          style={({ pressed }) => ({
                            flexDirection: 'row', alignItems: 'center', gap: 12,
                            paddingVertical: 10,
                            borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
                            borderTopColor: cardBorder,
                            opacity: pressed ? 0.7 : 1,
                          })}>
                          {album.artworkUrl
                            ? <ExpoImage source={{ uri: album.artworkUrl }} style={{ width: 44, height: 44, borderRadius: 6 }} contentFit="cover" cachePolicy="disk" />
                            : <View style={{ width: 44, height: 44, borderRadius: 6, backgroundColor: CARD_BG, alignItems: 'center', justifyContent: 'center' }}>
                                <FontAwesome name="music" size={16} color={SUBTEXT} />
                              </View>}
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: txt, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{album.title}</Text>
                            <Text style={{ color: sub, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{album.artist}</Text>
                          </View>
                          <View style={{ alignItems: 'flex-end', gap: 3 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                              <FontAwesome name="repeat" size={11} color={tint} />
                              <Text style={{ color: tint, fontSize: 13, fontWeight: '800' }}>{album.reListenCount}×</Text>
                            </View>
                            {album.rating > 0 && (
                              <Text style={{ color: sub, fontSize: 12, fontWeight: '600' }}>{album.rating}</Text>
                            )}
                          </View>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}

                {/* ── Milestones ── */}
                {(stats.firstAlbum || stats.lastAlbum || stats.album10 || stats.album25 || stats.album50 || stats.album100) && (
                  <View style={[st.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                    <Text style={[st.label, { color: muted }]}>MILESTONES</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, marginTop: 14 }}>
                      {stats.firstAlbum && (
                        <MilestoneCard album={stats.firstAlbum} label={`First of ${selectedYear}`} onPress={() => goToAlbum(stats.firstAlbum!)} colors={colors} />
                      )}
                      {stats.album10 && (
                        <MilestoneCard album={stats.album10} label="10th Album" onPress={() => goToAlbum(stats.album10!)} colors={colors} />
                      )}
                      {stats.album25 && (
                        <MilestoneCard album={stats.album25} label="25th Album" onPress={() => goToAlbum(stats.album25!)} colors={colors} />
                      )}
                      {stats.album50 && (
                        <MilestoneCard album={stats.album50} label="50th Album" onPress={() => goToAlbum(stats.album50!)} colors={colors} />
                      )}
                      {stats.album100 && (
                        <MilestoneCard album={stats.album100} label="100th Album" onPress={() => goToAlbum(stats.album100!)} colors={colors} />
                      )}
                      {stats.lastAlbum && stats.lastAlbum !== stats.firstAlbum && (
                        <MilestoneCard album={stats.lastAlbum} label={`Last of ${selectedYear}`} onPress={() => goToAlbum(stats.lastAlbum!)} colors={colors} />
                      )}
                    </ScrollView>
                  </View>
                )}

                {/* ── Three Breakdowns ── */}
                <View style={[st.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                  <Text style={[st.label, { color: muted }]}>THIS YEAR'S LISTENING</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 20, gap: 8 }}>

                    {/* New Releases vs Older */}
                    <View style={{ alignItems: 'center', flex: 1, gap: 10 }}>
                      <PieChart aCount={newReleasesCount} bCount={olderCount} aColor={tint} bColor="#4a3020" size={100} />
                      <View style={{ alignItems: 'center', gap: 4 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tint }} />
                          <Text style={{ color: sub, fontSize: 11 }}>New {selectedYear}</Text>
                          <Text style={{ color: txt, fontSize: 11, fontWeight: '700' }}>{newReleasesCount}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#4a3020" }} />
                          <Text style={{ color: sub, fontSize: 11 }}>Older</Text>
                          <Text style={{ color: txt, fontSize: 11, fontWeight: '700' }}>{olderCount}</Text>
                        </View>
                      </View>
                      <Text style={{ color: muted, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', textAlign: 'center' }}>NEW VS OLDER</Text>
                    </View>

                    {/* First Listens vs Re-listens */}
                    <View style={{ alignItems: 'center', flex: 1, gap: 10 }}>
                      <PieChart aCount={stats.firstListens} bCount={stats.relistens} aColor={tint} bColor="#4a3020" size={100} />
                      <View style={{ alignItems: 'center', gap: 4 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tint }} />
                          <Text style={{ color: sub, fontSize: 11 }}>First listen</Text>
                          <Text style={{ color: txt, fontSize: 11, fontWeight: '700' }}>{stats.firstListens}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#4a3020" }} />
                          <Text style={{ color: sub, fontSize: 11 }}>Re-listen</Text>
                          <Text style={{ color: txt, fontSize: 11, fontWeight: '700' }}>{stats.relistens}</Text>
                        </View>
                      </View>
                      <Text style={{ color: muted, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', textAlign: 'center' }}>1ST VS REPEAT</Text>
                    </View>

                    {/* Reviewed vs Not */}
                    <View style={{ alignItems: 'center', flex: 1, gap: 10 }}>
                      <PieChart aCount={stats.reviewCount} bCount={yearAlbums.length - stats.reviewCount} aColor={tint} bColor="#4a3020" size={100} />
                      <View style={{ alignItems: 'center', gap: 4 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tint }} />
                          <Text style={{ color: sub, fontSize: 11 }}>Reviewed</Text>
                          <Text style={{ color: txt, fontSize: 11, fontWeight: '700' }}>{stats.reviewCount}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#4a3020" }} />
                          <Text style={{ color: sub, fontSize: 11 }}>No review</Text>
                          <Text style={{ color: txt, fontSize: 11, fontWeight: '700' }}>{yearAlbums.length - stats.reviewCount}</Text>
                        </View>
                      </View>
                      <Text style={{ color: muted, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', textAlign: 'center' }}>REVIEWED</Text>
                    </View>
                  </View>
                </View>

                {/* ── Avg rating vs all-time ── */}
                {allTimeAvg !== null && stats.avgRating !== '—' && (
                  <View style={[st.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                    <Text style={[st.label, { color: muted }]}>RATING VS ALL-TIME</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginTop: 8 }}>
                      <View style={{ alignItems: 'center', gap: 4 }}>
                        <Text style={{ color: tint, fontSize: 28, fontWeight: '800' }}>{stats.avgRating}</Text>
                        <Text style={{ color: sub, fontSize: 12 }}>{selectedYear} avg</Text>
                      </View>
                      <View style={{ alignItems: 'center', gap: 4 }}>
                        {(() => {
                          const diff = (parseFloat(stats.avgRating) - allTimeAvg).toFixed(1);
                          const isUp = parseFloat(diff) > 0;
                          const isEq = parseFloat(diff) === 0;
                          return (
                            <>
                              <Text style={{ color: isEq ? sub : isUp ? '#a8c44a' : '#B85040', fontSize: 22, fontWeight: '800' }}>
                                {isEq ? '=' : isUp ? `+${diff}` : diff}
                              </Text>
                              <Text style={{ color: sub, fontSize: 12 }}>vs all-time</Text>
                            </>
                          );
                        })()}
                      </View>
                      <View style={{ alignItems: 'center', gap: 4 }}>
                        <Text style={{ color: sub, fontSize: 28, fontWeight: '800' }}>{allTimeAvg.toFixed(1)}</Text>
                        <Text style={{ color: sub, fontSize: 12 }}>all-time avg</Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* ── Rating Distribution ── */}
                {yearAlbums.filter(a => a.rating > 0).length > 0 && (
                  <View style={[st.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                    <Text style={[st.label, { color: muted }]}>RATING DISTRIBUTION</Text>
                    <View style={{ marginTop: 14 }}>
                      <RatingDistribution
                        albums={yearAlbums}
                        onRatingPress={(rating, list) => setModal({ title: `Rated ${rating}`, albums: list })}
                        tint={tint}
                        textColor={txt}
                        subtextColor={sub}
                        trackColor={cardBorder}
                      />
                    </View>
                  </View>
                )}

                {/* ── Top Artists ── */}
                {stats.topArtistsByCount.length > 0 && (
                  <View style={[st.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                    {/* Header + toggle */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <Text style={[st.label, { color: muted, flexShrink: 1, marginRight: 10 }]}>MOST LISTEND ARTISTS</Text>
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
                      const GAP = 10;
                      const cardW = Math.floor((screenWidth - 40 - 36 - GAP * 2) / 3);
                      const items: [string, string][] = artistView === 'listend'
                        ? stats.topArtistsByCount.map(({ artist, count }) => [artist, `${count} album${count !== 1 ? 's' : ''}`])
                        : stats.topArtistsByRating.map(({ artist, avg }) => [artist, `${avg.toFixed(1)} avg`]);

                      if (items.length === 0) {
                        return (
                          <Text style={{ color: sub, fontSize: 13, textAlign: 'center', paddingVertical: 20 }}>
                            {artistView === 'rated' ? 'Rate at least 2 albums per artist to see ratings.' : 'No artist data yet.'}
                          </Text>
                        );
                      }

                      // Chunk into rows of 3 — same as all-time stats
                      const rows: [string, string][][] = [];
                      for (let i = 0; i < items.length; i += 3) rows.push(items.slice(i, i + 3));

                      return (
                        <View style={{ gap: 16 }}>
                          {rows.map((row, ri) => (
                            <View key={ri} style={{ flexDirection: 'row', gap: GAP }}>
                              {row.map(([artist, lbl]) => (
                                <ArtistGridCard
                                  key={artist}
                                  artist={artist}
                                  label={lbl}
                                  imageUrl={artistImages[artist]}
                                  cardW={cardW}
                                  textColor={txt}
                                  subtextColor={sub}
                                  onPress={() => setModal({
                                    title: artist,
                                    albums: artistView === 'listend'
                                      ? yearAlbums.filter(a => a.artist === artist)
                                      : yearAlbums.filter(a => a.artist === artist && a.rating > 0),
                                    onTitlePress: () => {
                                      setModal(null);
                                      setTimeout(() => router.push({ pathname: '/artist-detail', params: { name: artist } } as any), 300);
                                    },
                                  })}
                                />
                              ))}
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
                    {stats.topGenres.map(({ genre, count }) => (
                      <BarRow
                        key={genre}
                        label={genre}
                        count={count}
                        maxCount={stats.topGenres[0].count}
                        tint={tint}
                        textColor={txt}
                        subtextColor={sub}
                        trackColor={cardBorder}
                        onPress={() => setModal({
                          title: genre,
                          albums: yearAlbums.filter(a => (a.genreTags ?? []).find(t => MAIN_GENRES.has(t)) === genre),
                        })}
                      />
                    ))}
                    <Text style={{ color: sub, fontSize: 12, marginTop: 4 }}>Tap a genre to see albums</Text>
                  </View>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
    </>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});
