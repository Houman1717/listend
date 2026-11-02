import { StyleSheet, View, Text, Pressable } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useState, type ReactNode } from 'react';
import type { LoggedAlbum } from '@/context/AlbumsContext';
import { effectiveRating } from '@/lib/effectiveRating';

// Albums by release decade, tap a decade for its years. Shared by My Stats and
// Month / Year in Review. Each bar wears its best-rated cover and the headline
// says what stands out, so the chart has a story rather than eight equal bars.

const CHART_H = 130;

type ChartView = 'albums' | 'ratings';

type Bucket = {
  key: number;
  label: string;
  albums: LoggedAlbum[];
  count: number;
  avgRating: number;
};

function avgOf(albums: LoggedAlbum[]): number {
  const rated = albums.filter(a => effectiveRating(a) > 0);
  return rated.length > 0 ? rated.reduce((s, a) => s + effectiveRating(a), 0) / rated.length : 0;
}

function buildDecadeBuckets(albums: LoggedAlbum[]): Bucket[] {
  const byDecade = new Map<number, LoggedAlbum[]>();
  for (const album of albums) {
    if (!album.year || album.year < 1900 || album.year > 2030) continue;
    const decade = Math.floor(album.year / 10) * 10;
    if (!byDecade.has(decade)) byDecade.set(decade, []);
    byDecade.get(decade)!.push(album);
  }
  return [...byDecade.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([decade, list]) => ({ key: decade, label: `${decade}s`, albums: list, count: list.length, avgRating: avgOf(list) }));
}

function buildYearBuckets(albums: LoggedAlbum[], decade: number): Bucket[] {
  return Array.from({ length: 10 }, (_, i) => {
    const year = decade + i;
    const list = albums.filter(a => a.year === year);
    return { key: year, label: String(year), albums: list, count: list.length, avgRating: avgOf(list) };
  });
}

export function ReleaseYearChart({
  albums,
  onShowAlbums,
  livesIn,
  empty,
  tint,
  textColor,
  subtextColor,
  borderColor,
}: {
  albums: LoggedAlbum[];
  /** Open a list of albums (a tapped year, or a whole decade). */
  onShowAlbums: (title: string, albums: LoggedAlbum[]) => void;
  /** Headline subject: "You live", "Sebi2075 lives", "Your October lived". */
  livesIn: string;
  /** Shown when no album has a release year. */
  empty?: ReactNode;
  tint: string;
  textColor: string;
  subtextColor: string;
  borderColor: string;
}) {
  const [view,        setView]        = useState<ChartView>('albums');
  const [drillDecade, setDrillDecade] = useState<number | null>(null);
  const [chartW,      setChartW]      = useState(0);

  const buckets: Bucket[] = drillDecade !== null
    ? buildYearBuckets(albums, drillDecade)
    : buildDecadeBuckets(albums);

  const maxCount = Math.max(...buckets.map(b => b.count), 1);
  const total    = buckets.reduce((s, b) => s + b.count, 0);

  // The bar the headline is about, drawn in full colour. For ratings, skip
  // buckets with under 3 rated albums so one lone 10 can't win.
  const ratedCount = (b: Bucket) => b.albums.filter(a => effectiveRating(a) > 0).length;
  const peak: Bucket | null = view === 'albums'
    ? buckets.reduce<Bucket | null>((best, b) => (b.count > (best?.count ?? 0) ? b : best), null)
    : (() => {
        const sturdy = buckets.filter(b => ratedCount(b) >= 3);
        const pool   = sturdy.length > 0 ? sturdy : buckets.filter(b => b.avgRating > 0);
        return pool.reduce<Bucket | null>((best, b) => (b.avgRating > (best?.avgRating ?? 0) ? b : best), null);
      })();

  let headline = '';
  let subline  = '';
  if (peak) {
    const label = drillDecade !== null ? String(peak.key) : `the ${peak.label}`;
    if (view === 'albums') {
      const pct = total > 0 ? Math.round(peak.count / total * 100) : 0;
      headline = drillDecade !== null ? `Top year: ${peak.key}` : `${livesIn} in ${label}`;
      subline = drillDecade !== null
        ? `${peak.count} of ${total} albums from the ${drillDecade}s`
        : `${peak.count} of ${total} albums · ${pct}%`;
    } else {
      headline = `Rated highest: ${label}`;
      subline  = `${peak.avgRating.toFixed(1)} avg across ${ratedCount(peak)} rated albums`;
    }
  }

  // Bars share the card's width, so every decade is on screen; there used to
  // be a sideways scroll nothing hinted at, which hid the 2020s.
  const gap    = buckets.length > 8 ? 4 : 6;
  const barW   = chartW > 0 ? (chartW - gap * (buckets.length - 1)) / buckets.length : 0;
  const capH   = Math.min(barW, 40);
  const maxBar = CHART_H - capH - 16; // room for the count above the cover
  const short  = barW < 30;

  function handleBarPress(bucket: Bucket) {
    if (drillDecade === null) {
      setDrillDecade(bucket.key);
    } else if (bucket.albums.length > 0) {
      onShowAlbums(String(bucket.key), bucket.albums);
    }
  }

  if (buckets.length === 0) return <>{empty ?? null}</>;

  const decadeAlbums = drillDecade !== null
    ? albums.filter(a => a.year >= drillDecade && a.year < drillDecade + 10)
    : [];

  return (
    <>
      {/* Header row: back button + toggle */}
      <View style={s.headerRow}>
        {drillDecade !== null ? (
          <Pressable
            style={({ pressed }) => [s.backBtn, { opacity: pressed ? 0.6 : 1 }]}
            onPress={() => setDrillDecade(null)}>
            <FontAwesome name="chevron-left" size={11} color={tint} />
            <Text style={[s.backText, { color: tint }]}>All decades</Text>
          </Pressable>
        ) : <View />}

        <View style={[s.toggle, { backgroundColor: borderColor }]}>
          {(['albums', 'ratings'] as ChartView[]).map(v => (
            <Pressable
              key={v}
              style={[s.toggleBtn, view === v && { backgroundColor: tint }]}
              onPress={() => setView(v)}>
              <Text style={[s.toggleText, { color: subtextColor }, view === v && s.toggleTextActive]}>
                {v === 'albums' ? 'Albums' : 'Avg Rating'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {headline ? (
        <View style={s.headlineWrap}>
          <Text style={[s.headline, { color: textColor }]}>{headline}</Text>
          <Text style={[s.subline, { color: subtextColor }]}>{subline}</Text>
        </View>
      ) : null}

      {/* Chart: each bar is capped with its best-rated cover */}
      <View
        style={[s.chartWrap, { gap, height: CHART_H + 22 }]}
        onLayout={e => setChartW(e.nativeEvent.layout.width)}>
        {barW > 0 && buckets.map(bucket => {
          const value    = view === 'albums' ? bucket.count : bucket.avgRating;
          const maxVal   = view === 'albums' ? maxCount : 10;
          const barH     = maxVal > 0 ? Math.max((value / maxVal) * maxBar, value > 0 ? 3 : 0) : 0;
          const valLabel = view === 'albums'
            ? (bucket.count > 0 ? String(bucket.count) : '')
            : (bucket.avgRating > 0 ? bucket.avgRating.toFixed(1) : '');
          const pressable = drillDecade === null || bucket.albums.length > 0;
          const isPeak    = peak?.key === bucket.key;
          const cover     = [...bucket.albums]
            .filter(a => a.artworkUrl)
            .sort((a, b) => effectiveRating(b) - effectiveRating(a))[0];
          const label = short
            ? (drillDecade !== null ? `'${String(bucket.key).slice(2)}` : `'${String(bucket.key).slice(2)}s`)
            : bucket.label;

          return (
            <Pressable
              key={bucket.key}
              style={({ pressed }) => [s.col, { width: barW }, pressable && pressed && { opacity: 0.6 }]}
              onPress={() => handleBarPress(bucket)}
              disabled={!pressable}>
              <View style={{ width: barW, height: CHART_H, justifyContent: 'flex-end', alignItems: 'center' }}>
                {valLabel ? (
                  <Text style={[s.valLabel, { color: isPeak ? textColor : subtextColor }, isPeak && s.valLabelPeak]}>
                    {valLabel}
                  </Text>
                ) : null}
                {cover && value > 0 ? (
                  <ExpoImage
                    source={{ uri: cover.artworkUrl }}
                    style={[
                      { width: capH, height: capH, borderRadius: 4, marginBottom: 2 },
                      isPeak && { borderWidth: 2, borderColor: tint },
                    ]}
                    contentFit="cover"
                    cachePolicy="disk"
                  />
                ) : null}
                <View style={[s.bar, { width: barW, height: barH, backgroundColor: tint, opacity: isPeak ? 1 : 0.35 }]} />
              </View>
              <Text style={[s.decLabel, { color: isPeak ? textColor : subtextColor }]} numberOfLines={1}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {drillDecade !== null ? (
        <>
          <Pressable
            style={({ pressed }) => [s.seeAll, { borderTopColor: borderColor, opacity: pressed ? 0.6 : 1 }]}
            onPress={() => onShowAlbums(`${drillDecade}s — All Albums`, decadeAlbums)}>
            <Text style={[s.seeAllText, { color: tint }]}>
              See all {decadeAlbums.length} albums from the {drillDecade}s
            </Text>
            <FontAwesome name="chevron-right" size={11} color={tint} />
          </Pressable>
          <Text style={[s.hint, { color: subtextColor }]}>Tap a bar to see albums</Text>
        </>
      ) : (
        <Text style={[s.hint, { color: subtextColor }]}>Tap a decade to explore</Text>
      )}
    </>
  );
}

const s = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  backBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backText:  { fontSize: 13, fontWeight: '600' },

  toggle:           { flexDirection: 'row', borderRadius: 8, padding: 2 },
  toggleBtn:        { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 7 },
  toggleText:       { fontSize: 13, fontWeight: '600' },
  toggleTextActive: { color: '#0F0A07', fontSize: 13, fontWeight: '700' },

  headlineWrap: { marginBottom: 14, gap: 2 },
  headline:     { fontSize: 18, fontWeight: '700', letterSpacing: -0.2 },
  subline:      { fontSize: 13 },
  chartWrap:    { flexDirection: 'row', alignItems: 'flex-end' },
  col:          { alignItems: 'center', gap: 4 },
  valLabel:     { fontSize: 10, fontWeight: '600', marginBottom: 3 },
  valLabelPeak: { fontWeight: '800' },
  bar:          { borderRadius: 4 },
  decLabel:     { fontSize: 10, fontWeight: '500', textAlign: 'center' },
  hint:         { fontSize: 12, marginTop: 6 },
  seeAll:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  seeAllText:   { fontSize: 13, fontWeight: '600' },
});
