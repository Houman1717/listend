import { Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import type { ColorsShape } from '@/constants/Colors';
import type { BellPrefs } from '@/lib/friendActivity';

const OPTIONS: { key: keyof BellPrefs; icon: React.ComponentProps<typeof FontAwesome>['name']; label: string; sub: string }[] = [
  { key: 'reviews', icon: 'pencil',     label: 'Reviews',      sub: 'When they write a review' },
  { key: 'ratings', icon: 'volume-up',  label: 'Ratings',      sub: 'When they rate an album' },
  { key: 'listens', icon: 'headphones', label: 'Every listen', sub: 'Every album they log' },
];

/**
 * The menu under the bell on a friend's profile (Instagram-style): one switch
 * per kind of activity, saved as you flip it. No router in here — Modal is its
 * own tree and router.push silently fails from inside it, so "Manage" hands
 * back to the parent.
 */
export function FriendActivityMenu({
  visible,
  onClose,
  name,
  prefs,
  saving,
  onToggle,
  onManage,
  top,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  name: string;
  prefs: BellPrefs;
  saving: boolean;
  onToggle: (key: keyof BellPrefs, value: boolean) => void;
  onManage: () => void;
  /** Distance from the top of the screen — just under the header. */
  top: number;
  colors: ColorsShape;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      <View style={[m.card, { top, backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[m.title, { color: colors.subtext }]} numberOfLines={1}>
          Notifications from {name}
        </Text>

        {OPTIONS.map(o => (
          <View key={o.key} style={m.row}>
            <FontAwesome name={o.icon} size={16} color={colors.tint} style={m.icon} />
            <View style={m.rowText}>
              <Text style={[m.label, { color: colors.text }]}>{o.label}</Text>
              <Text style={[m.sub, { color: colors.subtext }]}>{o.sub}</Text>
            </View>
            <Switch
              value={prefs[o.key]}
              onValueChange={v => onToggle(o.key, v)}
              disabled={saving}
              // `elevated` all but vanished on light cards — a 40% wash of the
              // theme's subtext reads as "off" on every theme, light or dark.
              trackColor={{ false: `${colors.subtext}66`, true: colors.tint }}
              ios_backgroundColor={`${colors.subtext}66`}
              thumbColor="#fff"
            />
          </View>
        ))}

        <View style={[m.sep, { backgroundColor: colors.border }]} />

        <Pressable
          style={({ pressed }) => [m.row, { opacity: pressed ? 0.6 : 1 }]}
          onPress={onManage}>
          <FontAwesome name="sliders" size={16} color={colors.subtext} style={m.icon} />
          <Text style={[m.label, { color: colors.text, flex: 1 }]}>All friend notifications</Text>
          <FontAwesome name="chevron-right" size={12} color={colors.subtext} />
        </Pressable>
      </View>
    </Modal>
  );
}

const m = StyleSheet.create({
  card: {
    position: 'absolute',
    right: 12,
    width: 300,
    maxWidth: '92%',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  title:   { fontSize: 13, fontWeight: '500', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  row:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11, gap: 12 },
  icon:    { width: 20, textAlign: 'center' },
  rowText: { flex: 1 },
  label:   { fontSize: 15, fontWeight: '500' },
  sub:     { fontSize: 12, marginTop: 2 },
  sep:     { height: StyleSheet.hairlineWidth, marginVertical: 4 },
});
