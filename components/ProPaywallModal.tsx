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
import { usePro } from '@/context/ProContext';
import { PRO_THEMES } from '@/lib/proThemes';

const FEATURES = [
  { icon: 'paint-brush', label: 'Custom Profile Themes',  sub: 'Unique background & colors visitors can see' },
  { icon: 'star',        label: 'Pro Badge',              sub: 'Gold PRO badge on your profile & reviews'   },
  { icon: 'bolt',        label: 'More Coming Soon',       sub: 'Priority access to every future Pro perk'   },
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
              <Text style={s.heroSub}>Elevate your profile. Stand out to every listener.</Text>
            </LinearGradient>

            {/* Feature list */}
            <View style={s.featureList}>
              {FEATURES.map(f => (
                <View key={f.icon} style={s.featureRow}>
                  <View style={s.featureIcon}>
                    <FontAwesome name={f.icon as any} size={18} color="#D4A017" />
                  </View>
                  <View style={s.featureText}>
                    <Text style={s.featureLabel}>{f.label}</Text>
                    <Text style={s.featureSub}>{f.sub}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Theme swatches preview */}
            <Text style={s.swatchLabel}>PROFILE THEMES</Text>
            <View style={s.swatchRow}>
              {PRO_THEMES.map(theme => (
                <View key={theme.key} style={s.swatchWrap}>
                  <View style={[s.swatchOuter, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <View style={[s.swatchInner, { backgroundColor: theme.accent }]} />
                  </View>
                  <Text style={s.swatchName}>{theme.name.split(' ')[0]}</Text>
                </View>
              ))}
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
    maxHeight: '92%',
    borderTopWidth: 1,
    borderTopColor: '#2E2018',
  },
  scroll: { paddingBottom: 24 },
  hero: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 28,
    paddingHorizontal: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#2A1E00',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#D4A017',
  },
  heroTitle: {
    color: '#F5ECD8',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  heroSub: {
    color: '#A08060',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  featureList: {
    paddingHorizontal: 24,
    paddingTop: 20,
    gap: 18,
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
    paddingHorizontal: 20,
    gap: 8,
  },
  swatchWrap: { alignItems: 'center', gap: 4, flex: 1 },
  swatchOuter: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchInner: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  swatchName: { color: '#6B4C35', fontSize: 9, fontWeight: '600' },
  priceBlock: {
    marginTop: 24,
    marginHorizontal: 24,
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
  ctaBtn: {
    marginTop: 20,
    marginHorizontal: 24,
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
