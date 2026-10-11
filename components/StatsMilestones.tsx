import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import type { LoggedAlbum } from '@/context/AlbumsContext';

// Which album was the Nth one logged — the 1st, 10th, 25th, then every 50th to
// 1000 and every 100th after, like RateYourMusic's profile milestones. The
// 10th and 25th give a newer library something to show before its 50th.
function milestoneCounts(total: number): number[] {
  const counts = [1, 10, 25];
  for (let n = 50; n <= Math.min(total + 100, 1000); n += 50) counts.push(n);
  for (let n = 1100; n <= total + 100; n += 100) counts.push(n);
  return counts;
}

function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

export type Milestone = { count: number; album: LoggedAlbum };

// Albums in the order they were first logged. dateLogged is the first-listen
// date (re-listens and review edits don't move it), so each album counts once.
export function computeMilestones(albums: LoggedAlbum[]) {
  const ordered = [...albums].sort((a, b) =>
    a.dateLogged.localeCompare(b.dateLogged) || a.id.localeCompare(b.id));
  const counts = milestoneCounts(ordered.length);
  const reached: Milestone[] = counts
    .filter(n => n <= ordered.length)
    .map(n => ({ count: n, album: ordered[n - 1] }));
  const next = counts.find(n => n > ordered.length) ?? null;
  return { reached, next, total: ordered.length };
}

// The latest few show by default; earlier ones open above them, oldest first.
const SHOWN = 6;

export function StatsMilestones({
  albums,
  onAlbumPress,
  tint,
  textColor,
  subtextColor,
  borderColor,
  trackColor,
}: {
  albums: LoggedAlbum[];
  onAlbumPress: (album: LoggedAlbum) => void;
  tint: string;
  textColor: string;
  subtextColor: string;
  borderColor: string;
  trackColor: string;
}) {
  const { reached, next, total } = useMemo(() => computeMilestones(albums), [albums]);
  const [showAll, setShowAll] = useState(false);

  const hidden = showAll ? 0 : Math.max(0, reached.length - SHOWN);
  const visible = reached.slice(hidden);
  // Progress from the last milestone reached towards the next.
  const prev = reached[reached.length - 1]?.count ?? 0;
  const progress = next ? (total - prev) / (next - prev) : 1;

  return (
    <View>
      {hidden > 0 && (
        <Pressable onPress={() => setShowAll(true)} hitSlop={6} style={({ pressed }) => [m.more, { opacity: pressed ? 0.6 : 1 }]}>
          <Text style={[m.moreText, { color: tint }]}>
            Show {hidden} earlier milestone{hidden === 1 ? '' : 's'}
          </Text>
        </Pressable>
      )}

      {visible.map(({ count, album }, i) => (
        <Pressable
          key={count}
          onPress={() => onAlbumPress(album)}
          style={({ pressed }) => [
            m.row,
            i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: borderColor },
            { opacity: pressed ? 0.6 : 1 },
          ]}>
          <Text style={[m.count, { color: tint }]}>{ordinal(count)}</Text>
          {album.artworkUrl ? (
            <ExpoImage source={{ uri: album.artworkUrl }} style={m.cover} contentFit="cover" cachePolicy="disk" />
          ) : (
            <View style={[m.cover, { backgroundColor: album.coverColor }]} />
          )}
          <View style={m.info}>
            <Text style={[m.title, { color: textColor }]} numberOfLines={1}>{album.title}</Text>
            <Text style={[m.artist, { color: subtextColor }]} numberOfLines={1}>{album.artist}</Text>
          </View>
          <Text style={[m.date, { color: subtextColor }]}>
            {new Date(album.dateLogged).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        </Pressable>
      ))}

      {next && (
        <View style={[m.next, reached.length > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: borderColor }]}>
          <View style={m.nextRow}>
            <Text style={[m.nextLabel, { color: textColor }]}>Next: {ordinal(next)} album</Text>
            <Text style={[m.nextLeft, { color: subtextColor }]}>{next - total} to go</Text>
          </View>
          <View style={[m.track, { backgroundColor: trackColor }]}>
            <View style={[m.fill, { backgroundColor: tint, width: `${Math.round(progress * 100)}%` }]} />
          </View>
        </View>
      )}
    </View>
  );
}

const m = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  count:    { width: 46, fontSize: 13, fontWeight: '800' },
  cover:    { width: 40, height: 40, borderRadius: 6 },
  info:     { flex: 1, minWidth: 0 },
  title:    { fontSize: 14, fontWeight: '600' },
  artist:   { fontSize: 12, marginTop: 2 },
  date:     { fontSize: 12 },
  more:     { alignSelf: 'flex-start', paddingBottom: 8 },
  moreText: { fontSize: 13, fontWeight: '600' },
  next:     { paddingTop: 12, marginTop: 4, gap: 8 },
  nextRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  nextLabel:{ fontSize: 13, fontWeight: '700' },
  nextLeft: { fontSize: 12 },
  track:    { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill:     { height: 6, borderRadius: 3 },
});
