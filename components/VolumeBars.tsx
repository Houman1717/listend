import { PixelRatio, View } from 'react-native';

// Small volume-rating bars (the staircase next to the speaker icon).
//
// Every size is snapped to whole physical pixels. Android densities like 2.625
// make a 2dp bar 5.25px wide, and Yoga rounds each bar's edges to the pixel
// grid independently — so bars came out 5px or 6px wide with 2px or 3px gaps,
// and the row looked wonky. With whole-pixel widths and gaps, every edge sits
// at the same sub-pixel offset and rounds the same way.

const snap = (dp: number) => Math.max(1, Math.round(dp * PixelRatio.get())) / PixelRatio.get();

const DEFAULT_HEIGHTS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export default function VolumeBars({
  rating,
  activeColor,
  inactiveColor,
  heights = DEFAULT_HEIGHTS,
  barWidth = 2,
  gap = 1,
}: {
  rating: number;
  activeColor: string;
  inactiveColor: string;
  heights?: number[];
  barWidth?: number;
  gap?: number;
}) {
  const w = snap(barWidth);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: snap(gap) }}>
      {heights.map((h, i) => (
        <View
          key={i}
          style={{ width: w, height: snap(h), borderRadius: 1, backgroundColor: i + 1 <= rating ? activeColor : inactiveColor }}
        />
      ))}
    </View>
  );
}
