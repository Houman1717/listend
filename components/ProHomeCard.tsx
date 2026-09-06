import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { usePro } from '@/context/ProContext';

const DISMISS_KEY  = 'proHomeCardDismissedAt';
const VARIANT_KEY  = 'proHomeCardVariant';
const DISMISS_DAYS = 14;
const ACCENT       = '#D4A017';

/**
 * Three pitches for the same product, rotated one per appearance: the feature
 * list, the personal-data angle, and the identity angle. Someone who ignored
 * one of them gets a different reason to care rather than the same card again.
 */
const VARIANTS = [
  {
    icon:  'star',
    title: 'Unlock Listend Pro',
    sub:   'Full stats, unlimited playlists, hourly flips and 9 profile themes.',
  },
  {
    icon:  'bar-chart',
    title: 'See your listening in numbers',
    sub:   'Top genres, decades, streaks and how your ratings compare.',
  },
  {
    icon:  'paint-brush',
    title: 'Make your profile yours',
    sub:   'Nine profile themes, a gold verified tick and unlimited playlists.',
  },
];

/**
 * Dismissible Pro promo at the top of the home feed. Pro was previously only
 * reachable from the settings sheet, so most users never learned it existed.
 *
 * Dismissal is remembered for two weeks rather than forever — long enough not
 * to nag, short enough that a user who has since built a library sees it again.
 */
export function ProHomeCard({
  colors,
  onPress,
}: {
  colors: { card: string; border: string; text: string; subtext: string };
  onPress: () => void;
}) {
  const { isPro, proLoaded } = usePro();
  // null = still reading storage; don't flash the card in before we know
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const [variant,   setVariant]   = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      AsyncStorage.getItem(DISMISS_KEY),
      AsyncStorage.getItem(VARIANT_KEY),
    ])
      .then(([rawAt, rawVariant]) => {
        if (cancelled) return;
        const at = rawAt ? Number(rawAt) : 0;
        const expired = !at || Date.now() - at > DISMISS_DAYS * 24 * 60 * 60 * 1000;
        const stored = Number(rawVariant);
        setVariant(Number.isInteger(stored) ? Math.abs(stored) % VARIANTS.length : 0);
        setDismissed(!expired);
      })
      .catch(() => { if (!cancelled) setDismissed(false); });
    return () => { cancelled = true; };
  }, []);

  // Wait for proLoaded too — otherwise a paying user sees the card flash up
  // on every cold start while their profile row is still being fetched.
  if (isPro || !proLoaded || dismissed !== false) return null;

  const copy = VARIANTS[variant];

  function dismiss() {
    setDismissed(true);
    // Advance on dismissal so the next window opens on a different pitch.
    const next = (variant + 1) % VARIANTS.length;
    AsyncStorage.multiSet([
      [DISMISS_KEY, String(Date.now())],
      [VARIANT_KEY, String(next)],
    ]).catch(() => {});
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.card,
        { backgroundColor: colors.card, borderColor: ACCENT, opacity: pressed ? 0.85 : 1 },
      ]}>
      <View style={s.iconWrap}>
        <FontAwesome name={copy.icon as any} size={16} color={ACCENT} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={[s.title, { color: colors.text }]}>{copy.title}</Text>
        <Text style={[s.sub, { color: colors.subtext }]} numberOfLines={2}>
          {copy.sub}
        </Text>
      </View>

      <Pressable
        onPress={dismiss}
        hitSlop={12}
        style={({ pressed }) => [s.close, { opacity: pressed ? 0.5 : 1 }]}>
        <FontAwesome name="times" size={13} color={colors.subtext} />
      </Pressable>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginTop: 14, marginBottom: 2,
    padding: 14, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(212,160,23,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 14.5, fontWeight: '700', letterSpacing: -0.2 },
  sub:   { fontSize: 12, lineHeight: 17, marginTop: 3 },
  close: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
});
