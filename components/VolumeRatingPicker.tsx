import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { VOLUME_EMPTY_DARK, VOLUME_EMPTY_LIGHT } from '@/constants/Colors';

// The Volume dial (1–10) — same look and gestures as album-detail's picker.
// Inside a <Modal> this needs a GestureHandlerRootView above it.

export const RATING_LABELS: Record<number, string> = {
  1: 'Skip', 2: 'Rough', 3: 'Forgettable', 4: 'Underwhelming',
  5: 'Basic', 6: 'Likable', 7: 'Strong', 8: 'Standout',
  9: 'Classic', 10: 'Timeless / No Skips',
};

const BAR_HEIGHTS = [6, 9, 12, 15, 18, 22, 26, 30, 34, 38];
const ACCENT = '#D4A017';

export function VolumeRatingPicker({ rating, onChange, isDark, tint = ACCENT }: { rating: number; onChange: (r: number) => void; isDark: boolean; tint?: string }) {
  const [trackWidth, setTrackWidth] = useState(0);
  const inactiveColor = isDark ? VOLUME_EMPTY_DARK : VOLUME_EMPTY_LIGHT;

  const tap = Gesture.Tap()
    .runOnJS(true)
    .onEnd(e => {
      const val = Math.max(1, Math.min(10, Math.ceil((e.x / trackWidth) * 10)));
      onChange(val === rating ? 0 : val);
    });

  const pan = Gesture.Pan()
    .runOnJS(true)
    .onUpdate(e => {
      const val = Math.ceil((e.x / trackWidth) * 10);
      onChange(Math.max(1, Math.min(10, val)));
    });

  const gesture = Gesture.Simultaneous(tap, pan);

  return (
    <View style={s.container}>
      <View style={s.row}>
        <FontAwesome name="volume-up" size={22} color={rating > 0 ? tint : inactiveColor} />
        <View style={{ flex: 1 }} onLayout={e => setTrackWidth(e.nativeEvent.layout.width)}>
          {trackWidth > 0 && (
            <GestureDetector gesture={gesture}>
              <View style={s.track}>
                {BAR_HEIGHTS.map((h, i) => (
                  <View key={i} style={[s.bar, { height: h, backgroundColor: i + 1 <= rating ? tint : inactiveColor }]} />
                ))}
              </View>
            </GestureDetector>
          )}
        </View>
        <View style={s.numBox}>
          <Text style={[s.num, { color: rating > 0 ? tint : inactiveColor }]}>
            {rating > 0 ? rating : '–'}
          </Text>
        </View>
      </View>
      <Text style={[s.hint, { color: '#a07850' }]}>
        {rating > 0 ? RATING_LABELS[rating] : ' '}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { width: '100%', marginTop: 10 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  track: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, paddingBottom: 2, height: 44 },
  bar: { flex: 1, borderRadius: 2 },
  hint: { marginTop: 10, fontSize: 13, textAlign: 'center', height: 18 },
  numBox: { width: 30, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 2 },
  num: { fontSize: 20, fontWeight: '700' },
});

// ─── Compact variant ─────────────────────────────────────────────────────────
// One-line dial for lists (e.g. rating every track while logging an album).
// The drag only claims horizontal movement so the list can still scroll.

const COMPACT_HEIGHTS = [4, 5, 7, 8, 10, 11, 13, 14, 16, 18];

export function CompactVolumePicker({ rating, onChange, isDark, width = 120 }: {
  rating: number;
  onChange: (r: number) => void;
  isDark: boolean;
  width?: number;
}) {
  const inactiveColor = isDark ? VOLUME_EMPTY_DARK : VOLUME_EMPTY_LIGHT;
  const valueAt = (x: number) => Math.max(1, Math.min(10, Math.ceil((x / width) * 10)));

  const tap = Gesture.Tap()
    .runOnJS(true)
    .onEnd(e => {
      const val = valueAt(e.x);
      onChange(val === rating ? 0 : val);
    });

  const pan = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-6, 6])
    .failOffsetY([-10, 10])
    .onUpdate(e => onChange(valueAt(e.x)));

  return (
    <View style={c.row}>
      <FontAwesome name="volume-up" size={12} color={rating > 0 ? ACCENT : inactiveColor} />
      <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
        <View style={[c.track, { width }]} hitSlop={{ top: 10, bottom: 10 }}>
          {COMPACT_HEIGHTS.map((h, i) => (
            <View key={i} style={[c.bar, { height: h, backgroundColor: i + 1 <= rating ? ACCENT : inactiveColor }]} />
          ))}
        </View>
      </GestureDetector>
      <Text style={[c.num, { color: rating > 0 ? ACCENT : inactiveColor }]}>{rating > 0 ? rating : '–'}</Text>
    </View>
  );
}

const c = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  track: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 22, paddingBottom: 2 },
  bar: { flex: 1, borderRadius: 1.5 },
  num: { width: 18, fontSize: 13, fontWeight: '700', textAlign: 'right' },
});
