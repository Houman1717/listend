import {
  StyleSheet,
  View,
  Text,
  Image,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// ─── Constants ────────────────────────────────────────────────────────────────

const DARK_BG = '#0d0d0d';
const BORDER  = '#1e1e1e';
const TEXT    = '#f0f0f0';
const SUBTEXT = '#888';
const ACCENT  = '#FF3CAC';

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
        // People who follow this user: follower_id → profiles
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
        // People this user follows: following_id → profiles
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
      <View style={s.center}>
        <ActivityIndicator color={ACCENT} size="large" />
      </View>
    );
  }

  const emptyLabel = type === 'followers' ? 'No followers yet.' : 'Not following anyone yet.';

  return (
    <FlatList
      style={s.container}
      data={users}
      keyExtractor={(item) => item.id}
      contentContainerStyle={users.length === 0 ? s.centerContent : { paddingBottom: 40 }}
      ItemSeparatorComponent={() => <View style={s.separator} />}
      ListEmptyComponent={() => (
        <Text style={s.empty}>{emptyLabel}</Text>
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
            {/* Avatar */}
            {item.avatar_url ? (
              <Image source={{ uri: item.avatar_url }} style={s.avatar} />
            ) : (
              <View style={[s.avatar, s.avatarFallback]}>
                <Text style={s.avatarInitial}>{initial}</Text>
              </View>
            )}
            {/* Text */}
            <View style={s.textWrap}>
              <Text style={s.name} numberOfLines={1}>{name}</Text>
              {item.username ? (
                <Text style={s.username} numberOfLines={1}>@{item.username}</Text>
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
  container:    { flex: 1, backgroundColor: DARK_BG },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: DARK_BG },
  centerContent:{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' },

  empty: { color: SUBTEXT, fontSize: 15, textAlign: 'center' },

  separator: { height: StyleSheet.hairlineWidth, backgroundColor: BORDER, marginLeft: 76 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 14,
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    flexShrink: 0,
  },
  avatarFallback: {
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: SUBTEXT, fontSize: 20, fontWeight: '700' },

  textWrap: { flex: 1, gap: 2 },
  name:     { color: TEXT,    fontSize: 15, fontWeight: '600' },
  username: { color: SUBTEXT, fontSize: 13 },
});
