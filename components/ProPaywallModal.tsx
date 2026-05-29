import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Ionicons from '@expo/vector-icons/Ionicons';
import { usePro } from '@/context/ProContext';
import { PRO_THEMES } from '@/lib/proThemes';

// 4 representative themes to preview (exclude 'default' — that's the base colour)
const PREVIEW_THEME_KEYS = ['ocean', 'rose', 'violet', 'midnight'];
const PREVIEW_THEMES = PRO_THEMES.filter(t => PREVIEW_THEME_KEYS.includes(t.key));

// My Stats showcase: the mini stats cards shown inside the paywall
const STAT_CARDS = [
  { value: '247', label: 'Albums Logged' },
  { value: '8.2', label: 'Avg Rating' },
  { value: '94',  label: 'Artists' },
];

const FEATURES = [
  { icon: 'list',         label: 'Unlimited Playlists',   sub: 'Create as many playlists as you like — free accounts are limited to 3' },
  { icon: 'random',       label: 'Flip Every Hour',       sub: 'Flip a Record every hour — free accounts are limited to once every 12 hours' },
  { icon: 'paint-brush',  label: 'Custom Profile Themes', sub: 'Give your profile a unique look that visitors can see' },
  { icon: 'checkmark-circle', label: 'Pro Verified Tick', sub: 'Gold verified badge next to your name on every review', isIonicon: true },
  { icon: 'bolt',         label: 'More Coming Soon',      sub: 'Priority access to every future Pro perk'             },
];

export function ProPaywallModal() {
  const { paywallVisible, hidePaywall } = usePro();

  return (
    <Modal
      visible={paywallVisible}
      transparent
      animationType="slide"
      onRequestClose={hidePaywall}>
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={hidePaywall} />
        <SafeAreaView style={s.sheet}>
          <ScrollView
            contentContainerStyle={s.scroll}
            showsVerticalScrollIndicator={false}>

            {/* Header gradient */}
            <LinearGradient
              colors={['#1A1200', '#2A1E00', '#0F0A07']}
              style={s.hero}>
              <View style={s.iconCircle}>
                <FontAwesome name="star" size={28} color="#D4A017" />
              </View>
              <Text style={s.heroTitle}>Listend Pro</Text>
              <Text style={s.heroSub}>Unlock insights. Stand out. Own your listening.</Text>
            </LinearGradient>

            {/* ── MY STATS — the main feature ── */}
            <View style={s.statsFeatureCard}>
              <View style={s.statsFeatureHeader}>
                <View style={s.statsFeatureBadge}>
                  <FontAwesome name="star" size={9} color="#0F0A07" />
                  <Text style={s.statsFeatureBadgeText}>PRO FEATURE</Text>
                </View>
                <Text style={s.statsFeatureTitle}>My Stats</Text>
                <Text style={s.statsFeatureSub}>
                  Your full listening history, broken down. See every genre you've explored, every decade
                  you've obsessed over, how your taste stacks up against the community, and the real
                  story behind your listening — all in one beautifully designed dashboard.
                </Text>
              </View>

              {/* Mini stats preview */}
              <View style={s.miniStatsRow}>
                {STAT_CARDS.map(card => (
                  <View key={card.label} style={s.miniStatCard}>
                    <Text style={s.miniStatValue}>{card.value}</Text>
                    <Text style={s.miniStatLabel}>{card.label}</Text>
                  </View>
                ))}
              </View>

              {/* Feature bullets */}
              <View style={s.statsBullets}>
                {[
                  'Genre breakdown — see your top genres at a glance',
                  'Decade distribution — are you a 70s or 90s listener?',
                  'Community comparison — how you rate vs. everyone else',
                  'Re-listen streaks — your most revisited albums',
                  'Top artists, formats, and yearly listening pace',
                ].map(bullet => (
                  <View key={bullet} style={s.bulletRow}>
                    <Ionicons name="checkmark-circle" size={14} color="#D4A017" style={{ marginTop: 1 }} />
                    <Text style={s.bulletText}>{bullet}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Other features */}
            <Text style={s.sectionLabel}>ALSO INCLUDED</Text>
            <View style={s.featureList}>
              {FEATURES.map(f => (
                <View key={f.icon} style={s.featureRow}>
                  <View style={s.featureIcon}>
                    {f.isIonicon
                      ? <Ionicons name={f.icon as any} size={18} color="#D4A017" />
                      : <FontAwesome name={f.icon as any} size={18} color="#D4A017" />
                    }
                  </View>
                  <View style={s.featureText}>
                    <Text style={s.featureLabel}>{f.label}</Text>
                    <Text style={s.featureSub}>{f.sub}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Theme swatches preview — just 4 */}
            <Text style={s.swatchLabel}>PROFILE THEMES</Text>
            <View style={s.swatchRow}>
              {PREVIEW_THEMES.map(theme => (
                <View key={theme.key} style={s.swatchWrap}>
                  <View style={[s.swatchOuter, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <View style={[s.swatchInner, { backgroundColor: theme.accent }]} />
                  </View>
                  <Text style={s.swatchName}>{theme.name.split(' ').slice(-1)[0]}</Text>
                </View>
              ))}
              {/* +more indicator */}
              <View style={s.swatchWrap}>
                <View style={[s.swatchOuter, { backgroundColor: '#1A1200', borderColor: '#3A2818' }]}>
                  <Text style={s.swatchMore}>+5</Text>
                </View>
                <Text style={s.swatchName}>More</Text>
              </View>
            </View>

            {/* Price block */}
            <View style={s.priceBlock}>
              <Text style={s.priceLabel}>Listend Pro</Text>
              <Text style={s.priceAmount}>Coming Soon</Text>
              <Text style={s.priceSub}>Subscription pricing will be announced shortly</Text>
            </View>

            {/* CTA */}
            <Pressable
              style={({ pressed }) => [s.ctaBtn, { opacity: pressed ? 0.8 : 1 }]}
              onPress={hidePaywall}>
              <LinearGradient
                colors={['#E8B830', '#D4A017', '#B8880F']}
                style={s.ctaGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}>
                <Text style={s.ctaText}>Notify Me When Available</Text>
              </LinearGradient>
            </Pressable>

            <Pressable onPress={hidePaywall} style={s.dismissBtn}>
              <Text style={s.dismissText}>Maybe Later</Text>
            </Pressable>

          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  sheet: {
    backgroundColor: '#0F0A07',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '94%',
    borderTopWidth: 1,
    borderTopColor: '#2E2018',
  },
  scroll: { paddingBottom: 28 },

  // ── Hero ──────────────────────────────────────────────────────────────────────
  hero: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2A1E00',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#D4A017',
  },
  heroTitle: {
    color: '#F5ECD8',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  heroSub: {
    color: '#A08060',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  // ── My Stats feature card ─────────────────────────────────────────────────────
  statsFeatureCard: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: '#1A1200',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#3A2818',
    overflow: 'hidden',
  },
  statsFeatureHeader: {
    padding: 20,
    paddingBottom: 16,
  },
  statsFeatureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D4A017',
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 10,
  },
  statsFeatureBadgeText: {
    color: '#0F0A07',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  statsFeatureTitle: {
    color: '#F5ECD8',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  statsFeatureSub: {
    color: '#A08060',
    fontSize: 13,
    lineHeight: 19,
  },

  // Mini stats strip
  miniStatsRow: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#3A2818',
  },
  miniStatCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    gap: 3,
  },
  miniStatValue: {
    color: '#D4A017',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  miniStatLabel: {
    color: '#6B4C35',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Bullet list
  statsBullets: {
    padding: 16,
    paddingTop: 14,
    gap: 9,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletText: {
    flex: 1,
    color: '#C0A070',
    fontSize: 13,
    lineHeight: 18,
  },

  // ── Also Included ─────────────────────────────────────────────────────────────
  sectionLabel: {
    color: '#6B4C35',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 12,
    paddingHorizontal: 24,
  },
  featureList: {
    paddingHorizontal: 20,
    gap: 14,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#2A1E00',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3A2818',
  },
  featureText: { flex: 1 },
  featureLabel: { color: '#F5ECD8', fontSize: 15, fontWeight: '700', marginBottom: 2 },
  featureSub:   { color: '#A08060', fontSize: 13, lineHeight: 18 },

  // ── Theme swatches ────────────────────────────────────────────────────────────
  swatchLabel: {
    color: '#6B4C35',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 10,
    paddingHorizontal: 24,
  },
  swatchRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 12,
  },
  swatchWrap: { alignItems: 'center', gap: 5 },
  swatchOuter: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchInner: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  swatchMore: {
    color: '#D4A017',
    fontSize: 11,
    fontWeight: '800',
  },
  swatchName: { color: '#6B4C35', fontSize: 9, fontWeight: '600' },

  // ── Price block ───────────────────────────────────────────────────────────────
  priceBlock: {
    marginTop: 24,
    marginHorizontal: 20,
    padding: 20,
    backgroundColor: '#1A1200',
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3A2818',
  },
  priceLabel:  { color: '#A08060', fontSize: 13, marginBottom: 6 },
  priceAmount: { color: '#D4A017', fontSize: 28, fontWeight: '800', letterSpacing: 0.3 },
  priceSub:    { color: '#6B4C35', fontSize: 12, marginTop: 6, textAlign: 'center' },

  // ── CTA ───────────────────────────────────────────────────────────────────────
  ctaBtn: {
    marginTop: 20,
    marginHorizontal: 20,
    borderRadius: 14,
    overflow: 'hidden',
  },
  ctaGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaText: {
    color: '#0F0A07',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  dismissBtn: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  dismissText: { color: '#6B4C35', fontSize: 14 },
});
