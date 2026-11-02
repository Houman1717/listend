import { StyleSheet, View, PixelRatio } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useState } from 'react';
import type { LoggedAlbum } from '@/context/AlbumsContext';
import { effectiveRating } from '@/lib/effectiveRating';

// A dimmed 4-column grid of someone's best covers, filling whatever card it's
// dropped into. Behind the stats heroes and the Pro unlock blocks, so the
// screens (and the pitch) are made of the listener's own music.

const COLS = 4;
export const MIN_MOSAIC_COVERS = 4;

/** Best-rated first, one per album. Fewer than MIN_MOSAIC_COVERS: no mosaic. */
export function mosaicCovers(albums: LoggedAlbum[]): string[] {
  return [...new Map(
    [...albums]
      .filter(a => a.artworkUrl)
      .sort((a, b) => effectiveRating(b) - effectiveRating(a))
      .map(a => [a.id, a.artworkUrl!] as const),
  ).values()];
}

// Stored covers are 500px, but a mosaic tile is ~620 real pixels on a 3x
// phone, so they came out soft. Ask for the size the tile actually needs:
// Apple's CDN renders any {n}x{n}bb; Cover Art Archive offers 1200.
function coverAt(url: string, px: number): string {
  const n = Math.min(Math.ceil(px / 100) * 100, 1200);
  return url
    .replace(/\/\d+x\d+bb\.(jpg|png|webp)$/i, `/${n}x${n}bb.$1`)
    .replace(/\/front-(250|500)$/, '/front-1200');
}

/** Absolute-fill backdrop; render it first inside a card with overflow hidden. */
export function CoverMosaic({ covers, dim = 0.7 }: { covers: string[]; dim?: number }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  // Whole pixels, rounded up; the card clips the spare pixel or two. Fractional
  // widths made the fourth tile wrap and left an empty strip on the right.
  const tile  = size.w > 0 ? Math.ceil(size.w / COLS) : 0;
  const rows  = tile > 0 ? Math.ceil(size.h / tile) : 0;
  // Repeat covers to fill the grid when there are only a few.
  const tiles = covers.length > 0 && tile > 0
    ? Array.from({ length: rows * COLS }, (_, i) => covers[i % covers.length])
    : [];

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={e => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <View style={[s.grid, { width: tile * COLS }]}>
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
      <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(8,10,16,${dim})` }]} />
    </View>
  );
}

const s = StyleSheet.create({
  grid: { position: 'absolute', top: 0, left: 0, flexDirection: 'row', flexWrap: 'wrap' },
});
