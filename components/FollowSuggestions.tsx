import { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { ProBadge } from '@/components/ProBadge';
import { followUser, type SuggestedUser } from '@/lib/growth';
import { capture } from '@/lib/analytics';

// Follow suggestions, in two shapes: a list row (onboarding "Find people")
// and a compact card (the Home "People to Follow" strip). Colors are passed
// in and applied inline so pro themes work (StyleSheet only holds layout).

type SuggestionColors = {
  text: string; subtext: string; card: string; border: string; tint: string; background: string;
};

type FollowStatus = 'idle' | 'busy' | 'following' | 'requested';

/** Per-id follow state shared by every row/card in one list. */
export function useFollowSuggestions(source: 'onboarding' | 'home') {
  const [status, setStatus] = useState<Record<string, FollowStatus>>({});

  const follow = useCallback(async (u: SuggestedUser) => {
    setStatus(s => ({ ...s, [u.id]: 'busy' }));
    const result = await followUser(u.id);
    setStatus(s => ({ ...s, [u.id]: result === 'error' ? 'idle' : result }));
    if (result !== 'error') capture('suggested_follow', { source, reason: u.reason, result });
  }, [source]);

  const followedCount = Object.values(status).filter(v => v === 'following' || v === 'requested').length;
  return { status, follow, followedCount };
}

// Characters people use to look nameless (Hangul fillers, Braille blank,
// zero-widths) that String.trim() leaves alone.
const INVISIBLE = /[\s­ᅟᅠ​-‏⁠⠀ㅤ﻿ﾠ]/g;

/** A name that renders as nothing falls back to the username. */
function displayName(u: SuggestedUser) {
  return u.display_name && u.display_name.replace(INVISIBLE, '') ? u.display_name.trim() : u.username;
}

function Avatar({ user, size, colors }: { user: SuggestedUser; size: number; colors: SuggestionColors }) {
  const name = displayName(user);
  if (user.avatar_url) {
    return (
      <ExpoImage
        source={{ uri: user.avatar_url }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
        cachePolicy="disk"
      />
    );
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: colors.subtext, fontSize: size * 0.4, fontWeight: '700' }}>
        {name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

function FollowButton({
  status, onPress, colors, compact,
}: { status: FollowStatus; onPress: () => void; colors: SuggestionColors; compact?: boolean }) {
  const done = status === 'following' || status === 'requested';
  const label = status === 'following' ? 'Following' : status === 'requested' ? 'Requested' : 'Follow';
  return (
    <Pressable
      onPress={onPress}
      disabled={status !== 'idle'}
      hitSlop={6}
      style={({ pressed }) => [
        compact ? s.btnCompact : s.btn,
        done
          ? { borderWidth: 1, borderColor: colors.border, backgroundColor: 'transparent' }
          : { backgroundColor: colors.tint },
        { opacity: pressed ? 0.75 : 1 },
      ]}>
      {status === 'busy'
        ? <ActivityIndicator size="small" color={done ? colors.text : '#fff'} />
        : <Text style={[s.btnText, { color: done ? colors.text : '#fff' }]}>{label}</Text>}
    </Pressable>
  );
}

/** Full-width row: avatar, name, reason, Follow. */
export function SuggestionRow({
  user, status, onFollow, onOpen, colors,
}: {
  user: SuggestedUser; status: FollowStatus; onFollow: () => void; onOpen: () => void; colors: SuggestionColors;
}) {
  return (
    <View style={[s.row, { borderBottomColor: colors.border }]}>
      <Pressable onPress={onOpen} style={s.rowMain} hitSlop={4}>
        <Avatar user={user} size={46} colors={colors} />
        <View style={{ flex: 1 }}>
          <View style={s.nameLine}>
            <Text style={[s.name, { color: colors.text }]} numberOfLines={1}>
              {displayName(user)}
            </Text>
            {user.is_pro && <ProBadge size="xs" />}
          </View>
          <Text style={[s.sub, { color: colors.subtext }]} numberOfLines={1}>
            {user.reason} · @{user.username}
          </Text>
        </View>
      </Pressable>
      <FollowButton status={status} onPress={onFollow} colors={colors} />
    </View>
  );
}

/** Compact card for a horizontal strip. */
export function SuggestionCard({
  user, status, onFollow, onOpen, colors,
}: {
  user: SuggestedUser; status: FollowStatus; onFollow: () => void; onOpen: () => void; colors: SuggestionColors;
}) {
  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Pressable onPress={onOpen} style={s.cardMain} hitSlop={4}>
        <Avatar user={user} size={64} colors={colors} />
        <View style={[s.nameLine, { marginTop: 8, justifyContent: 'center' }]}>
          <Text style={[s.cardName, { color: colors.text }]} numberOfLines={1}>
            {displayName(user)}
          </Text>
          {user.is_pro && <ProBadge size="xs" />}
        </View>
        <Text style={[s.cardSub, { color: colors.subtext }]} numberOfLines={2}>{user.reason}</Text>
      </Pressable>
      <FollowButton status={status} onPress={onFollow} colors={colors} compact />
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowMain:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name:     { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  sub:      { fontSize: 12.5, marginTop: 2 },
  btn:        { minWidth: 92, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  btnCompact: { alignSelf: 'stretch', height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  btnText:  { fontSize: 13, fontWeight: '700' },
  card: {
    width: 140, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth,
    padding: 12, alignItems: 'center',
  },
  cardMain: { alignItems: 'center', alignSelf: 'stretch' },
  cardName: { fontSize: 13.5, fontWeight: '700', flexShrink: 1 },
  cardSub:  { fontSize: 11.5, textAlign: 'center', marginTop: 3, minHeight: 30 },
});
