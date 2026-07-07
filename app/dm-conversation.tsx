import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Modal,
  SafeAreaView,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useRef, useCallback } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useAuth } from '@/context/AuthContext';
import { useAlbums } from '@/context/AlbumsContext';
import { useNotifications } from '@/context/NotificationsContext';
import { supabase } from '@/lib/supabase';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { type ColorsShape } from '@/constants/Colors';
import { usePro } from '@/context/ProContext';
import { getProTheme, themeToColors } from '@/lib/proThemes';

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT = '#D4A017';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
const POLL_INTERVAL_MS = 5000;

// ─── Types ────────────────────────────────────────────────────────────────────

type ColorsType = ColorsShape;

type MessageType = 'text' | 'album';

type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string | null;
  type: MessageType;
  album_data: {
    id: string;
    title: string;
    artist: string;
    artworkUrl: string;
    year?: number;
    sender_rating?: number;
    sender_review?: string;
  } | null;
  created_at: string;
};

type AlbumResult = {
  id: string;
  title: string;
  artist: string;
  artworkUrl: string;
  year?: number;
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DMConversationScreen() {
  const colorScheme  = useColorScheme();
  const { isPro, proTheme } = usePro();
  const colors = (isPro && proTheme !== 'default')
    ? themeToColors(getProTheme(proTheme))
    : Colors[colorScheme ?? 'dark'] as typeof Colors.dark;
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();

  const { userId: otherUserId } = useLocalSearchParams<{ userId: string }>();
  const { user }   = useAuth();
  const { loggedAlbums } = useAlbums();
  const { markMessagesRead } = useNotifications();
  const navigation = useNavigation();
  const router     = useRouter();

  const [messages,     setMessages]     = useState<Message[]>([]);
  const [loadingMsgs,  setLoadingMsgs]  = useState(true);
  const [inputText,    setInputText]    = useState('');
  const [sending,      setSending]      = useState(false);

  // Album search sheet
  const [albumSheetVisible,  setAlbumSheetVisible]  = useState(false);
  const [albumQuery,         setAlbumQuery]         = useState('');
  const [albumResults,       setAlbumResults]       = useState<AlbumResult[]>([]);
  const [albumSearchLoading, setAlbumSearchLoading] = useState(false);

  // Other user's reviews for album messages (keyed by album id, with title+artist fallback key)
  const [otherUserReviews, setOtherUserReviews] = useState<Record<string, { rating?: number; review?: string }>>({});

  const listRef       = useRef<FlatList<Message>>(null);
  const pollTimer     = useRef<ReturnType<typeof setInterval> | null>(null);
  const albumDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Set header title to other user's name ───────────────────────────────────
  useEffect(() => {
    if (!otherUserId) return;
    supabase
      .from('profiles')
      .select('display_name, username')
      .eq('id', otherUserId)
      .single()
      .then(({ data }) => {
        if (data) {
          const name = data.display_name || data.username || 'Message';
          navigation.setOptions({
            headerTitle: () => (
              <Pressable onPress={() => router.push({ pathname: '/user-profile', params: { userId: otherUserId } })}>
                <Text style={{ color: '#f5e6c8', fontSize: 17, fontWeight: '700' }}>{name}</Text>
              </Pressable>
            ),
          });
        }
      });
  }, [otherUserId, navigation, router]);

  // ── Load messages + start polling ───────────────────────────────────────────
  useEffect(() => {
    if (!user || !otherUserId) return;

    fetchMessages();

    pollTimer.current = setInterval(fetchMessages, POLL_INTERVAL_MS);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [user, otherUserId]);

  // ── Mark any unread message notifications from this sender as read ───────────
  useEffect(() => {
    if (!user || !otherUserId) return;
    markMessagesRead(otherUserId);
  }, [user?.id, otherUserId]);

  // ── Pre-load the other user's reviews as soon as the screen opens ────────────
  useEffect(() => {
    if (!otherUserId) return;
    fetchOtherUserReviews();
  }, [otherUserId]);


  async function fetchMessages() {
    if (!user || !otherUserId) return;

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),` +
        `and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`
      )
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[DMConversation] fetch error:', error);
    } else {
      setMessages(data ?? []);
      fetchOtherUserReviews();
    }
    setLoadingMsgs(false);
  }

  async function fetchOtherUserReviews() {
    if (!otherUserId) return;

    const { data } = await supabase
      .from('user_albums')
      .select('spotify_id, title, artist, rating, review')
      .eq('user_id', otherUserId);

    if (!data) return;

    const map: Record<string, { rating?: number; review?: string }> = {};
    data.forEach(row => {
      if (row.spotify_id) map[row.spotify_id] = { rating: row.rating ?? undefined, review: row.review ?? undefined };
      const fallbackKey = `${row.title?.toLowerCase()}::${row.artist?.toLowerCase()}`;
      map[fallbackKey] = { rating: row.rating ?? undefined, review: row.review ?? undefined };
    });
    setOtherUserReviews(map);
  }

  async function notifyRecipient() {
    if (!user || !otherUserId) return;
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', otherUserId)
      .eq('type', 'message')
      .eq('actor_id', user.id)
      .eq('read', false);
    if ((count ?? 0) === 0) {
      supabase.from('notifications').insert({
        user_id:  otherUserId,
        type:     'message',
        actor_id: user.id,
      }).then(({ error }) => {
        if (error) console.error('[DMConversation] notification insert error:', error.message);
      });
    }
  }

  // ── Send text message ────────────────────────────────────────────────────────
  async function sendText() {
    const text = inputText.trim();
    if (!text || !user || !otherUserId || sending) return;
    setSending(true);
    setInputText('');

    const { error } = await supabase.from('messages').insert({
      sender_id:   user.id,
      receiver_id: otherUserId,
      content:     text,
      type:        'text',
    });

    if (error) {
      console.error('[DMConversation] send error:', error);
      setInputText(text);
    } else {
      fetchMessages();
      notifyRecipient();
    }
    setSending(false);
  }

  // ── Send album message ───────────────────────────────────────────────────────
  async function sendAlbum(album: AlbumResult) {
    if (!user || !otherUserId) return;
    setAlbumSheetVisible(false);
    setAlbumQuery('');
    setAlbumResults([]);

    const loggedEntry = loggedAlbums.find(a => a.id === album.id)
      ?? loggedAlbums.find(a =>
          a.title.toLowerCase() === album.title.toLowerCase() &&
          a.artist.toLowerCase() === album.artist.toLowerCase()
        );
    const albumDataWithRating = {
      ...album,
      ...(loggedEntry && (loggedEntry.lastRating ?? loggedEntry.rating) > 0 ? { sender_rating: loggedEntry.lastRating ?? loggedEntry.rating } : {}),
      ...(loggedEntry && (loggedEntry.lastReview ?? loggedEntry.review) ? { sender_review: loggedEntry.lastReview ?? loggedEntry.review } : {}),
    };

    const { error } = await supabase.from('messages').insert({
      sender_id:   user.id,
      receiver_id: otherUserId,
      content:     album.title,
      type:        'album',
      album_data:  albumDataWithRating,
    });

    if (error) {
      console.error('[DMConversation] send album error:', error);
    } else {
      fetchMessages();
      notifyRecipient();
    }
  }

  // ── Album search ─────────────────────────────────────────────────────────────
  function handleAlbumQueryChange(text: string) {
    setAlbumQuery(text);
    if (albumDebounce.current) clearTimeout(albumDebounce.current);
    if (!text.trim() || text.trim().length < 2) { setAlbumResults([]); return; }
    albumDebounce.current = setTimeout(() => searchAlbums(text), 700);
  }

  async function searchAlbums(q: string) {
    setAlbumSearchLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/search?q=${encodeURIComponent(q.trim())}&type=album`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: AlbumResult[] = await res.json();
      setAlbumResults(data);
    } catch (e) {
      console.error('[DMConversation] album search error:', e);
      setAlbumResults([]);
    } finally {
      setAlbumSearchLoading(false);
    }
  }


  // ── Render ───────────────────────────────────────────────────────────────────

  if (loadingMsgs) {
    return (
      <View style={[s.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.tint} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={headerHeight}>

      {/* ── Message list ───────────────────────────────────────────────────── */}
      <FlatList
        ref={listRef}
        data={[...messages].reverse()}
        keyExtractor={m => m.id}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        inverted
        renderItem={({ item, index }) => {
          const reversedMsgs = [...messages].reverse();
          const isMe    = item.sender_id === user?.id;
          // index+1 in the reversed array = the chronologically older message
          const prevMsg = reversedMsgs[index + 1] as Message | undefined;
          const showDate =
            !prevMsg ||
            new Date(item.created_at).toDateString() !==
              new Date(prevMsg.created_at).toDateString();

          return (
            <>
              {item.type === 'album' && item.album_data ? (
                <AlbumCard
                  album={item.album_data}
                  isMe={isMe}
                  colors={colors}
                  senderRating={item.album_data.sender_rating}
                  senderReview={item.album_data.sender_review}
                  myLoggedEntry={(() => {
                    const ad = item.album_data!;
                    const fallbackKey = `${ad.title.toLowerCase()}::${ad.artist.toLowerCase()}`;
                    if (isMe) {
                      return otherUserReviews[ad.id] ?? otherUserReviews[fallbackKey];
                    } else {
                      return (
                        loggedAlbums.find(a => a.id === ad.id)
                        ?? loggedAlbums.find(a =>
                            a.title.toLowerCase() === ad.title.toLowerCase() &&
                            a.artist.toLowerCase() === ad.artist.toLowerCase()
                          )
                      );
                    }
                  })()}
                  onPress={() =>
                    router.push({
                      pathname: '/album-detail',
                      params: {
                        id:         item.album_data!.id,
                        title:      item.album_data!.title,
                        artist:     item.album_data!.artist,
                        year:       String(item.album_data!.year ?? ''),
                        artworkUrl: item.album_data!.artworkUrl,
                      },
                    })
                  }
                />
              ) : (
                <TextBubble text={item.content ?? ''} isMe={isMe} time={item.created_at} colors={colors} />
              )}
              {/* In an inverted list, rendering AFTER the bubble puts it visually ABOVE */}
              {showDate && (
                <Text style={[s.dateSeparator, { color: colors.subtext }]}>
                  {new Date(item.created_at).toLocaleDateString([], {
                    weekday: 'long', month: 'short', day: 'numeric',
                  })}
                </Text>
              )}
            </>
          );
        }}
      />

      {/* ── Input bar ──────────────────────────────────────────────────────── */}
      <View style={[s.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: 10 + insets.bottom }]}>
        <Pressable
          style={({ pressed }) => [s.albumBtn, {
            backgroundColor: colors.elevated,
            borderColor: colors.border,
            opacity: pressed ? 0.7 : 1,
          }]}
          onPress={() => setAlbumSheetVisible(true)}
          hitSlop={8}>
          <FontAwesome name="music" size={18} color={colors.tint} />
        </Pressable>

        <TextInput
          style={[s.textInput, {
            backgroundColor: colors.background,
            borderColor: colors.border,
            color: colors.text,
          }]}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Message…"
          placeholderTextColor={colors.subtext}
          multiline
          maxLength={1000}
          returnKeyType="default"
        />

        <Pressable
          style={({ pressed }) => [
            s.sendBtn,
            { backgroundColor: colors.tint },
            (!inputText.trim() || sending) && s.sendBtnDisabled,
            { opacity: pressed ? 0.7 : 1 },
          ]}
          onPress={sendText}
          disabled={!inputText.trim() || sending}
          hitSlop={8}>
          <FontAwesome name="send" size={16} color="#fff" />
        </Pressable>
      </View>

      {/* ── Album search sheet ─────────────────────────────────────────────── */}
      <Modal
        visible={albumSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAlbumSheetVisible(false)}>
        <KeyboardAvoidingView
          style={as.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setAlbumSheetVisible(false)} />
          <SafeAreaView style={[as.sheet, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            {/* Handle + header */}
            <View style={[as.handle, { backgroundColor: colors.border }]} />
            <View style={as.header}>
              <Text style={[as.title, { color: colors.text }]}>Send an Album</Text>
              <Pressable onPress={() => setAlbumSheetVisible(false)} hitSlop={12}>
                <FontAwesome name="times" size={18} color={colors.subtext} />
              </Pressable>
            </View>

            {/* Search input */}
            <View style={[as.searchBar, { backgroundColor: colors.background }]}>
              <FontAwesome name="search" size={14} color={colors.subtext} style={{ marginTop: 1 }} />
              <TextInput
                style={[as.searchInput, { color: colors.text }]}
                value={albumQuery}
                onChangeText={handleAlbumQueryChange}
                placeholder="Search albums…"
                placeholderTextColor={colors.subtext}
                autoFocus
                autoCorrect={false}
                autoCapitalize="none"
              />
              {albumQuery.length > 0 && (
                <Pressable onPress={() => { setAlbumQuery(''); setAlbumResults([]); }} hitSlop={8}>
                  <FontAwesome name="times-circle" size={14} color={colors.subtext} />
                </Pressable>
              )}
            </View>

            {/* Results */}
            {albumSearchLoading ? (
              <ActivityIndicator color={colors.tint} style={{ marginTop: 32 }} />
            ) : (
              <FlatList
                data={albumResults}
                keyExtractor={a => a.id}
                contentContainerStyle={{ paddingBottom: 20 }}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <Pressable
                    style={({ pressed }) => [as.result, { opacity: pressed ? 0.7 : 1 }]}
                    onPress={() => sendAlbum(item)}>
                    {item.artworkUrl ? (
                      <ExpoImage source={{ uri: item.artworkUrl }} style={as.artwork} 
            contentFit="cover" cachePolicy="disk"
          />
                    ) : (
                      <View style={[as.artwork, { backgroundColor: colors.border }]} />
                    )}
                    <View style={as.resultText}>
                      <Text style={[as.resultTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
                      <Text style={[as.resultSub, { color: colors.subtext }]} numberOfLines={1}>
                        {item.artist}{item.year ? ` · ${item.year}` : ''}
                      </Text>
                    </View>
                    <FontAwesome name="paper-plane-o" size={14} color={colors.tint} />
                  </Pressable>
                )}
              />
            )}
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

    </KeyboardAvoidingView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TextBubble({ text, isMe, time, colors }: { text: string; isMe: boolean; time: string; colors: ColorsType }) {
  return (
    <View style={[b.row, isMe ? b.rowMe : b.rowThem]}>
      <View style={[b.bubble, isMe ? [b.bubbleMe, { backgroundColor: colors.tint }] : { ...b.bubbleThem, backgroundColor: colors.surface }]}>
        <Text style={[b.text, isMe ? b.textMe : { color: colors.text }]}>{text}</Text>
        <Text style={[b.time, isMe ? b.timeMe : { color: colors.subtext }]}>
          {new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );
}

function AlbumCard({
  album,
  isMe,
  colors,
  senderRating,
  senderReview,
  myLoggedEntry,
  onPress,
}: {
  album: { id: string; title: string; artist: string; artworkUrl: string; year?: number };
  isMe: boolean;
  colors: ColorsType;
  senderRating?: number;
  senderReview?: string;
  myLoggedEntry?: { rating?: number; review?: string } | undefined;
  onPress: () => void;
}) {
  // myLoggedEntry = other user's data when isMe, own data when not isMe
  const recipientRating = myLoggedEntry?.rating && myLoggedEntry.rating > 0 ? myLoggedEntry.rating : undefined;
  const recipientReview = myLoggedEntry?.review ?? undefined;

  const senderLabel    = isMe ? 'You' : 'Them';
  const recipientLabel = isMe ? 'Them' : 'You';

  return (
    <View style={[b.row, isMe ? b.rowMe : b.rowThem]}>
      <Pressable
        style={({ pressed }) => [b.albumCard, {
          backgroundColor: colors.elevated,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        }]}
        onPress={onPress}>

        {/* Top: artwork + album meta */}
        <View style={b.albumTop}>
          {album.artworkUrl ? (
            <ExpoImage source={{ uri: album.artworkUrl }} style={b.albumArt} contentFit="cover" cachePolicy="disk" />
          ) : (
            <View style={[b.albumArt, { backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' }]}>
              <FontAwesome name="music" size={20} color={colors.subtext} />
            </View>
          )}
          <View style={b.albumMeta}>
            <Text style={[b.albumTitle, { color: colors.text }]} numberOfLines={2}>{album.title}</Text>
            <Text style={[b.albumArtist, { color: colors.subtext }]} numberOfLines={1}>{album.artist}</Text>
            {album.year ? <Text style={[b.albumYear, { color: colors.subtext }]}>{album.year}</Text> : null}
          </View>
          <FontAwesome name="chevron-right" size={11} color={colors.subtext} style={{ alignSelf: 'center', marginLeft: 4 }} />
        </View>

        {/* Only show review section if at least one person has logged it */}
        {(senderRating || senderReview || recipientRating || recipientReview) && (
          <>
            <View style={[b.reviewDivider, { backgroundColor: colors.border }]} />

            {(senderRating || senderReview) && (
              <View style={b.reviewSection}>
                <View style={b.reviewSectionHeader}>
                  <Text style={[b.reviewSectionLabel, { color: colors.subtext }]}>{senderLabel}</Text>
                  {senderRating ? (
                    <View style={[b.ratingBadge, { backgroundColor: colors.tint }]}>
                      <FontAwesome name="volume-up" size={8} color="#fff" />
                      <Text style={b.ratingBadgeText}>{senderRating}</Text>
                    </View>
                  ) : null}
                </View>
                {senderReview ? (
                  <Text style={[b.reviewText, { color: colors.subtext }]} numberOfLines={2}>"{senderReview}"</Text>
                ) : null}
              </View>
            )}

            {(recipientRating || recipientReview) && (
              <View style={b.reviewSection}>
                <View style={b.reviewSectionHeader}>
                  <Text style={[b.reviewSectionLabel, { color: colors.subtext }]}>{recipientLabel}</Text>
                  {recipientRating ? (
                    <View style={[b.ratingBadge, { backgroundColor: colors.tint }]}>
                      <FontAwesome name="volume-up" size={8} color="#fff" />
                      <Text style={b.ratingBadgeText}>{recipientRating}</Text>
                    </View>
                  ) : null}
                </View>
                {recipientReview ? (
                  <Text style={[b.reviewText, { color: colors.subtext }]} numberOfLines={2}>"{recipientReview}"</Text>
                ) : null}
              </View>
            )}
          </>
        )}

      </Pressable>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:   { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  listContent: { paddingHorizontal: 12, paddingTop: 16, paddingBottom: 12, gap: 2 },

  dateSeparator: {
    fontSize: 12, textAlign: 'center',
    marginVertical: 12,
  },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 10 : 10,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  albumBtn: {
    width: 36, height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'flex-end', marginBottom: 1,
  },
  textInput: {
    flex: 1,
    minHeight: 36,
    maxHeight: 120,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 15,
  },
  sendBtn: {
    width: 36, height: 36,
    borderRadius: 18,
    backgroundColor: ACCENT,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'flex-end', marginBottom: 1,
  },
  sendBtnDisabled: { opacity: 0.4 },
});

// Chat bubble styles
const b = StyleSheet.create({
  row:    { flexDirection: 'row', marginVertical: 3 },
  rowMe:  { justifyContent: 'flex-end' },
  rowThem:{ justifyContent: 'flex-start' },

  bubble: {
    maxWidth: '75%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 4,
  },
  bubbleMe:   { backgroundColor: ACCENT, borderBottomRightRadius: 4 },
  bubbleThem: { borderBottomLeftRadius: 4 },

  text:   { fontSize: 15, lineHeight: 21 },
  textMe: { color: '#fff' },

  time:   { fontSize: 10, alignSelf: 'flex-end' },
  timeMe: { color: 'rgba(255,255,255,0.6)' },

  // Album card
  albumCard: {
    maxWidth: 280,
    borderRadius: 14,
    overflow: 'hidden',
    padding: 12,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },

  albumTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  albumArt: {
    width: 52, height: 52,
    borderRadius: 6,
    flexShrink: 0,
  },
  albumMeta: { flex: 1, gap: 2, paddingTop: 1 },
  albumTitle:  { fontSize: 13, fontWeight: '700', lineHeight: 17 },
  albumArtist: { fontSize: 12 },
  albumYear:   { fontSize: 11 },

  reviewDivider: { height: StyleSheet.hairlineWidth },

  reviewSection: { gap: 4 },
  reviewSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewSectionLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: ACCENT,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ratingBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  reviewText:        { fontSize: 12, fontStyle: 'italic', lineHeight: 16 },
  reviewPlaceholder: { fontSize: 12, fontStyle: 'italic' },
});

// Album search sheet styles
const as = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    flexShrink: 1,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10, marginBottom: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: { fontSize: 17, fontWeight: '700' },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, height: '100%' },

  result: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  artwork: { width: 48, height: 48, borderRadius: 4 },
  resultText:  { flex: 1, gap: 3 },
  resultTitle: { fontSize: 14, fontWeight: '600' },
  resultSub:   { fontSize: 12 },
});
