import {
  StyleSheet,
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useRouter, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationsContext';
import { supabase } from '@/lib/supabase';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { usePro } from '@/context/ProContext';
import { getProTheme, themeToColors } from '@/lib/proThemes';

// ─── Types ────────────────────────────────────────────────────────────────────

type NotificationItem = {
  id: string;
  type: 'follow' | 'message' | 'like_review' | 'like_playlist' | 'comment' | 'comment_reply';
  read: boolean;
  createdAt: string;
  actorId: string;
  actorName: string;
  actorUsername: string | null;
  actorAvatarUrl: string | null;
  targetId: string | null;
};

// ─── Row ──────────────────────────────────────────────────────────────────────

const NOTIF_META: Record<NotificationItem['type'], { body: string; iconName: string; iconColor: string }> = {
  follow:        { body: 'started following you',    iconName: 'user-plus', iconColor: '#D4A017' },
  message:       { body: 'sent you a message',       iconName: 'envelope',  iconColor: '#B8880F' },
  like_review:   { body: 'liked your review',        iconName: 'heart',     iconColor: '#D4A017' },
  like_playlist: { body: 'liked your playlist',      iconName: 'heart',     iconColor: '#D4A017' },
  comment:       { body: 'commented on your review', iconName: 'comment',  iconColor: '#D4A017' },
  comment_reply: { body: 'replied to your comment',  iconName: 'comment',  iconColor: '#D4A017' },
};

function NotifRow({
  item,
  onPress,
  colors,
}: {
  item: NotificationItem;
  onPress: () => void;
  colors: ReturnType<typeof themeToColors>;
}) {
  const initial = item.actorName.charAt(0).toUpperCase();
  const date = new Date(item.createdAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  const meta = NOTIF_META[item.type] ?? NOTIF_META.follow;

  return (
    <Pressable
      style={({ pressed }) => [
        n.row,
        !item.read && { backgroundColor: colors.isDark ? 'rgba(212,160,23,0.06)' : 'rgba(212,160,23,0.08)' },
        { opacity: pressed ? 0.72 : 1 },
      ]}
      onPress={onPress}>
      <View style={n.avatarWrap}>
        {item.actorAvatarUrl ? (
          <ExpoImage source={{ uri: item.actorAvatarUrl }} style={n.avatar}
            contentFit="cover" cachePolicy="disk"
          />
        ) : (
          <View style={[n.avatar, { backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={[n.avatarInitial, { color: colors.subtext }]}>{initial}</Text>
          </View>
        )}
        <View style={[n.typeBadge, { backgroundColor: meta.iconColor, borderColor: colors.background }]}>
          <FontAwesome name={meta.iconName as any} size={8} color="#fff" />
        </View>
      </View>
      <View style={n.info}>
        <Text style={[n.body, { color: colors.text }]} numberOfLines={2}>
          <Text style={n.actor}>{item.actorName}</Text>
          {' '}{meta.body}
        </Text>
        <Text style={[n.date, { color: colors.subtext }]}>{date}</Text>
      </View>
      {!item.read && <View style={[n.dot, { backgroundColor: colors.tint }]} />}
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { markAllRead } = useNotifications();
  const colorScheme = useColorScheme();
  const { isPro, proTheme } = usePro();
  const colors = (isPro && proTheme && proTheme !== 'default')
    ? themeToColors(getProTheme(proTheme))
    : Colors[colorScheme ?? 'dark'];

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    load();
    markAllRead();
  }, [user?.id]);

  async function load() {
    if (!user) return;
    setLoading(true);

    const { data: rows, error } = await supabase
      .from('notifications')
      .select('id, type, read, created_at, actor_id, target_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[Notifications] fetch error:', error.message);
      setLoading(false);
      return;
    }
    if (!rows || rows.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    const actorIds = [...new Set(rows.map((r: any) => r.actor_id).filter(Boolean))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, username, avatar_url')
      .in('id', actorIds);

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    setItems(
      rows.map((row: any) => {
        const prof = profileMap.get(row.actor_id);
        return {
          id:             row.id,
          type:           row.type,
          read:           row.read,
          createdAt:      row.created_at,
          actorId:        row.actor_id                         ?? '',
          actorName:      prof?.display_name || prof?.username || 'User',
          actorUsername:  prof?.username                       ?? null,
          actorAvatarUrl: prof?.avatar_url                     ?? null,
          targetId:       row.target_id                        ?? null,
        };
      }),
    );
    setLoading(false);
  }

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Notifications', headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text, headerShadowVisible: false }} />
        <View style={[n.center, { backgroundColor: colors.background }]}>
          <ActivityIndicator color={colors.tint} size="large" />
        </View>
      </>
    );
  }

  if (items.length === 0) {
    return (
      <>
        <Stack.Screen options={{ title: 'Notifications', headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text, headerShadowVisible: false }} />
        <View style={[n.emptyWrap, { backgroundColor: colors.background }]}>
          <View style={[n.emptyRing, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <FontAwesome name="bell-o" size={32} color={colors.tint} />
          </View>
          <Text style={[n.emptyTitle, { color: colors.text }]}>No notifications yet</Text>
          <Text style={[n.emptySub, { color: colors.subtext }]}>You'll see follow, message, and like notifications here.</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Notifications', headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text, headerShadowVisible: false }} />
      <FlatList
        data={items}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={n.list}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={[n.sep, { backgroundColor: colors.border }]} />}
        renderItem={({ item }) => (
          <NotifRow
            item={item}
            colors={colors}
            onPress={() => {
              if (item.type === 'message') {
                router.push({ pathname: '/dm-conversation', params: { userId: item.actorId } });
              } else if ((item.type === 'like_review' || item.type === 'comment' || item.type === 'comment_reply') && item.targetId) {
                const albumId = item.targetId.split('_')[1];
                router.push({ pathname: '/album-detail', params: { id: albumId, reviewId: item.targetId } } as any);
              } else if (item.type === 'like_playlist' && item.targetId) {
                if (item.targetId.startsWith('featured:')) {
                  router.push({ pathname: '/discover-featured-playlist', params: { id: item.targetId.replace('featured:', '') } } as any);
                } else {
                  router.push({ pathname: '/playlist-detail', params: { id: item.targetId } } as any);
                }
              } else {
                router.push({ pathname: '/user-profile', params: { userId: item.actorId } });
              }
            }}
          />
        )}
      />
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const n = StyleSheet.create({
  list:   { paddingVertical: 8, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 13,
  },

  avatarWrap:    { position: 'relative', flexShrink: 0 },
  avatar:        { width: 48, height: 48, borderRadius: 24 },
  avatarInitial: { fontSize: 17, fontWeight: '700' },
  typeBadge: {
    position: 'absolute', bottom: 0, right: -2,
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
  },

  info:  { flex: 1, gap: 4 },
  body:  { fontSize: 14, lineHeight: 20 },
  actor: { fontWeight: '700' },
  date:  { fontSize: 12 },

  dot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },

  sep: { height: StyleSheet.hairlineWidth, marginLeft: 79 },

  emptyWrap: {
    flex: 1,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40,
  },
  emptyRing: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySub:   { fontSize: 14, lineHeight: 21, textAlign: 'center' },
});
