import {
  StyleSheet,
  View,
  Text,
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
import { setFriendActivityBell, BELL_OFF, type BellPrefs } from '@/lib/friendActivity';

const ACCENT  = '#D4A017';

type BelledFriend = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  prefs: BellPrefs;
};

/** "Every listen" covers the other two, so it's the whole summary when on. */
function prefsSummary(p: BellPrefs): string {
  if (p.listens) return 'Every listen';
  return [p.reviews && 'Reviews', p.ratings && 'Ratings'].filter(Boolean).join(' · ');
}

export default function NotificationSettingsScreen() {
  const colorScheme = useColorScheme();
  const colors      = Colors[colorScheme ?? 'light'];
  const isDark      = colorScheme === 'dark';
  const router      = useRouter();
  const { user }    = useAuth();
  const { isPro, proTheme } = usePro();
  const proColors = (isPro && proTheme !== 'default') ? themeToColors(getProTheme(proTheme)) : null;

  const [friends,  setFriends]  = useState<BelledFriend[]>([]);
  const [loading,  setLoading]  = useState(true);
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
      const { data: subs, error: subsErr } = await supabase
        .from('friend_activity_subscriptions')
        .select('target_id, reviews, ratings, listens')
        .eq('subscriber_id', uid)
        .order('created_at', { ascending: false });
      if (subsErr) {
        console.error('[NotificationSettings] bells load error:', subsErr.message);
      } else {
        const prefsById = new Map<string, BellPrefs>((subs ?? []).map((r: any) => [
          r.target_id as string,
          { reviews: !!r.reviews, ratings: !!r.ratings, listens: !!r.listens },
        ]));
        const ids = [...prefsById.keys()];
        if (ids.length === 0) {
          setFriends([]);
        } else {
          const { data: profiles, error } = await supabase
            .from('profiles')
            .select('id, display_name, username, avatar_url')
            .in('id', ids);
          if (error) console.error('[NotificationSettings] profiles load error:', error.message);
          else {
            const byId = new Map((profiles ?? []).map((p: any) => [p.id, p]));
            setFriends(ids
              .filter(id => byId.has(id))
              .map(id => ({ ...byId.get(id), prefs: prefsById.get(id)! }) as BelledFriend));
          }
        }
      }
      setLoading(false);
    })();
  }, [user?.id]));

  async function removeBell(friend: BelledFriend) {
    if (!user?.id || removing) return;
    setRemoving(friend.id);
    if (await setFriendActivityBell(user.id, friend.id, BELL_OFF)) {
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

      <Text style={[s.sectionLabel, { color: subColor }]}>FRIEND ACTIVITY</Text>
      <Text style={[s.intro, { color: subColor }]}>
        Tap the bell on a friend's profile to choose what you hear about: reviews, ratings or every album they log. Tap a bell here to turn it off.
      </Text>
      <View style={[s.card, { backgroundColor: rowBg, borderColor: sepColor }]}>
        {friends.length === 0 ? (
          <View style={s.row}>
            <Text style={[s.rowSub, { color: subColor, marginTop: 0 }]}>
              You're not getting friend activity from anyone yet.
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
                <View style={{ flex: 1 }}>
                  <Text style={[s.rowTitle, { color: textColor }]} numberOfLines={1}>{name}</Text>
                  <Text style={[s.rowSub, { color: subColor }]} numberOfLines={1}>{prefsSummary(f.prefs)}</Text>
                </View>
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
  intro: { fontSize: 13, lineHeight: 18, marginBottom: 12, marginLeft: 4, marginRight: 4 },

  card: {
    borderRadius: 14, borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden', marginBottom: 28,
  },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    gap: 12,
  },
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
