import {
  StyleSheet,
  View,
  Text,
  ScrollView,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

const DARK_BG = '#0d0d0d';
const CARD_BG  = '#111';
const BORDER   = '#1e1e1e';
const TEXT     = '#f0f0f0';
const SUBTEXT  = '#666';
const ACCENT   = '#FF3CAC';

export default function DMsScreen() {
  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>

      {/* ── Inbox header bar ─────────────────────────────────────────────────── */}
      <View style={s.inboxHeader}>
        <Text style={s.inboxLabel}>Inbox</Text>
      </View>

      {/* ── Placeholder conversation rows (visual structure) ─────────────────── */}
      <View style={s.listWrap}>
        {[0, 1, 2].map(i => (
          <View key={i} style={[s.placeholderRow, i < 2 && s.placeholderBorder]}>
            <View style={s.placeholderAvatar} />
            <View style={s.placeholderLines}>
              <View style={[s.placeholderLine, { width: '55%' }]} />
              <View style={[s.placeholderLine, { width: '80%', opacity: 0.4 }]} />
            </View>
          </View>
        ))}
      </View>

      {/* ── Empty state ───────────────────────────────────────────────────────── */}
      <View style={s.emptyWrap}>
        <View style={s.emptyIconRing}>
          <FontAwesome name="comments" size={36} color={ACCENT} />
        </View>
        <Text style={s.emptyTitle}>No conversations yet</Text>
        <Text style={s.emptySub}>
          When friends message you,{'\n'}they'll show up here.
        </Text>
      </View>

    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_BG },
  content:   { paddingBottom: 48 },

  inboxHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  inboxLabel: { color: TEXT, fontSize: 18, fontWeight: '700' },

  listWrap: { paddingHorizontal: 20, paddingTop: 4 },

  placeholderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 14,
  },
  placeholderBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  placeholderAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1c1c1c',
  },
  placeholderLines: { flex: 1, gap: 8 },
  placeholderLine: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1c1c1c',
  },

  emptyWrap: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyIconRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#1a0d14',
    borderWidth: 1,
    borderColor: '#3a1a2a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    color: TEXT,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  emptySub: {
    color: SUBTEXT,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
});
