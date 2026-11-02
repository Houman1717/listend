import { StyleSheet, View, Text, Pressable } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useState } from 'react';
import type { LoggedAlbum } from '@/context/AlbumsContext';
import { effectiveRating } from '@/lib/effectiveRating';

// Albums logged per bucket (months of a year, days of the week) in the same
// style as ReleaseYearChart: a headline about the peak, the peak bar in full
// colour, the rest faded, and covers on the bars when they're wide enough.

const CHART_H   = 120;
const MIN_COVER = 28; // narrower bars (12 months) skip the per-bar covers

export type ActivityBucket = {
  label: string;
  albums: LoggedAlbum[];
  /** Not reached yet (later months of the current year): drawn faint. */
  future?: boolean;
};

export function bestCover(albums: LoggedAlbum[]): LoggedAlbum | undefined {
  return [...albums].filter(a => a.artworkUrl).sort((a, b) => effectiveRating(b) - effectiveRating(a))[0];
}

/** Indexes of the bucket(s) with the most albums; empty when all are zero. */
export function peakIndexes(buckets: ActivityBucket[]): number[] {
  const max = Math.max(0, ...buckets.map(b => b.albums.length));
  return max === 0 ? [] : buckets.flatMap((b, i) => (b.albums.length === max ? [i] : []));
}

export function ActivityChart({
  buckets,
  headline,
  subline,
  headlineCover,
  onBarPress,
  tint,
  textColor,
  subtextColor,
  faintColor,
}: {
  buckets: ActivityBucket[];
  headline: string;
  subline: string;
  /** Shown beside the headline (the peak's best album). */
  headlineCover?: string;
  onBarPress?: (index: number) => void;
  tint: string;
  textColor: string;
  subtextColor: string;
  faintColor: string;
}) {
  const [width, setWidth] = useState(0);
  const peaks  = new Set(peakIndexes(buckets));
  const max    = Math.max(1, ...buckets.map(b => b.albums.length));
  const gap    = buckets.length > 8 ? 5 : 8;
  const barW   = width > 0 ? (width - gap * (buckets.length - 1)) / buckets.length : 0;
  const covers = barW >= MIN_COVER;
  const capH   = covers ? Math.min(barW, 40) : 0;
  const maxBar = CHART_H - capH - 16; // room for the count above

  return (
    <>
      <View style={s.headRow}>
        {headlineCover ? (
          <ExpoImage source={{ uri: headlineCover }} style={[s.headCover, { borderColor: tint }]} contentFit="cover" cachePolicy="disk" />
        ) : null}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[s.headline, { color: textColor }]}>{headline}</Text>
          <Text style={[s.subline, { color: subtextColor }]}>{subline}</Text>
        </View>
      </View>

      <View style={[s.chart, { gap, height: CHART_H + 20 }]} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
        {barW > 0 && buckets.map((b, i) => {
          const count  = b.albums.length;
          const isPeak = peaks.has(i);
          const cover  = covers && count > 0 ? bestCover(b.albums) : undefined;
          const barH   = count > 0 ? Math.max((count / max) * maxBar, 4) : 0;
          return (
            <Pressable
              key={b.label + i}
              disabled={!onBarPress || count === 0}
              onPress={() => onBarPress?.(i)}
              style={({ pressed }) => [s.col, { width: barW, opacity: pressed ? 0.6 : 1 }]}>
              <View style={{ width: barW, height: CHART_H, justifyContent: 'flex-end', alignItems: 'center' }}>
                {count > 0 ? (
                  <Text style={[s.count, { color: isPeak ? textColor : subtextColor }, isPeak && s.countPeak]}>{count}</Text>
                ) : null}
                {cover ? (
                  <ExpoImage
                    source={{ uri: cover.artworkUrl }}
                    style={[{ width: capH, height: capH, borderRadius: 4, marginBottom: 2 }, isPeak && { borderWidth: 2, borderColor: tint }]}
                    contentFit="cover"
                    cachePolicy="disk"
                  />
                ) : null}
                {count > 0 ? (
                  <View style={[s.bar, { width: barW, height: barH, backgroundColor: tint, opacity: isPeak ? 1 : 0.35 }]} />
                ) : (
                  // Empty bucket: a dot keeps the baseline from looking broken.
                  <View style={[s.dot, { backgroundColor: faintColor, opacity: b.future ? 0.4 : 1 }]} />
                )}
              </View>
              <Text
                style={[s.label, { color: isPeak ? textColor : subtextColor, opacity: b.future ? 0.45 : 1 }, isPeak && s.labelPeak]}
                numberOfLines={1}>
                {b.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  headRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, marginBottom: 14 },
  headCover: { width: 46, height: 46, borderRadius: 6, borderWidth: 2 },
  headline:  { fontSize: 18, fontWeight: '700', letterSpacing: -0.2 },
  subline:   { fontSize: 13 },
  chart:     { flexDirection: 'row', alignItems: 'flex-end' },
  col:       { alignItems: 'center', gap: 4 },
  count:     { fontSize: 10, fontWeight: '600', marginBottom: 3 },
  countPeak: { fontWeight: '800' },
  bar:       { borderRadius: 4 },
  dot:       { width: 6, height: 6, borderRadius: 3 },
  label:     { fontSize: 10, fontWeight: '500', textAlign: 'center' },
  labelPeak: { fontWeight: '800' },
});
