import {
  StyleSheet,
  View,
  Text,
  Pressable,
  FlatList,
  Modal,
  Platform,
  SafeAreaView,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAlbums, LoggedAlbum } from '@/context/AlbumsContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { SortBar, SortSheet, applySort, SortKey } from '@/components/SortSheet';
import { ReviewComment, CommentsSection, avatarColor } from '@/components/ReviewComments';
import { navigateToProfile } from '@/lib/navigateToProfile';

// ─── Volume badge (with number) ───────────────────────────────────────────────

const BAR_HEIGHTS = [3, 4, 5, 6, 7, 9, 11, 13, 15, 17];

function VolumeBadge({ rating, isDark }: { rating: number; isDark?: boolean }) {
  const inactive = isDark ? '#2a1e14' : '#e0e0e0';
  return (
    <View style={s.badge}>
      <FontAwesome name="volume-up" size={10} color={rating > 0 ? '#D4A017' : inactive} />
      <View style={s.badgeBars}>
        {BAR_HEIGHTS.map((h, i) => (
          <View
            key={i}
            style={[s.badgeBar, { height: h, backgroundColor: i + 1 <= rating ? '#D4A017' : inactive }]}
          />
        ))}
      </View>
      {rating > 0 && <Text style={s.badgeNum}>{rating}</Text>}
    </View>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type LikeState    = { liked: boolean; count: number };
type LikedReview  = LoggedAlbum & { ownerId: string; username: string; likedAt: string };

// ─── Review row ───────────────────────────────────────────────────────────────

function ReviewRow({
  album,
  colors,
  isDark,
  onPress,
  likeCount = 0,
  isLiked = false,
  onLike,
  byUsername,
}: {
  album: LoggedAlbum;
  colors: typeof Colors.light;
  isDark: boolean;
  onPress: () => void;
  likeCount?: number;
  isLiked?: boolean;
  onLike?: () => void;
  byUsername?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.row, { opacity: pressed ? 0.7 : 1 }]}>
      {/* Thumbnail */}
      {album.artworkUrl ? (
        <ExpoImage source={{ uri: album.artworkUrl }} style={s.thumb} contentFit="cover" cachePolicy="disk" />
      ) : (
        <View style={[s.thumb, s.thumbFallback, { backgroundColor: album.coverColor }]}>
          <Text style={s.thumbInitial}>{album.title.charAt(0)}</Text>
        </View>
      )}

      {/* Text block */}
      <View style={s.info}>
        <Text style={[s.title, { color: colors.text }]} numberOfLines={1}>
          {album.title}
        </Text>
        <Text style={[s.artist, { color: colors.subtext }]} numberOfLines={1}>
          {album.artist} · {album.year}
        </Text>
        {byUsername ? (
          <Text style={[s.byUser, { color: '#D4A017' }]} numberOfLines={1}>by @{byUsername}</Text>
        ) : null}
        <VolumeBadge rating={album.rating} isDark={isDark} />
        {album.dateLogged ? (
          <Text style={[s.dateListend, { color: colors.subtext }]}>
            Listend {new Date(album.dateLogged).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        ) : null}
        <Text style={[s.review, { color: isDark ? '#a07850' : '#7a5535' }]}>
          {album.review}
        </Text>

        {/* Like button (other's reviews) or read-only count (own reviews) */}
        {(onLike !== undefined || likeCount > 0) && (
          <View style={s.likeRow}>
            {onLike !== undefined ? (
              // Interactive — viewer can toggle like
              <Pressable onPress={onLike} hitSlop={8} style={s.likeBtn}>
                <FontAwesome
                  name={isLiked ? 'heart' : 'heart-o'}
                  size={13}
                  color={isLiked ? '#D4A017' : '#7a5535'}
                />
                {likeCount > 0 && (
                  <Text style={[s.likeCount, { color: isLiked ? '#D4A017' : '#7a5535' }]}>
                    {likeCount}
                  </Text>
                )}
              </Pressable>
            ) : likeCount > 0 ? (
              // Read-only — own review, just show how many people liked it
              <View style={s.likeBtn}>
                <FontAwesome name="heart" size={13} color="#D4A017" />
                <Text style={[s.likeCount, { color: '#D4A017' }]}>{likeCount}</Text>
              </View>
            ) : null}
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ─── Review detail modal ──────────────────────────────────────────────────────

function ReviewDetailModal({
  album,
  isDark,
  colors,
  reviewerUsername,
  likeState,
  onLike,
  onClose,
  onAlbumPress,
  onUsernamePress,
}: {
  album: LoggedAlbum;
  isDark: boolean;
  colors: typeof Colors.light;
  reviewerUsername: string;
  likeState: LikeState;
  onLike?: () => void;
  onClose: () => void;
  onAlbumPress: () => void;
  onUsernamePress?: (username: string) => void;
}) {
  const router = useRouter();
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const [localComments,    setLocalComments]    = useState<ReviewComment[]>([]);
  const border = isDark ? '#2a1e14' : '#e5e5e5';
  const dateStr = album.dateLogged
    ? new Date(album.dateLogged).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  function handleAddComment(body: string, parentId?: string | null, commenterUsername?: string, replyToUsername?: string, avatarUrl?: string | null) {
    setLocalComments(prev => [...prev, {
      id: `rev_${Date.now()}`,
      reviewId: album.id,
      userId: 'me',
      username: commenterUsername ?? reviewerUsername,
      avatarUrl: avatarUrl ?? null,
      body,
      parentCommentId: parentId ?? undefined,
      replyToUsername: replyToUsername ?? null,
      createdAt: 'just now',
    }]);
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: colors.background }}>
        <SafeAreaView style={{ flex: 1 }}>

          {/* Header */}
          <View style={[mrd.header, { borderBottomColor: border }]}>
            <Pressable onPress={onClose} hitSlop={12}>
              <FontAwesome name="chevron-down" size={16} color={isDark ? '#A08060' : '#6B4C35'} />
            </Pressable>
            <Text style={[mrd.headerTitle, { color: isDark ? '#f5e6c8' : '#1A0F0A' }]}>Review</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView
            contentContainerStyle={{ paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>

            {/* Album row — tappable */}
            <Pressable
              onPress={onAlbumPress}
              style={({ pressed }) => [mrd.albumRow, { opacity: pressed ? 0.7 : 1 }]}>
              {album.artworkUrl ? (
                <ExpoImage source={{ uri: album.artworkUrl }} style={mrd.art} contentFit="cover" cachePolicy="disk" />
              ) : (
                <View style={[mrd.art, { backgroundColor: album.coverColor, justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 28, fontWeight: '700' }}>{album.title.charAt(0)}</Text>
                </View>
              )}
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[mrd.albumTitle, { color: isDark ? '#f5e6c8' : '#1A0F0A' }]} numberOfLines={2}>{album.title}</Text>
                <Text style={[mrd.albumArtist, { color: isDark ? '#A08060' : '#6B4C35' }]} numberOfLines={1}>
                  {album.artist} · {album.year}
                </Text>
                <View style={mrd.ratingRow}>
                  <VolumeBadge rating={album.rating} isDark={isDark} />
                </View>
              </View>
            </Pressable>

            {/* Author row */}
            <Pressable
              style={mrd.authorRow}
              onPress={() => onUsernamePress?.(reviewerUsername)}
              disabled={!onUsernamePress}>
              <View style={[mrd.avatar, { backgroundColor: reviewerUsername === 'you' ? '#D4A017' : avatarColor(reviewerUsername) }]}>
                <Text style={mrd.avatarLetter}>{reviewerUsername[0].toUpperCase()}</Text>
              </View>
              <View style={{ gap: 2 }}>
                <Text style={mrd.username}>@{reviewerUsername}</Text>
                {dateStr ? (
                  <Text style={[mrd.listenedDate, { color: isDark ? '#A08060' : '#6B4C35' }]}>
                    Listend {dateStr}
                  </Text>
                ) : null}
              </View>
            </Pressable>

            {/* Review text */}
            {album.review ? (
              <Text style={[mrd.reviewText, { color: isDark ? '#A08060' : '#6B4C35' }]}>
                "{album.review}"
              </Text>
            ) : (
              <Text style={[mrd.reviewText, { color: isDark ? '#4a3020' : '#C8B89A', fontStyle: 'italic' }]}>
                No written review.
              </Text>
            )}

            {/* Like + comments row */}
            <View style={[mrd.likeCommentRow, { borderColor: border }]}>
              {onLike ? (
                <Pressable onPress={onLike} hitSlop={8} style={mrd.likeBtn}>
                  <FontAwesome
                    name={likeState.liked ? 'heart' : 'heart-o'}
                    size={15}
                    color={likeState.liked ? '#D4A017' : (isDark ? '#A08060' : '#6B4C35')}
                  />
                  <Text style={[mrd.likeCount, { color: likeState.liked ? '#D4A017' : (isDark ? '#A08060' : '#6B4C35') }]}>
                    {likeState.count}
                  </Text>
                </Pressable>
              ) : (
                <View style={mrd.likeBtn}>
                  <FontAwesome name="heart" size={15} color={likeState.count > 0 ? '#D4A017' : (isDark ? '#3a2818' : '#ddd')} />
                  <Text style={[mrd.likeCount, { color: likeState.count > 0 ? '#D4A017' : (isDark ? '#3a2818' : '#bbb') }]}>
                    {likeState.count}
                  </Text>
                </View>
              )}
              <Pressable
                onPress={() => setCommentsExpanded(p => !p)}
                hitSlop={8}
                style={[mrd.commentsToggle, { borderColor: border, flex: 1 }]}>
                <FontAwesome
                  name="comment-o"
                  size={13}
                  color={commentsExpanded ? '#D4A017' : (isDark ? '#6B4C35' : '#A08060')}
                />
                <Text style={[mrd.commentsToggleText, { color: commentsExpanded ? '#D4A017' : (isDark ? '#6B4C35' : '#A08060') }]}>
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
                onUsernamePress={(username) => { onClose(); navigateToProfile(username, router); }}
              />
            )}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

const COVER_COLORS = ['#2d5a27','#7a4a2e','#1a3018','#d4a017','#7a3a1a','#8b1a1a','#1a5a5a','#4a2818'];

export default function MyReviewsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { loggedAlbums, updateDuration } = useAlbums();
  const { user } = useAuth();
  const { userId: paramUserId } = useLocalSearchParams<{ userId?: string }>();

  const viewingOther = paramUserId || null;
  const [activeTab, setActiveTab]         = useState<'reviews' | 'liked'>('reviews');
  const [otherReviews, setOtherReviews]   = useState<LoggedAlbum[]>([]);
  const [likesMap, setLikesMap]           = useState<Map<string, LikeState>>(new Map());
  const [sortKey, setSortKey]             = useState<SortKey>('date_new');
  const [shuffled, setShuffled]           = useState<LoggedAlbum[] | null>(null);
  const [sheetOpen, setSheetOpen]         = useState(false);
  const [selectedReview, setSelectedReview] = useState<LoggedAlbum | null>(null);
  const [profileUsername, setProfileUsername] = useState('you');

  const [likedReviews,  setLikedReviews]  = useState<LikedReview[]>([]);
  const [likedLikesMap, setLikedLikesMap] = useState<Map<string, LikeState>>(new Map());
  const [likedLoading,  setLikedLoading]  = useState(false);
  const [selectedLiked, setSelectedLiked] = useState<LikedReview | null>(null);
  const [likedFetchTick, setLikedFetchTick] = useState(0);

  // Re-fetch liked reviews whenever this screen gains focus (covers the case
  // where the user liked a review on another screen and then navigated back)
  useFocusEffect(useCallback(() => {
    setLikedFetchTick(t => t + 1);
  }, []));

  // Fetch reviewer username for the modal
  useEffect(() => {
    const uid = viewingOther ?? user?.id;
    if (!uid) return;
    supabase
      .from('profiles')
      .select('username')
      .eq('id', uid)
      .single()
      .then(({ data }) => { if (data?.username) setProfileUsername(data.username); });
  }, [viewingOther, user?.id]);

  // ── Load other user's reviews + like state ────────────────────────────────
  useEffect(() => {
    if (!viewingOther) return;

    async function loadReviewsAndLikes() {
      // 1. Fetch the reviews
      const { data } = await supabase
        .from('user_albums')
        .select('spotify_id, title, artist, artwork_url, year, rating, review, listened_at, duration_ms')
        .eq('user_id', viewingOther!)
        .not('review', 'is', null)
        .order('listened_at', { ascending: false });

      if (!data) return;
      setOtherReviews(data.map((a, i) => ({
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

      // 2. Fetch all likes for this user's reviews (one query for counts + own state)
      const { data: allLikes } = await supabase
        .from('likes')
        .select('user_id, target_id')
        .eq('target_type', 'review')
        .eq('target_owner_id', viewingOther!);

      const newMap = new Map<string, LikeState>();
      for (const like of (allLikes ?? []) as any[]) {
        const existing = newMap.get(like.target_id) ?? { liked: false, count: 0 };
        newMap.set(like.target_id, {
          count: existing.count + 1,
          liked: existing.liked || like.user_id === user?.id,
        });
      }
      setLikesMap(newMap);
    }

    loadReviewsAndLikes();
  }, [viewingOther, user?.id]);

  // ── Load like counts for own reviews (informational, no button) ───────────
  useEffect(() => {
    if (viewingOther || !user) return;

    supabase
      .from('likes')
      .select('target_id')
      .eq('target_type', 'review')
      .eq('target_owner_id', user.id)
      .then(({ data }) => {
        const newMap = new Map<string, LikeState>();
        for (const like of (data ?? []) as any[]) {
          const existing = newMap.get(like.target_id) ?? { liked: false, count: 0 };
          newMap.set(like.target_id, { count: existing.count + 1, liked: false });
        }
        setLikesMap(newMap);
      });
  }, [viewingOther, user?.id]);

  // ── Fetch liked reviews (own or other user) when liked tab is active ─────
  useEffect(() => {
    if (activeTab !== 'liked') return;
    const uid = viewingOther ?? user?.id;
    if (!uid) return;
    setLikedLoading(true);

    (async () => {
      const { data: likedRows } = await supabase
        .from('likes')
        .select('target_id, target_owner_id, created_at')
        .eq('user_id', uid)
        .eq('target_type', 'review')
        .order('created_at', { ascending: false });

      if (!likedRows || likedRows.length === 0) {
        setLikedReviews([]);
        setLikedLikesMap(new Map());
        setLikedLoading(false);
        return;
      }

      // target_id format is "{owner_uuid}_{spotify_id}" — UUID is 36 chars
      const parsed = (likedRows as any[]).map(r => ({
        ownerId:  (r.target_id as string).slice(0, 36),
        albumId:  (r.target_id as string).slice(37),
        likedAt:  r.created_at as string,
        targetId: r.target_id as string,
      }));

      // Group albumIds by ownerId to batch queries
      const byOwner = new Map<string, string[]>();
      for (const { ownerId, albumId } of parsed) {
        byOwner.set(ownerId, [...(byOwner.get(ownerId) ?? []), albumId]);
      }

      const ownerIds = [...byOwner.keys()];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', ownerIds);
      const usernameById = new Map<string, string>(
        (profiles ?? []).map((p: any) => [p.id as string, (p.username ?? '') as string])
      );

      const allReviews: LikedReview[] = [];
      for (const [ownerId, albumIds] of byOwner.entries()) {
        const { data } = await supabase
          .from('user_albums')
          .select('spotify_id, title, artist, artwork_url, year, rating, review, listened_at')
          .eq('user_id', ownerId)
          .in('spotify_id', albumIds)
          .not('review', 'is', null);
        if (!data) continue;
        for (const a of data as any[]) {
          const likedEntry = parsed.find(p => p.ownerId === ownerId && p.albumId === a.spotify_id);
          allReviews.push({
            id:         a.spotify_id,
            title:      a.title      ?? '',
            artist:     a.artist     ?? '',
            year:       a.year       ?? 0,
            rating:     a.rating     ?? 0,
            review:     a.review     ?? undefined,
            dateLogged: a.listened_at ?? undefined,
            artworkUrl: a.artwork_url ?? undefined,
            coverColor: COVER_COLORS[allReviews.length % COVER_COLORS.length],
            ownerId,
            username:   usernameById.get(ownerId) ?? '',
            likedAt:    likedEntry?.likedAt ?? '',
          });
        }
      }
      allReviews.sort((a, b) => b.likedAt.localeCompare(a.likedAt));

      // Fetch like counts for all these reviews
      const likedMap = new Map<string, LikeState>();
      for (const ownerId of ownerIds) {
        const { data: lks } = await supabase
          .from('likes')
          .select('user_id, target_id')
          .eq('target_type', 'review')
          .eq('target_owner_id', ownerId);
        for (const lk of (lks ?? []) as any[]) {
          const ex = likedMap.get(lk.target_id) ?? { liked: false, count: 0 };
          likedMap.set(lk.target_id, {
            count: ex.count + 1,
            liked: ex.liked || lk.user_id === user?.id,
          });
        }
      }

      setLikedReviews(allReviews);
      setLikedLikesMap(likedMap);
      setLikedLoading(false);
    })();
  }, [activeTab, viewingOther, user?.id, likedFetchTick]);

  // ── Unlike a review from the liked tab (own user) ─────────────────────────
  async function handleUnlikeLikedReview(review: LikedReview) {
    if (!user) return;
    const targetId = `${review.ownerId}_${review.id}`;
    setLikedReviews(prev => prev.filter(r => !(r.ownerId === review.ownerId && r.id === review.id)));
    setSelectedLiked(null);
    setLikedLikesMap(prev => {
      const m = new Map(prev);
      const ex = m.get(targetId) ?? { liked: true, count: 1 };
      m.set(targetId, { liked: false, count: Math.max(0, ex.count - 1) });
      return m;
    });
    await supabase.from('likes').delete()
      .eq('user_id', user.id)
      .eq('target_type', 'review')
      .eq('target_id', targetId);
  }

  // ── Toggle like on a review in another user's liked-reviews tab ───────────
  async function handleToggleLikedReviewLike(review: LikedReview) {
    if (!user) return;
    const targetId = `${review.ownerId}_${review.id}`;
    const current  = likedLikesMap.get(targetId) ?? { liked: false, count: 0 };
    setLikedLikesMap(prev => {
      const m = new Map(prev);
      m.set(targetId, { liked: !current.liked, count: Math.max(0, current.liked ? current.count - 1 : current.count + 1) });
      return m;
    });
    if (current.liked) {
      await supabase.from('likes').delete()
        .eq('user_id', user.id)
        .eq('target_type', 'review')
        .eq('target_id', targetId);
    } else {
      await supabase.from('likes').insert({
        user_id: user.id, target_type: 'review',
        target_id: targetId, target_owner_id: review.ownerId,
      });
    }
  }

  // ── Toggle like on another user's review ─────────────────────────────────
  async function handleToggleLike(album: LoggedAlbum) {
    if (!user || !viewingOther) return;
    const targetId = `${viewingOther}_${album.id}`;
    const current  = likesMap.get(targetId) ?? { liked: false, count: 0 };

    // Optimistic update
    const updated = new Map(likesMap);
    updated.set(targetId, {
      liked: !current.liked,
      count: Math.max(0, current.liked ? current.count - 1 : current.count + 1),
    });
    setLikesMap(updated);

    if (current.liked) {
      // Unlike
      const { error } = await supabase
        .from('likes')
        .delete()
        .eq('user_id',     user.id)
        .eq('target_type', 'review')
        .eq('target_id',   targetId);
      if (error) {
        console.error('[Reviews] unlike error:', error.message);
        setLikesMap(new Map(likesMap)); // revert
      }
    } else {
      // Like
      const { error } = await supabase
        .from('likes')
        .insert({
          user_id:         user.id,
          target_type:     'review',
          target_id:       targetId,
          target_owner_id: viewingOther,
        });
      if (error) {
        console.error('[Reviews] like error:', error.message);
        setLikesMap(new Map(likesMap)); // revert
      } else {
        // Notify the review owner
        supabase.from('notifications').insert({
          user_id:  viewingOther,   // recipient = review owner (user B)
          type:     'like_review',
          actor_id: user.id,        // sender   = liker        (user A)
        }).then(({ error: notifErr }) => {
          if (notifErr) {
            console.error('[Reviews] notification insert error:', notifErr.message, notifErr.code, notifErr.details);
          } else {
            console.log('[Reviews] notification inserted — user_id (owner):', viewingOther, 'actor_id (liker):', user.id);
          }
        });
      }
    }
  }

  // ── Data ──────────────────────────────────────────────────────────────────
  const sourceReviews = viewingOther
    ? otherReviews
    : loggedAlbums.filter((a) => !!a.review);

  // Fetch durations for any reviewed album that doesn't have one yet
  useEffect(() => {
    const missing = sourceReviews.filter(a => !a.durationMs).map(a => a.id);
    if (missing.length === 0) return;
    const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';
    fetch(`${API_URL}/api/album-durations?ids=${missing.join(',')}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((data: Record<string, number>) => {
        Object.entries(data).forEach(([id, ms]) => {
          if (viewingOther) {
            setOtherReviews(prev => prev.map(a => a.id === id ? { ...a, durationMs: ms } : a));
          } else {
            updateDuration(id, ms);
          }
        });
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceReviews.length, viewingOther]);

  const reviewed = useMemo(() => {
    if (shuffled) return shuffled;
    return applySort(sourceReviews, sortKey);
  }, [sourceReviews, sortKey, shuffled]);

  function handleSelectSort(key: SortKey) {
    if (key === 'shuffle') {
      setShuffled([...sourceReviews].sort(() => Math.random() - 0.5));
    } else {
      setShuffled(null);
    }
    setSortKey(key);
  }

  // Build the target_id prefix used for likes map lookups
  const ownerId = viewingOther ?? user?.id ?? '';

  const isDarkBorder = isDark ? '#2e2018' : '#e8e8e8';

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>

      {/* ── Tab bar ──────────────────────────────────────────────────────── */}
      <View style={[s.tabRow, { borderBottomColor: isDarkBorder }]}>
        <Pressable onPress={() => setActiveTab('reviews')} style={[s.tab, activeTab === 'reviews' && s.tabActive]}>
          <Text style={[s.tabText, { color: activeTab === 'reviews' ? '#D4A017' : '#a07850' }]}>Reviews</Text>
        </Pressable>
        <Pressable onPress={() => setActiveTab('liked')} style={[s.tab, activeTab === 'liked' && s.tabActive]}>
          <Text style={[s.tabText, { color: activeTab === 'liked' ? '#D4A017' : '#a07850' }]}>Liked Reviews</Text>
        </Pressable>
      </View>

      {/* ── Reviews tab ──────────────────────────────────────────────────── */}
      {activeTab === 'reviews' && (
        <>
          <SortBar
            sortKey={sortKey}
            count={sourceReviews.length}
            noun="reviews"
            isDark={isDark}
            onPress={() => setSheetOpen(true)}
          />
          <FlatList
            data={reviewed}
            keyExtractor={(item) => item.id}
            style={{ flex: 1 }}
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => (
              <View style={[s.separator, { backgroundColor: isDark ? '#2e2018' : '#ebebeb' }]} />
            )}
            ListEmptyComponent={() => (
              <View style={s.empty}>
                <Text style={[s.emptyTitle, { color: colors.text }]}>No reviews yet</Text>
                <Text style={[s.emptySubtext, { color: colors.subtext }]}>
                  Log an album and write your thoughts on it.
                </Text>
              </View>
            )}
            renderItem={({ item }) => {
              const targetId  = `${ownerId}_${item.id}`;
              const likeState = likesMap.get(targetId) ?? { liked: false, count: 0 };
              return (
                <ReviewRow
                  album={item}
                  colors={colors}
                  isDark={isDark}
                  onPress={() => setSelectedReview(item)}
                  likeCount={likeState.count}
                  isLiked={likeState.liked}
                  onLike={viewingOther ? () => handleToggleLike(item) : undefined}
                />
              );
            }}
          />
          <SortSheet
            visible={sheetOpen}
            activeKey={sortKey}
            onSelect={handleSelectSort}
            onClose={() => setSheetOpen(false)}
            isDark={isDark}
          />
        </>
      )}

      {/* ── Liked Reviews tab ────────────────────────────────────────────── */}
      {activeTab === 'liked' && (
        likedLoading ? (
          <View style={s.likedLoading}>
            <ActivityIndicator color="#D4A017" size="large" />
          </View>
        ) : (
          <FlatList
            data={likedReviews}
            keyExtractor={(item) => `${item.ownerId}_${item.id}`}
            style={{ flex: 1 }}
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => (
              <View style={[s.separator, { backgroundColor: isDark ? '#2e2018' : '#ebebeb' }]} />
            )}
            ListEmptyComponent={() => (
              <View style={s.empty}>
                <Text style={[s.emptyTitle, { color: colors.text }]}>No liked reviews</Text>
                <Text style={[s.emptySubtext, { color: colors.subtext }]}>
                  {viewingOther ? 'This user has not liked any reviews yet.' : 'Like reviews from other users to find them here.'}
                </Text>
              </View>
            )}
            renderItem={({ item }) => {
              const targetId  = `${item.ownerId}_${item.id}`;
              const likeState = likedLikesMap.get(targetId) ?? { liked: false, count: 0 };
              return (
                <ReviewRow
                  album={item}
                  colors={colors}
                  isDark={isDark}
                  byUsername={item.username}
                  onPress={() => setSelectedLiked(item)}
                  likeCount={likeState.count}
                  isLiked={likeState.liked}
                  onLike={!viewingOther
                    ? () => handleUnlikeLikedReview(item)
                    : () => handleToggleLikedReviewLike(item)
                  }
                />
              );
            }}
          />
        )
      )}

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      {selectedReview && (() => {
        const targetId  = `${ownerId}_${selectedReview.id}`;
        const likeState = likesMap.get(targetId) ?? { liked: false, count: 0 };
        return (
          <ReviewDetailModal
            album={selectedReview}
            isDark={isDark}
            colors={colors}
            reviewerUsername={profileUsername}
            likeState={likeState}
            onLike={viewingOther ? () => handleToggleLike(selectedReview) : undefined}
            onClose={() => setSelectedReview(null)}
            onAlbumPress={() => {
              const a = selectedReview;
              setSelectedReview(null);
              router.push({ pathname: '/album-detail', params: { id: a.id, title: a.title, artist: a.artist, year: String(a.year ?? ''), artworkUrl: a.artworkUrl ?? '' } });
            }}
            onUsernamePress={viewingOther ? (username) => { setSelectedReview(null); navigateToProfile(username, router); } : undefined}
          />
        );
      })()}

      {selectedLiked && (() => {
        const targetId  = `${selectedLiked.ownerId}_${selectedLiked.id}`;
        const likeState = likedLikesMap.get(targetId) ?? { liked: false, count: 0 };
        return (
          <ReviewDetailModal
            album={selectedLiked}
            isDark={isDark}
            colors={colors}
            reviewerUsername={selectedLiked.username}
            likeState={likeState}
            onLike={!viewingOther
              ? () => handleUnlikeLikedReview(selectedLiked)
              : () => handleToggleLikedReviewLike(selectedLiked)
            }
            onClose={() => setSelectedLiked(null)}
            onAlbumPress={() => {
              const a = selectedLiked;
              setSelectedLiked(null);
              router.push({ pathname: '/album-detail', params: { id: a.id, title: a.title, artist: a.artist, year: String(a.year ?? ''), artworkUrl: a.artworkUrl ?? '' } });
            }}
            onUsernamePress={(username) => { setSelectedLiked(null); navigateToProfile(username, router); }}
          />
        );
      })()}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:   { flex: 1 },
  listContent: { paddingVertical: 8, paddingBottom: 48 },

  // Tab bar
  tabRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive:   { borderBottomColor: '#D4A017' },
  tabText:     { fontSize: 14, fontWeight: '600' },
  likedLoading:{ flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Row
  row:       { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 16, gap: 14 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 94 },

  // Thumbnail
  thumb:         { width: 64, height: 64, borderRadius: 6, flexShrink: 0 },
  thumbFallback: { justifyContent: 'center', alignItems: 'center' },
  thumbInitial:  { color: 'rgba(255,255,255,0.5)', fontSize: 22, fontWeight: '700' },

  // Text block
  info:   { flex: 1, gap: 4 },
  title:  { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  artist: { fontSize: 13 },
  byUser:      { fontSize: 12, fontWeight: '600' },
  review:      { fontSize: 13, lineHeight: 20, fontStyle: 'italic', marginTop: 2 },
  dateListend: { fontSize: 11, marginTop: 3 },

  // Volume badge
  badge:     { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  badgeBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 1.5 },
  badgeBar:  { width: 2.5, borderRadius: 1 },
  badgeNum:  { color: '#D4A017', fontSize: 10, fontWeight: '700', lineHeight: 15 },

  // Like
  likeRow:   { marginTop: 4 },
  likeBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  likeCount: { fontSize: 12, fontWeight: '600' },

  // Empty state
  empty:        { alignItems: 'center', marginTop: 80, paddingHorizontal: 32 },
  emptyTitle:   { fontSize: 17, fontWeight: '600', marginBottom: 8 },
  emptySubtext: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});

// ─── Modal styles ──────────────────────────────────────────────────────────────

const mrd = StyleSheet.create({
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle:  { fontSize: 16, fontWeight: '700' },
  albumRow:     { flexDirection: 'row', gap: 14, padding: 20, paddingBottom: 12 },
  art:          { width: 80, height: 80, borderRadius: 8, flexShrink: 0 },
  albumTitle:   { fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
  albumArtist:  { fontSize: 13 },
  ratingRow:    { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  authorRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 10 },
  avatar:       { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  avatarLetter: { color: '#fff', fontSize: 12, fontWeight: '700' },
  username:     { color: '#D4A017', fontWeight: '600', fontSize: 14 },
  listenedDate: { fontSize: 12 },
  reviewText:   { fontSize: 14, lineHeight: 22, fontStyle: 'italic', paddingHorizontal: 20, paddingVertical: 6 },
  likeCommentRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, marginTop: 6 },
  likeBtn:        { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 6 },
  likeCount:      { fontSize: 13, fontWeight: '600' },
  commentsToggle:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth },
  commentsToggleText: { fontSize: 12 },
});
