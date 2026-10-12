import { PixelRatio, View, Text } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { VOLUME_EMPTY_DARK, VOLUME_EMPTY_LIGHT } from '@/constants/Colors';

// A community average on the Volume dial — the same look as the album page's
// Ratings block: bars filled up to the average, the bar the average lands in
// partly faded by the fractional part, and the number to one decimal.

const snap = (dp: number) => Math.max(1, Math.round(dp * PixelRatio.get())) / PixelRatio.get();

const SIZES = {
  sm: { heights: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12], bar: 2,   gap: 1,   icon: 10, font: 11 },
  md: { heights: [4, 5, 7, 8, 10, 11, 13, 14, 16, 18], bar: 3, gap: 1.5, icon: 13, font: 15 },
} as const;

export function AverageVolume({ avg, isDark, size = 'sm', color = '#D4A017', numberColor }: {
  avg: number;
  isDark: boolean;
  size?: keyof typeof SIZES;
  color?: string;
  numberColor?: string;
}) {
  const cfg = SIZES[size];
  const inactive = isDark ? VOLUME_EMPTY_DARK : VOLUME_EMPTY_LIGHT;
  const full = Math.floor(avg);
  const frac = avg - full;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <FontAwesome name="volume-up" size={cfg.icon} color={color} />
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: snap(cfg.gap) }}>
        {cfg.heights.map((h, i) => {
          const isFull = i + 1 <= full;
          const isPartial = i === full && frac > 0;
          return (
            <View
              key={i}
              style={{
                width: snap(cfg.bar),
                height: snap(h),
                borderRadius: 1,
                backgroundColor: isFull || isPartial ? color : inactive,
                opacity: isPartial ? Math.max(0.25, frac) : 1,
              }}
            />
          );
        })}
      </View>
      <Text style={{ color: numberColor ?? color, fontSize: cfg.font, fontWeight: '700' }}>{avg.toFixed(1)}</Text>
    </View>
  );
}
