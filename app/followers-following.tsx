import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

// ─── Types ────────────────────────────────────────────────────────────────────

type ListType = 'followers' | 'following';

type UserRow = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FollowersFollowingScreen() {
  const colorScheme = useColorScheme();
  const colors      = Colors[colorScheme ?? 'light'];

  const { userId, type } = useLocalSearchParams<{ userId: string; type: ListType }>();
  const navigation = useNavigation();
  const router     = useRouter();

  const [users,   setUsers]   = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !type) return;

    navigation.setOptions({
      title: type === 'followers' ? 'Followers' : 'Following',
    });

    async function load() {
      setLoading(true);

      if (type === 'followers') {
        const { data, error } = await supabase
          .from('follows')
          .select('profile:profiles!follower_id(id, display_name, username, avatar_url)')
          .eq('following_id', userId);

        if (error) {
          console.error('[FollowersFollowing] followers query error:', error);
        } else {
          setUsers(
            (data ?? [])
              .map((row: any) => row.profile)
              .filter(Boolean) as UserRow[]
          );
        }
      } else {
        const { data, error } = await supabase
          .from('follows')
          .select('profile:profiles!following_id(id, display_name, username, avatar_url)')
          .eq('follower_id', userId);

        if (error) {
          console.error('[FollowersFollowing] following query error:', error);
        } else {
          setUsers(
            (data ?? [])
              .map((row: any) => row.profile)
              .filter(Boolean) as UserRow[]
          );
        }
      }

      setLoading(false);
    }

    load();
  }, [userId, type, navigation]);

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color="#D4A017" size="large" />
      </View>
    );
  }

  const emptyLabel = type === 'followers' ? 'No followers yet.' : 'Not following anyone yet.';

  return (
    <FlatList
      style={[s.container, { backgroundColor: colors.background }]}
      data={users}
      keyExtractor={(item) => item.id}
      contentContainerStyle={users.length === 0 ? s.centerContent : { paddingBottom: 40 }}
      ItemSeparatorComponent={() => <View style={[s.separator, { backgroundColor: colors.border }]} />}
      ListEmptyComponent={() => (
        <Text style={[s.empty, { color: colors.subtext }]}>{emptyLabel}</Text>
      )}
      renderItem={({ item }) => {
        const name    = item.display_name || item.username || 'Unknown';
        const initial = name.charAt(0).toUpperCase();
        return (
          <Pressable
            style={({ pressed }) => [s.row, { opacity: pressed ? 0.7 : 1 }]}
            onPress={() =>
              router.push({ pathname: '/user-profile', params: { userId: item.id } })
            }>
            {item.avatar_url ? (
              <ExpoImage source={{ uri: item.avatar_url }} style={s.avatar} 
            contentFit="cover" cachePolicy="disk"
          />
            ) : (
              <View style={[s.avatar, { backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={[s.avatarInitial, { color: colors.subtext }]}>{initial}</Text>
              </View>
            )}
            <View style={s.textWrap}>
              <Text style={[s.name, { color: colors.text }]} numberOfLines={1}>{name}</Text>
              {item.username ? (
                <Text style={[s.username, { color: colors.subtext }]} numberOfLines={1}>@{item.username}</Text>
              ) : null}
            </View>
          </Pressable>
        );
      }}
    />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:    { flex: 1 },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerContent:{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' },

  empty: { fontSize: 15, textAlign: 'center' },

  separator: { height: StyleSheet.hairlineWidth, marginLeft: 76 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 14,
  },

  avatar: { width: 48, height: 48, borderRadius: 24, flexShrink: 0 },
  avatarInitial: { fontSize: 20, fontWeight: '700' },

  textWrap: { flex: 1, gap: 2 },
  name:     { fontSize: 15, fontWeight: '600' },
  username: { fontSize: 13 },
});
