import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { supabase } from '@/lib/supabase';
import { fetchAllRows } from '@/lib/supabaseQuery';
import { rankMembers, memberQuery } from '@/lib/memberSearch';
import { handleText, nameOrHandle } from '@/lib/userHandle';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { ProBadge } from '@/components/ProBadge';
import { usePro } from '@/context/ProContext';
import { getProTheme, themeToColors } from '@/lib/proThemes';

// ─── Types ────────────────────────────────────────────────────────────────────

type ListType = 'followers' | 'following';

type UserRow = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  is_pro: boolean;
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FollowersFollowingScreen() {
  const colorScheme = useColorScheme();
  const { userId, type, proTheme: paramProTheme } = useLocalSearchParams<{ userId: string; type: ListType; proTheme?: string }>();
  const router     = useRouter();
  const { user: currentUser } = useAuth();

  // Pro theme, same rule as My Listend: your own list wears your theme;
  // someone else's wears theirs (passed from their profile).
  const { isPro, proTheme: ownProTheme } = usePro();
  const isOwn     = !!currentUser?.id && userId === currentUser.id;
  const themeKey  = isOwn ? (isPro ? ownProTheme : 'default') : (paramProTheme ?? 'default');
  const colors    = useMemo(
    () => (themeKey !== 'default' ? themeToColors(getProTheme(themeKey)) : Colors[colorScheme ?? 'light']),
    [themeKey, colorScheme],
  );
  const header = (
    <Stack.Screen options={{
      title: type === 'followers' ? 'Followers' : 'Following',
      headerStyle: { backgroundColor: colors.background },
      headerTintColor: colors.text,
      headerShadowVisible: false,
    }} />
  );

  const [users,   setUsers]   = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Pop-out search, same as My Listend: the magnifier toggles a search row;
  // typing filters this list and orders it like member search (exact >
  // starts-with > word starts-with > contains, ties to Pro and a photo).
  const [query,      setQuery]      = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const shownUsers = useMemo(() => {
    const q = memberQuery(query);
    if (!q) return users;
    const hits = users.filter(u =>
      (u.username ?? '').toLowerCase().includes(q) || (u.display_name ?? '').toLowerCase().includes(q));
    return rankMembers(hits, q);
  }, [users, query]);
  function toggleSearch() {
    const next = !searchOpen;
    setSearchOpen(next);
    if (!next) setQuery('');
    else setTimeout(() => searchInputRef.current?.focus(), 50);
  }

  useEffect(() => {
    if (!userId || !type) return;

    async function load() {
      setLoading(true);

      // Fetch blocked IDs (both directions) to filter from list
      const blockedIds = new Set<string>();
      if (currentUser?.id) {
        const [blockedByMe, blockedByThem] = await Promise.all([
          supabase.from('blocked_users').select('blocked_id').eq('blocker_id', currentUser.id),
          supabase.from('blocked_users').select('blocker_id').eq('blocked_id', currentUser.id),
        ]);
        (blockedByMe.data ?? []).forEach((r: any) => blockedIds.add(r.blocked_id));
        (blockedByThem.data ?? []).forEach((r: any) => blockedIds.add(r.blocker_id));
      }

      if (type === 'followers') {
        // Paged — a single select stops at 1000 rows.
        const data = await fetchAllRows<any>(
          (from, to) => supabase
            .from('follows')
            .select('profile:profiles!follower_id(id, display_name, username, avatar_url, is_pro)')
            .eq('following_id', userId)
            .order('follower_id')
            .range(from, to),
          20,
        );
        const error = data === null;

        if (error) {
          console.error('[FollowersFollowing] followers query error:', error);
        } else {
          const seen = new Set<string>();
          setUsers(
            (data ?? [])
              .map((row: any) => row.profile)
              .filter((p: any) => p && !blockedIds.has(p.id) && !seen.has(p.id) && seen.add(p.id)) as UserRow[]
          );
        }
      } else {
        const data = await fetchAllRows<any>(
          (from, to) => supabase
            .from('follows')
            .select('profile:profiles!following_id(id, display_name, username, avatar_url, is_pro)')
            .eq('follower_id', userId)
            .order('following_id')
            .range(from, to),
          20,
        );
        const error = data === null;

        if (error) {
          console.error('[FollowersFollowing] following query error:', error);
        } else {
          const seen = new Set<string>();
          setUsers(
            (data ?? [])
              .map((row: any) => row.profile)
              .filter((p: any) => p && !blockedIds.has(p.id) && !seen.has(p.id) && seen.add(p.id)) as UserRow[]
          );
        }
      }

      setLoading(false);
    }

    load();
  }, [userId, type]);

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: colors.background }]}>
        {header}
        <ActivityIndicator color={colors.tint} size="large" />
      </View>
    );
  }

  const emptyLabel = query.trim()
    ? 'No one matches that name.'
    : type === 'followers' ? 'No followers yet.' : 'Not following anyone yet.';
  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {header}
      <View style={[s.bar, { borderBottomColor: colors.border }]}>
        <Text style={[s.count, { color: colors.subtext }]}>
          {users.length} {type === 'followers' ? (users.length === 1 ? 'follower' : 'followers') : 'following'}
        </Text>
        <Pressable
          onPress={toggleSearch}
          hitSlop={8}
          style={({ pressed }) => [s.searchBtn, {
            backgroundColor: searchOpen ? colors.tint : colors.surface,
            borderColor: colors.border,
            opacity: pressed ? 0.7 : 1,
          }]}>
          <Ionicons name="search-outline" size={13} color={searchOpen ? '#fff' : colors.tint} />
        </Pressable>
      </View>
      {searchOpen && (
        <View style={[s.searchBar, { borderBottomColor: colors.border }]}>
          <FontAwesome name="search" size={14} color={colors.subtext} />
          <TextInput
            ref={searchInputRef}
            style={[s.searchInput, { color: colors.text }]}
            value={query}
            onChangeText={setQuery}
            placeholder={type === 'followers' ? 'Search followers…' : 'Search following…'}
            placeholderTextColor={colors.subtext}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
      )}
      <FlatList
        style={s.container}
        data={shownUsers}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={shownUsers.length === 0 ? s.centerContent : { paddingBottom: 40 }}
        ItemSeparatorComponent={() => <View style={[s.separator, { backgroundColor: colors.border }]} />}
        ListEmptyComponent={() => (
          <Text style={[s.empty, { color: colors.subtext }]}>{emptyLabel}</Text>
        )}
        renderItem={({ item }) => {
          const name    = nameOrHandle(item.display_name, item.username, item.id, 'Unknown');
          const initial = name.charAt(0).toUpperCase();
          return (
            <Pressable
              style={({ pressed }) => [s.row, { opacity: pressed ? 0.7 : 1 }]}
              onPress={() => {
                if (item.id === currentUser?.id) {
                  router.push('/(tabs)/listend' as any);
                } else {
                  router.push({ pathname: '/user-profile', params: { userId: item.id } });
                }
              }}>
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Text style={[s.name, { color: colors.text, flexShrink: 1 }]} numberOfLines={1}>{name}</Text>
                  {item.is_pro && <ProBadge />}
                </View>
                {handleText(item.username, item.id) ? (
                  <Text style={[s.username, { color: colors.subtext }]} numberOfLines={1}>{handleText(item.username, item.id)}</Text>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:    { flex: 1 },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerContent:{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' },

  empty: { fontSize: 15, textAlign: 'center' },

  // Count + search button row and pop-out search — matches My Listend's SortBar.
  bar:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  count:       { fontSize: 13 },
  searchBtn:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  searchBar:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  searchInput: { flex: 1, fontSize: 15, height: 36 },

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
