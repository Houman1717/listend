import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Ionicons from '@expo/vector-icons/Ionicons';
import { usePro } from '@/context/ProContext';
import { useRevenueCat } from '@/context/RevenueCatContext';
import { useColorScheme } from '@/context/ThemeContext';
import { PRO_THEMES } from '@/lib/proThemes';
import { useState } from 'react';
import type { PurchasesPackage } from 'react-native-purchases';

// ─── Colour palettes ──────────────────────────────────────────────────────────

const DARK = {
  bg:            '#0F0A07',
  surface:       '#1A1200',
  surface2:      '#2A1E00',
  surfaceActive: '#221800',
  border:        '#3A2818',
  accent:        '#D4A017',
  accentLight:   '#E8B830',
  accentDark:    '#B8880F',
  text:          '#F5ECD8',
  textMuted:     '#A08060',
  textDim:       '#6B4C35',
  textDimmer:    '#4A3020',
  onAccent:      '#0F0A07',
  bulletText:    '#C0A070',
};

const LIGHT = {
  bg:            '#F2EBE0',
  surface:       '#E8DDD0',
  surface2:      '#DDD0C0',
  surfaceActive: '#E2D4C0',
  border:        '#C8B090',
  accent:        '#D4A017',
  accentLight:   '#E8B830',
  accentDark:    '#B8880F',
  text:          '#1A0E00',
  textMuted:     '#6B4C2A',
  textDim:       '#9B7040',
  textDimmer:    '#B89060',
  onAccent:      '#1A0E00',
  bulletText:    '#5C3D1E',
};

// ─── Static data ──────────────────────────────────────────────────────────────

const PREVIEW_THEME_KEYS = ['ocean', 'rose', 'violet', 'midnight'];
const PREVIEW_THEMES = PRO_THEMES.filter(t => PREVIEW_THEME_KEYS.includes(t.key));

const STAT_CARDS = [
  { value: '247', label: 'Albums Logged' },
  { value: '8.2', label: 'Avg Rating' },
  { value: '94',  label: 'Artists' },
];

const FEATURES = [
  { icon: 'list',             label: 'Unlimited Playlists',   sub: 'Create as many playlists as you like — free accounts are limited to 3' },
  { icon: 'random',           label: 'Flip Every Hour',       sub: 'Flip a Record every hour — free accounts are limited to once every 12 hours' },
  { icon: 'paint-brush',      label: 'Custom Profile Themes', sub: 'Give your profile a unique look that visitors can see' },
  { icon: 'checkmark-circle', label: 'Pro Verified Tick',     sub: 'Gold verified badge next to your name on every review', isIonicon: true },
  { icon: 'bolt',             label: 'More Coming Soon',      sub: 'Priority access to every future Pro perk' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function ProPaywallModal() {
  const { paywallVisible, hidePaywall } = usePro();
  const { offerings, purchasePackage, restorePurchases, isLoading } = useRevenueCat();
  const scheme = useColorScheme();
  const c = scheme === 'light' ? LIGHT : DARK;

  const [purchasing, setPurchasing] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState<PurchasesPackage | null>(null);

  const packages   = offerings?.current?.availablePackages ?? [];
  const activePkg  = selectedPkg ?? packages[0] ?? null;

  async function handlePurchase() {
    if (!activePkg) return;
    setPurchasing(true);
    const success = await purchasePackage(activePkg);
    setPurchasing(false);
    if (success) hidePaywall();
  }

  async function handleRestore() {
    setPurchasing(true);
    const success = await restorePurchases();
    setPurchasing(false);
    if (success) {
      hidePaywall();
    } else {
      Alert.alert('No purchases found', 'We could not find any previous Pro purchases to restore.');
    }
  }

  return (
    <Modal
      visible={paywallVisible}
      animationType="slide"
      onRequestClose={hidePaywall}>

      <SafeAreaView style={[s.screen, { backgroundColor: c.bg }]}>
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

            {/* ── Close button ── */}
            <View style={s.closeRow}>
              <Pressable
                onPress={hidePaywall}
                style={[s.closeBtn, { backgroundColor: c.surface }]}
                hitSlop={8}>
                <Ionicons name="close" size={18} color={c.textMuted} />
              </Pressable>
            </View>

            {/* ── Hero ── */}
            <View style={s.hero}>
              <View style={[s.iconCircle, { backgroundColor: c.surface2, borderColor: c.accent }]}>
                <FontAwesome name="star" size={28} color={c.accent} />
              </View>
              <Text style={[s.heroTitle, { color: c.text }]}>Listend Pro</Text>
              <Text style={[s.heroSub, { color: c.textMuted }]}>
                Unlock insights. Stand out. Own your listening.
              </Text>
            </View>

            {/* ── My Stats card ── */}
            <View style={[s.statsFeatureCard, { backgroundColor: c.surface, borderColor: c.border }]}>
              <View style={s.statsFeatureHeader}>
                <View style={[s.statsFeatureBadge, { backgroundColor: c.accent }]}>
                  <FontAwesome name="star" size={9} color={c.onAccent} />
                  <Text style={[s.statsFeatureBadgeText, { color: c.onAccent }]}>PRO FEATURE</Text>
                </View>
                <Text style={[s.statsFeatureTitle, { color: c.text }]}>My Stats</Text>
                <Text style={[s.statsFeatureSub, { color: c.textMuted }]}>
                  Your full listening history, broken down. See every genre you've explored, every decade
                  you've obsessed over, how your taste stacks up against the community, and the real
                  story behind your listening — all in one beautifully designed dashboard.
                </Text>
              </View>

              {/* Mini stats strip */}
              <View style={[s.miniStatsRow, { borderColor: c.border }]}>
                {STAT_CARDS.map(card => (
                  <View key={card.label} style={s.miniStatCard}>
                    <Text style={[s.miniStatValue, { color: c.accent }]}>{card.value}</Text>
                    <Text style={[s.miniStatLabel, { color: c.textDim }]}>{card.label}</Text>
                  </View>
                ))}
              </View>

              {/* Bullet list */}
              <View style={s.statsBullets}>
                {[
                  'Genre breakdown — see your top genres at a glance',
                  'Decade distribution — are you a 70s or 90s listener?',
                  'Community comparison — how you rate vs. everyone else',
                  'Re-listen streaks — your most revisited albums',
                  'Top artists, formats, and yearly listening pace',
                ].map(bullet => (
                  <View key={bullet} style={s.bulletRow}>
                    <Ionicons name="checkmark-circle" size={14} color={c.accent} style={{ marginTop: 1 }} />
                    <Text style={[s.bulletText, { color: c.bulletText }]}>{bullet}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* ── Also Included ── */}
            <Text style={[s.sectionLabel, { color: c.textDim }]}>ALSO INCLUDED</Text>
            <View style={s.featureList}>
              {FEATURES.map(f => (
                <View key={f.icon} style={s.featureRow}>
                  <View style={[s.featureIcon, { backgroundColor: c.surface2, borderColor: c.border }]}>
                    {f.isIonicon
                      ? <Ionicons name={f.icon as any} size={18} color={c.accent} />
                      : <FontAwesome name={f.icon as any} size={18} color={c.accent} />
                    }
                  </View>
                  <View style={s.featureText}>
                    <Text style={[s.featureLabel, { color: c.text }]}>{f.label}</Text>
                    <Text style={[s.featureSub, { color: c.textMuted }]}>{f.sub}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* ── Theme swatches ── */}
            <Text style={[s.swatchLabel, { color: c.textDim }]}>PROFILE THEMES</Text>
            <View style={s.swatchRow}>
              {PREVIEW_THEMES.map(theme => (
                <View key={theme.key} style={s.swatchWrap}>
                  <View style={[s.swatchOuter, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <View style={[s.swatchInner, { backgroundColor: theme.accent }]} />
                  </View>
                  <Text style={[s.swatchName, { color: c.textDim }]}>
                    {theme.name.split(' ').slice(-1)[0]}
                  </Text>
                </View>
              ))}
              <View style={s.swatchWrap}>
                <View style={[s.swatchOuter, { backgroundColor: c.surface, borderColor: c.border }]}>
                  <Text style={[s.swatchMore, { color: c.accent }]}>+5</Text>
                </View>
                <Text style={[s.swatchName, { color: c.textDim }]}>More</Text>
              </View>
            </View>

            {/* ── Package selector / Coming Soon ── */}
            {isLoading ? (
              <ActivityIndicator color={c.accent} style={{ marginTop: 32 }} />
            ) : packages.length > 0 ? (
              <>
                <Text style={[s.sectionLabel, { color: c.textDim }]}>CHOOSE A PLAN</Text>
                <View style={s.packageList}>
                  {packages.map(pkg => {
                    const isActive = activePkg?.identifier === pkg.identifier;
                    return (
                      <Pressable
                        key={pkg.identifier}
                        onPress={() => setSelectedPkg(pkg)}
                        style={[
                          s.packageRow,
                          {
                            backgroundColor: isActive ? c.surfaceActive : c.surface,
                            borderColor: isActive ? c.accent : c.border,
                          },
                        ]}>
                        <View style={s.packageInfo}>
                          <Text style={[s.packageTitle, { color: isActive ? c.text : c.textMuted }]}>
                            {pkg.packageType === 'ANNUAL'  ? 'Annual'  :
                             pkg.packageType === 'MONTHLY' ? 'Monthly' :
                             pkg.product.title}
                          </Text>
                          {pkg.packageType === 'ANNUAL' && (
                            <View style={[s.saveBadge, { backgroundColor: c.accent }]}>
                              <Text style={[s.saveBadgeText, { color: c.onAccent }]}>BEST VALUE</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[s.packagePrice, { color: isActive ? c.accent : c.textMuted }]}>
                          {pkg.product.priceString}
                          <Text style={s.packagePeriod}>
                            {pkg.packageType === 'ANNUAL'  ? '/yr' :
                             pkg.packageType === 'MONTHLY' ? '/mo' : ''}
                          </Text>
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Pressable
                  style={({ pressed }) => [s.ctaBtn, { opacity: pressed || purchasing ? 0.8 : 1 }]}
                  onPress={handlePurchase}
                  disabled={purchasing}>
                  <LinearGradient
                    colors={[c.accentLight, c.accent, c.accentDark]}
                    style={s.ctaGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}>
                    {purchasing
                      ? <ActivityIndicator color={c.onAccent} />
                      : <Text style={[s.ctaText, { color: c.onAccent }]}>
                          Subscribe — {activePkg?.product.priceString}
                        </Text>
                    }
                  </LinearGradient>
                </Pressable>

                <Pressable onPress={handleRestore} style={s.dismissBtn} disabled={purchasing}>
                  <Text style={[s.dismissText, { color: c.textDim }]}>Restore Purchases</Text>
                </Pressable>
              </>
            ) : (
              <View style={[s.priceBlock, { backgroundColor: c.surface, borderColor: c.border }]}>
                <Text style={[s.priceLabel,  { color: c.textMuted }]}>Listend Pro</Text>
                <Text style={[s.priceAmount, { color: c.accent }]}>Coming Soon</Text>
                <Text style={[s.priceSub,    { color: c.textDim }]}>
                  Subscription pricing will be announced shortly
                </Text>
              </View>
            )}

            {/* ── Legal links (required by App Store guideline 3.1.2) ── */}
            <View style={s.legalRow}>
              <Pressable onPress={() => Linking.openURL('https://houman1717.github.io/listend-policys/privacy.html')}>
                <Text style={[s.legalLink, { color: c.textDim }]}>Privacy Policy</Text>
              </Pressable>
              <Text style={[s.legalSep, { color: c.textDimmer }]}>·</Text>
              <Pressable onPress={() => Linking.openURL('https://houman1717.github.io/listend-policys/terms.html')}>
                <Text style={[s.legalLink, { color: c.textDim }]}>Terms of Use</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={hidePaywall}
              style={[s.dismissBtn, { paddingTop: packages.length > 0 ? 0 : 16 }]}>
              <Text style={[s.dismissText, { color: c.textDimmer }]}>Maybe Later</Text>
            </Pressable>

          </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Layout-only styles (no colours) ─────────────────────────────────────────

const s = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: { paddingBottom: 40 },

  closeRow: {
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  hero: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 24,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1.5,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  heroSub: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  statsFeatureCard: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 18,
    borderWidth: 1,
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
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 10,
  },
  statsFeatureBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  statsFeatureTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  statsFeatureSub: {
    fontSize: 13,
    lineHeight: 19,
  },

  miniStatsRow: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  miniStatCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    gap: 3,
  },
  miniStatValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  miniStatLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

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
    fontSize: 13,
    lineHeight: 18,
  },

  sectionLabel: {
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
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  featureText: { flex: 1 },
  featureLabel: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  featureSub:   { fontSize: 13, lineHeight: 18 },

  swatchLabel: {
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
    fontSize: 11,
    fontWeight: '800',
  },
  swatchName: { fontSize: 9, fontWeight: '600' },

  packageList: {
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 4,
  },
  packageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  packageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  packageTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  packagePrice: {
    fontSize: 16,
    fontWeight: '700',
  },
  packagePeriod: {
    fontSize: 12,
    fontWeight: '400',
  },
  saveBadge: {
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  saveBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  priceBlock: {
    marginTop: 24,
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
  },
  priceLabel:  { fontSize: 13, marginBottom: 6 },
  priceAmount: { fontSize: 28, fontWeight: '800', letterSpacing: 0.3 },
  priceSub:    { fontSize: 12, marginTop: 6, textAlign: 'center' },

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
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  dismissBtn: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  dismissText: { fontSize: 14 },

  legalRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    paddingBottom: 4,
  },
  legalLink: { fontSize: 12, textDecorationLine: 'underline' },
  legalSep:  { fontSize: 12 },
});
