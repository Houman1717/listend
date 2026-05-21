import { StyleSheet, View, Text, ScrollView, Pressable, Modal, FlatList, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { useState, useEffect, Fragment } from 'react';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Svg, { Circle } from 'react-native-svg';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAlbums, LoggedAlbum } from '@/context/AlbumsContext';
import { supabase } from '@/lib/supabase';
import { cardWidth as calcCardWidth, GAP, COLS, PADDING } from '@/components/AlbumGridCard';
import { FLIP_POOL } from '@/constants/FlipPool';

const MAIN_GENRES = new Set([
  'Hip-Hop / Rap', 'Pop', 'Rock', 'Latin', 'Afrobeats',
  'R&B / Soul', 'Electronic', 'Indie / Alternative', 'Metal',
  'Country', 'Jazz', 'Classical', 'Folk / Singer-Songwriter', 'Blues',
]);

// Only override Apple Music's "Pop" tag when MusicBrainz's tag is one of these
// definitively specific genres — ones AM would never apply to a true Pop album.
const POP_OVERRIDE_GENRES = new Set([
  'Hip-Hop / Rap', 'Metal', 'Jazz', 'Classical',
  'Afrobeats', 'Electronic', 'Country', 'Blues', 'Latin',
]);

function pickGenreTag(genreTags: string[]): string | null {
  const filtered = genreTags.filter(t => MAIN_GENRES.has(t));
  const tag0 = filtered[0];
  const tag1 = filtered[1];
  if (!tag0) return null;
  if (tag0 === 'Pop' && tag1 && POP_OVERRIDE_GENRES.has(tag1)) return tag1;
  return tag0;
}

const CARD_BG  = '#2E2018';
const BORDER   = '#2a1e14';
const TEXT     = '#f5e6c8';
const SUBTEXT  = '#A08060';
const ACCENT   = '#D4A017';

const TAG_COLORS  = ['#7a5018', '#8B6914', '#5c3a10', '#6B4422', '#9a7020', '#4a3218'];
const GROW_CLR    = '#a8c44a';
const FADE_CLR    = '#B85040';

type EvolutionEntry = {
  album:        LoggedAlbum;
  firstRating:  number;
  latestRating: number;
  delta:        number;
};

function EvolutionCard({ entry, onPress }: { entry: EvolutionEntry; onPress: () => void }) {
  const { album, firstRating, latestRating, delta } = entry;
  const isGrow     = delta > 0;
  const deltaColor = isGrow ? GROW_CLR : FADE_CLR;
  const sign       = isGrow ? '+' : '';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [ev.card, { opacity: pressed ? 0.75 : 1 }]}>
      {album.artworkUrl ? (
        <ExpoImage source={{ uri: album.artworkUrl }} style={ev.art} contentFit="cover" cachePolicy="disk" />
      ) : (
        <View style={[ev.art, { backgroundColor: CARD_BG, alignItems: 'center', justifyContent: 'center' }]}>
          <FontAwesome name="music" size={22} color="rgba(255,255,255,0.3)" />
        </View>
      )}
      <View style={[ev.badge, { backgroundColor: deltaColor }]}>
        <Text style={ev.badgeText}>{sign}{delta}</Text>
      </View>
      <Text style={ev.title} numberOfLines={2}>{album.title}</Text>
      <View style={ev.ratingRow}>
        <Text style={ev.ratingOld}>{firstRating}</Text>
        <FontAwesome name={isGrow ? 'arrow-up' : 'arrow-down'} size={10} color={deltaColor} />
        <Text style={[ev.ratingNew, { color: deltaColor }]}>{latestRating}</Text>
      </View>
    </Pressable>
  );
}

const ev = StyleSheet.create({
  card:      { width: 110, gap: 6 },
  art:       { width: 110, height: 110, borderRadius: 10 },
  badge:     { position: 'absolute', top: 8, right: 8, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  title:     { color: TEXT,    fontSize: 12, fontWeight: '600', lineHeight: 16 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ratingOld: { color: SUBTEXT, fontSize: 12, fontWeight: '600' },
  ratingNew: { fontSize: 12, fontWeight: '700' },
});

function VolumeBadge({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <FontAwesome name="volume-up" size={9} color="#D4A017" />
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 1 }}>
        {Array.from({ length: 10 }, (_, i) => {
          const h = Math.round(3 + i * 1);
          return <View key={i} style={{ width: 2, height: h, borderRadius: 1, backgroundColor: i + 1 <= rating ? '#D4A017' : '#2a1e14' }} />;
        })}
      </View>
      <Text style={{ color: '#D4A017', fontSize: 10, fontWeight: '700' }}>{rating}</Text>
    </View>
  );
}

// ─── Album List Modal (reused for rating drilldown + year drilldown) ──────────

function AlbumListModal({
  title,
  albums,
  onClose,
  onAlbumPress,
  onTitlePress,
}: {
  title: string | null;
  albums: LoggedAlbum[];
  onClose: () => void;
  onAlbumPress: (album: LoggedAlbum) => void;
  onTitlePress?: () => void;
}) {
  const insets  = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cw      = calcCardWidth(width);

  return (
    <Modal visible={title !== null} transparent animationType="slide" onRequestClose={onClose}>
      <View style={rm.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[rm.sheet, { paddingBottom: Math.max(insets.bottom + 16, 32) }]}>
          <View style={rm.handle} />
          <View style={rm.header}>
            <Pressable onPress={onTitlePress} disabled={!onTitlePress} style={{ flex: 1, marginRight: 12 }}>
              <Text style={[rm.title, onTitlePress && { color: ACCENT }]}>{title}</Text>
              {onTitlePress && (
                <Text style={{ color: SUBTEXT, fontSize: 12, marginTop: 2 }}>View artist profile →</Text>
              )}
            </Pressable>
            <Pressable onPress={onClose} hitSlop={12}>
              <FontAwesome name="times" size={16} color={SUBTEXT} />
            </Pressable>
          </View>
          <Text style={rm.subtitle}>{albums.length} album{albums.length !== 1 ? 's' : ''}</Text>

          <FlatList
            data={albums}
            keyExtractor={a => a.id}
            numColumns={COLS}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: PADDING, paddingTop: 12, paddingBottom: 8 }}
            columnWrapperStyle={{ gap: GAP, marginBottom: GAP }}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [{ width: cw, opacity: pressed ? 0.7 : 1 }]}
                onPress={() => { onClose(); setTimeout(() => onAlbumPress(item), 300); }}>
                {item.artworkUrl ? (
                  <ExpoImage
                    source={{ uri: item.artworkUrl }}
                    style={{ width: cw, height: cw, borderRadius: 8 }}
                    contentFit="cover"
                    cachePolicy="disk"
                    transition={200}
                  />
                ) : (
                  <View style={[rm.fallback, { width: cw, height: cw }]}>
                    <FontAwesome name="music" size={cw * 0.28} color="#7a5535" />
                  </View>
                )}
                <Text style={rm.cardTitle}  numberOfLines={1}>{item.title}</Text>
                <Text style={rm.cardArtist} numberOfLines={1}>{item.artist}</Text>
                {item.rating > 0 && (
                  <View style={{ marginTop: 3 }}>
                    <VolumeBadge rating={item.rating} />
                  </View>
                )}
              </Pressable>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const rm = StyleSheet.create({
  overlay:    { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet:      { backgroundColor: '#161616', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BORDER, maxHeight: '85%' },
  handle:     { width: 36, height: 4, borderRadius: 2, backgroundColor: '#4a3020', alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  title:      { color: TEXT, fontSize: 18, fontWeight: '700' },
  subtitle:   { color: SUBTEXT, fontSize: 13, paddingHorizontal: 16, marginBottom: 8 },
  fallback:   { borderRadius: 8, backgroundColor: CARD_BG, justifyContent: 'center', alignItems: 'center' },
  cardTitle:  { color: TEXT,    fontSize: 12, fontWeight: '600', marginTop: 4 },
  cardArtist: { color: SUBTEXT, fontSize: 11, marginTop: 1 },
  cardRating: { color: ACCENT,  fontSize: 11, fontWeight: '700', marginTop: 2 },
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
  onPress,
}: {
  label: string;
  count: number;
  maxCount: number;
  colorIdx: number;
  pill?: boolean;
  onPress?: () => void;
}) {
  const pct = maxCount > 0 ? Math.max(count / maxCount, 0.02) : 0;
  return (
    <Pressable
      style={({ pressed }) => [br.row, onPress && { opacity: pressed ? 0.6 : 1 }]}
      onPress={onPress}
      disabled={!onPress}>
      {pill ? (
        <View style={br.pill}>
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
    </Pressable>
  );
}

const br = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, width: '100%' },
  pill:     { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, minWidth: 110, alignItems: 'center', backgroundColor: '#3a2818' },
  pillText: { color: TEXT, fontSize: 13, fontWeight: '600' },
  label:    { color: TEXT, fontSize: 13, fontWeight: '500', width: 110 },
  track:    { flex: 1, height: 6, borderRadius: 3, backgroundColor: BORDER, overflow: 'hidden', flexDirection: 'row' },
  fill:     { height: 6, borderRadius: 3, backgroundColor: ACCENT },
  count:    { color: SUBTEXT, fontSize: 13, fontWeight: '600', width: 28, textAlign: 'right' },
});

// ─── Artist grid card ─────────────────────────────────────────────────────────

const INITIAL_COLORS = ['#7a5018', '#5c3a10', '#6B4422', '#4a3218', '#8B6914', '#3d2a0e'];

function ArtistGridCard({
  artist,
  label,
  imageUrl,
  onPress,
  cardW,
}: {
  artist: string;
  label: string;
  imageUrl?: string;
  onPress: () => void;
  cardW: number;
}) {
  const imgSize = cardW - 20;
  const initial = artist.trim().charAt(0).toUpperCase();
  const bgColor = INITIAL_COLORS[artist.charCodeAt(0) % INITIAL_COLORS.length];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ width: cardW, alignItems: 'center', gap: 6, opacity: pressed ? 0.7 : 1 }]}>
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
      <Text style={ag.name} numberOfLines={2}>{artist}</Text>
      <Text style={ag.sub}>{label}</Text>
    </Pressable>
  );
}

const ag = StyleSheet.create({
  name: { color: TEXT,    fontSize: 12, fontWeight: '600', textAlign: 'center' },
  sub:  { color: SUBTEXT, fontSize: 11, fontWeight: '500', textAlign: 'center' },
});

// ─── Year Bar Chart with drill-down ──────────────────────────────────────────

const CHART_H = 130;
const BAR_W   = 38;
const BAR_GAP = 10;

type ChartView = 'albums' | 'ratings';

type Bucket = {
  key: number;
  label: string;
  albums: LoggedAlbum[];
  count: number;
  avgRating: number;
};

function buildDecadeBuckets(loggedAlbums: LoggedAlbum[]): Bucket[] {
  const byDecade = new Map<number, LoggedAlbum[]>();
  for (const album of loggedAlbums) {
    if (!album.year || album.year < 1900 || album.year > 2030) continue;
    const decade = Math.floor(album.year / 10) * 10;
    if (!byDecade.has(decade)) byDecade.set(decade, []);
    byDecade.get(decade)!.push(album);
  }
  return [...byDecade.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([decade, albums]) => {
      const rated = albums.filter(a => a.rating > 0);
      return {
        key: decade,
        label: `${decade}s`,
        albums,
        count: albums.length,
        avgRating: rated.length > 0 ? rated.reduce((s, a) => s + a.rating, 0) / rated.length : 0,
      };
    });
}

function buildYearBuckets(loggedAlbums: LoggedAlbum[], decade: number): Bucket[] {
  return Array.from({ length: 10 }, (_, i) => {
    const year   = decade + i;
    const albums = loggedAlbums.filter(a => a.year === year);
    const rated  = albums.filter(a => a.rating > 0);
    return {
      key: year,
      label: String(year),
      albums,
      count: albums.length,
      avgRating: rated.length > 0 ? rated.reduce((s, a) => s + a.rating, 0) / rated.length : 0,
    };
  });
}

function YearChart({
  loggedAlbums,
  onAlbumPress,
}: {
  loggedAlbums: LoggedAlbum[];
  onAlbumPress: (album: LoggedAlbum) => void;
}) {
  const [view,        setView]        = useState<ChartView>('albums');
  const [drillDecade, setDrillDecade] = useState<number | null>(null);
  const [modal,       setModal]       = useState<{ title: string; albums: LoggedAlbum[] } | null>(null);

  const buckets: Bucket[] = drillDecade !== null
    ? buildYearBuckets(loggedAlbums, drillDecade)
    : buildDecadeBuckets(loggedAlbums);

  const maxCount = Math.max(...buckets.map(b => b.count), 1);

  function handleBarPress(bucket: Bucket) {
    if (drillDecade === null) {
      setDrillDecade(bucket.key);
    } else if (bucket.albums.length > 0) {
      setModal({ title: String(bucket.key), albums: bucket.albums });
    }
  }

  if (buckets.length === 0) {
    return <EmptyState text="Log some albums to see your year breakdown." />;
  }

  return (
    <>
      <AlbumListModal
        title={modal?.title ?? null}
        albums={modal?.albums ?? []}
        onClose={() => setModal(null)}
        onAlbumPress={(album) => { setModal(null); setTimeout(() => onAlbumPress(album), 300); }}
      />

      {/* Header row: back button + toggle */}
      <View style={yc.headerRow}>
        {drillDecade !== null ? (
          <Pressable
            style={({ pressed }) => [yc.backBtn, { opacity: pressed ? 0.6 : 1 }]}
            onPress={() => setDrillDecade(null)}>
            <FontAwesome name="chevron-left" size={11} color={ACCENT} />
            <Text style={yc.backText}>All decades</Text>
          </Pressable>
        ) : <View />}

        <View style={yc.toggle}>
          {(['albums', 'ratings'] as ChartView[]).map(v => (
            <Pressable
              key={v}
              style={[yc.toggleBtn, view === v && yc.toggleActive]}
              onPress={() => setView(v)}>
              <Text style={[yc.toggleText, view === v && yc.toggleTextActive]}>
                {v === 'albums' ? 'Albums' : 'Avg Rating'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Chart */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={yc.scroll}>
        <View style={[yc.chartWrap, { height: CHART_H + 36 }]}>
          {/* Guide lines */}
          {[0.25, 0.5, 0.75, 1].map(pct => (
            <View key={pct} style={[yc.guide, { bottom: pct * CHART_H + 28 }]} />
          ))}

          {/* Bars */}
          {buckets.map(bucket => {
            const value    = view === 'albums' ? bucket.count : bucket.avgRating;
            const maxVal   = view === 'albums' ? maxCount : 10;
            const barH     = maxVal > 0 ? Math.max((value / maxVal) * CHART_H, value > 0 ? 4 : 0) : 0;
            const valLabel = view === 'albums'
              ? (bucket.count > 0 ? String(bucket.count) : '')
              : (bucket.avgRating > 0 ? bucket.avgRating.toFixed(1) : '');
            const pressable = drillDecade === null || bucket.albums.length > 0;

            return (
              <Pressable
                key={bucket.key}
                style={({ pressed }) => [yc.col, pressable && pressed && { opacity: 0.6 }]}
                onPress={() => handleBarPress(bucket)}
                disabled={!pressable}>
                <Text style={[yc.valLabel, { opacity: valLabel ? 1 : 0 }]}>{valLabel || '0'}</Text>
                <View style={[yc.barArea, { height: CHART_H }]}>
                  <View style={[yc.bar, { height: barH }]} />
                </View>
                <Text style={yc.decLabel}>{bucket.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {drillDecade !== null ? (
        <>
          <Pressable
            style={({ pressed }) => [yc.seeAll, { opacity: pressed ? 0.6 : 1 }]}
            onPress={() => {
              const allDecadeAlbums = loggedAlbums.filter(
                a => a.year >= drillDecade && a.year < drillDecade + 10
              );
              setModal({ title: `${drillDecade}s — All Albums`, albums: allDecadeAlbums });
            }}>
            <Text style={yc.seeAllText}>
              See all {loggedAlbums.filter(a => a.year >= drillDecade && a.year < drillDecade + 10).length} albums from the {drillDecade}s
            </Text>
            <FontAwesome name="chevron-right" size={11} color={ACCENT} />
          </Pressable>
          <Text style={yc.hint}>Tap a bar to see albums</Text>
        </>
      ) : (
        <Text style={yc.hint}>Tap a decade to explore</Text>
      )}
    </>
  );
}

const yc = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  backBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backText:  { color: ACCENT, fontSize: 13, fontWeight: '600' },

  toggle: {
    flexDirection: 'row',
    backgroundColor: BORDER,
    borderRadius: 8,
    padding: 2,
  },
  toggleBtn:        { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 7 },
  toggleActive:     { backgroundColor: ACCENT },
  toggleText:       { color: SUBTEXT, fontSize: 13, fontWeight: '600' },
  toggleTextActive: { color: '#0F0A07', fontSize: 13, fontWeight: '700' },

  scroll:    { paddingRight: 8 },
  chartWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: BAR_GAP, position: 'relative' },
  guide: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
  },
  col:      { width: BAR_W, alignItems: 'center', gap: 4 },
  valLabel: { color: SUBTEXT, fontSize: 10, fontWeight: '600' },
  barArea:  { width: BAR_W, justifyContent: 'flex-end' },
  bar:      { width: BAR_W, backgroundColor: ACCENT, borderRadius: 4, opacity: 0.85 },
  decLabel: { color: SUBTEXT, fontSize: 10, fontWeight: '500', textAlign: 'center' },
  hint:       { color: SUBTEXT, fontSize: 12, marginTop: 6 },
  seeAll:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BORDER },
  seeAllText: { color: ACCENT, fontSize: 13, fontWeight: '600' },
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
  const [listModal,      setListModal]        = useState<{ title: string; albums: LoggedAlbum[]; onTitlePress?: () => void } | null>(null);
  const [artistView,     setArtistView]       = useState<'listend' | 'rated'>('listend');
  const [genreView,      setGenreView]        = useState<'listend' | 'rated'>('listend');
  const [artistImages,   setArtistImages]     = useState<Record<string, string>>({});
  const [allReLists,     setAllReLists]       = useState<Map<string, { rating: number; listenedAt: string }[]>>(new Map());
  const [communityAvgs,  setCommunityAvgs]    = useState<Record<string, { avg: number; count: number }>>({});
  const [playlistAlbums, setPlaylistAlbums]   = useState<Record<string, { title: string; artist: string }[]>>({});
  const { width: screenWidth } = useWindowDimensions();

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

  // ── Most listend artists ──────────────────────────────────────────────────
  const artistCounts = new Map<string, number>();
  for (const album of loggedAlbums) {
    if (!album.artist) continue;
    artistCounts.set(album.artist, (artistCounts.get(album.artist) ?? 0) + 1);
  }
  const topArtists     = [...artistCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 9);
  const maxArtistCount = topArtists[0]?.[1] ?? 1;

  // ── Highest rated artists ─────────────────────────────────────────────────
  const artistRatings = new Map<string, number[]>();
  for (const album of loggedAlbums) {
    if (!album.artist || album.rating <= 0) continue;
    if (!artistRatings.has(album.artist)) artistRatings.set(album.artist, []);
    artistRatings.get(album.artist)!.push(album.rating);
  }
  const topRatedArtists = [...artistRatings.entries()]
    .filter(([, ratings]) => ratings.length >= 2)
    .map(([artist, ratings]) => [artist, ratings.reduce((s, r) => s + r, 0) / ratings.length] as [string, number])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 9);

  // ── Favourite genres ──────────────────────────────────────────────────────
  const genreCounts = new Map<string, number>();
  for (const album of loggedAlbums) {
    const genre = pickGenreTag(album.genreTags ?? []);
    if (genre) genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
  }
  const topGenres     = [...genreCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxGenreCount = topGenres[0]?.[1] ?? 1;
  const totalTagged   = loggedAlbums.filter(a => pickGenreTag(a.genreTags ?? []) !== null).length;

  // ── Highest rated genres ──────────────────────────────────────────────────
  const genreRatings = new Map<string, number[]>();
  for (const album of loggedAlbums) {
    if (album.rating <= 0) continue;
    const genre = pickGenreTag(album.genreTags ?? []);
    if (genre) {
      if (!genreRatings.has(genre)) genreRatings.set(genre, []);
      genreRatings.get(genre)!.push(album.rating);
    }
  }
  const topRatedGenres = [...genreRatings.entries()]
    .map(([genre, ratings]) => [genre, ratings.reduce((s, r) => s + r, 0) / ratings.length] as [string, number])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

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

  // Fetch artist images using the same /search?type=artist call that artist-detail uses
  useEffect(() => {
    if (!isLoaded || loggedAlbums.length === 0) return;
    const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
    const allNames = [...new Set([
      ...topArtists.map(([a]) => a),
      ...topRatedArtists.map(([a]) => a),
    ])] as string[];
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
      if (Object.keys(images).length > 0) setArtistImages(images);
    });
  }, [loggedAlbums]);

  // Fetch all re-listen rows for grower/fader computation
  useEffect(() => {
    if (!isLoaded) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id;
      if (!uid) return;
      supabase
        .from('re_listens')
        .select('spotify_id, rating, listened_at')
        .eq('user_id', uid)
        .order('listened_at', { ascending: true })
        .then(({ data }) => {
          const map = new Map<string, { rating: number; listenedAt: string }[]>();
          for (const r of data ?? []) {
            if (!map.has(r.spotify_id)) map.set(r.spotify_id, []);
            map.get(r.spotify_id)!.push({ rating: r.rating ?? 0, listenedAt: r.listened_at ?? '' });
          }
          setAllReLists(map);
        });
    });
  }, [isLoaded]);

  // Fetch community averages for all rated albums (excluding own rating)
  useEffect(() => {
    if (!isLoaded) return;
    const ratedAlbums = loggedAlbums.filter(a => a.rating > 0);
    if (ratedAlbums.length === 0) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id;
      if (!uid) return;
      // Match by title+year (not spotify_id) — different users may have different AM IDs for same album
      supabase
        .from('user_albums')
        .select('title, year, rating')
        .gt('rating', 0)
        .neq('user_id', uid)
        .then(({ data }) => {
          // Build community map keyed by title_lower::year
          const communityMap: Record<string, number[]> = {};
          for (const row of data ?? []) {
            const key = `${(row.title ?? '').toLowerCase()}::${row.year ?? 0}`;
            if (!communityMap[key]) communityMap[key] = [];
            communityMap[key].push(row.rating);
          }
          // Match against user's rated albums using same key
          const avgs: Record<string, { avg: number; count: number }> = {};
          for (const album of ratedAlbums) {
            const key = `${album.title.toLowerCase()}::${album.year ?? 0}`;
            const ratings = communityMap[key];
            if (!ratings || ratings.length === 0) continue;
            avgs[album.id] = { avg: ratings.reduce((s, r) => s + r, 0) / ratings.length, count: ratings.length };
          }
          setCommunityAvgs(avgs);
        });
    });
  }, [isLoaded]);

  // Fetch featured playlist album lists (in parallel, once)
  useEffect(() => {
    const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
    const featuredIds = FEATURED_PLAYLISTS.filter(p => p.id !== 'flip-a-record').map(p => p.id);
    Promise.allSettled(
      featuredIds.map(id =>
        fetch(`${API_URL}/api/featured-playlists/${id}`)
          .then(r => r.ok ? r.json() : [])
          .then((data: { title: string; artist: string }[]) => ({ id, albums: data }))
          .catch(() => ({ id, albums: [] }))
      )
    ).then(results => {
      const map: Record<string, { title: string; artist: string }[]> = {};
      for (const r of results) {
        if (r.status === 'fulfilled') map[r.value.id] = r.value.albums;
      }
      setPlaylistAlbums(map);
    });
  }, []);

  // ── Re-Listend evolution (growers / faders) ───────────────────────────────
  const reListenedAlbums = loggedAlbums.filter(a => a.isRelistened);
  const totalReListens   = reListenedAlbums.reduce((s, a) => s + (a.reListenCount ?? 0), 0);
  const evGrowers: EvolutionEntry[] = [];
  const evFaders:  EvolutionEntry[] = [];
  let evSumFirst = 0, evSumLatest = 0, evCount = 0;
  for (const album of reListenedAlbums) {
    const lists = allReLists.get(album.id);
    if (!lists || lists.length === 0) continue;
    const latestRated = [...lists].reverse().find(r => r.rating > 0);
    const latestRating = latestRated?.rating ?? 0;
    const firstRating  = album.rating;
    if (firstRating <= 0 || latestRating <= 0) continue;
    const delta = latestRating - firstRating;
    evSumFirst += firstRating; evSumLatest += latestRating; evCount++;
    if (delta >= 1)  evGrowers.push({ album, firstRating, latestRating, delta });
    if (delta <= -1) evFaders.push({ album, firstRating, latestRating, delta });
  }
  evGrowers.sort((a, b) => b.delta - a.delta);
  evFaders.sort((a, b) => a.delta - b.delta);
  const evAvgDelta      = evCount > 0 ? (evSumLatest - evSumFirst) / evCount : 0;
  const evFirstListenAvg = evCount > 0 ? evSumFirst  / evCount : 0;
  const evLongTermAvg    = evCount > 0 ? evSumLatest / evCount : 0;

  // Fetch all re-listen rows for grower/fader computation
  useEffect(() => {
    if (!isLoaded) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id;
      if (!uid) return;
      supabase
        .from('re_listens')
        .select('spotify_id, rating, listened_at')
        .eq('user_id', uid)
        .order('listened_at', { ascending: true })
        .then(({ data }) => {
          const map = new Map<string, { rating: number; listenedAt: string }[]>();
          for (const r of data ?? []) {
            if (!map.has(r.spotify_id)) map.set(r.spotify_id, []);
            map.get(r.spotify_id)!.push({ rating: r.rating ?? 0, listenedAt: r.listened_at ?? '' });
          }
          setAllReLists(map);
        });
    });
  }, [isLoaded]);

  // ── Community comparison (rated higher / lower than average) ─────────────
  const MIN_COMMUNITY = 10;
  type CompEntry = { album: LoggedAlbum; communityAvg: number; delta: number };
  const compHigher: CompEntry[] = [];
  const compLower:  CompEntry[] = [];
  for (const album of loggedAlbums.filter(a => a.rating > 0)) {
    const c = communityAvgs[album.id];
    if (!c || c.count < MIN_COMMUNITY) continue;
    const delta = album.rating - c.avg;
    if (delta >= 1)  compHigher.push({ album, communityAvg: c.avg, delta });
    if (delta <= -1) compLower.push({  album, communityAvg: c.avg, delta: Math.abs(delta) });
  }
  compHigher.sort((a, b) => b.delta - a.delta);
  compLower.sort((a, b) => b.delta - a.delta);
  const hasComparison = compHigher.length > 0 || compLower.length > 0;

  // ── Playlist progress ─────────────────────────────────────────────────────
  const loggedSet = new Set(
    loggedAlbums.map(a => `${a.title.toLowerCase()}::${(a.artist ?? '').toLowerCase()}`)
  );

  const flipTotal = FLIP_POOL.length;
  const flipDone  = FLIP_POOL.filter(
    a => loggedSet.has(`${a.title.toLowerCase()}::${a.artist.toLowerCase()}`)
  ).length;

  const playlistProgress = FEATURED_PLAYLISTS.map(pl => {
    if (pl.id === 'flip-a-record') return { ...pl, done: flipDone, total: flipTotal };
    const albums = playlistAlbums[pl.id] ?? [];
    const done = albums.filter(
      a => loggedSet.has(`${a.title.toLowerCase()}::${(a.artist ?? '').toLowerCase()}`)
    ).length;
    return { ...pl, done, total: albums.length };
  });

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
      <AlbumListModal
        title={selectedRating !== null ? `Rated ${selectedRating}` : null}
        albums={selectedAlbums}
        onClose={() => setSelectedRating(null)}
        onAlbumPress={handleAlbumPress}
      />
      <AlbumListModal
        title={listModal?.title ?? null}
        albums={listModal?.albums ?? []}
        onClose={() => setListModal(null)}
        onAlbumPress={(album) => { setListModal(null); setTimeout(() => handleAlbumPress(album), 300); }}
        onTitlePress={listModal?.onTitlePress}
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

        {/* ── Year Chart ────────────────────────────────────────────────── */}
        <View style={[s.card, { backgroundColor: cardBg, borderColor: BORDER }]}>
          <Text style={[s.cardTitle, { color: colors.textMuted }]}>BY RELEASE YEAR</Text>
          <YearChart loggedAlbums={loggedAlbums} onAlbumPress={handleAlbumPress} />
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

        {/* ── Rated Higher / Lower Than Average ─────────────────────────── */}
        {ratedAlbums.length > 0 && (
          <View style={[s.card, { backgroundColor: cardBg, borderColor: BORDER }]}>
            <Text style={[s.cardTitle, { color: colors.textMuted }]}>RATED VS COMMUNITY</Text>
            {!hasComparison && (
              <EmptyState text="Your ratings will be compared to the community once enough listeners have rated the same albums." />
            )}

            {/* Rated Higher */}
            <View style={rl.section}>
              <View style={rl.sectionHeader}>
                <View style={[rl.sectionBadge, { backgroundColor: GROW_CLR }]}>
                  <FontAwesome name="arrow-up" size={9} color="#fff" />
                </View>
                <Text style={[rl.sectionTitle, { color: colors.text }]}>Rated Higher</Text>
                <Text style={[rl.sectionSub, { color: SUBTEXT }]}>{compHigher.length} above avg</Text>
              </View>
              {compHigher.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[rl.carousel, { paddingTop: 4 }]}>
                  {compHigher.map(({ album, communityAvg }) => (
                    <ComparisonCard key={album.id} album={album} communityAvg={communityAvg} onPress={() => handleAlbumPress(album)} />
                  ))}
                </ScrollView>
              ) : (
                <EmptyState text="Ratings are revealed once more listeners have rated this album." />
              )}
            </View>

            {/* Rated Lower */}
            <View style={[rl.section, { marginTop: 8 }]}>
              <View style={rl.sectionHeader}>
                <View style={[rl.sectionBadge, { backgroundColor: FADE_CLR }]}>
                  <FontAwesome name="arrow-down" size={9} color="#fff" />
                </View>
                <Text style={[rl.sectionTitle, { color: colors.text }]}>Rated Lower</Text>
                <Text style={[rl.sectionSub, { color: SUBTEXT }]}>{compLower.length} below avg</Text>
              </View>
              {compLower.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[rl.carousel, { paddingTop: 4 }]}>
                  {compLower.map(({ album, communityAvg }) => (
                    <ComparisonCard key={album.id} album={album} communityAvg={communityAvg} onPress={() => handleAlbumPress(album)} />
                  ))}
                </ScrollView>
              ) : (
                <EmptyState text="Ratings are revealed once more listeners have rated this album." />
              )}
            </View>
          </View>
        )}

        {/* ── Most Listend Artists ───────────────────────────────────────── */}
        <View style={[s.card, { backgroundColor: cardBg, borderColor: BORDER }]}>
          <View style={s.cardTitleRow}>
            <Text style={[s.cardTitle, { color: colors.textMuted, marginBottom: 0 }]}>MOST LISTEND ARTISTS</Text>
            <View style={yc.toggle}>
              {(['listend', 'rated'] as const).map(v => (
                <Pressable key={v} onPress={() => setArtistView(v)} style={[yc.toggleBtn, artistView === v && yc.toggleActive]}>
                  <Text style={[yc.toggleText, artistView === v && yc.toggleTextActive]}>
                    {v === 'listend' ? 'Most Listend' : 'Highest Rated'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          {(() => {
            // Floor ensures 3 cards + 2 gaps never exceed container width on any screen size
            const GAP = 10;
            const cardW = Math.floor((screenWidth - 40 - 36 - GAP * 2) / 3);
            const items: [string, string][] = artistView === 'listend'
              ? topArtists.map(([a, c]) => [a, `${c} album${c !== 1 ? 's' : ''}`])
              : topRatedArtists.map(([a, avg]) => [a, `${avg.toFixed(1)} avg`]);
            if (items.length === 0) {
              return <EmptyState text={artistView === 'listend' ? 'Log some albums to see your top artists.' : 'Rate at least 2 albums per artist to see ratings.'} />;
            }
            // Chunk into explicit rows of 3 so layout never wraps unexpectedly
            const rows: [string, string][][] = [];
            for (let i = 0; i < items.length; i += 3) rows.push(items.slice(i, i + 3));
            return (
              <View style={{ gap: 16 }}>
                {rows.map((row, ri) => (
                  <View key={ri} style={{ flexDirection: 'row', gap: GAP }}>
                    {row.map(([artist, sub]) => (
                      <ArtistGridCard
                        key={artist}
                        artist={artist}
                        label={sub}
                        imageUrl={artistImages[artist]}
                        cardW={cardW}
                        onPress={() => setListModal({
                          title: artist,
                          albums: artistView === 'listend'
                            ? loggedAlbums.filter(a => a.artist === artist)
                            : loggedAlbums.filter(a => a.artist === artist && a.rating > 0),
                          onTitlePress: () => {
                            setListModal(null);
                            setTimeout(() => router.push({ pathname: '/artist-detail', params: { name: artist, artworkUrl: artistImages[artist] ?? '' } } as any), 300);
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

        {/* ── Most Listend Genres ────────────────────────────────────────── */}
        <View style={[s.card, { backgroundColor: cardBg, borderColor: BORDER }]}>
          <View style={s.cardTitleRow}>
            <Text style={[s.cardTitle, { color: colors.textMuted, marginBottom: 0 }]}>MOST LISTEND GENRES</Text>
            <View style={yc.toggle}>
              {(['listend', 'rated'] as const).map(v => (
                <Pressable key={v} onPress={() => setGenreView(v)} style={[yc.toggleBtn, genreView === v && yc.toggleActive]}>
                  <Text style={[yc.toggleText, genreView === v && yc.toggleTextActive]}>
                    {v === 'listend' ? 'Most Listend' : 'Highest Rated'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          {genreView === 'listend' ? (
            topGenres.length > 0 ? (
              <>
                {topGenres.map(([genre, count], i) => (
                  <BarRow
                    key={genre}
                    label={genre}
                    count={count}
                    maxCount={maxGenreCount}
                    colorIdx={i}
                    pill
                    onPress={() => setListModal({
                      title: genre,
                      albums: loggedAlbums.filter(a => a.genreTags?.slice(0, 2).includes(genre)),
                    })}
                  />
                ))}
                <Text style={s.footnote}>Based on {totalTagged} of {loggedAlbums.length} logged albums</Text>
              </>
            ) : (
              <EmptyState text="Log more albums to see your top genres here." />
            )
          ) : (
            topRatedGenres.length > 0 ? (
              <>
                {topRatedGenres.map(([genre, avg], i) => (
                  <BarRow
                    key={genre}
                    label={genre}
                    count={parseFloat(avg.toFixed(1))}
                    maxCount={10}
                    colorIdx={i}
                    pill
                    onPress={() => setListModal({
                      title: genre,
                      albums: loggedAlbums.filter(a => a.genreTags?.slice(0, 2).includes(genre) && a.rating > 0),
                    })}
                  />
                ))}
                <Text style={s.footnote}>Based on rated albums only</Text>
              </>
            ) : (
              <EmptyState text="Rate some albums to see your highest rated genres." />
            )
          )}
        </View>

        {/* ── Re-Listend ─────────────────────────────────────────────────── */}
        {reListenedAlbums.length > 0 && (
          <View style={[s.card, { backgroundColor: cardBg, borderColor: BORDER }]}>
            <Text style={[s.cardTitle, { color: colors.textMuted }]}>RE-LISTEND</Text>

            {/* Stats strip */}
            <View style={[rl.strip, { borderColor: BORDER }]}>
              <View style={rl.cell}>
                <Text style={rl.val}>{totalReListens}</Text>
                <Text style={rl.lbl}>Re-Listens</Text>
              </View>
              <View style={[rl.divider, { backgroundColor: BORDER }]} />
              <View style={rl.cell}>
                <Text style={[rl.val, { color: evAvgDelta >= 0.5 ? GROW_CLR : evAvgDelta <= -0.5 ? FADE_CLR : SUBTEXT }]}>
                  {evAvgDelta > 0 ? '+' : ''}{evAvgDelta.toFixed(1)}
                </Text>
                <Text style={rl.lbl}>Avg Change</Text>
              </View>
              <View style={[rl.divider, { backgroundColor: BORDER }]} />
              <View style={rl.cell}>
                <Text style={rl.val}>{evFirstListenAvg > 0 ? evFirstListenAvg.toFixed(1) : '—'}</Text>
                <Text style={rl.lbl}>First Listen</Text>
              </View>
              <View style={[rl.divider, { backgroundColor: BORDER }]} />
              <View style={rl.cell}>
                <Text style={[rl.val, { color: evLongTermAvg > evFirstListenAvg ? GROW_CLR : evLongTermAvg < evFirstListenAvg ? FADE_CLR : TEXT }]}>
                  {evLongTermAvg > 0 ? evLongTermAvg.toFixed(1) : '—'}
                </Text>
                <Text style={rl.lbl}>Long-Term</Text>
              </View>
            </View>

            {/* Growers */}
            {evGrowers.length > 0 && (
              <View style={rl.section}>
                <View style={rl.sectionHeader}>
                  <View style={[rl.sectionBadge, { backgroundColor: GROW_CLR }]}>
                    <FontAwesome name="arrow-up" size={9} color="#fff" />
                  </View>
                  <Text style={[rl.sectionTitle, { color: colors.text }]}>Growers</Text>
                  <Text style={[rl.sectionSub, { color: SUBTEXT }]}>{evGrowers.length} grew on you</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={rl.carousel}>
                  {evGrowers.map(entry => (
                    <EvolutionCard
                      key={entry.album.id}
                      entry={entry}
                      onPress={() => setListModal({ title: entry.album.title, albums: [entry.album] })}
                    />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Faders */}
            {evFaders.length > 0 && (
              <View style={rl.section}>
                <View style={rl.sectionHeader}>
                  <View style={[rl.sectionBadge, { backgroundColor: FADE_CLR }]}>
                    <FontAwesome name="arrow-down" size={9} color="#fff" />
                  </View>
                  <Text style={[rl.sectionTitle, { color: colors.text }]}>Faders</Text>
                  <Text style={[rl.sectionSub, { color: SUBTEXT }]}>{evFaders.length} faded over time</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={rl.carousel}>
                  {evFaders.map(entry => (
                    <EvolutionCard
                      key={entry.album.id}
                      entry={entry}
                      onPress={() => setListModal({ title: entry.album.title, albums: [entry.album] })}
                    />
                  ))}
                </ScrollView>
              </View>
            )}

            {evGrowers.length === 0 && evFaders.length === 0 && (
              <EmptyState text="Re-listen to albums and rate them to see how your opinion changes." />
            )}
          </View>
        )}

        {/* ── Playlist Progress ──────────────────────────────────────────── */}
        <View style={[s.card, { backgroundColor: cardBg, borderColor: BORDER }]}>
          <Text style={[s.cardTitle, { color: colors.textMuted }]}>PLAYLIST PROGRESS</Text>
          {(() => {
            const COL = 3;
            const RING_GAP = 12;
            const cellW = Math.floor((screenWidth - 40 - 36 - RING_GAP * (COL - 1)) / COL);
            const rows: typeof playlistProgress[] = [];
            for (let i = 0; i < playlistProgress.length; i += COL) {
              rows.push(playlistProgress.slice(i, i + COL));
            }
            return (
              <View style={{ gap: 20 }}>
                {rows.map((row, ri) => (
                  <View key={ri} style={{ flexDirection: 'row', gap: RING_GAP }}>
                    {row.map(pl => (
                      <Pressable
                        key={pl.id}
                        style={({ pressed }) => ({ width: cellW, alignItems: 'center', gap: 6, opacity: pressed ? 0.65 : 1 })}
                        onPress={() => {
                          if (pl.id === 'flip-a-record') {
                            router.push('/flip-a-record' as any);
                          } else {
                            router.push({ pathname: '/discover-featured-playlist', params: { id: pl.id, name: pl.name } } as any);
                          }
                        }}>
                        <ProgressRing done={pl.done} total={pl.total} size={68} />
                        <Text style={pp.name} numberOfLines={2}>{pl.name}</Text>
                        <Text style={pp.count}>
                          {pl.total > 0 ? `${pl.done} / ${pl.total}` : '—'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ))}
              </View>
            );
          })()}
        </View>

      </ScrollView>
    </>
  );
}

// ─── Playlist Progress ────────────────────────────────────────────────────────

const FEATURED_PLAYLISTS = [
  { id: 'flip-a-record',    name: 'Flip a Record'    },
  { id: 'all-time-classics',name: 'All-Time Classics' },
  { id: 'late-night',       name: 'Late Night'        },
  { id: 'summer',           name: 'Summer'            },
  { id: 'heartbreak',       name: 'Heartbreak'        },
  { id: 'road-trip',        name: 'Road Trip'         },
  { id: 'chill',            name: 'Chill'             },
  { id: 'hidden-gems',      name: 'Hidden Gems'       },
  { id: 'essentials',       name: 'Essentials'        },
];

function ProgressRing({
  done,
  total,
  size = 72,
}: {
  done: number;
  total: number;
  size?: number;
}) {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = total > 0 ? done / total : 0;
  const dash = circumference * pct;
  const gap = circumference - dash;
  const center = size / 2;
  const label = total > 0 ? `${Math.round(pct * 100)}%` : '0%';
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {/* Track */}
        <Circle
          cx={center} cy={center} r={radius}
          stroke={BORDER} strokeWidth={strokeWidth} fill="none"
        />
        {/* Progress */}
        <Circle
          cx={center} cy={center} r={radius}
          stroke={ACCENT} strokeWidth={strokeWidth} fill="none"
          strokeDasharray={`${dash} ${gap}`}
          strokeLinecap="round"
          rotation="-90"
          origin={`${center}, ${center}`}
        />
      </Svg>
      <Text style={{ color: TEXT, fontSize: 13, fontWeight: '700' }}>{label}</Text>
    </View>
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

// ─── Community comparison card ────────────────────────────────────────────────

function ComparisonCard({ album, communityAvg, onPress }: {
  album: LoggedAlbum;
  communityAvg: number;
  onPress: () => void;
}) {
  const delta    = album.rating - communityAvg;
  const isHigher = delta > 0;
  const deltaColor = isHigher ? GROW_CLR : FADE_CLR;
  const sign       = isHigher ? '+' : '';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [cc.card, { opacity: pressed ? 0.75 : 1 }]}>
      {album.artworkUrl ? (
        <ExpoImage source={{ uri: album.artworkUrl }} style={cc.art} contentFit="cover" cachePolicy="disk" />
      ) : (
        <View style={[cc.art, { backgroundColor: CARD_BG, alignItems: 'center', justifyContent: 'center' }]}>
          <FontAwesome name="music" size={20} color="rgba(255,255,255,0.3)" />
        </View>
      )}
      <View style={[cc.deltaBadge, { backgroundColor: deltaColor }]}>
        <Text style={cc.deltaBadgeText}>{sign}{delta.toFixed(1)}</Text>
      </View>
      <Text style={cc.title} numberOfLines={2}>{album.title}</Text>
      <VolumeBadge rating={album.rating} />
      <Text style={cc.communityAvg}>Community: {communityAvg.toFixed(1)}</Text>
    </Pressable>
  );
}

const cc = StyleSheet.create({
  card:           { width: 110, gap: 5 },
  art:            { width: 110, height: 110, borderRadius: 10 },
  deltaBadge:     { position: 'absolute', top: 8, right: 8, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 },
  deltaBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  title:          { color: TEXT,    fontSize: 12, fontWeight: '600', lineHeight: 16 },
  communityAvg:   { color: SUBTEXT, fontSize: 11, fontWeight: '500' },
});

const pp = StyleSheet.create({
  name:  { color: TEXT,    fontSize: 11, fontWeight: '600', textAlign: 'center', lineHeight: 15 },
  count: { color: SUBTEXT, fontSize: 11, fontWeight: '500', textAlign: 'center' },
});

const rl = StyleSheet.create({
  strip:        { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', marginBottom: 4 },
  cell:         { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 3 },
  divider:      { width: StyleSheet.hairlineWidth, height: 32 },
  val:          { color: TEXT,    fontSize: 17, fontWeight: '700' },
  lbl:          { color: SUBTEXT, fontSize: 10, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.6, textAlign: 'center' },
  section:      { paddingTop: 16, gap: 10 },
  sectionHeader:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionBadge: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: TEXT },
  sectionSub:   { fontSize: 12, fontWeight: '500' },
  carousel:     { gap: 12, paddingBottom: 4 },
});
