import { StyleSheet, View, Text, ScrollView, Pressable, Modal, FlatList, useWindowDimensions, TextInput, ActivityIndicator, Platform, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { useState, useEffect, Fragment, useMemo } from 'react';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { usePro } from '@/context/ProContext';
import { getProTheme, themeToColors } from '@/lib/proThemes';
import { ProBadge } from '@/components/ProBadge';
import { useAlbums, LoggedAlbum } from '@/context/AlbumsContext';
import { supabase } from '@/lib/supabase';
import { cardWidth as calcCardWidth, GAP, COLS, PADDING } from '@/components/AlbumGridCard';
import { FLIP_POOL } from '@/constants/FlipPool';
import { useFlip } from '@/context/FlipContext';

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

const TAG_COLORS  = ['#7a5018', '#8B6914', '#5c3a10', '#6B4422', '#9a7020', '#4a3218'];
const GROW_CLR    = '#a8c44a';
const FADE_CLR    = '#B85040';

type EvolutionEntry = {
  album:        LoggedAlbum;
  firstRating:  number;
  latestRating: number;
  delta:        number;
};

function EvolutionCard({ entry, onPress, textColor = TEXT, subtextColor = SUBTEXT, surfaceColor = CARD_BG }: {
  entry: EvolutionEntry; onPress: () => void;
  textColor?: string; subtextColor?: string; surfaceColor?: string;
}) {
  const { album, firstRating, latestRating, delta } = entry;
  const isGrow     = delta > 0;
  const deltaColor = isGrow ? GROW_CLR : FADE_CLR;
  const sign       = isGrow ? '+' : '';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [ev.card, { opacity: pressed ? 0.75 : 1 }]}>
      {album.artworkUrl ? (
        <ExpoImage source={{ uri: album.artworkUrl }} style={ev.art} contentFit="cover" cachePolicy="disk" />
      ) : (
        <View style={[ev.art, { backgroundColor: surfaceColor, alignItems: 'center', justifyContent: 'center' }]}>
          <FontAwesome name="music" size={22} color={subtextColor} />
        </View>
      )}
      <View style={[ev.badge, { backgroundColor: deltaColor }]}>
        <Text style={ev.badgeText}>{sign}{delta}</Text>
      </View>
      <Text style={[ev.title, { color: textColor }]} numberOfLines={2}>{album.title}</Text>
      <View style={ev.ratingRow}>
        <Text style={[ev.ratingOld, { color: subtextColor }]}>{firstRating}</Text>
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

function VolumeBadge({ rating, tint = ACCENT }: { rating: number; tint?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
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

// ─── Album List Modal (reused for rating drilldown + year drilldown) ──────────

type ModalColors = {
  background: string; surface: string; text: string;
  subtext: string; tint: string; border: string;
};

function AlbumListModal({
  title,
  albums,
  onClose,
  onAlbumPress,
  onTitlePress,
  themeColors,
}: {
  title: string | null;
  albums: LoggedAlbum[];
  onClose: () => void;
  onAlbumPress: (album: LoggedAlbum) => void;
  onTitlePress?: () => void;
  themeColors?: ModalColors;
}) {
  const insets  = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cw      = calcCardWidth(width);

  const bg      = themeColors?.background ?? '#161616';
  const txt     = themeColors?.text       ?? TEXT;
  const sub     = themeColors?.subtext    ?? SUBTEXT;
  const tint    = themeColors?.tint       ?? ACCENT;
  const border  = themeColors?.border     ?? BORDER;
  const surface = themeColors?.surface    ?? CARD_BG;

  return (
    <Modal visible={title !== null} transparent animationType="slide" onRequestClose={onClose}>
      <View style={rm.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[rm.sheet, { backgroundColor: bg, borderTopColor: border, paddingBottom: Math.max(insets.bottom + 16, 32) }]}>
          <View style={[rm.handle, { backgroundColor: border }]} />
          <View style={rm.header}>
            <Pressable onPress={onTitlePress} disabled={!onTitlePress} style={{ flex: 1, marginRight: 12 }}>
              <Text style={[rm.title, { color: onTitlePress ? tint : txt }]}>{title}</Text>
              {onTitlePress && (
                <Text style={{ color: sub, fontSize: 12, marginTop: 2 }}>View artist profile →</Text>
              )}
            </Pressable>
            <Pressable onPress={onClose} hitSlop={12}>
              <FontAwesome name="times" size={16} color={sub} />
            </Pressable>
          </View>
          <Text style={[rm.subtitle, { color: sub }]}>{albums.length} album{albums.length !== 1 ? 's' : ''}</Text>

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
                  <View style={[rm.fallback, { width: cw, height: cw, backgroundColor: surface }]}>
                    <FontAwesome name="music" size={cw * 0.28} color={sub} />
                  </View>
                )}
                <Text style={[rm.cardTitle,  { color: txt }]} numberOfLines={1}>{item.title}</Text>
                <Text style={[rm.cardArtist, { color: sub }]} numberOfLines={1}>{item.artist}</Text>
                {item.rating > 0 && (
                  <View style={{ marginTop: 3 }}>
                    <VolumeBadge rating={item.rating} tint={tint} />
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
  sheet:      { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: StyleSheet.hairlineWidth, maxHeight: '85%' },
  handle:     { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  title:      { fontSize: 18, fontWeight: '700' },
  subtitle:   { fontSize: 13, paddingHorizontal: 16, marginBottom: 8 },
  fallback:   { borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  cardTitle:  { fontSize: 12, fontWeight: '600', marginTop: 4 },
  cardArtist: { fontSize: 11, marginTop: 1 },
  cardRating: { fontSize: 11, fontWeight: '700', marginTop: 2 },
});

// ─── Artist List Modal ────────────────────────────────────────────────────────

function ArtistListModal({
  visible,
  albums,
  onClose,
  onArtistPress,
  themeColors,
}: {
  visible: boolean;
  albums: LoggedAlbum[];
  onClose: () => void;
  onArtistPress: (artist: string, artistAlbums: LoggedAlbum[]) => void;
  themeColors?: ModalColors;
}) {
  const insets = useSafeAreaInsets();
  const bg     = themeColors?.background ?? '#161616';
  const txt    = themeColors?.text       ?? TEXT;
  const sub    = themeColors?.subtext    ?? SUBTEXT;
  const border = themeColors?.border     ?? BORDER;
  const tint   = themeColors?.tint       ?? ACCENT;

  const artists = useMemo(() => {
    const map = new Map<string, LoggedAlbum[]>();
    for (const a of albums) {
      const name = a.artist || 'Unknown';
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push(a);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  }, [albums]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={rm.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[rm.sheet, { backgroundColor: bg, borderTopColor: border, paddingBottom: Math.max(insets.bottom + 16, 32) }]}>
          <View style={[rm.handle, { backgroundColor: border }]} />
          <View style={rm.header}>
            <Text style={[rm.title, { color: txt, flex: 1 }]}>Unique Artists</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <FontAwesome name="times" size={16} color={sub} />
            </Pressable>
          </View>
          <Text style={[rm.subtitle, { color: sub }]}>{artists.length} artist{artists.length !== 1 ? 's' : ''}</Text>
          <FlatList
            data={artists}
            keyExtractor={([name]) => name}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 }}
            renderItem={({ item: [name, artistAlbums] }) => (
              <Pressable
                onPress={() => { onClose(); setTimeout(() => onArtistPress(name, artistAlbums), 300); }}
                style={({ pressed }) => [{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: border,
                  opacity: pressed ? 0.6 : 1,
                }]}>
                <Text style={{ color: txt, fontSize: 15, fontWeight: '600', flex: 1 }} numberOfLines={1}>{name}</Text>
                <Text style={{ color: sub, fontSize: 13 }}>{artistAlbums.length} album{artistAlbums.length !== 1 ? 's' : ''}</Text>
                <FontAwesome name="chevron-right" size={11} color={sub} style={{ marginLeft: 10 }} />
              </Pressable>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

// ─── Hero Stats ───────────────────────────────────────────────────────────────

function StatRow({
  stats,
  textColor = TEXT,
  subtextColor = SUBTEXT,
  borderColor = BORDER,
}: {
  stats: { label: string; value: string | number; onPress?: () => void }[];
  textColor?: string;
  subtextColor?: string;
  borderColor?: string;
}) {
  return (
    <View style={hs.row}>
      {stats.map((stat, i) => (
        <Fragment key={stat.label}>
          <Pressable
            style={({ pressed }) => [hs.box, stat.onPress && pressed && { opacity: 0.6 }]}
            onPress={stat.onPress}
            disabled={!stat.onPress}>
            <Text style={[hs.value, { color: textColor }]}>{stat.value}</Text>
            <Text style={[hs.label, { color: subtextColor }]}>{stat.label}</Text>
          </Pressable>
          {i < stats.length - 1 && <View style={[hs.divider, { backgroundColor: borderColor }]} />}
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
  tint = ACCENT,
  trackColor = BORDER,
  textColor = TEXT,
  subtextColor = SUBTEXT,
}: {
  loggedAlbums: LoggedAlbum[];
  onRatingPress: (rating: number, albums: LoggedAlbum[]) => void;
  tint?: string;
  trackColor?: string;
  textColor?: string;
  subtextColor?: string;
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
            <Text style={[rd.ratingLabel, { color: subtextColor }]}>{rating}</Text>
            <View style={[rd.track, { backgroundColor: trackColor }]}>
              <View style={[rd.fill, {
                flex: filled,
                opacity: 0.4 + (count / maxCount) * 0.6,
                backgroundColor: tint,
              }]} />
              {filled < 1 && <View style={{ flex: 1 - filled }} />}
            </View>
            <Text style={[rd.countLabel, { color: textColor }]}>{count}</Text>
          </Pressable>
        );
      })}
      <Text style={[rd.hint, { color: subtextColor }]}>Tap a bar to see albums</Text>
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
  tint = ACCENT,
  trackColor = BORDER,
  textColor = TEXT,
  subtextColor = SUBTEXT,
  pillBgColor,
}: {
  label: string;
  count: number;
  maxCount: number;
  colorIdx: number;
  pill?: boolean;
  onPress?: () => void;
  tint?: string;
  trackColor?: string;
  textColor?: string;
  subtextColor?: string;
  pillBgColor?: string;
}) {
  const pct = maxCount > 0 ? Math.max(count / maxCount, 0.02) : 0;
  return (
    <Pressable
      style={({ pressed }) => [br.row, onPress && { opacity: pressed ? 0.6 : 1 }]}
      onPress={onPress}
      disabled={!onPress}>
      {pill ? (
        <View style={[br.pill, pillBgColor ? { backgroundColor: pillBgColor } : undefined]}>
          <Text style={[br.pillText, { color: textColor }]} numberOfLines={1}>{label}</Text>
        </View>
      ) : (
        <Text style={[br.label, { color: textColor }]} numberOfLines={1}>{label}</Text>
      )}
      <View style={[br.track, { backgroundColor: trackColor }]}>
        <View style={[br.fill, { flex: pct, opacity: 0.45 + pct * 0.55, backgroundColor: tint }]} />
        <View style={{ flex: 1 - pct }} />
      </View>
      <Text style={[br.count, { color: subtextColor }]}>{count}</Text>
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
  textColor = TEXT,
  subtextColor = SUBTEXT,
}: {
  artist: string;
  label: string;
  imageUrl?: string;
  onPress: () => void;
  cardW: number;
  textColor?: string;
  subtextColor?: string;
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
      <Text style={[ag.name, { color: textColor }]} numberOfLines={2}>{artist}</Text>
      <Text style={[ag.sub,  { color: subtextColor }]}>{label}</Text>
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
  tint = ACCENT,
  textColor = TEXT,
  subtextColor = SUBTEXT,
  borderColor = BORDER,
  themeColors,
}: {
  loggedAlbums: LoggedAlbum[];
  onAlbumPress: (album: LoggedAlbum) => void;
  tint?: string;
  textColor?: string;
  subtextColor?: string;
  borderColor?: string;
  themeColors?: ModalColors;
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
        themeColors={themeColors}
      />

      {/* Header row: back button + toggle */}
      <View style={yc.headerRow}>
        {drillDecade !== null ? (
          <Pressable
            style={({ pressed }) => [yc.backBtn, { opacity: pressed ? 0.6 : 1 }]}
            onPress={() => setDrillDecade(null)}>
            <FontAwesome name="chevron-left" size={11} color={tint} />
            <Text style={[yc.backText, { color: tint }]}>All decades</Text>
          </Pressable>
        ) : <View />}

        <View style={[yc.toggle, { backgroundColor: borderColor }]}>
          {(['albums', 'ratings'] as ChartView[]).map(v => (
            <Pressable
              key={v}
              style={[yc.toggleBtn, view === v && { backgroundColor: tint }]}
              onPress={() => setView(v)}>
              <Text style={[yc.toggleText, { color: subtextColor }, view === v && yc.toggleTextActive]}>
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
            <View key={pct} style={[yc.guide, { bottom: pct * CHART_H + 28, backgroundColor: borderColor }]} />
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
                <Text style={[yc.valLabel, { opacity: valLabel ? 1 : 0, color: textColor }]}>{valLabel || '0'}</Text>
                <View style={[yc.barArea, { height: CHART_H }]}>
                  <View style={[yc.bar, { height: barH, backgroundColor: tint }]} />
                </View>
                <Text style={[yc.decLabel, { color: subtextColor }]}>{bucket.label}</Text>
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
            <Text style={[yc.seeAllText, { color: tint }]}>
              See all {loggedAlbums.filter(a => a.year >= drillDecade && a.year < drillDecade + 10).length} albums from the {drillDecade}s
            </Text>
            <FontAwesome name="chevron-right" size={11} color={tint} />
          </Pressable>
          <Text style={[yc.hint, { color: subtextColor }]}>Tap a bar to see albums</Text>
        </>
      ) : (
        <Text style={[yc.hint, { color: subtextColor }]}>Tap a decade to explore</Text>
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
  const { isPro, proTheme: ownProTheme, showPaywall } = usePro();
  const params = useLocalSearchParams<{ userId?: string; proTheme?: string; displayName?: string }>();
  const viewedUserId  = params.userId ?? null;

  // Resolve colors: other-user uses their proTheme param; own view uses own Pro context
  const activeThemeKey = viewedUserId ? (params.proTheme ?? 'default') : (isPro ? ownProTheme : 'default');
  const colors = (activeThemeKey && activeThemeKey !== 'default')
    ? themeToColors(getProTheme(activeThemeKey))
    : Colors[colorScheme ?? 'dark'];
  const isDark = colors.isDark;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { loggedAlbums: ownAlbums, isLoaded: ownLoaded, topAlbums: myTop5Albums, topArtists: myTop5Artists } = useAlbums();
  const { history: flipHistory } = useFlip();

  // Other-user album fetch
  const [otherAlbums,  setOtherAlbums]  = useState<LoggedAlbum[]>([]);
  const [otherLoaded,  setOtherLoaded]  = useState(false);

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
        const albums: LoggedAlbum[] = (data ?? []).map((row, i) => ({
          id:            row.spotify_id,
          title:         row.title        ?? '',
          artist:        row.artist       ?? '',
          year:          row.year         ?? 0,
          rating:        row.rating       ?? 0,
          dateLogged:    row.listened_at  ?? new Date().toISOString(),
          artworkUrl:    row.artwork_url  ?? undefined,
          coverColor:    '#2E2018',
          durationMs:    row.duration_ms  ?? undefined,
          reListenCount: row.re_listen_count ?? 0,
          isRelistened:  row.is_relistened   ?? false,
          genreTags:     row.genre_tags   ?? [],
        }));
        setOtherAlbums(albums);
        setOtherLoaded(true);
      });
  }, [viewedUserId]);

  const loggedAlbums = viewedUserId ? otherAlbums  : ownAlbums;
  const isLoaded     = viewedUserId ? otherLoaded  : ownLoaded;

  const [selectedRating, setSelectedRating]   = useState<number | null>(null);
  const [selectedAlbums, setSelectedAlbums]   = useState<LoggedAlbum[]>([]);
  const [listModal,      setListModal]        = useState<{ title: string; albums: LoggedAlbum[]; onTitlePress?: () => void } | null>(null);
  const [artistView,     setArtistView]       = useState<'listend' | 'rated'>('listend');
  const [genreView,      setGenreView]        = useState<'listend' | 'rated'>('listend');

  // ── Compare tab ───────────────────────────────────────────────────────────
  const [mainTab,          setMainTab]          = useState<'stats' | 'compare'>('stats');
  const [compareQuery,     setCompareQuery]     = useState('');
  const [compareSearching, setCompareSearching] = useState(false);
  const [compareError,     setCompareError]     = useState<string | null>(null);
  const [compareFriend,    setCompareFriend]    = useState<{
    id: string; displayName: string; username: string;
    avatarUrl: string | null; isPro: boolean;
  } | null>(null);
  const [friendAlbums,  setFriendAlbums]  = useState<LoggedAlbum[]>([]);
  const [friendLoading, setFriendLoading] = useState(false);
  const [sharedModal,        setSharedModal]        = useState<'albums' | 'artists' | null>(null);
  const [followingList,      setFollowingList]      = useState<{ id: string; displayName: string; username: string; avatarUrl: string | null; isPro: boolean }[]>([]);
  const [friendTop5Albums,   setFriendTop5Albums]   = useState<{ id: string; title: string; artworkUrl?: string }[]>([]);
  const [friendTop5Artists,  setFriendTop5Artists]  = useState<{ id: string; name: string; artworkUrl?: string }[]>([]);
  const [friendLikedArtists, setFriendLikedArtists] = useState<{ artistId: string; name: string }[]>([]);
  const [myLikedArtists,     setMyLikedArtists]     = useState<{ artistId: string; name: string }[]>([]);
  const [friendReviewCount,  setFriendReviewCount]  = useState(0);
  const [artistImages,   setArtistImages]     = useState<Record<string, string>>({});
  const [allReLists,     setAllReLists]       = useState<Map<string, { rating: number; listenedAt: string }[]>>(new Map());
  const [communityAvgs,  setCommunityAvgs]    = useState<Record<string, { avg: number; count: number }>>({});
  const [playlistAlbums, setPlaylistAlbums]   = useState<Record<string, { title: string; artist: string }[]>>({});
  const [genreAlbums,    setGenreAlbums]      = useState<Record<string, { title: string; artist: string }[]>>({});
  const [decadeAlbums,   setDecadeAlbums]     = useState<Record<string, { title: string; artist: string }[]>>({});
  const [showAllPlaylists, setShowAllPlaylists] = useState(false);
  const [artistModalOpen,  setArtistModalOpen]  = useState(false);
  const { width: screenWidth } = useWindowDimensions();

  const cardBg  = colors.surface;
  const cardBorder = colors.border;

  // ── Hero stats ────────────────────────────────────────────────────────────
  const ratedAlbums    = loggedAlbums.filter(a => a.rating > 0);
  const avgRating      = ratedAlbums.length > 0
    ? (ratedAlbums.reduce((sum, a) => sum + a.rating, 0) / ratedAlbums.length).toFixed(1)
    : '—';
  const uniqueArtists  = new Set(loggedAlbums.map(a => a.artist)).size;
  const totalMs        = loggedAlbums.reduce((sum, a) => sum + (a.durationMs ?? 0), 0);
  const totalHours     = totalMs > 0 ? Math.round(totalMs / 3_600_000) : '—';

  // ── Streak helpers ────────────────────────────────────────────────────────
  // Build a set of "YYYY-M-D" keys (0-indexed month) for every day with a log
  const listenDayKeys = new Set(
    loggedAlbums.map(a => {
      const d = new Date(a.dateLogged);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    })
  );

  // Convert a set of "YYYY-M-D" keys → sorted timestamps → find the longest run
  function longestConsecutiveStreak(dayKeys: Set<string>): number {
    if (dayKeys.size === 0) return 0;
    const times = [...dayKeys]
      .map(k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m, d).getTime(); })
      .sort((a, b) => a - b);
    let longest = 1, current = 1;
    for (let i = 1; i < times.length; i++) {
      if (times[i] - times[i - 1] === 86_400_000) { current++; longest = Math.max(longest, current); }
      else { current = 1; }
    }
    return longest;
  }

  // Current streak — count back from today
  let streakDays = 0;
  const today = new Date();
  for (let i = 0; i <= 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (listenDayKeys.has(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`)) { streakDays++; }
    else { break; }
  }

  // Longest streak ever
  const longestStreak = longestConsecutiveStreak(listenDayKeys);

  // Flip a Record streak — longest consecutive logged run across all history
  const flipStreak = (() => {
    let best = 0, current = 0;
    for (const r of flipHistory) {
      if (r.status === 'pending') continue;
      if (r.status === 'logged') { current++; if (current > best) best = current; }
      else current = 0;
    }
    return best;
  })();

  const heroStats = [
    { label: 'Albums Logged',   value: loggedAlbums.length, onPress: loggedAlbums.length > 0 ? () => setListModal({ title: 'Albums Logged', albums: loggedAlbums }) : undefined },
    { label: 'Listening Hours', value: totalHours },
    { label: 'Unique Artists',  value: uniqueArtists, onPress: uniqueArtists > 0 ? () => setArtistModalOpen(true) : undefined },
    { label: 'Avg Rating',      value: avgRating },
    { label: 'Top Flip Streak', value: flipStreak > 0 ? flipStreak : '—' },
    { label: 'Best Streak',     value: longestStreak > 0 ? longestStreak : '—' },
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
    const genre = (album.genreTags ?? []).find(t => MAIN_GENRES.has(t));
    if (genre) genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
  }
  const topGenres     = [...genreCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxGenreCount = topGenres[0]?.[1] ?? 1;
  const totalTagged   = loggedAlbums.filter(a => (a.genreTags ?? []).some(t => MAIN_GENRES.has(t))).length;

  // ── Highest rated genres ──────────────────────────────────────────────────
  const genreRatings = new Map<string, number[]>();
  for (const album of loggedAlbums) {
    if (album.rating <= 0) continue;
    const genre = (album.genreTags ?? []).find(t => MAIN_GENRES.has(t));
    if (genre) {
      if (!genreRatings.has(genre)) genreRatings.set(genre, []);
      genreRatings.get(genre)!.push(album.rating);
    }
  }
  const topRatedGenres = [...genreRatings.entries()]
    .map(([genre, ratings]) => [genre, ratings.reduce((s, r) => s + r, 0) / ratings.length] as [string, number])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);


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

  // Fetch all re-listen rows for grower/fader computation (scoped to viewed user)
  useEffect(() => {
    if (!isLoaded) return;
    const run = async (uid: string) => {
      const { data } = await supabase
        .from('re_listens')
        .select('spotify_id, rating, listened_at')
        .eq('user_id', uid)
        .order('listened_at', { ascending: true });
      const map = new Map<string, { rating: number; listenedAt: string }[]>();
      for (const r of data ?? []) {
        if (!map.has(r.spotify_id)) map.set(r.spotify_id, []);
        map.get(r.spotify_id)!.push({ rating: r.rating ?? 0, listenedAt: r.listened_at ?? '' });
      }
      setAllReLists(map);
    };
    if (viewedUserId) {
      run(viewedUserId);
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user?.id) run(session.user.id);
      });
    }
  }, [isLoaded, viewedUserId]);

  // Fetch community averages for all rated albums (excluding viewed user's own rating)
  useEffect(() => {
    if (!isLoaded) return;
    const ratedAlbums = loggedAlbums.filter(a => a.rating > 0);
    if (ratedAlbums.length === 0) return;
    const run = async (excludeUid: string) => {
      // Match by title+year (not spotify_id) — different users may have different AM IDs for same album
      const { data } = await supabase
        .from('user_albums')
        .select('title, year, rating')
        .gt('rating', 0)
        .neq('user_id', excludeUid);
      // Build community map keyed by title_lower::year
      const communityMap: Record<string, number[]> = {};
      for (const row of data ?? []) {
        const key = `${(row.title ?? '').toLowerCase()}::${row.year ?? 0}`;
        if (!communityMap[key]) communityMap[key] = [];
        communityMap[key].push(row.rating);
      }
      const avgs: Record<string, { avg: number; count: number }> = {};
      for (const album of ratedAlbums) {
        const key = `${album.title.toLowerCase()}::${album.year ?? 0}`;
        const ratings = communityMap[key];
        if (!ratings || ratings.length === 0) continue;
        avgs[album.id] = { avg: ratings.reduce((s, r) => s + r, 0) / ratings.length, count: ratings.length };
      }
      setCommunityAvgs(avgs);
    };
    if (viewedUserId) {
      run(viewedUserId);
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user?.id) run(session.user.id);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, viewedUserId]);


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

  // Fetch genre album lists (once)
  useEffect(() => {
    const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
    fetch(`${API_URL}/genres`)
      .then(r => r.ok ? r.json() : {})
      .then((data: Record<string, { title: string; artist: string }[]>) => setGenreAlbums(data))
      .catch(() => {});
  }, []);

  // Fetch decade album lists (once)
  useEffect(() => {
    const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
    fetch(`${API_URL}/decades`)
      .then(r => r.ok ? r.json() : {})
      .then((data: Record<string, { title: string; artist: string }[]>) => setDecadeAlbums(data))
      .catch(() => {});
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

  const playlistProgress = [
    ...FEATURED_PLAYLISTS.map(pl => {
      if (pl.id === 'flip-a-record') return { ...pl, kind: 'featured' as const, done: flipDone, total: flipTotal };
      const albums = playlistAlbums[pl.id] ?? [];
      const done = albums.filter(
        a => loggedSet.has(`${a.title.toLowerCase()}::${(a.artist ?? '').toLowerCase()}`)
      ).length;
      return { ...pl, kind: 'featured' as const, done, total: albums.length };
    }),
    ...GENRE_LABELS.map(label => {
      const albums = genreAlbums[label] ?? [];
      const done = albums.filter(
        a => loggedSet.has(`${a.title.toLowerCase()}::${(a.artist ?? '').toLowerCase()}`)
      ).length;
      return { id: label, name: label, kind: 'genre' as const, done, total: albums.length };
    }),
    ...DECADE_LABELS.map(label => {
      const albums = decadeAlbums[label] ?? [];
      const done = albums.filter(
        a => loggedSet.has(`${a.title.toLowerCase()}::${(a.artist ?? '').toLowerCase()}`)
      ).length;
      return { id: label, name: label, kind: 'decade' as const, done, total: albums.length };
    }),
  ];

  // ── Compare: load following list when tab opens ───────────────────────────
  useEffect(() => {
    if (mainTab !== 'compare' || viewedUserId || followingList.length > 0) return;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const uid = session?.user?.id;
      if (!uid) return;
      const { data } = await supabase
        .from('follows')
        .select('following_id, profiles!follows_following_id_fkey(id, display_name, username, avatar_url, is_pro)')
        .eq('follower_id', uid)
        .limit(50);
      if (!data) return;
      setFollowingList(
        (data as any[])
          .map(r => r.profiles)
          .filter(Boolean)
          .map((p: any) => ({
            id: p.id,
            displayName: p.display_name || p.username || '',
            username: p.username || '',
            avatarUrl: p.avatar_url ?? null,
            isPro: p.is_pro ?? false,
          }))
      );
    });
  }, [mainTab]);

  // ── Compare: search friend ────────────────────────────────────────────────
  async function searchFriend() {
    const q = compareQuery.trim().replace(/^@/, '');
    if (!q) return;
    setCompareSearching(true);
    setCompareError(null);
    setCompareFriend(null);
    setFriendAlbums([]);
    const pattern = `%${q}%`;
    const { data: rows } = await supabase
      .from('profiles')
      .select('id, display_name, username, avatar_url, is_pro')
      .or(`username.ilike.${pattern},display_name.ilike.${pattern}`)
      .limit(1);
    const data = rows?.[0] ?? null;
    if (!data) {
      setCompareError('No user found with that username.');
      setCompareSearching(false);
      return;
    }
    setCompareFriend({
      id: data.id, displayName: data.display_name || data.username || '',
      username: data.username || '', avatarUrl: data.avatar_url ?? null, isPro: data.is_pro ?? false,
    });
    if (data.is_pro) {
      setFriendLoading(true);
      await loadFriendData(data.id);
      setFriendLoading(false);
    }
    setCompareSearching(false);
  }

  async function loadFriendData(friendId: string) {
    const [albumsRes, profileRes, likedRes, myLikedRes] = await Promise.allSettled([
      supabase.from('user_albums')
        .select('spotify_id, title, artist, artwork_url, rating, year, listened_at, duration_ms, genre_tags, review, is_relistened')
        .eq('user_id', friendId).not('listened_at', 'is', null),
      supabase.from('profiles')
        .select('top_albums, top_artists')
        .eq('id', friendId).single(),
      supabase.from('liked_artists')
        .select('artist_id, name').eq('user_id', friendId),
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (!session?.user?.id) return { data: [] };
        return supabase.from('liked_artists').select('artist_id, name').eq('user_id', session.user.id);
      }),
    ]);

    if (albumsRes.status === 'fulfilled' && albumsRes.value.data) {
      const rows = albumsRes.value.data;
      setFriendAlbums(rows.map(r => ({
        id: r.spotify_id, title: r.title ?? '', artist: r.artist ?? '',
        year: r.year ?? 0, rating: r.rating ?? 0,
        dateLogged: r.listened_at ?? new Date().toISOString(),
        artworkUrl: r.artwork_url ?? undefined, coverColor: '#2E2018',
        durationMs: r.duration_ms ?? undefined, genreTags: r.genre_tags ?? [],
        reListenCount: 0, isRelistened: r.is_relistened ?? false,
        review: r.review ?? undefined,
      })));
      setFriendReviewCount(rows.filter(r => r.review).length);
    }
    if (profileRes.status === 'fulfilled' && profileRes.value.data) {
      const p = profileRes.value.data;
      setFriendTop5Albums((p.top_albums ?? []).filter(Boolean).map((a: any) => ({ id: a.id, title: a.title, artworkUrl: a.artworkUrl })));
      setFriendTop5Artists((p.top_artists ?? []).filter(Boolean).map((a: any) => ({ id: a.id, name: a.name, artworkUrl: a.artworkUrl })));
    }
    if (likedRes.status === 'fulfilled' && likedRes.value.data) {
      setFriendLikedArtists((likedRes.value.data as any[]).map(r => ({ artistId: r.artist_id, name: r.name })));
    }
    if (myLikedRes.status === 'fulfilled') {
      const res = myLikedRes.value as any;
      setMyLikedArtists((res.data ?? []).map((r: any) => ({ artistId: r.artist_id, name: r.name })));
    }
  }

  // ── Compare: computed values ──────────────────────────────────────────────
  const myAlbumIdSet     = new Set(ownAlbums.map(a => a.id));
  const friendAlbumIdSet = new Set(friendAlbums.map(a => a.id));
  const sharedAlbumList  = friendAlbums.filter(a => myAlbumIdSet.has(a.id));
  const unionAlbumCount  = new Set([...myAlbumIdSet, ...friendAlbumIdSet]).size;
  const albumScore       = unionAlbumCount > 0 ? sharedAlbumList.length / unionAlbumCount : 0;

  const myArtistSet      = new Set(ownAlbums.map(a => a.artist.toLowerCase().trim()));
  const friendArtistSet  = new Set(friendAlbums.map(a => a.artist.toLowerCase().trim()));
  const sharedArtistList = [...myArtistSet].filter(a => friendArtistSet.has(a)).sort();
  const unionArtistCount = new Set([...myArtistSet, ...friendArtistSet]).size;
  const artistScore      = unionArtistCount > 0 ? sharedArtistList.length / unionArtistCount : 0;
  const compatibility    = Math.round((artistScore * 0.6 + albumScore * 0.4) * 100);

  // Friend hero stats
  const friendRated     = friendAlbums.filter(a => a.rating > 0);
  const friendAvgRating = friendRated.length > 0
    ? (friendRated.reduce((s, a) => s + a.rating, 0) / friendRated.length).toFixed(1) : '—';
  const friendHours     = friendAlbums.reduce((s, a) => s + (a.durationMs ?? 0), 0);
  const friendHoursVal  = friendHours > 0 ? Math.round(friendHours / 3_600_000) : '—';
  const friendArtistCount = new Set(friendAlbums.map(a => a.artist)).size;

  // Friend top genres
  const friendGenreCounts = new Map<string, number>();
  for (const album of friendAlbums) {
    const genre = (album.genreTags ?? []).find(t => MAIN_GENRES.has(t));
    if (genre) friendGenreCounts.set(genre, (friendGenreCounts.get(genre) ?? 0) + 1);
  }
  const friendTopGenres   = [...friendGenreCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  // ── Extra compare stats ───────────────────────────────────────────────────
  // Era preference
  const myYears     = ownAlbums.map(a => a.year).filter(y => y > 1900);
  const friendYears = friendAlbums.map(a => a.year).filter(y => y > 1900);
  const myAvgEra    = myYears.length > 0 ? Math.round(myYears.reduce((s, y) => s + y, 0) / myYears.length) : null;
  const friendAvgEra = friendYears.length > 0 ? Math.round(friendYears.reduce((s, y) => s + y, 0) / friendYears.length) : null;

  // Re-listen rate
  const myRelistenRate     = ownAlbums.length > 0 ? Math.round((ownAlbums.filter(a => a.isRelistened).length / ownAlbums.length) * 100) : 0;
  const friendRelistenRate = friendAlbums.length > 0 ? Math.round((friendAlbums.filter(a => a.isRelistened).length / friendAlbums.length) * 100) : 0;

  // Most active month
  function mostActiveMonth(albums: LoggedAlbum[]) {
    const counts = new Map<string, number>();
    for (const a of albums) {
      const d = new Date(a.dateLogged);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    if (counts.size === 0) return '—';
    const [top] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const [year, month] = top[0].split('-');
    return new Date(Number(year), Number(month) - 1).toLocaleString('default', { month: 'short', year: 'numeric' });
  }
  const myActiveMonth     = mostActiveMonth(ownAlbums);
  const friendActiveMonth = mostActiveMonth(friendAlbums);

  // Review count
  const myReviewCount = ownAlbums.filter(a => a.review).length;

  // Top 5 overlap
  const myTop5AlbumIds   = new Set(myTop5Albums.filter(Boolean).map((a: any) => a?.id));
  const myTop5ArtistIds  = new Set(myTop5Artists.filter(Boolean).map((a: any) => a?.id));
  const sharedTop5Albums  = friendTop5Albums.filter(a => myTop5AlbumIds.has(a.id));
  const sharedTop5Artists = friendTop5Artists.filter(a => myTop5ArtistIds.has(a.id));

  // Liked artists in common
  const myLikedSet      = new Set(myLikedArtists.map(a => a.artistId));
  const sharedLikedArtists = friendLikedArtists.filter(a => myLikedSet.has(a.artistId));

  // Taste label
  function tasteLabel(pct: number): { label: string; emoji: string } {
    if (pct >= 80) return { label: 'Music Twins',        emoji: '' };
    if (pct >= 60) return { label: 'Frequency Matched', emoji: '' };
    if (pct >= 40) return { label: 'Vibe Aligned',      emoji: '' };
    if (pct >= 20) return { label: 'Different Worlds',  emoji: '' };
    return              { label: 'Polar Opposites',     emoji: '' };
  }
  const taste = tasteLabel(compatibility);

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

  // ── Pro gate — own stats only ─────────────────────────────────────────────
  if (!viewedUserId && !isPro) {
    return (
      <>
        <Stack.Screen options={{
          title: 'My Stats',
          headerStyle: { backgroundColor: Colors[colorScheme ?? 'dark'].background },
          headerTintColor: Colors[colorScheme ?? 'dark'].text,
          headerShadowVisible: false,
        }} />
        <View style={{ flex: 1, backgroundColor: Colors[colorScheme ?? 'dark'].background, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 20 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#2A1E00', borderWidth: 1.5, borderColor: '#D4A017', alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome name="lock" size={28} color="#D4A017" />
          </View>
          <Text style={{ color: Colors[colorScheme ?? 'dark'].text, fontSize: 22, fontWeight: '800', textAlign: 'center', letterSpacing: -0.3 }}>
            My Stats is a Pro Feature
          </Text>
          <Text style={{ color: '#A08060', fontSize: 14, textAlign: 'center', lineHeight: 21 }}>
            Unlock your full listening history — genre breakdowns, decade distribution, community comparisons, re-listen streaks, and more.
          </Text>
          <Pressable
            onPress={showPaywall}
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1, borderRadius: 14, overflow: 'hidden', alignSelf: 'stretch' })}>
            <View style={{ backgroundColor: '#D4A017', borderRadius: 14, paddingVertical: 16, alignItems: 'center' }}>
              <Text style={{ color: '#0F0A07', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 }}>
                Unlock with Pro
              </Text>
            </View>
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{
        title: viewedUserId && params.displayName ? `${params.displayName}'s Stats` : 'My Stats',
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }} />
      <AlbumListModal
        title={selectedRating !== null ? `Rated ${selectedRating}` : null}
        albums={selectedAlbums}
        onClose={() => setSelectedRating(null)}
        onAlbumPress={handleAlbumPress}
        themeColors={colors}
      />
      <AlbumListModal
        title={listModal?.title ?? null}
        albums={listModal?.albums ?? []}
        onClose={() => setListModal(null)}
        onAlbumPress={(album) => { setListModal(null); setTimeout(() => handleAlbumPress(album), 300); }}
        onTitlePress={listModal?.onTitlePress}
        themeColors={colors}
      />
      <ArtistListModal
        visible={artistModalOpen}
        albums={loggedAlbums}
        onClose={() => setArtistModalOpen(false)}
        onArtistPress={(artist, artistAlbums) => setListModal({ title: artist, albums: artistAlbums })}
        themeColors={colors}
      />

      {/* ── Main tab toggle (own stats only) ────────────────────────────── */}
      {!viewedUserId && (
        <View style={{ flexDirection: 'row', backgroundColor: colors.background, paddingHorizontal: 20, paddingVertical: 10, gap: 8 }}>
          {(['stats', 'compare'] as const).map(t => (
            <Pressable
              key={t}
              onPress={() => setMainTab(t)}
              style={{
                flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center',
                backgroundColor: mainTab === t ? colors.tint : colors.surface,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: mainTab === t ? colors.tint : colors.border,
              }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: mainTab === t ? '#fff' : colors.subtext }}>
                {t === 'stats' ? 'My Stats' : 'Compare'}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* ── Compare tab ──────────────────────────────────────────────────── */}
      {mainTab === 'compare' && !viewedUserId && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView
            style={[s.container, { backgroundColor: colors.background }]}
            contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 48 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">

            {/* Shared Albums Modal */}
            <Modal visible={sharedModal === 'albums'} animationType="slide" onRequestClose={() => setSharedModal(null)}>
              <View style={{ flex: 1, backgroundColor: colors.background }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: insets.top + 16 }}>
                  <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>{sharedAlbumList.length} Albums in Common</Text>
                  <Pressable onPress={() => setSharedModal(null)}><FontAwesome name="times" size={20} color={colors.subtext} /></Pressable>
                </View>
                <FlatList
                  data={sharedAlbumList}
                  keyExtractor={a => a.id}
                  contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 12 }}
                  renderItem={({ item }) => {
                    const myEntry = ownAlbums.find(a => a.id === item.id);
                    return (
                      <Pressable
                        onPress={() => { setSharedModal(null); setTimeout(() => handleAlbumPress(item), 300); }}
                        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.7 : 1 })}>
                        {item.artworkUrl
                          ? <ExpoImage source={{ uri: item.artworkUrl }} style={{ width: 48, height: 48, borderRadius: 6 }} contentFit="cover" />
                          : <View style={{ width: 48, height: 48, borderRadius: 6, backgroundColor: CARD_BG }} />}
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>{item.title}</Text>
                          <Text style={{ color: colors.subtext, fontSize: 12 }} numberOfLines={1}>{item.artist}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 2 }}>
                          {myEntry?.rating ? <Text style={{ color: ACCENT, fontSize: 12, fontWeight: '700' }}>You: {myEntry.rating}</Text> : null}
                          {item.rating ? <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: '600' }}>Them: {item.rating}</Text> : null}
                        </View>
                      </Pressable>
                    );
                  }}
                />
              </View>
            </Modal>

            {/* Shared Artists Modal */}
            <Modal visible={sharedModal === 'artists'} animationType="slide" onRequestClose={() => setSharedModal(null)}>
              <View style={{ flex: 1, backgroundColor: colors.background }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: insets.top + 16 }}>
                  <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>{sharedArtistList.length} Artists in Common</Text>
                  <Pressable onPress={() => setSharedModal(null)}><FontAwesome name="times" size={20} color={colors.subtext} /></Pressable>
                </View>
                <FlatList
                  data={sharedArtistList}
                  keyExtractor={a => a}
                  contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 8 }}
                  renderItem={({ item: artist }) => {
                    const myCount = ownAlbums.filter(a => a.artist.toLowerCase().trim() === artist).length;
                    const theirCount = friendAlbums.filter(a => a.artist.toLowerCase().trim() === artist).length;
                    const displayName = ownAlbums.find(a => a.artist.toLowerCase().trim() === artist)?.artist ?? artist;
                    return (
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
                        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', flex: 1 }} numberOfLines={1}>{displayName}</Text>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                          <Text style={{ color: ACCENT, fontSize: 12, fontWeight: '700' }}>You: {myCount}</Text>
                          <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: '600' }}>Them: {theirCount}</Text>
                        </View>
                      </View>
                    );
                  }}
                />
              </View>
            </Modal>

            {/* Search bar */}
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <TextInput
                style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 11, color: colors.text, fontSize: 15 }}
                placeholder="Search by @username"
                placeholderTextColor={colors.subtext}
                value={compareQuery}
                onChangeText={setCompareQuery}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={searchFriend}
              />
              <Pressable
                onPress={searchFriend}
                style={({ pressed }) => ({ backgroundColor: colors.tint, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 11, opacity: pressed ? 0.7 : 1 })}>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Search</Text>
              </Pressable>
            </View>

            {compareSearching && <ActivityIndicator color={colors.tint} style={{ marginTop: 20 }} />}
            {compareError && <Text style={{ color: colors.subtext, fontSize: 14, textAlign: 'center', marginTop: 20 }}>{compareError}</Text>}

            {/* Following list — shown when no search has been made yet */}
            {!compareFriend && !compareSearching && !compareError && followingList.length > 0 && (
              <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border, padding: 0, overflow: 'hidden' }]}>
                <Text style={[s.cardTitle, { color: colors.textMuted, paddingHorizontal: 18, paddingTop: 16, marginBottom: 0 }]}>PEOPLE YOU FOLLOW</Text>
                {followingList.map((person, i) => (
                  <Pressable
                    key={person.id}
                    onPress={async () => {
                      setCompareError(null);
                      setFriendAlbums([]);
                      setFriendTop5Albums([]);
                      setFriendTop5Artists([]);
                      setFriendLikedArtists([]);
                      setCompareFriend(person);
                      if (person.isPro) {
                        setFriendLoading(true);
                        await loadFriendData(person.id);
                        setFriendLoading(false);
                      }
                    }}
                    style={({ pressed }) => ({
                      flexDirection: 'row', alignItems: 'center', gap: 12,
                      paddingHorizontal: 18, paddingVertical: 12, opacity: pressed ? 0.7 : 1,
                      borderTopWidth: i === 0 ? StyleSheet.hairlineWidth : 0,
                      borderTopColor: colors.border,
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: colors.border,
                    })}>
                    {person.avatarUrl
                      ? <ExpoImage source={{ uri: person.avatarUrl }} style={{ width: 40, height: 40, borderRadius: 20 }} contentFit="cover" />
                      : <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: CARD_BG, alignItems: 'center', justifyContent: 'center' }}>
                          <FontAwesome name="user" size={18} color={SUBTEXT} />
                        </View>}
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{person.displayName}</Text>
                        {person.isPro && <ProBadge size="xs" />}
                      </View>
                      {person.username ? <Text style={{ color: colors.subtext, fontSize: 12 }}>@{person.username}</Text> : null}
                    </View>
                    <FontAwesome name="chevron-right" size={12} color={colors.subtext} />
                  </Pressable>
                ))}
              </View>
            )}

            {/* Friend found but not Pro */}
            {compareFriend && !compareFriend.isPro && (
              <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border, alignItems: 'center', gap: 8 }]}>
                {compareFriend.avatarUrl
                  ? <ExpoImage source={{ uri: compareFriend.avatarUrl }} style={{ width: 56, height: 56, borderRadius: 28 }} contentFit="cover" />
                  : <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: CARD_BG, alignItems: 'center', justifyContent: 'center' }}><FontAwesome name="user" size={24} color={SUBTEXT} /></View>}
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>{compareFriend.displayName}</Text>
                <Text style={{ color: colors.subtext, fontSize: 13 }}>@{compareFriend.username}</Text>
                <View style={{ marginTop: 8, backgroundColor: colors.background, borderRadius: 10, padding: 14, alignItems: 'center', gap: 4 }}>
                  <Text style={{ color: ACCENT, fontSize: 15, fontWeight: '700' }}>Pro required</Text>
                  <Text style={{ color: colors.subtext, fontSize: 13, textAlign: 'center', lineHeight: 18 }}>This user doesn't have Pro — their stats aren't available for comparison.</Text>
                </View>
              </View>
            )}

            {/* Friend found and is Pro */}
            {compareFriend?.isPro && (
              <>
                {/* Friend profile card */}
                <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border, alignItems: 'center', gap: 6 }]}>
                  {compareFriend.avatarUrl
                    ? <ExpoImage source={{ uri: compareFriend.avatarUrl }} style={{ width: 64, height: 64, borderRadius: 32 }} contentFit="cover" />
                    : <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: CARD_BG, alignItems: 'center', justifyContent: 'center' }}><FontAwesome name="user" size={28} color={SUBTEXT} /></View>}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>{compareFriend.displayName}</Text>
                    <ProBadge />
                  </View>
                  <Text style={{ color: colors.subtext, fontSize: 13 }}>@{compareFriend.username}</Text>
                </View>

                {friendLoading
                  ? <ActivityIndicator color={colors.tint} style={{ marginTop: 20 }} />
                  : (
                  <>
                    {/* Compatibility score */}
                    <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border, alignItems: 'center', gap: 6 }]}>
                      <Text style={[s.cardTitle, { color: colors.textMuted }]}>COMPATIBILITY</Text>
                      <Text style={{ color: colors.tint, fontSize: 56, fontWeight: '800', letterSpacing: -2 }}>{compatibility}%</Text>
                      <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>{taste.label}</Text>
                      <Text style={{ color: colors.subtext, fontSize: 13, textAlign: 'center', marginTop: 2 }}>
                        {sharedArtistList.length} shared artists · {sharedAlbumList.length} shared albums
                      </Text>
                    </View>

                    {/* Side-by-side stats */}
                    <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border, padding: 0, overflow: 'hidden' }]}>
                      <Text style={[s.cardTitle, { color: colors.textMuted, paddingHorizontal: 18, paddingTop: 18, marginBottom: 0 }]}>STATS COMPARISON</Text>
                      {/* Header row */}
                      <View style={{ flexDirection: 'row', paddingHorizontal: 18, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
                        <Text style={{ flex: 1, color: colors.subtext, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>STAT</Text>
                        <Text style={{ width: 64, color: ACCENT, fontSize: 11, fontWeight: '700', textAlign: 'center' }}>YOU</Text>
                        <Text style={{ width: 64, color: colors.subtext, fontSize: 11, fontWeight: '700', textAlign: 'center' }}>THEM</Text>
                      </View>
                      {[
                        { label: 'Albums Logged',   mine: ownAlbums.length,    theirs: friendAlbums.length },
                        { label: 'Avg Rating',      mine: avgRating,           theirs: friendAvgRating },
                        { label: 'Listening Hours', mine: totalHours,          theirs: friendHoursVal },
                        { label: 'Unique Artists',  mine: uniqueArtists,       theirs: friendArtistCount },
                        { label: 'Reviews Written', mine: myReviewCount,       theirs: friendReviewCount },
                        { label: 'Re-listen Rate',  mine: `${myRelistenRate}%`,   theirs: `${friendRelistenRate}%` },
                        { label: 'Avg Era',         mine: myAvgEra ?? '—',    theirs: friendAvgEra ?? '—' },
                        { label: 'Peak Month',      mine: myActiveMonth,       theirs: friendActiveMonth },
                      ].map((row, i, arr) => (
                        <View key={row.label} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 13, borderBottomWidth: i < arr.length - 1 ? StyleSheet.hairlineWidth : 0, borderBottomColor: colors.border }}>
                          <Text style={{ flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' }}>{row.label}</Text>
                          <Text style={{ width: 64, color: ACCENT, fontSize: 15, fontWeight: '800', textAlign: 'center' }}>{row.mine}</Text>
                          <Text style={{ width: 64, color: colors.subtext, fontSize: 15, fontWeight: '700', textAlign: 'center' }}>{row.theirs}</Text>
                        </View>
                      ))}
                    </View>

                    {/* Shared albums row */}
                    <Pressable
                      onPress={() => setSharedModal('albums')}
                      style={({ pressed }) => [s.card, { backgroundColor: colors.surface, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', opacity: pressed ? 0.7 : 1 }]}>
                      <FontAwesome name="music" size={16} color={colors.tint} style={{ marginRight: 12 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>{sharedAlbumList.length} Albums in Common</Text>
                        <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 2 }}>Tap to see them with ratings</Text>
                      </View>
                      <FontAwesome name="chevron-right" size={13} color={colors.subtext} />
                    </Pressable>

                    {/* Shared artists row */}
                    <Pressable
                      onPress={() => setSharedModal('artists')}
                      style={({ pressed }) => [s.card, { backgroundColor: colors.surface, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', opacity: pressed ? 0.7 : 1 }]}>
                      <FontAwesome name="headphones" size={16} color={colors.tint} style={{ marginRight: 12 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>{sharedArtistList.length} Artists in Common</Text>
                        <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 2 }}>Tap to see your overlap</Text>
                      </View>
                      <FontAwesome name="chevron-right" size={13} color={colors.subtext} />
                    </Pressable>

                    {/* Liked artists in common */}
                    {(myLikedArtists.length > 0 || friendLikedArtists.length > 0) && (
                      <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={[s.cardTitle, { color: colors.textMuted }]}>LIKED ARTISTS IN COMMON</Text>
                        {sharedLikedArtists.length === 0 ? (
                          <Text style={{ color: colors.subtext, fontSize: 14, textAlign: 'center' }}>No shared liked artists yet</Text>
                        ) : (
                          <>
                            <Text style={{ color: colors.tint, fontSize: 28, fontWeight: '800', textAlign: 'center' }}>{sharedLikedArtists.length}</Text>
                            <Text style={{ color: colors.subtext, fontSize: 13, textAlign: 'center', marginTop: 2 }}>
                              {sharedLikedArtists.slice(0, 5).map(a => a.name).join(', ')}{sharedLikedArtists.length > 5 ? ` +${sharedLikedArtists.length - 5} more` : ''}
                            </Text>
                          </>
                        )}
                      </View>
                    )}

                    {/* Top 5 overlap */}
                    {(friendTop5Albums.length > 0 || friendTop5Artists.length > 0) && (
                      <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={[s.cardTitle, { color: colors.textMuted }]}>TOP 5 OVERLAP</Text>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                          <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                            <Text style={{ color: colors.tint, fontSize: 28, fontWeight: '800' }}>{sharedTop5Albums.length}</Text>
                            <Text style={{ color: colors.subtext, fontSize: 12, textAlign: 'center' }}>Albums in both{'\n'}Top 5s</Text>
                          </View>
                          <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />
                          <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                            <Text style={{ color: colors.tint, fontSize: 28, fontWeight: '800' }}>{sharedTop5Artists.length}</Text>
                            <Text style={{ color: colors.subtext, fontSize: 12, textAlign: 'center' }}>Artists in both{'\n'}Top 5s</Text>
                          </View>
                        </View>
                        {sharedTop5Albums.length > 0 && (
                          <View style={{ marginTop: 12, gap: 4 }}>
                            <Text style={{ color: colors.subtext, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>SHARED ALBUMS</Text>
                            {sharedTop5Albums.map(a => (
                              <Text key={a.id} style={{ color: colors.text, fontSize: 13 }}>• {a.title}</Text>
                            ))}
                          </View>
                        )}
                        {sharedTop5Artists.length > 0 && (
                          <View style={{ marginTop: 10, gap: 4 }}>
                            <Text style={{ color: colors.subtext, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>SHARED ARTISTS</Text>
                            {sharedTop5Artists.map(a => (
                              <Text key={a.id} style={{ color: colors.text, fontSize: 13 }}>• {a.name}</Text>
                            ))}
                          </View>
                        )}
                      </View>
                    )}

                    {/* Genre comparison */}
                    {(topGenres.length > 0 || friendTopGenres.length > 0) && (
                      <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={[s.cardTitle, { color: colors.textMuted }]}>TOP GENRES</Text>
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginBottom: 12 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: colors.tint }} />
                            <Text style={{ color: colors.subtext, fontSize: 11, fontWeight: '600' }}>YOU</Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: colors.subtext }} />
                            <Text style={{ color: colors.subtext, fontSize: 11, fontWeight: '600' }}>THEM</Text>
                          </View>
                        </View>
                        {(() => {
                          const allGenres = [...new Set([...topGenres.map(([g]) => g), ...friendTopGenres.map(([g]) => g)])].slice(0, 8);
                          const myMap = new Map(topGenres);
                          const theirMap = new Map(friendTopGenres);
                          const maxVal = Math.max(...allGenres.map(g => Math.max(myMap.get(g) ?? 0, theirMap.get(g) ?? 0)), 1);
                          return allGenres.map(genre => (
                            <View key={genre} style={{ marginBottom: 10 }}>
                              <Text style={{ color: colors.subtext, fontSize: 11, fontWeight: '600', marginBottom: 4 }}>{genre}</Text>
                              <View style={{ gap: 3 }}>
                                <View style={{ height: 7, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' }}>
                                  <View style={{ height: 7, borderRadius: 4, backgroundColor: colors.tint, width: `${((myMap.get(genre) ?? 0) / maxVal) * 100}%` }} />
                                </View>
                                <View style={{ height: 7, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' }}>
                                  <View style={{ height: 7, borderRadius: 4, backgroundColor: colors.subtext, width: `${((theirMap.get(genre) ?? 0) / maxVal) * 100}%` }} />
                                </View>
                              </View>
                            </View>
                          ));
                        })()}
                      </View>
                    )}
                  </>
                )}
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* ── My Stats tab ─────────────────────────────────────────────────── */}
      {(mainTab === 'stats' || viewedUserId) && (
      <ScrollView
        style={[s.container, { backgroundColor: colors.background }]}
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}>

        {/* ── Hero Stats ────────────────────────────────────────────────── */}
        <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder, padding: 0, overflow: 'hidden' }]}>
          <Text style={[s.cardTitle, { color: colors.textMuted, paddingHorizontal: 18, paddingTop: 18, marginBottom: 0 }]}>MY STATS</Text>
          <StatRow stats={heroStats.slice(0, 3)} textColor={colors.text} subtextColor={colors.subtext} borderColor={colors.border} />
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: cardBorder, marginHorizontal: 8 }} />
          <StatRow stats={heroStats.slice(3)} textColor={colors.text} subtextColor={colors.subtext} borderColor={colors.border} />
        </View>

        {/* ── Year in Review + Monthly Stats cards ──────────────────────── */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable
            onPress={() => router.push(viewedUserId
              ? { pathname: '/year-in-review', params: { userId: viewedUserId, displayName: params.displayName ?? '', proTheme: params.proTheme ?? '' } } as any
              : '/year-in-review' as any)}
            style={({ pressed }) => [s.card, { flex: 1, backgroundColor: cardBg, borderColor: cardBorder, gap: 6, opacity: pressed ? 0.7 : 1 }]}>
            <FontAwesome name="calendar" size={18} color={colors.tint} />
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 4 }}>Year in Review</Text>
            <Text style={{ color: colors.subtext, fontSize: 12 }}>Deep dive into your year</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push(viewedUserId
              ? { pathname: '/month-in-review', params: { userId: viewedUserId, displayName: params.displayName ?? '', proTheme: params.proTheme ?? '' } } as any
              : '/month-in-review' as any)}
            style={({ pressed }) => [s.card, { flex: 1, backgroundColor: cardBg, borderColor: cardBorder, gap: 6, opacity: pressed ? 0.7 : 1 }]}>
            <FontAwesome name="bar-chart" size={18} color={colors.tint} />
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 4 }}>Monthly Stats</Text>
            <Text style={{ color: colors.subtext, fontSize: 12 }}>Browse past months</Text>
          </Pressable>
        </View>

        {/* ── Year Chart ────────────────────────────────────────────────── */}
        <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <Text style={[s.cardTitle, { color: colors.textMuted }]}>BY RELEASE YEAR</Text>
          <YearChart loggedAlbums={loggedAlbums} onAlbumPress={handleAlbumPress} tint={colors.tint} textColor={colors.text} subtextColor={colors.subtext} borderColor={colors.border} themeColors={colors} />
        </View>

        {/* ── Rating Distribution ────────────────────────────────────────── */}
        <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={s.cardTitleRow}>
            <Text style={[s.cardTitle, { color: colors.textMuted, marginBottom: 0 }]}>RATING BREAKDOWN</Text>
            {ratedAlbums.length > 0 && <Text style={[s.cardTitleValue, { color: colors.text }]}>{avgRating} avg</Text>}
          </View>
          {ratedAlbums.length > 0 ? (
            <RatingDistribution loggedAlbums={loggedAlbums} onRatingPress={handleRatingPress} tint={colors.tint} trackColor={cardBorder} textColor={colors.text} subtextColor={colors.subtext} />
          ) : (
            <EmptyState text="Rate some albums to see your breakdown." />
          )}
        </View>

        {/* ── Rated Higher / Lower Than Average ─────────────────────────── */}
        {ratedAlbums.length > 0 && (
          <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
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
                    <ComparisonCard key={album.id} album={album} communityAvg={communityAvg} onPress={() => handleAlbumPress(album)} tint={colors.tint} />
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
                    <ComparisonCard key={album.id} album={album} communityAvg={communityAvg} onPress={() => handleAlbumPress(album)} tint={colors.tint} />
                  ))}
                </ScrollView>
              ) : (
                <EmptyState text="Ratings are revealed once more listeners have rated this album." />
              )}
            </View>
          </View>
        )}

        {/* ── Most Listend Artists ───────────────────────────────────────── */}
        <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={s.cardTitleRow}>
            <Text style={[s.cardTitle, { color: colors.textMuted, marginBottom: 0 }]}>MOST LISTEND ARTISTS</Text>
            <View style={[yc.toggle, { backgroundColor: colors.border }]}>
              {(['listend', 'rated'] as const).map(v => (
                <Pressable key={v} onPress={() => setArtistView(v)} style={[yc.toggleBtn, artistView === v && { backgroundColor: colors.tint }]}>
                  <Text style={[yc.toggleText, { color: colors.subtext }, artistView === v && yc.toggleTextActive]}>
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
                        textColor={colors.text}
                        subtextColor={colors.subtext}
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
        <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={s.cardTitleRow}>
            <Text style={[s.cardTitle, { color: colors.textMuted, marginBottom: 0 }]}>MOST LISTEND GENRES</Text>
            <View style={[yc.toggle, { backgroundColor: colors.border }]}>
              {(['listend', 'rated'] as const).map(v => (
                <Pressable key={v} onPress={() => setGenreView(v)} style={[yc.toggleBtn, genreView === v && { backgroundColor: colors.tint }]}>
                  <Text style={[yc.toggleText, { color: colors.subtext }, genreView === v && yc.toggleTextActive]}>
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
                    tint={colors.tint}
                    trackColor={cardBorder}
                    textColor={colors.text}
                    subtextColor={colors.subtext}
                    pillBgColor={colors.elevated}
                    onPress={() => setListModal({
                      title: genre,
                      albums: loggedAlbums.filter(a => (a.genreTags ?? []).find(t => MAIN_GENRES.has(t)) === genre),
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
                    tint={colors.tint}
                    trackColor={cardBorder}
                    textColor={colors.text}
                    subtextColor={colors.subtext}
                    pillBgColor={colors.elevated}
                    onPress={() => setListModal({
                      title: genre,
                      albums: loggedAlbums.filter(a => (a.genreTags ?? []).find(t => MAIN_GENRES.has(t)) === genre && a.rating > 0),
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
          <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Text style={[s.cardTitle, { color: colors.textMuted }]}>RE-LISTEND</Text>

            {/* Stats strip */}
            <View style={[rl.strip, { borderColor: cardBorder }]}>
              <View style={rl.cell}>
                <Text style={[rl.val, { color: colors.text }]}>{totalReListens}</Text>
                <Text style={[rl.lbl, { color: colors.subtext }]}>Re-Listens</Text>
              </View>
              <View style={[rl.divider, { backgroundColor: cardBorder }]} />
              <View style={rl.cell}>
                <Text style={[rl.val, { color: evAvgDelta >= 0.5 ? GROW_CLR : evAvgDelta <= -0.5 ? FADE_CLR : colors.subtext }]}>
                  {evAvgDelta > 0 ? '+' : ''}{evAvgDelta.toFixed(1)}
                </Text>
                <Text style={[rl.lbl, { color: colors.subtext }]}>Avg Change</Text>
              </View>
              <View style={[rl.divider, { backgroundColor: cardBorder }]} />
              <View style={rl.cell}>
                <Text style={[rl.val, { color: colors.text }]}>{evFirstListenAvg > 0 ? evFirstListenAvg.toFixed(1) : '—'}</Text>
                <Text style={[rl.lbl, { color: colors.subtext }]}>First Listen</Text>
              </View>
              <View style={[rl.divider, { backgroundColor: cardBorder }]} />
              <View style={rl.cell}>
                <Text style={[rl.val, { color: evLongTermAvg > evFirstListenAvg ? GROW_CLR : evLongTermAvg < evFirstListenAvg ? FADE_CLR : colors.text }]}>
                  {evLongTermAvg > 0 ? evLongTermAvg.toFixed(1) : '—'}
                </Text>
                <Text style={[rl.lbl, { color: colors.subtext }]}>Long-Term</Text>
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
                      textColor={colors.text}
                      subtextColor={colors.subtext}
                      surfaceColor={colors.surface}
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
                      textColor={colors.text}
                      subtextColor={colors.subtext}
                      surfaceColor={colors.surface}
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
        <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <Text style={[s.cardTitle, { color: colors.textMuted }]}>PLAYLIST PROGRESS</Text>
          {(() => {
            const COL = 3;
            const RING_GAP = 12;
            const cellW = Math.floor((screenWidth - 40 - 36 - RING_GAP * (COL - 1)) / COL);
            const INITIAL_ROWS = 3;
            const visible = showAllPlaylists ? playlistProgress : playlistProgress.slice(0, INITIAL_ROWS * COL);
            const rows: typeof playlistProgress[] = [];
            for (let i = 0; i < visible.length; i += COL) {
              rows.push(visible.slice(i, i + COL));
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
                          } else if (pl.kind === 'genre') {
                            router.push({ pathname: '/discover-genre-grid', params: { genre: pl.id } } as any);
                          } else if (pl.kind === 'decade') {
                            router.push({ pathname: '/discover-decade-grid', params: { decade: pl.id } } as any);
                          } else {
                            router.push({ pathname: '/discover-featured-playlist', params: { id: pl.id, name: pl.name } } as any);
                          }
                        }}>
                        <ProgressRing done={pl.done} total={pl.total} size={68} tint={colors.tint} trackColor={cardBorder} textColor={colors.text} bgColor={cardBg} />
                        <Text style={[pp.name, { color: colors.text }]} numberOfLines={2}>{pl.name}</Text>
                        <Text style={[pp.count, { color: colors.subtext }]}>
                          {pl.total > 0 ? `${pl.done} / ${pl.total}` : '—'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ))}
                {playlistProgress.length > INITIAL_ROWS * COL && (
                  <Pressable
                    onPress={() => setShowAllPlaylists(v => !v)}
                    style={({ pressed }) => ({ alignItems: 'center', paddingVertical: 4, opacity: pressed ? 0.6 : 1 })}>
                    <Text style={{ color: colors.tint, fontSize: 14, fontWeight: '600' }}>
                      {showAllPlaylists ? 'See less' : `See all ${playlistProgress.length} playlists`}
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })()}
        </View>

      </ScrollView>
      )}
    </>
  );
}

// ─── Playlist Progress ────────────────────────────────────────────────────────

const GENRE_LABELS = [
  'Hip-Hop / Rap', 'Pop', 'Rock', 'Reggaeton', 'Afrobeats',
  'R&B / Soul', 'Electronic', 'Indie / Alternative', 'Metal',
  'Country', 'Jazz', 'Classical', 'Blues', 'Folk / Singer-Songwriter',
];

const DECADE_LABELS = ['1950s', '1960s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s'];

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
  tint = ACCENT,
  trackColor = BORDER,
  textColor = TEXT,
  bgColor = CARD_BG,
}: {
  done: number;
  total: number;
  size?: number;
  tint?: string;
  trackColor?: string;
  textColor?: string;
  bgColor?: string;
}) {
  const strokeWidth = 6;
  const pct = total > 0 ? done / total : 0;
  const fillDeg = pct * 360;
  const r = size / 2;
  const innerR = r - strokeWidth;
  const label = total > 0 ? `${Math.round(pct * 100)}%` : '0%';
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Track disc */}
      <View style={{ position: 'absolute', width: size, height: size, borderRadius: r, backgroundColor: trackColor }} />
      {/* Accent fill — solid half-discs pivoted at circle center */}
      <View style={{ position: 'absolute', width: size, height: size, borderRadius: r, overflow: 'hidden' }}>
        {/* Right half-disc: covers 0–180° of fill, pivot at circle center (left edge) */}
        <View style={{ position: 'absolute', left: r, top: 0, width: r, height: size, overflow: 'hidden' }}>
          <View style={{
            position: 'absolute', left: 0, top: 0,
            width: r, height: size,
            borderTopRightRadius: r, borderBottomRightRadius: r,
            backgroundColor: tint,
            transform: [
              { translateX: -(r / 2) },
              { rotate: `${Math.min(fillDeg, 180) - 180}deg` },
              { translateX: r / 2 },
            ],
          }} />
        </View>
        {/* Left half-disc: covers 180–360° of fill, pivot at circle center (right edge) */}
        {fillDeg > 180 && (
          <View style={{ position: 'absolute', left: 0, top: 0, width: r, height: size, overflow: 'hidden' }}>
            <View style={{
              position: 'absolute', left: 0, top: 0,
              width: r, height: size,
              borderTopLeftRadius: r, borderBottomLeftRadius: r,
              backgroundColor: tint,
              transform: [
                { translateX: r / 2 },
                { rotate: `${360 - fillDeg}deg` },
                { translateX: -(r / 2) },
              ],
            }} />
          </View>
        )}
      </View>
      {/* Centre punch-out to create ring appearance */}
      <View style={{
        position: 'absolute',
        width: innerR * 2, height: innerR * 2, borderRadius: innerR,
        backgroundColor: bgColor,
      }} />
      <Text style={{ color: textColor, fontSize: 13, fontWeight: '700' }}>{label}</Text>
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

function ComparisonCard({ album, communityAvg, onPress, tint = ACCENT }: {
  album: LoggedAlbum;
  communityAvg: number;
  onPress: () => void;
  tint?: string;
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
      <VolumeBadge rating={album.rating} tint={tint} />
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
