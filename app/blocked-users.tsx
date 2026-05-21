import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useEffect, useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

const ACCENT = '#D4A017';

type BlockedUser = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

function avatarColor(id: string): string {
  const COLORS = ['#7C3AED', '#2563EB', '#059669', '#D97706', '#DC2626'];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

export default function BlockedUsersScreen() {
  const colorScheme = useColorScheme();
  const colors      = Colors[colorScheme ?? 'light'];
  const isDark      = colorScheme === 'dark';
  const { user }    = useAuth();

  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [unblocking,   setUnblocking]   = useState<string | null>(null);

  const sepColor = isDark ? '#2a1e14' : '#e8e8e8';

  async function load() {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('blocked_users')
      .select('blocked_id, profiles:blocked_id(id, display_name, username, avatar_url)')
      .eq('blocker_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[BlockedUsers] fetch error:', error);
    } else {
      setBlockedUsers(
        (data ?? [])
          .map((row: any) => row.profiles)
          .filter(Boolean) as BlockedUser[]
      );
    }
    setLoading(false);
  }

  useFocusEffect(useCallback(() => { load(); }, [user?.id]));

  async function handleUnblock(blockedId: string, name: string) {
    Alert.alert(
      'Unblock User',
      `Unblock ${name}? They will be able to see your profile and contact you again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            setUnblocking(blockedId);
            const { error } = await supabase
              .from('blocked_users')
              .delete()
              .match({ blocker_id: user!.id, blocked_id: blockedId });
            if (error) {
              console.error('[BlockedUsers] unblock error:', error);
              Alert.alert('Error', 'Could not unblock user. Please try again.');
            } else {
              setBlockedUsers(prev => prev.filter(u => u.id !== blockedId));
            }
            setUnblocking(null);
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={ACCENT} />
      </View>
    );
  }

  return (
    <FlatList
      style={[s.container, { backgroundColor: colors.background }]}
      data={blockedUsers}
      keyExtractor={item => item.id}
      ItemSeparatorComponent={() => <View style={[s.sep, { backgroundColor: sepColor }]} />}
      ListEmptyComponent={
        <View style={s.emptyWrap}>
          <FontAwesome name="ban" size={40} color={colors.subtext} style={{ marginBottom: 12, opacity: 0.4 }} />
          <Text style={[s.emptyText, { color: colors.subtext }]}>No blocked users</Text>
        </View>
      }
      renderItem={({ item }) => {
        const name    = item.display_name || item.username || 'Unknown';
        const initial = name.charAt(0).toUpperCase();
        const isUnblocking = unblocking === item.id;

        return (
          <View style={[s.row, { backgroundColor: colors.background }]}>
            {/* Avatar */}
            <View style={[s.avatar, { backgroundColor: avatarColor(item.id) }]}>
              {item.avatar_url ? (
                <ExpoImage source={{ uri: item.avatar_url }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" />
              ) : (
                <Text style={s.avatarLetter}>{initial}</Text>
              )}
            </View>

            {/* Name */}
            <View style={s.info}>
              <Text style={[s.name, { color: colors.text }]} numberOfLines={1}>{name}</Text>
              {item.username ? (
                <Text style={[s.username, { color: colors.subtext }]} numberOfLines={1}>@{item.username}</Text>
              ) : null}
            </View>

            {/* Unblock button */}
            <Pressable
              style={({ pressed }) => [s.unblockBtn, { opacity: pressed || isUnblocking ? 0.6 : 1 }]}
              onPress={() => handleUnblock(item.id, name)}
              disabled={isUnblocking}>
              {isUnblocking
                ? <ActivityIndicator size="small" color={ACCENT} />
                : <Text style={s.unblockText}>Unblock</Text>}
            </Pressable>
          </View>
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },

  emptyWrap: { flex: 1, alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: 15 },

  sep: { height: StyleSheet.hairlineWidth, marginLeft: 72 },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, gap: 12,
  },

  avatar: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  avatarLetter: { color: '#fff', fontSize: 17, fontWeight: '700' },

  info:     { flex: 1 },
  name:     { fontSize: 15, fontWeight: '600' },
  username: { fontSize: 13, marginTop: 1 },

  unblockBtn: {
    borderWidth: 1.5, borderColor: ACCENT,
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7,
    minWidth: 74, alignItems: 'center',
  },
  unblockText: { color: ACCENT, fontSize: 13, fontWeight: '600' },
});
