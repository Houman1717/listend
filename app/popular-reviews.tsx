import { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { PopularReview, fetchPopularReviewsThisWeek } from '@/lib/homeData';
import { ReviewComment, CommentsSection, avatarColor } from '@/components/ReviewComments';
import { fetchReviewComments, insertReviewComment } from '@/lib/reviewComments';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { SpotifyAlbum } from '@/context/SpotifyService';
import { navigateToProfile } from '@/lib/navigateToProfile';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

// ─── Volume badge ─────────────────────────────────────────────────────────────

function VolumeBadge({ rating, isDark }: { rating: number; isDark?: boolean }) {
  const inactive = isDark ? '#2a1e14' : '#e0e0e0';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <FontAwesome name="volume-up" size={10} color="#D4A017" />
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 1 }}>
        {Array.from({ length: 10 }, (_, i) => {
          const h = Math.round(3 + i * 1);
          return (
            <View key={i} style={{ width: 2, height: h, borderRadius: 1, backgroundColor: i + 1 <= rating ? '#D4A017' : inactive }} />
          );
        })}
      </View>
      <Text style={{ color: '#D4A017', fontSize: 10, fontWeight: '700' }}>{rating}</Text>
    </View>
  );
}

// ─── Full review row ──────────────────────────────────────────────────────────

function ReviewRow({
  item,
  liked,
  onLike,
  onAlbumPress,
  onUsernamePress,
  comments,
  onAddComment,
  onCommentsToggle,
  isDark,
  colors,
}: {
  item: PopularReview;
  liked: boolean;
  onLike: () => void;
  onAlbumPress: () => void;
  onUsernamePress?: () => void;
  comments: ReviewComment[];
  onAddComment: (body: string, parentId?: string | null, username?: string, replyToUsername?: string, avatarUrl?: string | null) => void;
  onCommentsToggle?: () => void;
  isDark: boolean;
  colors: any;
}) {
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const displayCount = item.likeCount + (liked ? 1 : 0);
  const displayCommentCount = comments.length > 0 ? comments.length : item.commentCount;
  const border = isDark ? '#2a1e14' : '#e8e8e8';
  const subtext = isDark ? '#7a5535' : '#a07850';

  return (
    <View
      style={[
        s.row,
        {
          backgroundColor: isDark ? '#2e2018' : '#fff',
          borderColor: border,
        },
      ]}>
      {/* Top: art + album meta — tappable to open album profile */}
      <Pressable
        onPress={onAlbumPress}
        style={({ pressed }) => [s.topRow, { opacity: pressed ? 0.7 : 1 }]}>
        <ExpoImage source={{ uri: item.artworkUrl }} style={s.art}
          contentFit="cover" cachePolicy="disk"
        />
        <View style={s.albumInfo}>
          <Text style={[s.albumTitle, { color: isDark ? '#f5e6c8' : '#1c1410' }]}>
            {item.albumTitle}
          </Text>
          <Text style={[s.albumArtist, { color: isDark ? '#a07850' : '#7a5535' }]}>
            {item.albumArtist} · {item.albumYear}
          </Text>
          <View style={s.ratingRow}>
            <VolumeBadge rating={item.rating} isDark={isDark} />
          </View>
        </View>
      </Pressable>

      {/* Full review text */}
      <Text style={[s.reviewText, { color: isDark ? '#a07850' : '#3a2818' }]}>
        "{item.review}"
      </Text>

      {/* Footer: avatar + username | comments + like */}
      <View style={s.footer}>
        <Pressable style={s.userRow} onPress={onUsernamePress} hitSlop={6}>
          <View style={[s.avatar, { backgroundColor: avatarColor(item.username) }]}>
            <Text style={s.avatarLetter}>{item.username[0].toUpperCase()}</Text>
          </View>
          <Text style={[s.username, { color: '#D4A017' }]}>@{item.username}</Text>
        </Pressable>
        <View style={s.footerActions}>
          <Pressable
            onPress={() => { onCommentsToggle?.(); setCommentsExpanded(prev => !prev); }}
            hitSlop={8}
            style={s.actionBtn}>
            <FontAwesome
              name="comment-o"
              size={16}
              color={commentsExpanded ? '#D4A017' : subtext}
            />
            <Text style={[s.actionCount, { color: commentsExpanded ? '#D4A017' : subtext }]}>
              {displayCommentCount}
            </Text>
          </Pressable>
          <Pressable onPress={onLike} hitSlop={10} style={s.actionBtn}>
            <FontAwesome
              name={liked ? 'heart' : 'heart-o'}
              size={16}
              color={liked ? '#D4A017' : subtext}
            />
            <Text style={[s.actionCount, { color: liked ? '#D4A017' : subtext }]}>
              {displayCount}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Comments section */}
      {commentsExpanded && (
        <CommentsSection
          comments={comments}
          isDark={isDark}
          colors={colors}
          onAddComment={onAddComment}
          onUsernamePress={onUsernamePress}
          large
        />
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PopularReviewsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { user } = useAuth();

  const [reviews,      setReviews]      = useState<PopularReview[]>([]);
  const [likedReviews, setLikedReviews] = useState<Set<string>>(new Set());
  const [commentsMap,  setCommentsMap]  = useState<Map<string, ReviewComment[]>>(new Map());

  useEffect(() => {
    fetchPopularReviewsThisWeek().then(setReviews);
  }, []);

  useEffect(() => {
    if (!user?.id || reviews.length === 0) return;
    const ids = reviews.map(r => r.id);
    supabase.from('likes').select('target_id')
      .eq('target_type', 'review').eq('user_id', user.id).in('target_id', ids)
      .then(({ data }) => {
        setLikedReviews(new Set((data ?? []).map((r: any) => r.target_id as string)));
      });
  }, [reviews.length, user?.id]);

  function handleLike(id: string) {
    if (!user) return;
    const wasLiked = likedReviews.has(id);
    setLikedReviews(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    if (wasLiked) {
      supabase.from('likes').delete()
        .eq('user_id', user.id).eq('target_type', 'review').eq('target_id', id)
        .then(({ error }) => {
          if (error) setLikedReviews(prev => { const n = new Set(prev); n.add(id); return n; });
        });
    } else {
      supabase.from('likes').insert({
        user_id: user.id, target_type: 'review', target_id: id, target_owner_id: id.split('_')[0],
      }).then(({ error }) => {
        if (error) setLikedReviews(prev => { const n = new Set(prev); n.delete(id); return n; });
      });
    }
  }

  function ensureCommentsLoaded(reviewId: string) {
    if (!commentsMap.has(reviewId)) {
      fetchReviewComments(reviewId).then(comments => {
        setCommentsMap(prev => {
          const m = new Map(prev);
          if (!m.has(reviewId)) m.set(reviewId, comments);
          return m;
        });
      });
    }
  }

  function handleAddComment(reviewId: string, body: string, parentId?: string | null, commenterUsername?: string, replyToUsername?: string, avatarUrl?: string | null) {
    const tempId = `pr_local_${Date.now()}`;
    const newComment: ReviewComment = {
      id:              tempId,
      reviewId,
      parentCommentId: parentId ?? null,
      replyToUsername: replyToUsername ?? null,
      userId:          user?.id ?? 'me',
      username:        commenterUsername ?? 'me',
      avatarUrl:       avatarUrl ?? null,
      body,
      createdAt:       'just now',
    };
    setCommentsMap(prev => {
      const m = new Map(prev);
      m.set(reviewId, [...(m.get(reviewId) ?? []), newComment]);
      return m;
    });
    if (user?.id) {
      insertReviewComment(reviewId, user.id, body, parentId ?? null).then(realId => {
        if (realId) {
          setCommentsMap(prev => {
            const m = new Map(prev);
            const list = (m.get(reviewId) ?? []).map(c => c.id === tempId ? { ...c, id: realId } : c);
            m.set(reviewId, list);
            return m;
          });
        }
      });
    }
  }

  async function navigateToAlbum(title: string, artist: string, artworkUrl: string, year: string) {
    try {
      const q = encodeURIComponent(`${title} ${artist}`);
      const res = await fetch(`${API_URL}/search?q=${q}&type=album`);
      if (res.ok) {
        const data: SpotifyAlbum[] = await res.json();
        const match = data[0];
        if (match) {
          router.push({ pathname: '/album-detail', params: { id: match.id, title: match.title, artist: match.artist, year: String(match.year), artworkUrl: match.artworkUrl } });
          return;
        }
      }
    } catch {}
    router.push({ pathname: '/album-detail', params: { id: '', title, artist, artworkUrl, year } });
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        data={reviews}
        keyExtractor={item => item.id}
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={[s.list, { paddingBottom: 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <ReviewRow
            item={item}
            liked={likedReviews.has(item.id)}
            onLike={() => handleLike(item.id)}
            onAlbumPress={() => navigateToAlbum(item.albumTitle, item.albumArtist, item.artworkUrl, item.albumYear)}
            onUsernamePress={() => navigateToProfile(item.username, router)}
            comments={commentsMap.get(item.id) ?? []}
            onAddComment={(body, parentId, u, rtu, av) => handleAddComment(item.id, body, parentId, u, rtu, av)}
            onCommentsToggle={() => ensureCommentsLoaded(item.id)}
            isDark={isDark}
            colors={colors}
          />
        )}
      />
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  list: { padding: 16, gap: 14 },

  row: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 12,
  },

  topRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  art: {
    width: 84,
    height: 84,
    borderRadius: 8,
  },
  albumInfo: {
    flex: 1,
    gap: 4,
    paddingTop: 2,
  },
  albumTitle:  { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  albumArtist: { fontSize: 13 },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  ratingBadge: {
    backgroundColor: '#D4A017',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  ratingNum: { color: '#fff', fontSize: 12, fontWeight: '700' },

  reviewText: {
    fontSize: 14,
    lineHeight: 21,
    fontStyle: 'italic',
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: { color: '#fff', fontSize: 11, fontWeight: '700' },
  username:     { fontSize: 13, fontWeight: '600' },
  footerActions: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionCount: { fontSize: 14 },
});
