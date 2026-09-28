import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Linking,
  Platform,
} from 'react-native';
import { useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import Purchases from 'react-native-purchases';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Ionicons from '@expo/vector-icons/Ionicons';
import { PRO_FEATURES } from '@/components/ProPaywallModal';

export default function ProSettingsScreen() {
  const navigation = useNavigation();
  // Store page for cancelling / switching plan. Null for Pro granted by hand
  // in Supabase — there's no store subscription to manage.
  const [managementURL, setManagementURL] = useState<string | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: 'Listend Pro', headerStyle: { backgroundColor: '#1c1410' }, headerTintColor: '#f5e6c8' });
  }, [navigation]);

  useEffect(() => {
    Purchases.getCustomerInfo()
      .then(info => setManagementURL(info.managementURL))
      .catch(e => console.warn('[ProSettings] getCustomerInfo error:', e));
  }, []);

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

      {/* Badge info */}
      <View style={s.infoCard}>
        <View style={s.infoIconWrap}>
          <FontAwesome name="star" size={20} color="#D4A017" />
        </View>
        <View style={s.infoText}>
          <Text style={s.infoTitle}>Pro Badge Active</Text>
          <Text style={s.infoSub}>Your gold PRO badge is visible on your profile and reviews.</Text>
        </View>
      </View>

      {/* What's included */}
      <Text style={s.sectionLabel}>WHAT'S INCLUDED</Text>
      <View style={s.featureList}>
        <View style={s.featureRow}>
          <FontAwesome name="bar-chart" size={16} color="#D4A017" style={s.featureIcon} />
          <Text style={s.featureLabel}>My Stats</Text>
        </View>
        {PRO_FEATURES.map(f => (
          <View key={f.icon} style={s.featureRow}>
            {f.isIonicon
              ? <Ionicons name={f.icon as any} size={17} color="#D4A017" style={s.featureIcon} />
              : <FontAwesome name={f.icon as any} size={16} color="#D4A017" style={s.featureIcon} />
            }
            <Text style={s.featureLabel}>{f.label}</Text>
          </View>
        ))}
      </View>

      {managementURL && (
        <>
          <Pressable
            style={({ pressed }) => [s.manageBtn, { opacity: pressed ? 0.7 : 1 }]}
            onPress={() => Linking.openURL(managementURL)}>
            <Text style={s.manageBtnText}>Manage Subscription</Text>
          </Pressable>
          <Text style={s.footer}>
            Change or cancel your plan in your {Platform.OS === 'android' ? 'Google Play' : 'App Store'} account.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0A07' },
  content:   { padding: 20, paddingBottom: 40 },

  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1200',
    borderRadius: 14,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: '#3A2818',
    marginBottom: 28,
  },
  infoIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2A1E00',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#D4A017',
  },
  infoText:  { flex: 1 },
  infoTitle: { color: '#F5ECD8', fontSize: 15, fontWeight: '700', marginBottom: 3 },
  infoSub:   { color: '#A08060', fontSize: 13, lineHeight: 18 },

  sectionLabel: {
    color: '#6B4C35',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 12,
  },

  featureList: {
    backgroundColor: '#1A1200',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#3A2818',
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
  featureLabel: { color: '#F5ECD8', fontSize: 15, fontWeight: '600' },

  manageBtn: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#D4A017',
    paddingVertical: 14,
    alignItems: 'center',
  },
  manageBtnText: { color: '#D4A017', fontSize: 15, fontWeight: '700' },

  footer: {
    color: '#6B4C35',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 18,
  },
});
