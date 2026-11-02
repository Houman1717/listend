import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import VolumeBars from '@/components/VolumeBars';
import { RatingChart, type RatedAlbum } from '@/components/RatingChart';

export type { RatedAlbum };

// The sheet behind a profile's "Avg rating": the average with its volume
// meter over the shared Rating Breakdown chart (also on My Stats and the
// month / year recaps).
//
// Replaced a full-width list of thin bars inside a SafeAreaView — in a Modal
// that SafeAreaView overrode the sheet's padding, so the close button and the
// bottom row ran into the screen edges.

type SheetColors = { text: string; subtext: string; tint: string; border: string; surface: string };

export function RatingBreakdownSheet(props: {
  visible: boolean;
  onClose: () => void;
  avgRating: string;
  /** Rated albums only. */
  albums: RatedAlbum[];
  /** Whose: "your" on your own profile, "their" on someone else's. */
  whose: 'your' | 'their';
  /** Parent closes the sheet and navigates (no router inside a Modal). */
  onAlbumPress: (album: RatedAlbum) => void;
  colors: SheetColors;
}) {
  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}>
      {/* Its own provider: a Modal is a separate view tree, so insets are 0 without one */}
      <SafeAreaProvider>
        <Sheet {...props} />
      </SafeAreaProvider>
    </Modal>
  );
}

function Sheet({ onClose, avgRating, albums, whose, onAlbumPress, colors }: Parameters<typeof RatingBreakdownSheet>[0]) {
  const insets = useSafeAreaInsets();

  const avgNum = Number(avgRating);
  const Whose = whose === 'your' ? 'Your' : 'Their';

  return (
    <View style={s.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[s.sheet, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom + 20 }]}>
        <View style={[s.handle, { backgroundColor: colors.border }]} />

        <View style={s.header}>
          <View style={s.headerSide} />
          <Text style={[s.headerTitle, { color: colors.text }]}>Rating Breakdown</Text>
          <Pressable onPress={onClose} hitSlop={10} style={[s.close, { backgroundColor: colors.border }]}>
            <FontAwesome name="times" size={14} color={colors.subtext} />
          </Pressable>
        </View>

        {/* Average */}
        <View style={s.avgRow}>
          <Text style={[s.avgValue, { color: colors.tint }]}>
            {avgRating}
            {avgRating !== '—' && <Text style={[s.avgUnit, { color: colors.subtext }]}> /10</Text>}
          </Text>
          <View style={{ gap: 6 }}>
            {Number.isFinite(avgNum) && (
              <View style={s.meter}>
                <FontAwesome name="volume-up" size={18} color={colors.tint} />
                <VolumeBars rating={Math.round(avgNum)} activeColor={colors.tint} inactiveColor={colors.border}
                  heights={[5, 7, 9, 11, 13, 15, 17, 19, 21, 23]} barWidth={3} gap={2} />
              </View>
            )}
            <Text style={[s.avgSub, { color: colors.subtext }]}>
              {Whose} average across {albums.length} rated album{albums.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        <RatingChart albums={albums} whose={whose} onAlbumPress={onAlbumPress} colors={colors} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop:    { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet:       { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 20 },
  handle:      { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, paddingBottom: 14 },
  headerSide:  { width: 32 },
  headerTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  close:       { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avgRow:      { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 22 },
  avgValue:    { fontSize: 52, fontWeight: '800', letterSpacing: -2 },
  avgUnit:     { fontSize: 18, fontWeight: '600', letterSpacing: 0 },
  avgSub:      { fontSize: 13, fontWeight: '500' },
  meter:       { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
});
