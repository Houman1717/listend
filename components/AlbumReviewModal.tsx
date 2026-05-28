import {
  StyleSheet, View, Text, Pressable, ScrollView,
  Modal, Platform, KeyboardAvoidingView,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ReviewComment, CommentsSection, avatarColor } from '@/components/ReviewComments';
import { LoggedAlbum } from '@/context/AlbumsContext';

function VolumeBadge({ rating, isDark, tint = '#D4A017' }: { rating: number; isDark?: boolean; tint?: string }) {
  const inactive = isDark ? '#2a1e14' : '#e0e0e0';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <FontAwesome name="volume-up" size={9} color={tint} />
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 1 }}>
        {Array.from({ length: 10 }, (_, i) => {
          const h = Math.round(3 + i * 1);
          return <View key={i} style={{ width: 2, height: h, borderRadius: 1, backgroundColor: i + 1 <= rating ? tint : inactive }} />;
        })}
      </View>
      <Text style={{ color: tint, fontSize: 10, fontWeight: '700' }}>{rating}</Text>
    </View>
  );
}

export function AlbumReviewModal({
  album,
  username,
  onClose,
  onAlbumPress,
  onUsernamePress,
  isDark,
  colors,
  isOwner = false,
  onUndoReListen,
  onDelete,
}: {
  album: LoggedAlbum;
  username: string;
  onClose: () => void;
  onAlbumPress: () => void;
  onUsernamePress?: (username: string) => void;
  isDark: boolean;
  colors: any;
  isOwner?: boolean;
  onUndoReListen?: () => void;
  onDelete?: () => void;
}) {
  const [liked,            setLiked]            = useState(false);
  const [likeCount,        setLikeCount]        = useState(0);
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const [localComments,    setLocalComments]    = useState<ReviewComment[]>([]);

  const insets = useSafeAreaInsets();
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
        <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}>

          {/* Header */}
          <View style={[s.header, { borderBottomColor: border }]}>
            <Pressable onPress={onClose} hitSlop={12}>
              <FontAwesome name="chevron-down" size={16} color={isDark ? '#A08060' : '#6B4C35'} />
            </Pressable>
            <Text style={[s.headerTitle, { color: isDark ? '#f5e6c8' : '#1A0F0A' }]}>Review</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView
            contentContainerStyle={[s.body, { paddingBottom: 40 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>

            {/* Album row */}
            <Pressable
              onPress={onAlbumPress}
              style={({ pressed }) => [s.albumRow, { opacity: pressed ? 0.7 : 1 }]}>
              {album.artworkUrl ? (
                <ExpoImage source={{ uri: album.artworkUrl }} style={s.art} contentFit="cover" cachePolicy="disk" />
              ) : (
                <View style={[s.art, { backgroundColor: album.coverColor, justifyContent: 'center', alignItems: 'center' }]}>
                  <FontAwesome name="music" size={20} color="rgba(255,255,255,0.4)" />
                </View>
              )}
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[s.albumTitle, { color: isDark ? '#f5e6c8' : '#1A0F0A' }]}>{album.title}</Text>
                <Text style={[s.albumArtist, { color: isDark ? '#A08060' : '#6B4C35' }]}>
                  {album.artist}{album.year > 0 ? ` · ${album.year}` : ''}
                </Text>
                {(album.lastRating ?? album.rating) > 0 && (
                  <View style={s.ratingRow}>
                    <VolumeBadge rating={album.lastRating ?? album.rating} isDark={isDark} tint={colors.tint} />
                  </View>
                )}
                {album.isRelistened && (
                  <FontAwesome name="repeat" size={9} color={colors.tint} style={{ marginTop: 2 }} />
                )}
              </View>
            </Pressable>

            {/* Author + date */}
            <Pressable
              style={s.authorRow}
              onPress={() => onUsernamePress?.(username)}
              disabled={!onUsernamePress}>
              <View style={[s.avatar, { backgroundColor: avatarColor(username || '?') }]}>
                <Text style={s.avatarLetter}>{(username || '?')[0].toUpperCase()}</Text>
              </View>
              <View style={{ gap: 1 }}>
                <Text style={[s.username, { color: colors.tint }]}>@{username || '…'}</Text>
                {dateStr ? (
                  <Text style={[s.listenedDate, { color: isDark ? '#A08060' : '#6B4C35' }]}>
                    Listend {dateStr}
                  </Text>
                ) : null}
              </View>
            </Pressable>

            {/* Review text */}
            {(album.lastReview ?? album.review) ? (
              <Text style={[s.reviewText, { color: isDark ? '#A08060' : '#6B4C35' }]}>
                "{album.lastReview ?? album.review}"
              </Text>
            ) : (
              <Text style={[s.reviewText, { color: isDark ? '#4a3020' : '#C8B89A', fontStyle: 'italic' }]}>
                No written review.
              </Text>
            )}

            {/* Like + comment row */}
            <View style={[s.likeCommentRow, { borderColor: border }]}>
              <Pressable onPress={handleLike} hitSlop={8} style={s.likeBtn}>
                <FontAwesome
                  name={liked ? 'heart' : 'heart-o'}
                  size={15}
                  color={liked ? '#D4A017' : (isDark ? '#A08060' : '#6B4C35')}
                />
                <Text style={[s.likeCount, { color: liked ? '#D4A017' : (isDark ? '#A08060' : '#6B4C35') }]}>
                  {likeCount}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setCommentsExpanded(prev => !prev)}
                hitSlop={8}
                style={[s.commentsToggle, { borderColor: border, flex: 1, marginBottom: 0 }]}>
                <FontAwesome
                  name="comment-o"
                  size={13}
                  color={commentsExpanded ? '#D4A017' : (isDark ? '#6B4C35' : '#A08060')}
                />
                <Text style={[s.commentsToggleText, { color: commentsExpanded ? '#D4A017' : (isDark ? '#6B4C35' : '#A08060') }]}>
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

            {isOwner && album.isRelistened && onUndoReListen && (
              <Pressable
                onPress={onUndoReListen}
                style={({ pressed }) => [s.undoRelistenBtn, { opacity: pressed ? 0.7 : 1 }]}>
                <FontAwesome name="undo" size={13} color="#8B1A1A" />
                <Text style={s.undoRelistenBtnText}>Undo Last Re-listen</Text>
              </Pressable>
            )}
            {isOwner && onDelete && !album.isRelistened && (
              <Pressable
                onPress={onDelete}
                style={({ pressed }) => [s.deleteBtn, { opacity: pressed ? 0.7 : 1 }]}>
                <FontAwesome name="trash" size={13} color="#8B1A1A" />
                <Text style={s.deleteBtnText}>Remove from Listend</Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  body: { padding: 20 },
  albumRow:    { flexDirection: 'row', gap: 14, marginBottom: 20 },
  art:         { width: 80, height: 80, borderRadius: 10 },
  albumTitle:  { fontSize: 16, fontWeight: '700' },
  albumArtist: { fontSize: 13 },
  ratingRow:   { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  authorRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  avatar:      { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  avatarLetter:{ color: '#fff', fontWeight: '700', fontSize: 14 },
  username:    { color: '#D4A017', fontWeight: '600', fontSize: 14 },
  listenedDate:{ fontSize: 12 },
  reviewText:  { fontSize: 15, lineHeight: 22, fontStyle: 'italic', marginBottom: 20 },
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
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 24, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, borderColor: '#8B1A1A',
  },
  deleteBtnText: { color: '#8B1A1A', fontWeight: '600', fontSize: 14 },
  undoRelistenBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 24, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, borderColor: '#8B1A1A',
  },
  undoRelistenBtnText: { color: '#8B1A1A', fontWeight: '600', fontSize: 14 },
});
