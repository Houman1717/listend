import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

// ─── Types ────────────────────────────────────────────────────────────────────

type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string | null;
  type: string;
  album_data: any;
  created_at: string;
};

type Conversation = {
  partnerId: string;
  partnerName: string;
  partnerUsername: string | null;
  partnerAvatarUrl: string | null;
  lastMessage: Message;
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DMsScreen() {
  const colorScheme = useColorScheme();
  const colors      = Colors[colorScheme ?? 'light'];

  const { user } = useAuth();
  const router   = useRouter();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading,       setLoading]       = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [user])
  );

  async function loadConversations() {
    if (!user) return;
    setLoading(true);

    const { data: msgs, error: msgsErr } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (msgsErr) {
      console.error('[DMs] messages fetch error:', msgsErr);
      setLoading(false);
      return;
    }

    const convMap = new Map<string, Message>();
    for (const msg of msgs ?? []) {
      const partnerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
      if (!convMap.has(partnerId)) convMap.set(partnerId, msg);
    }

    if (convMap.size === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const partnerIds = Array.from(convMap.keys());
    const { data: profiles, error: profErr } = await supabase
      .from('profiles')
      .select('id, display_name, username, avatar_url')
      .in('id', partnerIds);

    if (profErr) console.error('[DMs] profiles fetch error:', profErr);

    const profileMap = new Map((profiles ?? []).map(p => [p.id, p]));

    const convs: Conversation[] = partnerIds
      .map(partnerId => {
        const profile = profileMap.get(partnerId);
        return {
          partnerId,
          partnerName:      profile?.display_name || profile?.username || 'Unknown',
          partnerUsername:  profile?.username  ?? null,
          partnerAvatarUrl: profile?.avatar_url ?? null,
          lastMessage: convMap.get(partnerId)!,
        };
      })
      .sort((a, b) =>
        new Date(b.lastMessage.created_at).getTime() -
        new Date(a.lastMessage.created_at).getTime()
      );

    setConversations(convs);
    setLoading(false);
  }

  function previewText(msg: Message): string {
    if (msg.type === 'album' && msg.album_data) {
      return `🎵 ${msg.album_data.title}`;
    }
    return msg.content ?? '';
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color="#D4A017" size="large" />
      </View>
    );
  }

  return (
    <FlatList
      style={[s.container, { backgroundColor: colors.background }]}
      data={conversations}
      keyExtractor={item => item.partnerId}
      contentContainerStyle={conversations.length === 0 ? s.centerContent : { paddingBottom: 40 }}
      ItemSeparatorComponent={() => <View style={[s.separator, { backgroundColor: colors.border }]} />}
      ListEmptyComponent={() => (
        <View style={s.emptyWrap}>
          <View style={[s.emptyIconRing, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <FontAwesome name="comments" size={36} color="#D4A017" />
          </View>
          <Text style={[s.emptyTitle, { color: colors.text }]}>No conversations yet</Text>
          <Text style={[s.emptySub, { color: colors.subtext }]}>
            When friends message you,{'\n'}they'll show up here.
          </Text>
        </View>
      )}
      renderItem={({ item }) => {
        const initial = item.partnerName.charAt(0).toUpperCase();
        return (
          <Pressable
            style={({ pressed }) => [s.row, { opacity: pressed ? 0.7 : 1 }]}
            onPress={() =>
              router.push({
                pathname: '/dm-conversation',
                params: { userId: item.partnerId },
              })
            }>
            {item.partnerAvatarUrl ? (
              <ExpoImage source={{ uri: item.partnerAvatarUrl }} style={s.avatar} 
            contentFit="cover" cachePolicy="disk"
          />
            ) : (
              <View style={[s.avatar, { backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={[s.avatarInitial, { color: colors.subtext }]}>{initial}</Text>
              </View>
            )}
            <View style={s.textWrap}>
              <Text style={[s.name, { color: colors.text }]} numberOfLines={1}>{item.partnerName}</Text>
              <Text style={[s.preview, { color: colors.subtext }]} numberOfLines={1}>{previewText(item.lastMessage)}</Text>
            </View>
            <Text style={[s.time, { color: colors.subtext }]}>
              {formatTime(item.lastMessage.created_at)}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const date  = new Date(iso);
  const now   = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:    { flex: 1 },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerContent:{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' },

  separator: { height: StyleSheet.hairlineWidth, marginLeft: 82 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 14,
  },

  avatar: { width: 50, height: 50, borderRadius: 25, flexShrink: 0 },
  avatarInitial: { fontSize: 20, fontWeight: '700' },

  textWrap: { flex: 1, gap: 3 },
  name:     { fontSize: 15, fontWeight: '600' },
  preview:  { fontSize: 13 },

  time: { fontSize: 12, alignSelf: 'flex-start', marginTop: 2 },

  emptyWrap: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyIconRing: {
    width: 84, height: 84, borderRadius: 42,
    borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 10 },
  emptySub:   { fontSize: 14, lineHeight: 21, textAlign: 'center' },
});
