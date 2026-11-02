import { StyleSheet, View, Text, Pressable } from 'react-native';
import type { LoggedAlbum } from '@/context/AlbumsContext';
import { CoverMosaic, mosaicCovers, MIN_MOSAIC_COVERS } from '@/components/CoverMosaic';

// The opening card of Month and Year in Review (and My Stats, including the
// free tease): the period's own covers as a dimmed mosaic behind the big
// number, plus how it compares with the period before. Falls back to a plain
// themed card when there are too few covers.

const HERO_H = 200;

export function ReviewHero({
  label,
  albums,
  value,
  caption,
  previousCount,
  previousLabel = '',
  note,
  onPress,
  cardBg,
  cardBorder,
  tint,
  subtextColor,
  mutedColor,
}: {
  /** "2026" or "October 2026". */
  label: string;
  albums: LoggedAlbum[];
  /** The big number; defaults to the album count. */
  value?: string | number;
  /** Under the number; defaults to "albums logged". */
  caption?: string;
  /** Albums logged in the period before; omitted when there was none. */
  previousCount?: number;
  /** "2025" or "September". */
  previousLabel?: string;
  /** Chip text when there's no comparison, e.g. "Since Jun 2022". */
  note?: string;
  onPress?: () => void;
  cardBg: string;
  cardBorder: string;
  tint: string;
  subtextColor: string;
  mutedColor: string;
}) {
  const covers = mosaicCovers(albums);
  const mosaic = covers.length >= MIN_MOSAIC_COVERS;

  const count = albums.length;
  let comparison = note ?? '';
  if (previousCount != null && previousCount > 0) {
    const diff = count - previousCount;
    comparison = diff > 0 ? `↑ ${diff} more than ${previousLabel}`
      : diff < 0 ? `↓ ${-diff} fewer than ${previousLabel}`
      : `Same as ${previousLabel}`;
  }

  const fg      = mosaic ? '#FFFFFF' : tint;
  const fgSub   = mosaic ? 'rgba(255,255,255,0.88)' : subtextColor;
  const fgLabel = mosaic ? 'rgba(255,255,255,0.75)' : mutedColor;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        s.card,
        { backgroundColor: cardBg, borderColor: cardBorder, opacity: pressed ? 0.85 : 1 },
      ]}>
      {mosaic && <CoverMosaic covers={covers} />}

      <Text style={[s.label, { color: fgLabel }]}>{label}</Text>
      <Text style={[s.count, { color: fg }]}>{value ?? count}</Text>
      <Text style={[s.sub, { color: fgSub }]}>{caption ?? (count === 1 ? 'album logged' : 'albums logged')}</Text>
      {comparison ? (
        <View style={[s.chip, { backgroundColor: mosaic ? 'rgba(255,255,255,0.18)' : cardBorder }]}>
          <Text style={[s.chipText, { color: mosaic ? '#FFFFFF' : subtextColor }]}>{comparison}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    height: HERO_H,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label:    { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2 },
  count:    { fontSize: 76, fontWeight: '800', letterSpacing: -3, lineHeight: 84 },
  sub:      { fontSize: 14, fontWeight: '500' },
  chip:     { marginTop: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  chipText: { fontSize: 12, fontWeight: '600' },
});
