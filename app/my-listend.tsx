import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  Modal,
  Platform,
  SafeAreaView,
  KeyboardAvoidingView,
  useWindowDimensions,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useState, useMemo, useEffect } from 'react';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAlbums, LoggedAlbum } from '@/context/AlbumsContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { SortBar, SortSheet, applySort, SortKey } from '@/components/SortSheet';
import { ReviewComment, CommentsSection, avatarColor } from '@/components/ReviewComments';
import { navigateToProfile } from '@/lib/navigateToProfile';

const PADDING = 16;
const GAP     = 12;
const COLS    = 3;

const COVER_COLORS = ['#2d5a27','#7a4a2e','#1a3018','#d4a017','#7a3a1a','#8b1a1a','#1a5a5a','#4a2818'];

// ─── Volume + bars badge ──────────────────────────────────────────────────────

function VolumeBadge({ rating, showNumber, isDark }: { rating: number; showNumber?: boolean; isDark?: boolean }) {
  const inactive = isDark ? '#2a1e14' : '#e0e0e0';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <FontAwesome name="volume-up" size={9} color="#D4A017" />
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 1 }}>
        {Array.from({ length: 10 }, (_, i) => {
          const h = Math.round(3 + i * 1);
          return (
            <View
              key={i}
              style={{ width: 2, height: h, borderRadius: 1, backgroundColor: i + 1 <= rating ? '#D4A017' : inactive }}
            />
          );
        })}
      </View>
      {showNumber && (
        <Text style={{ color: '#D4A017', fontSize: 10, fontWeight: '700' }}>{rating}</Text>
      )}
    </View>
  );
}

// ─── Album review modal ───────────────────────────────────────────────────────

function AlbumReviewModal({
  album,
  username,
  onClose,
  onAlbumPress,
  onUsernamePress,
  isDark,
  colors,
}: {
  album: LoggedAlbum;
  username: string;
  onClose: () => void;
  onAlbumPress: () => void;
  onUsernamePress?: (username: string) => void;
  isDark: boolean;
  colors: any;
}) {
  const [liked,            setLiked]            = useState(false);
  const [likeCount,        setLikeCount]        = useState(0);
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const [localComments,    setLocalComments]    = useState<ReviewComment[]>([]);

  const border = isDark ? '#2a1e14' : '#e5e5e5';
  const dateStr = album.dateLogged
    ? new Date(album.dateLogged).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  function handleLike() {
    setLiked(prev => !prev);
    setLikeCount(prev => liked ? prev - 1 : prev + 1);
  }

  function handleAddComment(body: string, parentId?: string | null, commenterUsername?: string, replyToUsername?: string, avatarUrl?: string | null) {
    const c: ReviewComment = {
      id:              `mlc_${Date.now()}`,
      reviewId:        album.id,
      userId:          'me',
      username:        commenterUsername ?? username,
      avatarUrl:       avatarUrl ?? null,
      body,
      parentCommentId: parentId ?? undefined,
      replyToUsername: replyToUsername ?? null,
      createdAt:       'just now',
    };
    setLocalComments(prev => [...prev, c]);
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: colors.background }}>
        <SafeAreaView style={{ flex: 1 }}>

          {/* Header */}
          <View style={[ml.header, { borderBottomColor: border }]}>
            <Pressable onPress={onClose} hitSlop={12}>
              <FontAwesome name="chevron-down" size={16} color={isDark ? '#A08060' : '#6B4C35'} />
            </Pressable>
            <Text style={[ml.headerTitle, { color: isDark ? '#f5e6c8' : '#1A0F0A' }]}>Review</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView
            contentContainerStyle={[ml.body, { paddingBottom: 40 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>

            {/* Album row */}
            <Pressable
              onPress={onAlbumPress}
              style={({ pressed }) => [ml.albumRow, { opacity: pressed ? 0.7 : 1 }]}>
              {album.artworkUrl ? (
                <ExpoImage source={{ uri: album.artworkUrl }} style={ml.art} contentFit="cover" cachePolicy="disk" />
              ) : (
                <View style={[ml.art, { backgroundColor: album.coverColor, justifyContent: 'center', alignItems: 'center' }]}>
                  <FontAwesome name="music" size={20} color="rgba(255,255,255,0.4)" />
                </View>
              )}
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[ml.albumTitle, { color: isDark ? '#f5e6c8' : '#1A0F0A' }]}>{album.title}</Text>
                <Text style={[ml.albumArtist, { color: isDark ? '#A08060' : '#6B4C35' }]}>
                  {album.artist}{album.year > 0 ? ` · ${album.year}` : ''}
                </Text>
                {album.rating > 0 && (
                  <View style={ml.ratingRow}>
                    <VolumeBadge rating={album.rating} isDark={isDark} />
                  </View>
                )}
              </View>
            </Pressable>

            {/* Author + date */}
            <Pressable
              style={ml.authorRow}
              onPress={() => onUsernamePress?.(username)}
              disabled={!onUsernamePress}>
              <View style={[ml.avatar, { backgroundColor: avatarColor(username || '?') }]}>
                <Text style={ml.avatarLetter}>{(username || '?')[0].toUpperCase()}</Text>
              </View>
              <View style={{ gap: 1 }}>
                <Text style={ml.username}>@{username || '…'}</Text>
                {dateStr ? (
                  <Text style={[ml.listenedDate, { color: isDark ? '#A08060' : '#6B4C35' }]}>
                    Listend {dateStr}
                  </Text>
                ) : null}
              </View>
            </Pressable>

            {/* Review text */}
            <Text style={[ml.reviewText, { color: isDark ? '#A08060' : '#6B4C35' }]}>
              "{album.review}"
            </Text>

            {/* Like + comment toggle row */}
            <View style={[ml.likeCommentRow, { borderColor: border }]}>
              <Pressable onPress={handleLike} hitSlop={8} style={ml.likeBtn}>
                <FontAwesome
                  name={liked ? 'heart' : 'heart-o'}
                  size={15}
                  color={liked ? '#D4A017' : (isDark ? '#A08060' : '#6B4C35')}
                />
                <Text style={[ml.likeCount, { color: liked ? '#D4A017' : (isDark ? '#A08060' : '#6B4C35') }]}>
                  {likeCount}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setCommentsExpanded(prev => !prev)}
                hitSlop={8}
                style={[ml.commentsToggle, { borderColor: border, flex: 1, marginBottom: 0 }]}>
                <FontAwesome
                  name="comment-o"
                  size={13}
                  color={commentsExpanded ? '#D4A017' : (isDark ? '#6B4C35' : '#A08060')}
                />
                <Text style={[ml.commentsToggleText, { color: commentsExpanded ? '#D4A017' : (isDark ? '#6B4C35' : '#A08060') }]}>
                  {localComments.length === 0
                    ? 'No comments yet'
                    : `${localComments.length} comment${localComments.length !== 1 ? 's' : ''}`}
                </Text>
                <FontAwesome
                  name={commentsExpanded ? 'chevron-up' : 'chevron-down'}
                  size={10}
                  color={isDark ? '#6B4C35' : '#A08060'}
                  style={{ marginLeft: 'auto' }}
                />
              </Pressable>
            </View>

            {commentsExpanded && (
              <CommentsSection
                comments={localComments}
                isDark={isDark}
                colors={colors}
                onAddComment={handleAddComment}
                onUsernamePress={onUsernamePress}
              />
            )}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Album card ───────────────────────────────────────────────────────────────

function AlbumCard({
  album,
  cardWidth,
  colors,
  isDark,
  onPress,
  onLongPress,
}: {
  album: LoggedAlbum;
  cardWidth: number;
  colors: any;
  isDark: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [s.card, { width: cardWidth, opacity: pressed ? 0.7 : 1 }]}>
      {album.artworkUrl ? (
        <ExpoImage
          source={{ uri: album.artworkUrl }}
          style={{ width: cardWidth, height: cardWidth, borderRadius: 8 }}
          contentFit="cover"
          cachePolicy="disk"
          transition={200}
        />
      ) : (
        <View style={[s.fallback, { width: cardWidth, height: cardWidth, backgroundColor: album.coverColor }]}>
          <Text style={[s.fallbackText, { fontSize: cardWidth * 0.32 }]}>{album.title.charAt(0)}</Text>
        </View>
      )}
      <Text style={[s.cardTitle,  { color: colors.text    }]} numberOfLines={1}>{album.title}</Text>
      <Text style={[s.cardArtist, { color: colors.subtext }]} numberOfLines={1}>{album.artist}</Text>
      {album.rating > 0 && (
        <View style={{ marginTop: 3, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <VolumeBadge rating={album.rating} showNumber isDark={isDark} />
          {!!album.review && (
            <FontAwesome name="pencil" size={8} color="#D4A017" />
          )}
        </View>
      )}
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MyListendScreen() {
  const { width } = useWindowDimensions();
  const cardWidth = (width - PADDING * 2 - GAP * (COLS - 1)) / COLS;
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { loggedAlbums, removeLoggedAlbum, updateDuration } = useAlbums();
  const { user } = useAuth();
  const { userId: paramUserId, username: paramUsername } = useLocalSearchParams<{ userId?: string; username?: string }>();

  const viewingOther = paramUserId || null;
  const [otherAlbums, setOtherAlbums] = useState<LoggedAlbum[]>([]);
  const [sortKey, setSortKey]       = useState<SortKey>('date_new');
  const [shuffled, setShuffled]     = useState<LoggedAlbum[] | null>(null);
  const [sheetOpen, setSheetOpen]   = useState(false);

  // Review modal state
  const [selectedAlbum,  setSelectedAlbum]  = useState<LoggedAlbum | null>(null);
  const [profileUsername, setProfileUsername] = useState<string>(paramUsername ?? '');

  // Fetch the profile username for author row in the modal
  useEffect(() => {
    const uid = viewingOther || user?.id;
    if (!uid || profileUsername) return;
    supabase
      .from('profiles')
      .select('username')
      .eq('id', uid)
      .single()
      .then(({ data }) => { if (data?.username) setProfileUsername(data.username); });
  }, [viewingOther, user?.id]);

  useEffect(() => {
    if (!viewingOther) return;
    supabase
      .from('user_albums')
      .select('spotify_id, title, artist, artwork_url, year, rating, review, listened_at, duration_ms')
      .eq('user_id', viewingOther)
      .not('listened_at', 'is', null)
      .order('listened_at', { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        setOtherAlbums(data.map((a, i) => ({
          id:         a.spotify_id,
          title:      a.title      ?? '',
          artist:     a.artist     ?? '',
          year:       a.year       ?? 0,
          rating:     a.rating     ?? 0,
          review:     a.review     ?? undefined,
          dateLogged: a.listened_at ?? new Date().toISOString(),
          artworkUrl: a.artwork_url ?? undefined,
          coverColor: COVER_COLORS[i % COVER_COLORS.length],
          durationMs: a.duration_ms ?? undefined,
        })));
      });
  }, [viewingOther]);

  const sourceAlbums = viewingOther ? otherAlbums : loggedAlbums;

  // Fetch durations for any album in the list that doesn't have one yet
  useEffect(() => {
    const missing = sourceAlbums.filter(a => !a.durationMs).map(a => a.id);
    if (missing.length === 0) return;
    const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';
    fetch(`${API_URL}/api/album-durations?ids=${missing.join(',')}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((data: Record<string, number>) => {
        Object.entries(data).forEach(([id, ms]) => {
          if (viewingOther) {
            setOtherAlbums(prev => prev.map(a => a.id === id ? { ...a, durationMs: ms } : a));
          } else {
            updateDuration(id, ms);
          }
        });
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceAlbums.length, viewingOther]);

  const displayAlbums = useMemo(() => {
    if (shuffled) return shuffled;
    return applySort(sourceAlbums, sortKey);
  }, [sourceAlbums, sortKey, shuffled]);

  function handleSelectSort(key: SortKey) {
    if (key === 'shuffle') {
      setShuffled([...sourceAlbums].sort(() => Math.random() - 0.5));
    } else {
      setShuffled(null);
    }
    setSortKey(key);
  }

  function confirmRemove(album: LoggedAlbum) {
    Alert.alert(
      'Remove Album',
      `Remove "${album.title}" from your Listend?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeLoggedAlbum(album.id) },
      ]
    );
  }

  function navigateToAlbum(album: LoggedAlbum) {
    router.push({
      pathname: '/album-detail',
      params: {
        id:         album.id,
        title:      album.title,
        artist:     album.artist,
        year:       String(album.year ?? ''),
        artworkUrl: album.artworkUrl ?? '',
      },
    });
  }

  function handleAlbumPress(album: LoggedAlbum) {
    if (album.review && album.rating > 0) {
      setSelectedAlbum(album);
    } else {
      navigateToAlbum(album);
    }
  }

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <SortBar
        sortKey={sortKey}
        count={sourceAlbums.length}
        noun="albums"
        isDark={isDark}
        onPress={() => setSheetOpen(true)}
      />
      <ScrollView contentContainerStyle={s.gridWrap} showsVerticalScrollIndicator={false}>
        {displayAlbums.length === 0 ? (
          <Text style={[s.emptyText, { color: colors.subtext }]}>
            No albums logged yet — head to Search!
          </Text>
        ) : (
          <View style={s.grid}>
            {displayAlbums.map((album, index) => (
              <AlbumCard
                key={`${album.id}-${index}`}
                album={album}
                cardWidth={cardWidth}
                colors={colors}
                isDark={isDark}
                onPress={() => handleAlbumPress(album)}
                onLongPress={!viewingOther ? () => confirmRemove(album) : undefined}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <SortSheet
        visible={sheetOpen}
        activeKey={sortKey}
        onSelect={handleSelectSort}
        onClose={() => setSheetOpen(false)}
        isDark={isDark}
      />

      {selectedAlbum && (
        <AlbumReviewModal
          album={selectedAlbum}
          username={profileUsername}
          onClose={() => setSelectedAlbum(null)}
          onAlbumPress={() => {
            const a = selectedAlbum;
            setSelectedAlbum(null);
            navigateToAlbum(a);
          }}
          onUsernamePress={viewingOther
            ? (username) => { setSelectedAlbum(null); navigateToProfile(username, router); }
            : undefined}
          isDark={isDark}
          colors={colors}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:    { flex: 1 },
  gridWrap:{ padding: PADDING, paddingBottom: 48 },
  grid:    { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  card:    { gap: 0 },
  fallback:     { borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  fallbackText: { color: 'rgba(255,255,255,0.5)', fontWeight: '700' },
  cardTitle:    { marginTop: 5, fontSize: 11, fontWeight: '600', lineHeight: 14 },
  cardArtist:   { fontSize: 10, lineHeight: 13, marginTop: 1 },
  emptyText:    { textAlign: 'center', marginTop: 80, fontSize: 15 },
});

// ─── Modal styles ─────────────────────────────────────────────────────────────

const ml = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 16, fontWeight: '700' },

  body: { padding: 20 },

  albumRow: { flexDirection: 'row', gap: 14, marginBottom: 20 },
  art:      { width: 80, height: 80, borderRadius: 10 },
  albumTitle:  { fontSize: 16, fontWeight: '700' },
  albumArtist: { fontSize: 13 },
  ratingRow:   { flexDirection: 'row', alignItems: 'center', marginTop: 4 },

  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  avatar:    { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  avatarLetter: { color: '#fff', fontWeight: '700', fontSize: 14 },
  username:     { color: '#D4A017', fontWeight: '600', fontSize: 14 },
  listenedDate: { fontSize: 12 },

  reviewText: { fontSize: 15, lineHeight: 22, fontStyle: 'italic', marginBottom: 20 },

  likeCommentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10, marginBottom: 16,
  },
  likeBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  likeCount: { fontSize: 14, fontWeight: '600' },

  commentsToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, marginBottom: 12,
  },
  commentsToggleText: { fontSize: 14, fontWeight: '500' },
});
