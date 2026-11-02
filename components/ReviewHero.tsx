import { StyleSheet, View, Text, Pressable, PixelRatio } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useState } from 'react';
import type { LoggedAlbum } from '@/context/AlbumsContext';
import { effectiveRating } from '@/lib/effectiveRating';

// The opening card of Month and Year in Review (and My Stats): the period's own covers as a
// dimmed mosaic behind the album count, plus how it compares with the period
// before. Falls back to a plain themed card when there are too few covers.

const HERO_H = 200;
const COLS   = 4;
const MIN_COVERS = 4;

// Stored covers are 500px, but a mosaic tile is ~620 real pixels on a 3x
// phone, so they came out soft. Ask for the size the tile actually needs:
// Apple's CDN renders any {n}x{n}bb; Cover Art Archive offers 1200.
function coverAt(url: string, px: number): string {
  const n = Math.min(Math.ceil(px / 100) * 100, 1200);
  return url
    .replace(/\/\d+x\d+bb\.(jpg|png|webp)$/i, `/${n}x${n}bb.$1`)
    .replace(/\/front-(250|500)$/, '/front-1200');
}

export function ReviewHero({
  label,
  albums,
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
  const [width, setWidth] = useState(0);

  // Best-rated first, one tile per album.
  const covers = [...new Map(
    [...albums]
      .filter(a => a.artworkUrl)
      .sort((a, b) => effectiveRating(b) - effectiveRating(a))
      .map(a => [a.id, a.artworkUrl!] as const),
  ).values()];
  const mosaic = covers.length >= MIN_COVERS;

  // Whole pixels, rounded up; the card clips the spare pixel or two. Fractional
  // widths made the fourth tile wrap and left an empty strip on the right.
  const tile  = width > 0 ? Math.ceil(width / COLS) : 0;
  const rows  = tile > 0 ? Math.ceil(HERO_H / tile) : 0;
  // Repeat covers to fill the grid when the period has only a few.
  const tiles = mosaic && tile > 0
    ? Array.from({ length: rows * COLS }, (_, i) => covers[i % covers.length])
    : [];

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
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
      style={({ pressed }) => [
        s.card,
        { backgroundColor: cardBg, borderColor: cardBorder, opacity: pressed ? 0.85 : 1 },
      ]}>
      {mosaic && (
        <>
          <View style={[s.mosaic, { width: tile * COLS }]}>
            {tiles.map((uri, i) => (
              <ExpoImage
                key={i}
                source={{ uri: coverAt(uri, PixelRatio.getPixelSizeForLayoutSize(tile)) }}
                placeholder={{ uri }}
                style={{ width: tile, height: tile }}
                contentFit="cover"
                cachePolicy="disk"
              />
            ))}
          </View>
          <View style={s.dim} />
        </>
      )}

      <Text style={[s.label, { color: fgLabel }]}>{label}</Text>
      <Text style={[s.count, { color: fg }]}>{count}</Text>
      <Text style={[s.sub, { color: fgSub }]}>{count === 1 ? 'album logged' : 'albums logged'}</Text>
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
  mosaic:   { position: 'absolute', top: 0, left: 0, flexDirection: 'row', flexWrap: 'wrap' },
  dim:      { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8,10,16,0.7)' },
  label:    { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2 },
  count:    { fontSize: 76, fontWeight: '800', letterSpacing: -3, lineHeight: 84 },
  sub:      { fontSize: 14, fontWeight: '500' },
  chip:     { marginTop: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  chipText: { fontSize: 12, fontWeight: '600' },
});
