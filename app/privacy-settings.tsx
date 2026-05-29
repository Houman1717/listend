import {
  StyleSheet,
  View,
  Text,
  Switch,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter, Stack } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { usePro } from '@/context/ProContext';
import { getProTheme, themeToColors } from '@/lib/proThemes';

const ACCENT  = '#D4A017';

export default function PrivacySettingsScreen() {
  const colorScheme = useColorScheme();
  const colors      = Colors[colorScheme ?? 'light'];
  const isDark      = colorScheme === 'dark';
  const router      = useRouter();
  const { user }    = useAuth();
  const { isPro, proTheme } = usePro();
  const proColors = (isPro && proTheme !== 'default') ? themeToColors(getProTheme(proTheme)) : null;

  const [isPrivate,  setIsPrivate]  = useState(false);
  const [allowDms,   setAllowDms]   = useState(true);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState<'private' | 'dms' | null>(null);

  const sepColor  = proColors ? proColors.border     : isDark ? '#2a1e14' : '#e8e8e8';
  const rowBg     = proColors ? proColors.surface    : isDark ? '#1c1410' : '#fff';
  const sectionBg = proColors ? proColors.background : isDark ? '#0F0A07' : '#f5f5f5';
  const textColor = proColors ? proColors.text       : colors.text;
  const subColor  = proColors ? proColors.subtext    : colors.subtext;
  const accent    = proColors ? proColors.tint       : ACCENT;

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('profiles')
      .select('is_private, allow_dms')
      .eq('id', user.id)
      .single()
      .then(({ data, error }) => {
        if (error) console.error('[PrivacySettings] load error:', error);
        if (data) {
          setIsPrivate(data.is_private ?? false);
          setAllowDms(data.allow_dms ?? true);
        }
        setLoading(false);
      });
  }, [user?.id]);

  async function togglePrivate(value: boolean) {
    if (!user?.id || saving) return;
    setIsPrivate(value);
    setSaving('private');
    const { error } = await supabase
      .from('profiles')
      .update({ is_private: value })
      .eq('id', user.id);
    if (error) {
      console.error('[PrivacySettings] update is_private error:', error);
      setIsPrivate(!value);
      Alert.alert('Error', 'Could not save setting. Please try again.');
    }
    setSaving(null);
  }

  async function toggleAllowDms(value: boolean) {
    if (!user?.id || saving) return;
    setAllowDms(value);
    setSaving('dms');
    const { error } = await supabase
      .from('profiles')
      .update({ allow_dms: value })
      .eq('id', user.id);
    if (error) {
      console.error('[PrivacySettings] update allow_dms error:', error);
      setAllowDms(!value);
      Alert.alert('Error', 'Could not save setting. Please try again.');
    }
    setSaving(null);
  }

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: sectionBg }]}>
        <ActivityIndicator color={accent} />
      </View>
    );
  }

  return (
    <>
    <Stack.Screen options={{
      headerStyle: { backgroundColor: sectionBg },
      headerTintColor: textColor,
      headerShadowVisible: false,
    }} />
    <ScrollView style={[s.container, { backgroundColor: sectionBg }]} contentContainerStyle={s.content}>

      {/* Account Privacy */}
      <Text style={[s.sectionLabel, { color: subColor }]}>ACCOUNT</Text>
      <View style={[s.card, { backgroundColor: rowBg, borderColor: sepColor }]}>

        <View style={s.row}>
          <View style={s.rowLeft}>
            <FontAwesome name="lock" size={16} color={accent} style={s.icon} />
            <View style={s.rowText}>
              <Text style={[s.rowTitle, { color: textColor }]}>Private Account</Text>
              <Text style={[s.rowSub, { color: subColor }]}>
                Only approved followers can see your library, reviews, and playlists.
              </Text>
            </View>
          </View>
          <Switch
            value={isPrivate}
            onValueChange={togglePrivate}
            disabled={saving === 'private'}
            trackColor={{ false: isDark ? '#3a2818' : '#d0d0d0', true: accent }}
            thumbColor="#fff"
          />
        </View>

        <View style={[s.sep, { backgroundColor: sepColor }]} />

        <View style={s.row}>
          <View style={s.rowLeft}>
            <FontAwesome name="comment-o" size={16} color={accent} style={s.icon} />
            <View style={s.rowText}>
              <Text style={[s.rowTitle, { color: textColor }]}>Allow Direct Messages</Text>
              <Text style={[s.rowSub, { color: subColor }]}>
                When off, no one can send you a DM.
              </Text>
            </View>
          </View>
          <Switch
            value={allowDms}
            onValueChange={toggleAllowDms}
            disabled={saving === 'dms'}
            trackColor={{ false: isDark ? '#3a2818' : '#d0d0d0', true: accent }}
            thumbColor="#fff"
          />
        </View>

      </View>

      {/* Blocked Users */}
      <Text style={[s.sectionLabel, { color: subColor }]}>BLOCKING</Text>
      <View style={[s.card, { backgroundColor: rowBg, borderColor: sepColor }]}>
        <Pressable
          style={({ pressed }) => [s.row, s.rowTappable, { opacity: pressed ? 0.6 : 1 }]}
          onPress={() => router.push('/blocked-users')}>
          <View style={s.rowLeft}>
            <FontAwesome name="ban" size={16} color={accent} style={s.icon} />
            <Text style={[s.rowTitle, { color: textColor }]}>Blocked Users</Text>
          </View>
          <FontAwesome name="chevron-right" size={13} color={subColor} />
        </Pressable>
      </View>

    </ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content:   { paddingTop: 20, paddingHorizontal: 16, paddingBottom: 40 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 1.2, marginBottom: 8, marginLeft: 4,
  },

  card: {
    borderRadius: 14, borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden', marginBottom: 28,
  },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    gap: 12,
  },
  rowTappable: { justifyContent: 'space-between' },
  rowLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 20, textAlign: 'center' },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '500' },
  rowSub:   { fontSize: 12, marginTop: 2, lineHeight: 17 },

  sep: { height: StyleSheet.hairlineWidth, marginLeft: 48 },
});
