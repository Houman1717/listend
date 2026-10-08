import { StyleSheet, View, Text, FlatList, Pressable, Modal, ActivityIndicator, TextInput, LayoutAnimation } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useState, useEffect, useRef, useMemo } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/context/AuthContext';
import { useAlbums } from '@/context/AlbumsContext';
import { ProBadge } from '@/components/ProBadge';
import { DMAlbum, DMFriend, fetchDMFriends, sendAlbumMessage } from '@/lib/directMessages';

const ACCENT = '#D4A017';

type SendState = 'sending' | 'sent' | 'failed';

type Props = {
  visible: boolean;
  album: DMAlbum;
  isDark: boolean;
  colors: { text: string; subtext: string; border: string; tint: string; surface: string };
  onClose: () => void;
};

/** Bottom sheet listing your friends (mutual follows with DMs on); tap Send to DM them the album. */
export function SendAlbumSheet({ visible, album, isDark, colors, onClose }: Props) {
  const { user } = useAuth();
  const { loggedAlbums } = useAlbums();
  const [friends, setFriends] = useState<DMFriend[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [sendState, setSendState] = useState<Record<string, SendState>>({});
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchInputRef = useRef<TextInput>(null);

  // Same toggle as the library screens' search (my-listend etc.). Searching
  // expands the sheet to (nearly) full height, pinned under the status bar —
  // see the sheet style below for why it doesn't dodge the keyboard instead.
  function toggleSearch() {
    const next = !searchOpen;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSearchOpen(next);
    if (!next) setQuery('');
    else setTimeout(() => searchInputRef.current?.focus(), 50);
  }

  const shownFriends = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^@/, '');
    if (!friends || !q) return friends;
    return friends.filter(f =>
      f.name.toLowerCase().includes(q) || (f.username ?? '').toLowerCase().includes(q)
    );
  }, [friends, query]);

  useEffect(() => {
    if (!visible || !user?.id) return;
    let cancelled = false;
    setLoadFailed(false);
    setSendState({});
    setSearchOpen(false);
    setQuery('');
    fetchDMFriends(user.id).then(result => {
      if (cancelled) return;
      if (result) setFriends(result);
      else setLoadFailed(true);
    });
    return () => { cancelled = true; };
  }, [visible, user?.id]);

  async function send(friend: DMFriend) {
    if (!user?.id) return;
    const state = sendState[friend.id];
    if (state === 'sending' || state === 'sent') return;
    setSendState(prev => ({ ...prev, [friend.id]: 'sending' }));
    const ok = await sendAlbumMessage(user.id, friend.id, album, loggedAlbums);
    setSendState(prev => ({ ...prev, [friend.id]: ok ? 'sent' : 'failed' }));
  }

  const sheetBg = isDark ? '#141414' : '#fff';
  const divider = isDark ? '#2a1e14' : '#f5e6c8';

  let body;
  if (friends === null && !loadFailed) {
    body = <ActivityIndicator style={{ marginVertical: 32 }} color={ACCENT} />;
  } else if (loadFailed && friends === null) {
    body = <Text style={[s.empty, { color: colors.subtext }]}>Couldn't load your friends. Try again in a moment.</Text>;
  } else if (friends && friends.length === 0) {
    body = (
      <Text style={[s.empty, { color: colors.subtext }]}>
        No friends to send to yet. Friends are people you follow who follow you back.
      </Text>
    );
  } else if (shownFriends && shownFriends.length === 0) {
    body = <Text style={[s.empty, { color: colors.subtext }]}>No friends match "{query.trim()}"</Text>;
  } else {
    body = (
      <FlatList
        data={shownFriends}
        keyExtractor={f => f.id}
        style={s.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        // iOS: scroll the last rows out from under the keyboard.
        automaticallyAdjustKeyboardInsets
        renderItem={({ item }) => {
          const state = sendState[item.id];
          const sent = state === 'sent';
          return (
            <View style={[s.row, { borderBottomColor: divider }]}>
              {item.avatarUrl ? (
                <ExpoImage source={{ uri: item.avatarUrl }} style={s.avatar} contentFit="cover" cachePolicy="disk" />
              ) : (
                <View style={[s.avatar, { backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={[s.avatarInitial, { color: colors.subtext }]}>{item.name.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <View style={s.rowText}>
                <View style={s.nameRow}>
                  <Text style={[s.name, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                  {item.isPro && <ProBadge size="xs" />}
                </View>
                {item.username && (
                  <Text style={[s.username, { color: colors.subtext }]} numberOfLines={1}>@{item.username}</Text>
                )}
              </View>
              <Pressable
                onPress={() => send(item)}
                disabled={state === 'sending' || sent}
                hitSlop={6}
                style={({ pressed }) => [
                  s.sendBtn,
                  sent
                    ? { backgroundColor: 'transparent', borderColor: ACCENT }
                    : { backgroundColor: ACCENT, borderColor: ACCENT },
                  { opacity: pressed ? 0.7 : 1 },
                ]}>
                {state === 'sending' ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : sent ? (
                  <>
                    <FontAwesome name="check" size={11} color={ACCENT} />
                    <Text style={[s.sendText, { color: ACCENT }]}>Sent</Text>
                  </>
                ) : (
                  <Text style={[s.sendText, { color: '#fff' }]}>{state === 'failed' ? 'Retry' : 'Send'}</Text>
                )}
              </Pressable>
            </View>
          );
        }}
      />
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[s.sheet, searchOpen ? s.sheetSearching : s.sheetResting, { backgroundColor: sheetBg }]}>
          <View style={s.handle} />
          <View style={s.titleRow}>
            <View style={s.titleText}>
              <Text style={[s.title, { color: colors.text }]}>Send to a Friend</Text>
              <Text style={[s.subtitle, { color: colors.subtext }]} numberOfLines={1}>
                {album.title} · {album.artist}
              </Text>
            </View>
            {friends && friends.length > 0 && (
              <Pressable
                onPress={toggleSearch}
                hitSlop={6}
                style={({ pressed }) => [s.searchBtn, {
                  backgroundColor: searchOpen ? colors.tint : colors.surface,
                  borderColor: colors.border,
                  opacity: pressed ? 0.7 : 1,
                }]}>
                <Ionicons name="search-outline" size={13} color={searchOpen ? '#fff' : colors.tint} />
              </Pressable>
            )}
          </View>
          {searchOpen && (
            <View style={[s.searchBar, { borderBottomColor: divider }]}>
              <FontAwesome name="search" size={14} color={colors.subtext} />
              <TextInput
                ref={searchInputRef}
                style={[s.searchInput, { color: colors.text }]}
                value={query}
                onChangeText={setQuery}
                placeholder="Search friends…"
                placeholderTextColor={colors.subtext}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
            </View>
          )}
          {body}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', paddingTop: 60 },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 12, paddingBottom: 40 },
  sheetResting: { maxHeight: '75%' },
  // While searching the sheet fills the screen below the status bar (the
  // overlay's paddingTop) and the keyboard simply covers the bottom of the
  // list. It used to sit in a KeyboardAvoidingView, but inside this Modal that
  // over-shot by ~250pt on real devices (iOS and Android) and pushed the title
  // and search bar off the top of the screen. Nothing here moves with the
  // keyboard now, so it can't overshoot.
  sheetSearching: { flex: 1 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#4a3020', alignSelf: 'center', marginBottom: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 8, gap: 12 },
  titleText: { flex: 1 },
  title: { fontSize: 17, fontWeight: '700' },
  subtitle: { fontSize: 13, marginTop: 2 },
  searchBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  searchInput: { flex: 1, fontSize: 15, height: 36 },
  list: { flexGrow: 0, flexShrink: 1 },
  empty: { fontSize: 14, lineHeight: 20, paddingHorizontal: 20, paddingVertical: 24, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 11, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarInitial: { fontSize: 16, fontWeight: '600' },
  rowText: { flex: 1, gap: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  username: { fontSize: 12 },
  sendBtn: { minWidth: 72, height: 32, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  sendText: { fontSize: 13, fontWeight: '600' },
});
