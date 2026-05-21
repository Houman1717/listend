import {
  StyleSheet,
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationsContext';
import { supabase } from '@/lib/supabase';

// ─── Palette ──────────────────────────────────────────────────────────────────

const DARK_BG = '#1c1410';
const BORDER  = '#2e2018';
const TEXT    = '#f5e6c8';
const SUBTEXT = '#777';
const ACCENT  = '#D4A017';

// ─── Types ────────────────────────────────────────────────────────────────────

type NotificationItem = {
  id: string;
  type: 'follow' | 'message' | 'like_review' | 'like_playlist';
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
  follow:        { body: 'started following you', iconName: 'user-plus', iconColor: '#D4A017' },
  message:       { body: 'sent you a message',    iconName: 'envelope',  iconColor: '#B8880F' },
  like_review:   { body: 'liked your review',     iconName: 'heart',     iconColor: '#D4A017' },
  like_playlist: { body: 'liked your playlist',   iconName: 'heart',     iconColor: '#D4A017' },
};

function NotifRow({ item, onPress }: { item: NotificationItem; onPress: () => void }) {
  const initial = item.actorName.charAt(0).toUpperCase();
  const date = new Date(item.createdAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  const meta = NOTIF_META[item.type] ?? NOTIF_META.follow;

  return (
    <Pressable
      style={({ pressed }) => [
        n.row,
        !item.read && n.rowUnread,
        { opacity: pressed ? 0.72 : 1 },
      ]}
      onPress={onPress}>
      <View style={n.avatarWrap}>
        {item.actorAvatarUrl ? (
          <ExpoImage source={{ uri: item.actorAvatarUrl }} style={n.avatar} 
            contentFit="cover" cachePolicy="disk"
          />
        ) : (
          <View style={[n.avatar, n.avatarFallback]}>
            <Text style={n.avatarInitial}>{initial}</Text>
          </View>
        )}
        {/* Type badge — small icon overlaid on the avatar */}
        <View style={[n.typeBadge, { backgroundColor: meta.iconColor }]}>
          <FontAwesome name={meta.iconName as any} size={8} color="#fff" />
        </View>
      </View>
      <View style={n.info}>
        <Text style={n.body} numberOfLines={2}>
          <Text style={n.actor}>{item.actorName}</Text>
          {' '}{meta.body}
        </Text>
        <Text style={n.date}>{date}</Text>
      </View>
      {!item.read && <View style={n.dot} />}
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { markAllRead } = useNotifications();

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    load();
    // Mark all as read when the screen is opened
    markAllRead();
  }, [user?.id]);

  async function load() {
    if (!user) return;
    setLoading(true);

    // Step 1 — fetch notification rows (no join)
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

    // Step 2 — fetch profiles for all unique actor IDs
    const actorIds = [...new Set(rows.map((r: any) => r.actor_id).filter(Boolean))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, username, avatar_url')
      .in('id', actorIds);

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    // Step 3 — merge in memory
    setItems(
      rows.map((row: any) => {
        const prof = profileMap.get(row.actor_id);
        return {
          id:             row.id,
          type:           row.type,
          read:           row.read,
          createdAt:      row.created_at,
          actorId:        row.actor_id                                  ?? '',
          actorName:      prof?.display_name || prof?.username          || 'User',
          actorUsername:  prof?.username                                ?? null,
          actorAvatarUrl: prof?.avatar_url                              ?? null,
          targetId:       row.target_id                                 ?? null,
        };
      }),
    );
    setLoading(false);
  }

  if (loading) {
    return (
      <View style={n.center}>
        <ActivityIndicator color={ACCENT} size="large" />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={n.emptyWrap}>
        <View style={n.emptyRing}>
          <FontAwesome name="bell-o" size={32} color={ACCENT} />
        </View>
        <Text style={n.emptyTitle}>No notifications yet</Text>
        <Text style={n.emptySub}>You'll see follow, message, and like notifications here.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item, index) => `${item.id}-${index}`}
      style={n.container}
      contentContainerStyle={n.list}
      showsVerticalScrollIndicator={false}
      ItemSeparatorComponent={() => <View style={n.sep} />}
      renderItem={({ item }) => (
        <NotifRow
          item={item}
          onPress={() => {
            if (item.type === 'message') {
              router.push({ pathname: '/dm-conversation', params: { userId: item.actorId } });
            } else if (item.type === 'like_review' && item.targetId) {
              const albumId = item.targetId.split('_')[1];
              router.push({ pathname: '/album-detail', params: { id: albumId, reviewId: item.targetId } } as any);
            } else {
              router.push({ pathname: '/user-profile', params: { userId: item.actorId } });
            }
          }}
        />
      )}
    />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const n = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_BG },
  list:      { paddingVertical: 8, paddingBottom: 48 },
  center:    { flex: 1, backgroundColor: DARK_BG, alignItems: 'center', justifyContent: 'center' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 13,
  },
  rowUnread: {
    backgroundColor: 'rgba(255,60,172,0.05)',
  },

  avatarWrap:    { position: 'relative', flexShrink: 0 },
  avatar:        { width: 48, height: 48, borderRadius: 24 },
  avatarFallback:{ backgroundColor: '#2e2018', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: 'rgba(255,255,255,0.45)', fontSize: 17, fontWeight: '700' },
  typeBadge: {
    position: 'absolute', bottom: 0, right: -2,
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#1c1410',
  },

  info:  { flex: 1, gap: 4 },
  body:  { color: TEXT,    fontSize: 14, lineHeight: 20 },
  actor: { fontWeight: '700' },
  date:  { color: SUBTEXT, fontSize: 12 },

  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: ACCENT,
    flexShrink: 0,
  },

  sep: { height: StyleSheet.hairlineWidth, backgroundColor: BORDER, marginLeft: 79 },

  emptyWrap: {
    flex: 1, backgroundColor: DARK_BG,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40,
  },
  emptyRing: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#2e2018',
    borderWidth: 1, borderColor: '#3a2818',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: { color: TEXT,    fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySub:   { color: SUBTEXT, fontSize: 14, lineHeight: 21,    textAlign: 'center' },
});
