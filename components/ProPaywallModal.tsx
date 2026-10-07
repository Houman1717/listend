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

export const PRO_FEATURES = [
  { icon: 'list',             label: 'Unlimited Playlists',   sub: 'Create as many playlists as you like — free accounts are limited to 3' },
  { icon: 'random',           label: 'Flip Every Hour',       sub: 'Flip a Record every hour — free accounts are limited to once every 12 hours' },
  { icon: 'paint-brush',      label: 'Custom Profile Themes', sub: 'Give your profile a unique look that visitors can see' },
  { icon: 'checkmark-circle', label: 'Pro Verified Tick',     sub: 'Gold verified badge next to your name on every review', isIonicon: true },
];

// "Save 40%" for the annual plan against 12 months of the monthly one.
function annualSavingPercent(packages: PurchasesPackage[]): number | null {
  const annual  = packages.find(p => p.packageType === 'ANNUAL');
  const monthly = packages.find(p => p.packageType === 'MONTHLY');
  if (!annual || !monthly || monthly.product.price <= 0) return null;
  const pct = Math.round((1 - annual.product.price / (monthly.product.price * 12)) * 100);
  return pct > 0 ? pct : null;
}

function periodSuffix(pkg: PurchasesPackage): string {
  return pkg.packageType === 'ANNUAL' ? '/year' : pkg.packageType === 'MONTHLY' ? '/month' : '';
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProPaywallModal() {
  const { paywallVisible, hidePaywall, markProActive } = usePro();
  const { offerings, purchasePackage, restorePurchases, isLoading, offeringsError } = useRevenueCat();
  const scheme = useColorScheme();
  const c = scheme === 'light' ? LIGHT : DARK;

  const [purchasing, setPurchasing] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState<PurchasesPackage | null>(null);

  const packages   = offerings?.current?.availablePackages ?? [];
  const activePkg  = selectedPkg
    ?? packages.find(p => p.packageType === 'ANNUAL')
    ?? packages[0]
    ?? null;
  const savingPct  = annualSavingPercent(packages);

  async function handlePurchase() {
    if (!activePkg) return;
    setPurchasing(true);
    const success = await purchasePackage(activePkg);
    setPurchasing(false);
    if (success) {
      markProActive();
      hidePaywall();
    }
  }

  async function handleRestore() {
    setPurchasing(true);
    const success = await restorePurchases();
    setPurchasing(false);
    if (success) {
      markProActive();
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
          <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

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
                See your taste in numbers, and make your profile yours.
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
                  Your listening history, broken down.
                </Text>
              </View>

              <Text style={[s.exampleLabel, { color: c.textDim }]}>EXAMPLE</Text>

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
              {PRO_FEATURES.map(f => (
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

          </ScrollView>

          {/* ── Pinned footer: plans + CTA are always visible without scrolling ── */}
          <View style={[s.footer, { backgroundColor: c.bg, borderTopColor: c.border }]}>
            {isLoading ? (
              <ActivityIndicator color={c.accent} style={{ marginVertical: 24 }} />
            ) : packages.length > 0 ? (
              <>
                <View style={s.packageList}>
                  {packages.map(pkg => {
                    const isActive = activePkg?.identifier === pkg.identifier;
                    const isAnnual = pkg.packageType === 'ANNUAL';
                    return (
                      <Pressable
                        key={pkg.identifier}
                        onPress={() => setSelectedPkg(pkg)}
                        style={[
                          s.packageCard,
                          {
                            backgroundColor: isActive ? c.surfaceActive : c.surface,
                            borderColor: isActive ? c.accent : c.border,
                          },
                        ]}>
                        {isAnnual && savingPct !== null && (
                          <View style={[s.saveBadge, { backgroundColor: c.accent }]}>
                            <Text style={[s.saveBadgeText, { color: c.onAccent }]}>SAVE {savingPct}%</Text>
                          </View>
                        )}
                        <Text style={[s.packageTitle, { color: isActive ? c.text : c.textMuted }]}>
                          {isAnnual ? 'Yearly' : pkg.packageType === 'MONTHLY' ? 'Monthly' : pkg.product.title}
                        </Text>
                        <Text style={[s.packagePrice, { color: isActive ? c.accent : c.textMuted }]}>
                          {pkg.product.priceString}
                          <Text style={s.packagePeriod}>{periodSuffix(pkg)}</Text>
                        </Text>
                        {isAnnual && pkg.product.pricePerMonthString && (
                          <Text style={[s.packageSub, { color: c.textDim }]}>
                            {pkg.product.pricePerMonthString}/month
                          </Text>
                        )}
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
                          Start Pro — {activePkg?.product.priceString}{activePkg ? periodSuffix(activePkg) : ''}
                        </Text>
                    }
                  </LinearGradient>
                </Pressable>

                <Text style={[s.renewText, { color: c.textDim }]}>
                  Renews automatically. Cancel anytime in Settings.
                </Text>
              </>
            ) : (
              <View style={[s.priceBlock, { backgroundColor: c.surface, borderColor: c.border }]}>
                <Text style={[s.priceLabel,  { color: c.textMuted }]}>Listend Pro</Text>
                <Text style={[s.priceAmount, { color: c.accent }]}>Coming Soon</Text>
                <Text style={[s.priceSub,    { color: c.textDim }]}>
                  Subscription pricing will be announced shortly
                </Text>
                {/* Shown in production too. A misconfigured store is invisible
                    otherwise — every failure looked like a deliberate "Coming
                    Soon", including a whole platform that could never load
                    products. Users only ever see this line when something is
                    genuinely wrong, so a quiet diagnostic beats silence. */}
                {offeringsError ? (
                  <Text style={[s.priceSub, { color: c.textDim, marginTop: 8, fontSize: 11, opacity: 0.7 }]}>
                    {offeringsError}
                  </Text>
                ) : null}
              </View>
            )}

            {/* ── Restore + legal links (legal required by App Store guideline 3.1.2) ── */}
            <View style={s.legalRow}>
              {packages.length > 0 && (
                <>
                  <Pressable onPress={handleRestore} disabled={purchasing}>
                    <Text style={[s.legalLink, { color: c.textDim }]}>Restore</Text>
                  </Pressable>
                  <Text style={[s.legalSep, { color: c.textDimmer }]}>·</Text>
                </>
              )}
              <Pressable onPress={() => Linking.openURL('https://listend.uk/privacy')}>
                <Text style={[s.legalLink, { color: c.textDim }]}>Privacy</Text>
              </Pressable>
              <Text style={[s.legalSep, { color: c.textDimmer }]}>·</Text>
              <Pressable onPress={() => Linking.openURL('https://listend.uk/terms')}>
                <Text style={[s.legalLink, { color: c.textDim }]}>Terms</Text>
              </Pressable>
            </View>
          </View>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Layout-only styles (no colours) ─────────────────────────────────────────

const s = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: { paddingBottom: 24 },

  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 14,
  },

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
  exampleLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 6,
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
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
  },
  packageCard: {
    flex: 1,
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  packageTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  packageSub: {
    fontSize: 11,
    marginTop: 2,
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
    position: 'absolute',
    top: -9,
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

  renewText: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
  },

  ctaBtn: {
    marginTop: 12,
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
