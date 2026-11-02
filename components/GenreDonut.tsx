import { View, Text, Pressable, StyleSheet } from 'react-native';

// My Stats' Most Listend genres as a donut: the library's genre mix, top
// genre's share in the hole, and a tappable legend. Plain Views, no
// react-native-svg (not in the native build): each slice is a "wedge from
// 0° to its cumulative end", drawn largest-first so later wedges cover the
// earlier ones, then a hole on top.

const SHOWN = 5; // the rest fold into "Other"

function mixHex(a: string, b: string, t: number): string {
  const ok = /^#[0-9a-f]{6}$/i;
  if (!ok.test(a) || !ok.test(b)) return a;
  const p = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return '#' + x.map((v, i) => Math.round(v * t + y[i] * (1 - t)).toString(16).padStart(2, '0')).join('');
}

/** A filled wedge from 12 o'clock clockwise to `deg`, as two rotated half-discs. */
function Wedge({ deg, color, size }: { deg: number; color: string; size: number }) {
  const r = size / 2;
  return (
    <View style={[StyleSheet.absoluteFill, { borderRadius: r, overflow: 'hidden' }]}>
      {/* Right half: 0–180° */}
      <View style={{ position: 'absolute', left: r, top: 0, width: r, height: size, overflow: 'hidden' }}>
        <View style={{
          position: 'absolute', left: 0, top: 0, width: r, height: size,
          borderTopRightRadius: r, borderBottomRightRadius: r, backgroundColor: color,
          transform: [{ translateX: -(r / 2) }, { rotate: `${Math.min(deg, 180) - 180}deg` }, { translateX: r / 2 }],
        }} />
      </View>
      {/* Left half: 180–360° */}
      {deg > 180 && (
        <View style={{ position: 'absolute', left: 0, top: 0, width: r, height: size, overflow: 'hidden' }}>
          <View style={{
            position: 'absolute', left: 0, top: 0, width: r, height: size,
            borderTopLeftRadius: r, borderBottomLeftRadius: r, backgroundColor: color,
            transform: [{ translateX: r / 2 }, { rotate: `${360 - deg}deg` }, { translateX: -(r / 2) }],
          }} />
        </View>
      )}
    </View>
  );
}

export function GenreDonut({
  genres,
  onGenrePress,
  onOtherPress,
  tint,
  textColor,
  subtextColor,
  cardBg,
  otherColor,
  size = 132,
}: {
  /** [genre, album count], most first. */
  genres: [string, number][];
  onGenrePress: (genre: string) => void;
  onOtherPress?: () => void;
  tint: string;
  textColor: string;
  subtextColor: string;
  cardBg: string;
  otherColor: string;
  size?: number;
}) {
  const total = genres.reduce((s, [, n]) => s + n, 0);
  if (total === 0) return null;

  // Shades of the theme colour, strongest for the biggest slice.
  const shades = [1, 0.78, 0.6, 0.45, 0.33].map(t => mixHex(tint, cardBg, t));
  const top = genres.slice(0, SHOWN);
  const otherCount = genres.slice(SHOWN).reduce((s, [, n]) => s + n, 0);
  const slices = [
    ...top.map(([genre, n], i) => ({ key: genre, label: genre, n, color: shades[i] })),
    ...(otherCount > 0 ? [{ key: '__other', label: `Other (${genres.length - SHOWN})`, n: otherCount, color: otherColor }] : []),
  ];

  let acc = 0;
  const wedges = slices.map(sl => { acc += sl.n; return { ...sl, end: (acc / total) * 360 }; });
  const pct = (n: number) => Math.round((n / total) * 100);
  const hole = size * 0.6;

  return (
    <View style={s.wrap}>
      <View style={{ width: size, height: size }}>
        {[...wedges].reverse().map(w => (
          <Wedge key={w.key} deg={Math.min(w.end, 359.99)} color={w.color} size={size} />
        ))}
        <View style={[s.hole, { width: hole, height: hole, borderRadius: hole / 2, left: (size - hole) / 2, top: (size - hole) / 2, backgroundColor: cardBg }]}>
          <Text style={[s.holePct, { color: textColor }]}>{pct(top[0][1])}%</Text>
          <Text style={[s.holeLabel, { color: subtextColor }]} numberOfLines={2}>{top[0][0]}</Text>
        </View>
      </View>

      <View style={s.legend}>
        {slices.map(sl => (
          <Pressable
            key={sl.key}
            onPress={() => (sl.key === '__other' ? onOtherPress?.() : onGenrePress(sl.key))}
            style={({ pressed }) => [s.row, { opacity: pressed ? 0.6 : 1 }]}>
            <View style={[s.swatch, { backgroundColor: sl.color }]} />
            <Text style={[s.name, { color: textColor }]} numberOfLines={1}>{sl.label}</Text>
            <Text style={[s.pct, { color: subtextColor }]}>{pct(sl.n)}%</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:      { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 4 },
  hole:      { position: 'absolute', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  holePct:   { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  holeLabel: { fontSize: 10, fontWeight: '600', textAlign: 'center' },
  legend:    { flex: 1, gap: 7 },
  row:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swatch:    { width: 10, height: 10, borderRadius: 3 },
  name:      { flex: 1, fontSize: 13, fontWeight: '600' },
  pct:       { fontSize: 12, fontWeight: '600' },
});
