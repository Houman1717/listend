import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import type { ColorsShape } from '@/constants/Colors';
import { StreakMedal } from '@/components/StreakMedal';
import {
  getStreakTier, STREAK_META, nextTierProgress, readableTierColor, textOn,
} from '@/lib/flipStreak';

/**
 * Opens from the streak coin beside a profile's @handle: the big animated
 * medal, the run, its level and how far to the next, and a way into Flip a
 * Record. Wears the profile's own theme, like the Pro sheet.
 *
 * `onOpenFlip` is a callback rather than a router push on purpose — router
 * navigation from inside a React Native Modal silently no-ops.
 */
export function StreakSheet({
  visible, onClose, onOpenFlip, streak, best, name, isOwn, colors,
}: {
  visible: boolean;
  onClose: () => void;
  onOpenFlip: () => void;
  streak: number;
  /** Longest run we know of; shown when it's beaten the current one. */
  best: number;
  name: string;
  isOwn: boolean;
  colors: ColorsShape;
}) {
  const c = colors;
  const tier = getStreakTier(streak);
  const meta = STREAK_META[tier];
  const ink = readableTierColor(meta.color, !c.isDark);
  const next = nextTierProgress(streak);
  const nextMeta = next ? STREAK_META[next.next] : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <SafeAreaProvider>
        <View style={s.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          <SafeAreaView edges={['bottom']} style={[s.sheet, { backgroundColor: c.background, borderTopColor: c.border }]}>
            <View style={[s.handle, { backgroundColor: c.border }]} />

            {/* The medal, big */}
            <View style={s.header}>
              {visible && <StreakMedal streak={streak} size={76} />}
              <Text style={[s.title, { color: c.text }]}>
                {isOwn ? `You're on a ${streak}-flip streak` : `${name} is on a ${streak}-flip streak`}
              </Text>
              <Text style={[s.subtitle, { color: c.subtext }]}>
                <Text style={{ color: ink, fontWeight: '700' }}>{meta.label}</Text>
                {' · '}{meta.caption}
              </Text>
            </View>

            {/* Progress to the next level */}
            <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
              {next && nextMeta ? (
                <>
                  <View style={s.cardRow}>
                    <Text style={[s.cardLabel, { color: c.text }]}>Next: <Text style={{ color: readableTierColor(nextMeta.color, !c.isDark) }}>{nextMeta.label}</Text></Text>
                    <Text style={[s.cardValue, { color: c.subtext }]}>{next.remaining} to go</Text>
                  </View>
                  <View style={[s.track, { backgroundColor: c.border }]}>
                    <View style={[s.fill, { backgroundColor: meta.color, width: `${Math.max(4, Math.round(next.progress * 100))}%` as `${number}%` }]} />
                  </View>
                </>
              ) : (
                <Text style={[s.cardLabel, { color: c.text, textAlign: 'center' }]}>Top level reached — {meta.caption.toLowerCase()}</Text>
              )}
              {best > streak && (
                <Text style={[s.best, { color: c.subtext }]}>Best ever: {best} in a row</Text>
              )}
            </View>

            {/* What it is */}
            <Text style={[s.explain, { color: c.subtext }]}>
              {isOwn
                ? 'Flip a Record deals you a classic album at random. Log it to keep the streak going; skip one and it starts again.'
                : 'Flip a Record deals you a classic album at random. Every one you log adds to your streak.'}
            </Text>

            <Pressable
              onPress={onOpenFlip}
              style={({ pressed }) => [s.cta, { backgroundColor: c.tint, opacity: pressed ? 0.85 : 1 }]}>
              <Text style={[s.ctaText, { color: textOn(c.tint) }]}>{isOwn ? 'Open Flip a Record' : 'Try Flip a Record'}</Text>
            </Pressable>

            <Pressable onPress={onClose} style={({ pressed }) => [s.dismiss, { opacity: pressed ? 0.6 : 1 }]}>
              <Text style={[s.dismissText, { color: c.subtext }]}>Not now</Text>
            </Pressable>
          </SafeAreaView>
        </View>
      </SafeAreaProvider>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20, paddingBottom: 12,
  },
  handle: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10 },

  header:   { alignItems: 'center', paddingTop: 10, paddingBottom: 6 },
  title:    { fontSize: 19, fontWeight: '800', letterSpacing: -0.3, textAlign: 'center', marginTop: 4 },
  subtitle: { fontSize: 13.5, lineHeight: 20, textAlign: 'center', marginTop: 6 },

  card:      { marginTop: 18, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 10 },
  cardRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  cardLabel: { fontSize: 14, fontWeight: '700' },
  cardValue: { fontSize: 12.5, fontWeight: '600' },
  track:     { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill:      { height: 6, borderRadius: 3 },
  best:      { fontSize: 12 },

  explain: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 16, paddingHorizontal: 8 },

  cta:     { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  ctaText: { fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },

  dismiss:     { alignItems: 'center', paddingVertical: 14 },
  dismissText: { fontSize: 13.5, fontWeight: '600' },
});
