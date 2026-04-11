import {
  StyleSheet,
  View,
  Text,
  Image,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useState, useEffect, useRef, useCallback } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

// ─── Constants ────────────────────────────────────────────────────────────────

const DARK_BG   = '#0d0d0d';
const CARD_BG   = '#1a1a1a';
const BORDER    = '#2a2a2a';
const TEXT      = '#f0f0f0';
const SUBTEXT   = '#888';
const ACCENT    = '#FF3CAC';
const MY_BUBBLE = '#FF3CAC';
const THEIR_BG  = '#1e1e1e';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
const POLL_INTERVAL_MS = 5000;

// ─── Types ────────────────────────────────────────────────────────────────────

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
  const { userId: otherUserId } = useLocalSearchParams<{ userId: string }>();
  const { user }   = useAuth();
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

  const listRef        = useRef<FlatList<Message>>(null);
  const pollTimer      = useRef<ReturnType<typeof setInterval> | null>(null);
  const albumDebounce  = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          navigation.setOptions({
            title: data.display_name || data.username || 'Message',
          });
        }
      });
  }, [otherUserId, navigation]);

  // ── Load messages + start polling ───────────────────────────────────────────
  useEffect(() => {
    if (!user || !otherUserId) return;

    fetchMessages();

    pollTimer.current = setInterval(fetchMessages, POLL_INTERVAL_MS);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [user, otherUserId]);

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
    }
    setLoadingMsgs(false);
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
      setInputText(text); // restore on failure
    } else {
      fetchMessages();
    }
    setSending(false);
  }

  // ── Send album message ───────────────────────────────────────────────────────
  async function sendAlbum(album: AlbumResult) {
    if (!user || !otherUserId) return;
    setAlbumSheetVisible(false);
    setAlbumQuery('');
    setAlbumResults([]);

    const { error } = await supabase.from('messages').insert({
      sender_id:   user.id,
      receiver_id: otherUserId,
      content:     album.title,
      type:        'album',
      album_data:  album,
    });

    if (error) {
      console.error('[DMConversation] send album error:', error);
    } else {
      fetchMessages();
    }
  }

  // ── Album search ─────────────────────────────────────────────────────────────
  function handleAlbumQueryChange(text: string) {
    setAlbumQuery(text);
    if (albumDebounce.current) clearTimeout(albumDebounce.current);
    if (!text.trim()) { setAlbumResults([]); return; }
    albumDebounce.current = setTimeout(() => searchAlbums(text), 400);
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

  // ── Scroll to bottom when messages change ───────────────────────────────────
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 60);
    }
  }, [messages]);

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loadingMsgs) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={ACCENT} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={88}>

      {/* ── Message list ───────────────────────────────────────────────────── */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={m => m.id}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => {
          const isMe = item.sender_id === user?.id;
          const prevMsg = messages[index - 1];
          const showDate =
            !prevMsg ||
            new Date(item.created_at).toDateString() !==
              new Date(prevMsg.created_at).toDateString();

          return (
            <>
              {showDate && (
                <Text style={s.dateSeparator}>
                  {new Date(item.created_at).toLocaleDateString([], {
                    weekday: 'long', month: 'short', day: 'numeric',
                  })}
                </Text>
              )}
              {item.type === 'album' && item.album_data ? (
                <AlbumCard
                  album={item.album_data}
                  isMe={isMe}
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
                <TextBubble text={item.content ?? ''} isMe={isMe} time={item.created_at} />
              )}
            </>
          );
        }}
      />

      {/* ── Input bar ──────────────────────────────────────────────────────── */}
      <View style={s.inputBar}>
        <Pressable
          style={({ pressed }) => [s.albumBtn, { opacity: pressed ? 0.7 : 1 }]}
          onPress={() => setAlbumSheetVisible(true)}
          hitSlop={8}>
          <FontAwesome name="music" size={18} color={ACCENT} />
        </Pressable>

        <TextInput
          style={s.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Message…"
          placeholderTextColor={SUBTEXT}
          multiline
          maxLength={1000}
          returnKeyType="default"
        />

        <Pressable
          style={({ pressed }) => [
            s.sendBtn,
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
        <View style={as.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setAlbumSheetVisible(false)} />
          <SafeAreaView style={as.sheet}>
            {/* Handle + header */}
            <View style={as.handle} />
            <View style={as.header}>
              <Text style={as.title}>Send an Album</Text>
              <Pressable onPress={() => setAlbumSheetVisible(false)} hitSlop={12}>
                <FontAwesome name="times" size={18} color={SUBTEXT} />
              </Pressable>
            </View>

            {/* Search input */}
            <View style={as.searchBar}>
              <FontAwesome name="search" size={14} color={SUBTEXT} style={{ marginTop: 1 }} />
              <TextInput
                style={as.searchInput}
                value={albumQuery}
                onChangeText={handleAlbumQueryChange}
                placeholder="Search albums…"
                placeholderTextColor={SUBTEXT}
                autoFocus
                autoCorrect={false}
                autoCapitalize="none"
              />
              {albumQuery.length > 0 && (
                <Pressable onPress={() => { setAlbumQuery(''); setAlbumResults([]); }} hitSlop={8}>
                  <FontAwesome name="times-circle" size={14} color={SUBTEXT} />
                </Pressable>
              )}
            </View>

            {/* Results */}
            {albumSearchLoading ? (
              <ActivityIndicator color={ACCENT} style={{ marginTop: 32 }} />
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
                      <Image source={{ uri: item.artworkUrl }} style={as.artwork} />
                    ) : (
                      <View style={[as.artwork, as.artworkFallback]} />
                    )}
                    <View style={as.resultText}>
                      <Text style={as.resultTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={as.resultSub} numberOfLines={1}>
                        {item.artist}{item.year ? ` · ${item.year}` : ''}
                      </Text>
                    </View>
                    <FontAwesome name="paper-plane-o" size={14} color={ACCENT} />
                  </Pressable>
                )}
              />
            )}
          </SafeAreaView>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TextBubble({ text, isMe, time }: { text: string; isMe: boolean; time: string }) {
  return (
    <View style={[b.row, isMe ? b.rowMe : b.rowThem]}>
      <View style={[b.bubble, isMe ? b.bubbleMe : b.bubbleThem]}>
        <Text style={[b.text, isMe ? b.textMe : b.textThem]}>{text}</Text>
        <Text style={[b.time, isMe ? b.timeMe : b.timeThem]}>
          {new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );
}

function AlbumCard({
  album,
  isMe,
  onPress,
}: {
  album: { id: string; title: string; artist: string; artworkUrl: string; year?: number };
  isMe: boolean;
  onPress: () => void;
}) {
  return (
    <View style={[b.row, isMe ? b.rowMe : b.rowThem]}>
      <Pressable
        style={({ pressed }) => [b.albumCard, isMe ? b.albumCardMe : b.albumCardThem, { opacity: pressed ? 0.85 : 1 }]}
        onPress={onPress}>
        {album.artworkUrl ? (
          <Image source={{ uri: album.artworkUrl }} style={b.albumArt} resizeMode="cover" />
        ) : (
          <View style={[b.albumArt, b.albumArtFallback]}>
            <FontAwesome name="music" size={24} color={SUBTEXT} />
          </View>
        )}
        <View style={b.albumInfo}>
          <Text style={b.albumTitle} numberOfLines={2}>{album.title}</Text>
          <Text style={b.albumArtist} numberOfLines={1}>{album.artist}</Text>
          {album.year ? <Text style={b.albumYear}>{album.year}</Text> : null}
        </View>
        <FontAwesome name="chevron-right" size={12} color={SUBTEXT} style={{ alignSelf: 'center' }} />
      </Pressable>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: DARK_BG },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: DARK_BG },

  listContent: { paddingHorizontal: 12, paddingTop: 16, paddingBottom: 12, gap: 2 },

  dateSeparator: {
    color: SUBTEXT, fontSize: 12, textAlign: 'center',
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
    borderTopColor: BORDER,
    backgroundColor: DARK_BG,
  },
  albumBtn: {
    width: 36, height: 36,
    borderRadius: 18,
    backgroundColor: '#1a0d14',
    borderWidth: 1, borderColor: '#3a1a2a',
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'flex-end', marginBottom: 1,
  },
  textInput: {
    flex: 1,
    minHeight: 36,
    maxHeight: 120,
    backgroundColor: '#1a1a1a',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 8,
    color: TEXT,
    fontSize: 15,
  },
  sendBtn: {
    width: 36, height: 36,
    borderRadius: 18,
    backgroundColor: ACCENT,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'flex-end', marginBottom: 1,
  },
  sendBtnDisabled: { backgroundColor: '#4a1a30', opacity: 0.5 },
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
  bubbleMe:   { backgroundColor: MY_BUBBLE, borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: THEIR_BG,  borderBottomLeftRadius:  4 },

  text:   { fontSize: 15, lineHeight: 21 },
  textMe:   { color: '#fff' },
  textThem: { color: TEXT },

  time:     { fontSize: 10, alignSelf: 'flex-end' },
  timeMe:   { color: 'rgba(255,255,255,0.6)' },
  timeThem: { color: SUBTEXT },

  // Album card
  albumCard: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 280,
    borderRadius: 14,
    overflow: 'hidden',
    gap: 10,
    padding: 10,
  },
  albumCardMe:   { backgroundColor: '#c42d8a' },
  albumCardThem: { backgroundColor: '#222' },

  albumArt: {
    width: 56, height: 56,
    borderRadius: 6,
    flexShrink: 0,
  },
  albumArtFallback: {
    backgroundColor: '#333',
    alignItems: 'center', justifyContent: 'center',
  },
  albumInfo: { flex: 1, gap: 2 },
  albumTitle:  { color: TEXT,    fontSize: 14, fontWeight: '700', lineHeight: 18 },
  albumArtist: { color: SUBTEXT, fontSize: 12 },
  albumYear:   { color: SUBTEXT, fontSize: 11 },
});

// Album search sheet styles
const as = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: '#161616',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#444',
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
  title: { color: TEXT, fontSize: 17, fontWeight: '700' },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#222',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchInput: { flex: 1, color: TEXT, fontSize: 15, height: '100%' },

  result: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  artwork: { width: 48, height: 48, borderRadius: 4 },
  artworkFallback: { backgroundColor: '#2a2a2a' },
  resultText:   { flex: 1, gap: 3 },
  resultTitle:  { color: TEXT,    fontSize: 14, fontWeight: '600' },
  resultSub:    { color: SUBTEXT, fontSize: 12 },
});
