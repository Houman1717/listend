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
import { useCallback, useState } from 'react';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { usePro } from '@/context/ProContext';
import { getProTheme, themeToColors } from '@/lib/proThemes';
import { nameOrHandle } from '@/lib/userHandle';
import { fetchFriendActivityEnabled, setFriendActivityBell, setFriendActivityEnabled } from '@/lib/friendActivity';

const ACCENT  = '#D4A017';

type BelledFriend = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export default function NotificationSettingsScreen() {
  const colorScheme = useColorScheme();
  const colors      = Colors[colorScheme ?? 'light'];
  const isDark      = colorScheme === 'dark';
  const router      = useRouter();
  const { user }    = useAuth();
  const { isPro, proTheme } = usePro();
  const proColors = (isPro && proTheme !== 'default') ? themeToColors(getProTheme(proTheme)) : null;

  const [enabled,  setEnabled]  = useState(false);
  const [friends,  setFriends]  = useState<BelledFriend[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const sepColor  = proColors ? proColors.border     : isDark ? '#2a1e14' : '#e8e8e8';
  const rowBg     = proColors ? proColors.surface    : isDark ? '#1c1410' : '#fff';
  const sectionBg = proColors ? proColors.background : isDark ? '#0F0A07' : '#f5f5f5';
  const textColor = proColors ? proColors.text       : colors.text;
  const subColor  = proColors ? proColors.subtext    : colors.subtext;
  const accent    = proColors ? proColors.tint       : ACCENT;

  // On focus, so bells rung on a profile and then coming back show up here.
  useFocusEffect(useCallback(() => {
    if (!user?.id) return;
    const uid = user.id;
    (async () => {
      const [on, { data: subs, error: subsErr }] = await Promise.all([
        fetchFriendActivityEnabled(uid),
        supabase
          .from('friend_activity_subscriptions')
          .select('target_id')
          .eq('subscriber_id', uid)
          .order('created_at', { ascending: false }),
      ]);
      if (on != null) setEnabled(on);
      if (subsErr) {
        console.error('[NotificationSettings] bells load error:', subsErr.message);
      } else {
        const ids = (subs ?? []).map((r: any) => r.target_id as string);
        if (ids.length === 0) {
          setFriends([]);
        } else {
          const { data: profiles, error } = await supabase
            .from('profiles')
            .select('id, display_name, username, avatar_url')
            .in('id', ids);
          if (error) console.error('[NotificationSettings] profiles load error:', error.message);
          else {
            const byId = new Map((profiles ?? []).map((p: any) => [p.id, p as BelledFriend]));
            setFriends(ids.map(id => byId.get(id)).filter(Boolean) as BelledFriend[]);
          }
        }
      }
      setLoading(false);
    })();
  }, [user?.id]));

  async function toggleEnabled(value: boolean) {
    if (!user?.id || saving) return;
    setEnabled(value);
    setSaving(true);
    if (!(await setFriendActivityEnabled(user.id, value))) {
      setEnabled(!value);
      Alert.alert('Error', 'Could not save setting. Please try again.');
    }
    setSaving(false);
  }

  async function removeBell(friend: BelledFriend) {
    if (!user?.id || removing) return;
    setRemoving(friend.id);
    if (await setFriendActivityBell(user.id, friend.id, false)) {
      setFriends(prev => prev.filter(f => f.id !== friend.id));
    } else {
      Alert.alert('Error', 'Could not update notifications. Please try again.');
    }
    setRemoving(null);
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

      <Text style={[s.sectionLabel, { color: subColor }]}>FRIENDS</Text>
      <View style={[s.card, { backgroundColor: rowBg, borderColor: sepColor }]}>
        <View style={s.row}>
          <View style={s.rowLeft}>
            <FontAwesome name="bell-o" size={16} color={accent} style={s.icon} />
            <View style={s.rowText}>
              <Text style={[s.rowTitle, { color: textColor }]}>Friend Activity</Text>
              <Text style={[s.rowSub, { color: subColor }]}>
                Get notified when friends you choose log, rate or review an album. Tap the bell on a friend's profile to add them.
              </Text>
            </View>
          </View>
          <Switch
            value={enabled}
            onValueChange={toggleEnabled}
            disabled={saving}
            trackColor={{ false: isDark ? '#3a2818' : '#d0d0d0', true: accent }}
            thumbColor="#fff"
          />
        </View>
      </View>

      <Text style={[s.sectionLabel, { color: subColor }]}>NOTIFYING YOU ABOUT</Text>
      <View style={[s.card, { backgroundColor: rowBg, borderColor: sepColor }, !enabled && { opacity: 0.5 }]}>
        {friends.length === 0 ? (
          <View style={s.row}>
            <Text style={[s.rowSub, { color: subColor, marginTop: 0 }]}>
              No one yet. Open a friend's profile and tap the bell next to Following.
            </Text>
          </View>
        ) : friends.map((f, i) => {
          const name = nameOrHandle(f.display_name, f.username, f.id, 'Unknown');
          return (
            <View key={f.id}>
              {i > 0 && <View style={[s.sep, { backgroundColor: sepColor, marginLeft: 64 }]} />}
              <Pressable
                style={({ pressed }) => [s.row, { opacity: pressed ? 0.6 : 1 }]}
                onPress={() => router.push({ pathname: '/user-profile', params: { userId: f.id } })}>
                <View style={[s.avatar, { backgroundColor: sepColor }]}>
                  {f.avatar_url ? (
                    <ExpoImage source={{ uri: f.avatar_url }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" />
                  ) : (
                    <Text style={[s.avatarLetter, { color: textColor }]}>{name.charAt(0).toUpperCase()}</Text>
                  )}
                </View>
                <Text style={[s.rowTitle, { color: textColor, flex: 1 }]} numberOfLines={1}>{name}</Text>
                <Pressable
                  onPress={() => removeBell(f)}
                  disabled={removing === f.id}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={`Stop notifications from ${name}`}
                  style={({ pressed }) => [s.bellBtn, { backgroundColor: accent, opacity: pressed || removing === f.id ? 0.6 : 1 }]}>
                  <FontAwesome name="bell" size={13} color="#fff" />
                </Pressable>
              </Pressable>
            </View>
          );
        })}
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
  rowLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 20, textAlign: 'center' },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '500' },
  rowSub:   { fontSize: 12, marginTop: 2, lineHeight: 17 },

  avatar: {
    width: 36, height: 36, borderRadius: 18, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: { fontSize: 15, fontWeight: '700' },

  bellBtn: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
  },

  sep: { height: StyleSheet.hairlineWidth, marginLeft: 48 },
});
