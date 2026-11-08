import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Linking,
  Platform,
} from 'react-native';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import Purchases from 'react-native-purchases';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Ionicons from '@expo/vector-icons/Ionicons';
import { PRO_FEATURES } from '@/components/ProPaywallModal';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { usePro } from '@/context/ProContext';
import { getProTheme, themeToColors } from '@/lib/proThemes';

export default function ProSettingsScreen() {
  // Light/dark like the rest of the app, or the user's pro theme when one is set.
  const colorScheme = useColorScheme();
  const { isPro, proTheme } = usePro();
  const colors = (isPro && proTheme && proTheme !== 'default')
    ? themeToColors(getProTheme(proTheme))
    : Colors[colorScheme ?? 'light'];
  const accent = colors.tint;
  // Store page for cancelling / switching plan. Null for Pro granted by hand
  // in Supabase — there's no store subscription to manage.
  const [managementURL, setManagementURL] = useState<string | null>(null);

  useEffect(() => {
    Purchases.getCustomerInfo()
      .then(info => setManagementURL(info.managementURL))
      .catch(e => console.warn('[ProSettings] getCustomerInfo error:', e));
  }, []);

  return (
    <>
    <Stack.Screen options={{
      headerStyle: { backgroundColor: colors.background },
      headerTintColor: colors.text,
    }} />
    <ScrollView style={[s.container, { backgroundColor: colors.background }]} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

      {/* Badge info */}
      <View style={[s.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[s.infoIconWrap, { backgroundColor: colors.elevated, borderColor: accent }]}>
          <FontAwesome name="star" size={20} color={accent} />
        </View>
        <View style={s.infoText}>
          <Text style={[s.infoTitle, { color: colors.text }]}>Pro Badge Active</Text>
          <Text style={[s.infoSub, { color: colors.subtext }]}>Your gold PRO badge is visible on your profile and reviews.</Text>
        </View>
      </View>

      {/* What's included */}
      <Text style={[s.sectionLabel, { color: colors.subtext }]}>WHAT'S INCLUDED</Text>
      <View style={[s.featureList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={s.featureRow}>
          <FontAwesome name="bar-chart" size={16} color={accent} style={s.featureIcon} />
          <Text style={[s.featureLabel, { color: colors.text }]}>My Stats</Text>
        </View>
        {PRO_FEATURES.map(f => (
          <View key={f.icon} style={s.featureRow}>
            {f.isIonicon
              ? <Ionicons name={f.icon as any} size={17} color={accent} style={s.featureIcon} />
              : <FontAwesome name={f.icon as any} size={16} color={accent} style={s.featureIcon} />
            }
            <Text style={[s.featureLabel, { color: colors.text }]}>{f.label}</Text>
          </View>
        ))}
      </View>

      {managementURL && (
        <>
          <Pressable
            style={({ pressed }) => [s.manageBtn, { borderColor: accent, opacity: pressed ? 0.7 : 1 }]}
            onPress={() => Linking.openURL(managementURL)}>
            <Text style={[s.manageBtnText, { color: accent }]}>Manage Subscription</Text>
          </Pressable>
          <Text style={[s.footer, { color: colors.textMuted }]}>
            Change or cancel your plan in your {Platform.OS === 'android' ? 'Google Play' : 'App Store'} account.
          </Text>
        </>
      )}
    </ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content:   { padding: 20, paddingBottom: 40 },

  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    marginBottom: 28,
  },
  infoIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  infoText:  { flex: 1 },
  infoTitle: { fontSize: 15, fontWeight: '700', marginBottom: 3 },
  infoSub:   { fontSize: 13, lineHeight: 18 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 12,
  },

  featureList: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 6,
    marginBottom: 28,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    gap: 14,
  },
  featureIcon:  { width: 20, textAlign: 'center' },
  featureLabel: { fontSize: 15, fontWeight: '600' },

  manageBtn: {
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 14,
    alignItems: 'center',
  },
  manageBtnText: { fontSize: 15, fontWeight: '700' },

  footer: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 18,
  },
});
