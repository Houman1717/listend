import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';

// "Rating Breakdown": a 1–10 column chart with the most-used rating in gold,
// and the covers rated whichever column is tapped underneath. Shared by the
// profile's rating sheet, My Stats and Month / Year in Review so all four
// read the same.

export type RatedAlbum = {
  id: string;
  title: string;
  artist: string;
  artworkUrl?: string;
  year?: number;
  rating: number;
  /** For "latest first" in the cover row. */
  listenedAt?: string;
};

type ChartColors = { text: string; subtext: string; tint: string; border: string };

const CHART_H = 120;
const GAP = 5;

export function RatingChart<A extends RatedAlbum>({
  albums,
  whose,
  period,
  onAlbumPress,
  colors,
}: {
  /** Rated albums only. */
  albums: A[];
  whose: 'your' | 'their';
  /** "October" or "2026": the headline then reads "Most of your October albums…". */
  period?: string;
  onAlbumPress: (album: A) => void;
  colors: ChartColors;
}) {
  const counts = useMemo(
    () => Array.from({ length: 10 }, (_, i) => albums.filter(a => a.rating === i + 1).length),
    [albums],
  );
  const max = Math.max(...counts, 1);
  // Most-used rating; a tie goes to the higher one.
  const peak = counts.reduce((best, n, i) => (n >= counts[best] ? i : best), 0) + 1;

  const [selected, setSelected] = useState(peak);
  useEffect(() => { setSelected(peak); }, [peak]);

  const selectedAlbums = useMemo(
    () => albums
      .filter(a => a.rating === selected)
      .sort((a, b) => (b.listenedAt ?? '').localeCompare(a.listenedAt ?? '')),
    [albums, selected],
  );

  if (albums.length === 0) return null;

  const Whose = whose === 'your' ? 'Your' : 'Their';
  const noun = period ? `${period} albums` : 'albums';
  const headline = albums.length < 5
    ? `${Whose} ratings`
    : `Most of ${whose} ${noun} land on ${peak === 8 ? 'an' : 'a'} ${peak}`;

  return (
    <View>
      <Text style={[s.headline, { color: colors.text }]}>{headline}</Text>

      {/* 1–10 columns; tap one to see its albums below */}
      <View style={s.chart}>
        {counts.map((count, i) => {
          const rating = i + 1;
          const isSel = rating === selected;
          const h = count > 0 ? Math.max((count / max) * CHART_H, 5) : 0;
          return (
            <Pressable key={rating} onPress={() => setSelected(rating)} hitSlop={{ top: 8, bottom: 8 }} style={s.col}>
              {count > 0 && (
                <Text style={[s.count, { color: isSel ? colors.text : colors.subtext }, isSel && s.countSel]} numberOfLines={1}>{count}</Text>
              )}
              {count > 0 ? (
                <View style={[s.bar, { height: h, backgroundColor: colors.tint, opacity: isSel ? 1 : 0.3 }]} />
              ) : (
                <View style={[s.dot, { backgroundColor: colors.border }]} />
              )}
            </Pressable>
          );
        })}
      </View>
      <View style={s.axis}>
        {counts.map((_, i) => (
          <Pressable key={i} onPress={() => setSelected(i + 1)} style={{ flex: 1 }}>
            <Text style={[s.axisLabel, { color: i + 1 === selected ? colors.tint : colors.subtext }]}>{i + 1}</Text>
          </Pressable>
        ))}
      </View>

      {/* Albums rated the selected number */}
      <View style={[s.strip, { borderTopColor: colors.border }]}>
        <Text style={[s.stripTitle, { color: colors.text }]}>
          Rated {selected}
          <Text style={{ color: colors.subtext, fontWeight: '500' }}>
            {'  ·  '}{selectedAlbums.length} album{selectedAlbums.length !== 1 ? 's' : ''}
          </Text>
        </Text>
        {selectedAlbums.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.covers}>
            {selectedAlbums.map(a => (
              <Pressable key={a.id} onPress={() => onAlbumPress(a)} style={({ pressed }) => [s.coverCard, { opacity: pressed ? 0.7 : 1 }]}>
                {a.artworkUrl ? (
                  <ExpoImage source={{ uri: a.artworkUrl }} style={s.cover} contentFit="cover" cachePolicy="disk" />
                ) : (
                  <View style={[s.cover, { backgroundColor: colors.border }]} />
                )}
                <Text style={[s.coverTitle, { color: colors.text }]} numberOfLines={1}>{a.title}</Text>
                <Text style={[s.coverArtist, { color: colors.subtext }]} numberOfLines={1}>{a.artist}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <Text style={[s.none, { color: colors.subtext }]}>No albums rated {selected}.</Text>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  headline:    { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  chart:       { flexDirection: 'row', alignItems: 'flex-end', gap: GAP, height: CHART_H + 18 },
  col:         { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 3, height: '100%' },
  count:       { fontSize: 11, fontWeight: '600' },
  countSel:    { fontWeight: '800' },
  bar:         { alignSelf: 'stretch', borderRadius: 5 },
  dot:         { width: 5, height: 5, borderRadius: 2.5 },
  axis:        { flexDirection: 'row', gap: GAP, marginTop: 6 },
  axisLabel:   { textAlign: 'center', fontSize: 13, fontWeight: '700' },
  strip:       { marginTop: 18, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, gap: 10 },
  stripTitle:  { fontSize: 15, fontWeight: '700' },
  covers:      { gap: 12 },
  coverCard:   { width: 84, gap: 3 },
  cover:       { width: 84, height: 84, borderRadius: 6 },
  coverTitle:  { fontSize: 12, fontWeight: '600', marginTop: 2 },
  coverArtist: { fontSize: 11 },
  none:        { fontSize: 13, paddingVertical: 20 },
});
