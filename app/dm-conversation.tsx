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
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  ZoomIn,
  ZoomOut,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  interpolate,
  Extrapolation,
  runOnJS,
} from 'react-native-reanimated';
import { useAuth } from '@/context/AuthContext';
import { useAlbums } from '@/context/AlbumsContext';
import { useNotifications } from '@/context/NotificationsContext';
import { supabase } from '@/lib/supabase';
import { nameOrHandle } from '@/lib/userHandle';
import { fetchAllRows } from '@/lib/supabaseQuery';
import { notifyMessageRecipient, sendAlbumMessage } from '@/lib/directMessages';
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
  // Ids of whoever liked it (double-tap). Missing until add-message-likes.sql has run.
  liked_by?: string[] | null;
  // The message this one answers (swipe to reply). Missing until add-message-replies.sql has run.
  reply_to?: string | null;
};

// Swipe a message this far right to reply to it.
const REPLY_SWIPE = 56;

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

  const [otherName,    setOtherName]    = useState<string | null>(null);
  const [messages,     setMessages]     = useState<Message[]>([]);
  const [loadingMsgs,  setLoadingMsgs]  = useState(true);
  // Height of the on-screen keyboard, Android only. Under edge-to-edge the app
  // window is already full-screen, so `adjustResize` never moves anything and
  // nothing lifts the input bar off the keyboard on its own — we apply the IME
  // inset ourselves. `keyboardDidHide` always fires, so this returns to 0 and
  // can't leave a gap behind the way KeyboardAvoidingView's height math did.
  // Note this is measured from the top of the navigation bar, not the bottom
  // of the screen, so the input bar keeps its own `insets.bottom` on top.
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [inputText,    setInputText]    = useState('');
  const [sending,      setSending]      = useState(false);
  // The message being replied to, shown above the input until sent or cancelled.
  const [replyTo,      setReplyTo]      = useState<Message | null>(null);
  // Briefly tints the original after tapping a reply's quote to jump to it.
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // Album search sheet
  const [albumSheetVisible,  setAlbumSheetVisible]  = useState(false);
  const [albumQuery,         setAlbumQuery]         = useState('');
  const [albumResults,       setAlbumResults]       = useState<AlbumResult[]>([]);
  const [albumSearchLoading, setAlbumSearchLoading] = useState(false);

  // Other user's reviews for album messages (keyed by album id, with title+artist fallback key)
  const [otherUserReviews, setOtherUserReviews] = useState<Record<string, { rating?: number; review?: string }>>({});

  // Likes the server hasn't confirmed yet, so a poll landing mid-request
  // doesn't flash the heart back to its old state.
  const pendingLikes  = useRef<Map<string, boolean>>(new Map());

  const listRef       = useRef<FlatList<Message>>(null);
  const inputRef      = useRef<TextInput>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimer     = useRef<ReturnType<typeof setInterval> | null>(null);
  const albumDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Set header title to other user's name ───────────────────────────────────
  useEffect(() => {
    if (!otherUserId) return;
    supabase
      .from('profiles')
      .select('id, display_name, username')
      .eq('id', otherUserId)
      .single()
      .then(({ data }) => {
        if (data) setOtherName(nameOrHandle(data.display_name, data.username, (data as any).id, 'Message'));
      });
  }, [otherUserId]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const onShow = Keyboard.addListener('keyboardDidShow', e => setKeyboardHeight(e.endCoordinates.height));
    const onHide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => { onShow.remove(); onHide.remove(); };
  }, []);

  // React Navigation paints its own container behind this screen, and in
  // light mode that colour is a near-white grey. Any moment the content
  // doesn't reach the bottom of the window, that grey is what shows through —
  // so a themed container makes a stray gap invisible rather than glaring.
  //
  // The header follows the active theme too — _layout.tsx's default is the
  // dark-mode brown, which sat on top of light mode and every pro theme.
  useEffect(() => {
    navigation.setOptions({
      contentStyle: { backgroundColor: colors.background },
      headerStyle: { backgroundColor: colors.background },
      headerTintColor: colors.text,
      headerShadowVisible: false,
      ...(otherName && {
        headerTitle: () => (
          <Pressable onPress={() => router.push({ pathname: '/user-profile', params: { userId: otherUserId } })}>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>{otherName}</Text>
          </Pressable>
        ),
      }),
    });
  }, [navigation, router, otherUserId, otherName, colors.background, colors.text]);

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
      setMessages(applyPendingLikes(data ?? []));
      fetchOtherUserReviews();
    }
    setLoadingMsgs(false);
  }

  function withMyLike(m: Message, like: boolean): Message {
    if (!user) return m;
    const others = (m.liked_by ?? []).filter(id => id !== user.id);
    return { ...m, liked_by: like ? [...others, user.id] : others };
  }

  function applyPendingLikes(rows: Message[]): Message[] {
    if (pendingLikes.current.size === 0) return rows;
    return rows.map(m => pendingLikes.current.has(m.id) ? withMyLike(m, pendingLikes.current.get(m.id)!) : m);
  }

  // ── Like / unlike a message (double-tap) ─────────────────────────────────────
  async function toggleLike(message: Message) {
    if (!user) return;
    const like = !(message.liked_by ?? []).includes(user.id);
    pendingLikes.current.set(message.id, like);
    setMessages(prev => prev.map(m => m.id === message.id ? withMyLike(m, like) : m));

    const { data, error } = await supabase.rpc('toggle_message_like', { p_message_id: message.id, p_like: like });
    // Only settle if this is still the latest toggle for the message.
    if (pendingLikes.current.get(message.id) !== like) return;
    pendingLikes.current.delete(message.id);
    if (error) {
      console.error('[DMConversation] like error:', error.message);
      setMessages(prev => prev.map(m => m.id === message.id ? withMyLike(m, !like) : m));
    } else {
      setMessages(prev => prev.map(m => m.id === message.id ? { ...m, liked_by: (data as string[] | null) ?? [] } : m));
    }
  }

  async function fetchOtherUserReviews() {
    if (!otherUserId) return;

    // Paged — a single select stops at 1000 rows, so a large library lost
    // the rating/review on cards for albums past the first page.
    const data = await fetchAllRows<{ spotify_id: string | null; title: string | null; artist: string | null; rating: number | null; review: string | null }>(
      (from, to) => supabase
        .from('user_albums')
        .select('spotify_id, title, artist, rating, review')
        .eq('user_id', otherUserId)
        .order('spotify_id')
        .range(from, to),
      20,
    );

    if (!data) return;

    const map: Record<string, { rating?: number; review?: string }> = {};
    data.forEach(row => {
      if (row.spotify_id) map[row.spotify_id] = { rating: row.rating ?? undefined, review: row.review ?? undefined };
      const fallbackKey = `${row.title?.toLowerCase()}::${row.artist?.toLowerCase()}`;
      map[fallbackKey] = { rating: row.rating ?? undefined, review: row.review ?? undefined };
    });
    setOtherUserReviews(map);
  }

  function notifyRecipient() {
    if (!user || !otherUserId) return;
    notifyMessageRecipient(user.id, otherUserId);
  }

  // ── Send text message ────────────────────────────────────────────────────────
  async function sendText() {
    const text = inputText.trim();
    if (!text || !user || !otherUserId || sending) return;
    const replyingTo = replyTo;
    setSending(true);
    setInputText('');
    setReplyTo(null);

    const row = {
      sender_id:   user.id,
      receiver_id: otherUserId,
      content:     text,
      type:        'text',
    };
    let { error } = await supabase.from('messages').insert(
      replyingTo ? { ...row, reply_to: replyingTo.id } : row
    );
    // PGRST204 = no reply_to column yet (add-message-replies.sql not run).
    // Send it as a plain message rather than losing it.
    if (error?.code === 'PGRST204' && replyingTo) {
      ({ error } = await supabase.from('messages').insert(row));
    }

    if (error) {
      console.error('[DMConversation] send error:', error);
      setInputText(text);
      setReplyTo(replyingTo);
    } else {
      fetchMessages();
      notifyRecipient();
    }
    setSending(false);
  }

  // ── Reply (swipe a message right) ───────────────────────────────────────────
  function startReply(message: Message) {
    setReplyTo(message);
    inputRef.current?.focus();
  }

  function senderLabel(m: Message) {
    return m.sender_id === user?.id ? 'You' : (otherName ?? 'Them');
  }

  // Tapping a reply's quote scrolls back to the message it answers.
  function jumpToMessage(id: string) {
    const index = [...messages].reverse().findIndex(m => m.id === id);
    if (index < 0) return;
    listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true });
    setHighlightedId(id);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightedId(null), 1400);
  }

  // ── Send album message ───────────────────────────────────────────────────────
  async function sendAlbum(album: AlbumResult) {
    if (!user || !otherUserId) return;
    setAlbumSheetVisible(false);
    setAlbumQuery('');
    setAlbumResults([]);

    if (await sendAlbumMessage(user.id, otherUserId, album, loggedAlbums)) {
      fetchMessages();
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
    // iOS keeps KeyboardAvoidingView. Android drives its own padding from the
    // measured keyboard height instead: `behavior="height"` shrank the view by
    // keyboard + header and left that shortfall in place after the keyboard
    // closed (the "white space under the DMs"), while no behavior at all left
    // the input buried under the keyboard, because edge-to-edge means the
    // window never resizes for the IME in the first place.
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: colors.background, paddingBottom: keyboardHeight }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}>

      {/* ── Message list ───────────────────────────────────────────────────── */}
      <FlatList
        ref={listRef}
        data={[...messages].reverse()}
        keyExtractor={m => m.id}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        inverted
        // Rows vary in height, so a jump to a far-off quoted message can land
        // outside the rendered window: get roughly there, then aim again.
        onScrollToIndexFailed={info => {
          listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true });
          setTimeout(() => listRef.current?.scrollToIndex({ index: info.index, viewPosition: 0.5, animated: true }), 250);
        }}
        renderItem={({ item, index }) => {
          const reversedMsgs = [...messages].reverse();
          const isMe    = item.sender_id === user?.id;
          const quoted  = item.reply_to ? messages.find(m => m.id === item.reply_to) : undefined;
          // index+1 in the reversed array = the chronologically older message
          const prevMsg = reversedMsgs[index + 1] as Message | undefined;
          const showDate =
            !prevMsg ||
            new Date(item.created_at).toDateString() !==
              new Date(prevMsg.created_at).toDateString();

          return (
            <>
              <SwipeToReply onReply={() => startReply(item)} highlighted={highlightedId === item.id} colors={colors}>
              {item.type === 'album' && item.album_data ? (
                <AlbumCard
                  album={item.album_data}
                  isMe={isMe}
                  colors={colors}
                  likedBy={item.liked_by ?? []}
                  myId={user?.id}
                  onToggleLike={() => toggleLike(item)}
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
                <TextBubble
                  text={item.content ?? ''}
                  isMe={isMe}
                  time={item.created_at}
                  colors={colors}
                  likedBy={item.liked_by ?? []}
                  myId={user?.id}
                  onToggleLike={() => toggleLike(item)}
                  quote={quoted && (
                    <ReplyQuote
                      message={quoted}
                      name={senderLabel(quoted)}
                      onBubble={isMe}
                      colors={colors}
                      onPress={() => jumpToMessage(quoted.id)}
                    />
                  )}
                />
              )}
              </SwipeToReply>
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

      {/* ── Replying-to bar ────────────────────────────────────────────────── */}
      {replyTo && (
        <Animated.View
          entering={FadeIn.duration(150)}
          style={[s.replyBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <View style={[s.replyBarAccent, { backgroundColor: colors.tint }]} />
          <View style={s.replyBarText}>
            <Text style={[s.replyBarLabel, { color: colors.tint }]} numberOfLines={1}>
              Replying to {replyTo.sender_id === user?.id ? 'yourself' : (otherName ?? 'them')}
            </Text>
            <Text style={[s.replyBarSnippet, { color: colors.subtext }]} numberOfLines={1}>
              {messageSnippet(replyTo)}
            </Text>
          </View>
          <Pressable onPress={() => setReplyTo(null)} hitSlop={12} accessibilityLabel="Cancel reply">
            <FontAwesome name="times" size={16} color={colors.subtext} />
          </Pressable>
        </Animated.View>
      )}

      {/* ── Input bar ──────────────────────────────────────────────────────── */}
      <View style={[s.inputBar, {
        backgroundColor: colors.surface,
        borderTopColor: colors.border,
        // Keep the safe-area inset even while the keyboard is up: Android
        // reports the IME height measured from *above* the navigation bar, so
        // the root's keyboard padding alone leaves the bar a nav-bar's height
        // short and the keys cover it.
        paddingBottom: 10 + insets.bottom,
      }]}>
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
          ref={inputRef}
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

/** One-line description of a message, for the reply bar and quotes. */
function messageSnippet(m: Message) {
  if (m.type === 'album' && m.album_data) return `${m.album_data.title} · ${m.album_data.artist}`;
  return m.content ?? '';
}

/**
 * Swipe a message right to reply to it. The row follows the finger (with some
 * resistance) and a reply arrow fades in behind it; letting go past
 * REPLY_SWIPE starts the reply, and the row springs back either way. Only a
 * clearly sideways drag takes over, so scrolling the conversation and tapping
 * or double-tapping the bubble behave as before.
 */
function SwipeToReply({ onReply, highlighted, colors, children }: {
  onReply: () => void;
  highlighted: boolean;
  colors: ColorsType;
  children: React.ReactNode;
}) {
  const offset = useSharedValue(0);
  const flash  = useSharedValue(0);

  useEffect(() => {
    if (highlighted) {
      flash.value = withSequence(withTiming(1, { duration: 150 }), withDelay(700, withTiming(0, { duration: 500 })));
    }
  }, [highlighted]);

  const pan = Gesture.Pan()
    .activeOffsetX(12)
    .failOffsetY([-12, 12])
    .onUpdate(e => {
      offset.value = Math.max(0, Math.min(REPLY_SWIPE + 24, e.translationX * 0.6));
    })
    .onEnd(() => {
      if (offset.value >= REPLY_SWIPE) runOnJS(onReply)();
    })
    .onFinalize(() => {
      offset.value = withSpring(0, { damping: 18, stiffness: 220 });
    });

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  const iconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(offset.value, [16, REPLY_SWIPE], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(offset.value, [16, REPLY_SWIPE], [0.6, 1], Extrapolation.CLAMP) }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <View>
        {/* Always mounted and faded by opacity: toggling a background colour
            on and off didn't reliably repaint the row. */}
        <Animated.View pointerEvents="none" style={[b.flash, { backgroundColor: colors.tint + '33' }, flashStyle]} />
        <Animated.View style={[b.replyIcon, iconStyle]}>
          <FontAwesome name="reply" size={14} color={colors.subtext} />
        </Animated.View>
        <Animated.View style={rowStyle}>{children}</Animated.View>
      </View>
    </GestureDetector>
  );
}

/** The quoted original at the top of a reply bubble; tap to jump to it. */
function ReplyQuote({ message, name, onBubble, colors, onPress }: {
  message: Message;
  name: string;
  onBubble: boolean;   // sits on your own (accent) bubble rather than theirs
  colors: ColorsType;
  onPress: () => void;
}) {
  const album = message.type === 'album' ? message.album_data : null;
  return (
    <Pressable
      onPress={onPress}
      style={[b.quote, onBubble
        ? { backgroundColor: 'rgba(255,255,255,0.18)', borderLeftColor: 'rgba(255,255,255,0.85)' }
        : { backgroundColor: colors.background, borderLeftColor: colors.tint }]}>
      <Text style={[b.quoteName, { color: onBubble ? '#fff' : colors.tint }]} numberOfLines={1}>{name}</Text>
      {album ? (
        <View style={b.quoteAlbum}>
          {album.artworkUrl ? (
            <ExpoImage source={{ uri: album.artworkUrl }} style={b.quoteArt} contentFit="cover" cachePolicy="disk" />
          ) : null}
          <Text style={[b.quoteText, { color: onBubble ? 'rgba(255,255,255,0.85)' : colors.subtext, flexShrink: 1 }]} numberOfLines={2}>
            {album.title} · {album.artist}
          </Text>
        </View>
      ) : (
        <Text style={[b.quoteText, { color: onBubble ? 'rgba(255,255,255,0.85)' : colors.subtext }]} numberOfLines={2}>
          {message.content}
        </Text>
      )}
    </Pressable>
  );
}

type LikeProps = {
  likedBy: string[];
  myId: string | undefined;
  onToggleLike: () => void;
};

// Taps give up once the finger travels this far, so a swipe-to-reply on an
// album card doesn't also open the album when the finger lifts.
const TAP_MAX_DIST = 10;

function useDoubleTap(onDoubleTap: () => void, onSingleTap?: () => void) {
  const double = Gesture.Tap().numberOfTaps(2).maxDelay(250).maxDistance(TAP_MAX_DIST).runOnJS(true).onEnd((_e, ok) => { if (ok) onDoubleTap(); });
  if (!onSingleTap) return double;
  const single = Gesture.Tap().maxDistance(TAP_MAX_DIST).runOnJS(true).onEnd((_e, ok) => { if (ok) onSingleTap(); });
  return Gesture.Exclusive(double, single);
}

/** Small heart under a liked message; tapping it takes your own like back. */
function LikeBadge({ likedBy, myId, onToggleLike, isMe, colors }: LikeProps & { isMe: boolean; colors: ColorsType }) {
  if (likedBy.length === 0) return null;
  const mine = !!myId && likedBy.includes(myId);
  return (
    <Animated.View entering={ZoomIn.springify().damping(12)} exiting={ZoomOut.duration(120)}
      style={[b.likeBadgeWrap, isMe ? { alignSelf: 'flex-end', marginRight: 10 } : { alignSelf: 'flex-start', marginLeft: 10 }]}>
      <Pressable
        onPress={mine ? onToggleLike : undefined}
        disabled={!mine}
        hitSlop={8}
        style={[b.likeBadge, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
        <FontAwesome name="heart" size={10} color={colors.tint} />
        {likedBy.length > 1 && <Text style={[b.likeCount, { color: colors.subtext }]}>{likedBy.length}</Text>}
      </Pressable>
    </Animated.View>
  );
}

function TextBubble({ text, isMe, time, colors, likedBy, myId, onToggleLike, quote }: { text: string; isMe: boolean; time: string; colors: ColorsType; quote?: React.ReactNode } & LikeProps) {
  const tap = useDoubleTap(onToggleLike);
  return (
    <View style={[b.row, isMe ? b.rowMe : b.rowThem]}>
      <View style={b.bubbleCol}>
        <GestureDetector gesture={tap}>
          <View style={[b.bubble, isMe ? [b.bubbleMe, { backgroundColor: colors.tint }] : { ...b.bubbleThem, backgroundColor: colors.surface }]}>
            {quote}
            <Text style={[b.text, isMe ? b.textMe : { color: colors.text }]}>{text}</Text>
            <Text style={[b.time, isMe ? b.timeMe : { color: colors.subtext }]}>
              {new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </GestureDetector>
        <LikeBadge likedBy={likedBy} myId={myId} onToggleLike={onToggleLike} isMe={isMe} colors={colors} />
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
  likedBy,
  myId,
  onToggleLike,
}: LikeProps & {
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

  // Single tap still opens the album; it waits out the double-tap window.
  const tap = useDoubleTap(onToggleLike, onPress);

  return (
    <View style={[b.row, isMe ? b.rowMe : b.rowThem]}>
      <View style={b.albumCol}>
      <GestureDetector gesture={tap}>
      <View
        style={[b.albumCard, {
          backgroundColor: colors.elevated,
          borderColor: colors.border,
        }]}>

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

      </View>
      </GestureDetector>
      <LikeBadge likedBy={likedBy} myId={myId} onToggleLike={onToggleLike} isMe={isMe} colors={colors} />
      </View>
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

  // Replying-to bar
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  replyBarAccent:  { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  replyBarText:    { flex: 1, gap: 1 },
  replyBarLabel:   { fontSize: 12, fontWeight: '700' },
  replyBarSnippet: { fontSize: 13 },
});

// Chat bubble styles
const b = StyleSheet.create({
  row:    { flexDirection: 'row', marginVertical: 3 },
  rowMe:  { justifyContent: 'flex-end' },
  rowThem:{ justifyContent: 'flex-start' },

  bubbleCol: { maxWidth: '75%' },
  flash:     { ...StyleSheet.absoluteFillObject, borderRadius: 12 },
  replyIcon: { position: 'absolute', left: 4, top: 0, bottom: 0, justifyContent: 'center' },

  // Quoted original inside a reply
  quote: {
    borderLeftWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 2,
    marginBottom: 2,
  },
  quoteName:  { fontSize: 12, fontWeight: '700' },
  quoteText:  { fontSize: 13, lineHeight: 17 },
  quoteAlbum: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  quoteArt:   { width: 24, height: 24, borderRadius: 3 },
  albumCol:  { width: 280, maxWidth: '85%' },
  likeBadgeWrap: { marginTop: -8, zIndex: 1 },
  likeBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth },
  likeCount: { fontSize: 10, fontWeight: '600' },

  bubble: {
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
