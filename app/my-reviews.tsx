import {
  StyleSheet,
  View,
  Text,
  Image,
  Pressable,
  FlatList,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useState, useEffect } from 'react';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAlbums, LoggedAlbum } from '@/context/AlbumsContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

// ─── Volume badge (with number) ───────────────────────────────────────────────

const BAR_HEIGHTS = [3, 4, 5, 6, 7, 9, 11, 13, 15, 17];

function VolumeBadge({ rating }: { rating: number }) {
  return (
    <View style={s.badge}>
      <FontAwesome name="volume-up" size={10} color={rating > 0 ? '#e8963a' : '#3a2818'} />
      <View style={s.badgeBars}>
        {BAR_HEIGHTS.map((h, i) => (
          <View
            key={i}
            style={[s.badgeBar, { height: h, backgroundColor: i + 1 <= rating ? '#e8963a' : '#2a1e14' }]}
          />
        ))}
      </View>
      {rating > 0 && <Text style={s.badgeNum}>{rating}</Text>}
    </View>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type LikeState = { liked: boolean; count: number };

// ─── Review row ───────────────────────────────────────────────────────────────

function ReviewRow({
  album,
  colors,
  isDark,
  onPress,
  likeCount = 0,
  isLiked = false,
  onLike,
}: {
  album: LoggedAlbum;
  colors: typeof Colors.light;
  isDark: boolean;
  onPress: () => void;
  likeCount?: number;
  isLiked?: boolean;
  /** Defined only when the viewer can like this review (i.e. it belongs to another user). */
  onLike?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.row, { opacity: pressed ? 0.7 : 1 }]}>
      {/* Thumbnail */}
      {album.artworkUrl ? (
        <Image source={{ uri: album.artworkUrl }} style={s.thumb} resizeMode="cover" />
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
        <VolumeBadge rating={album.rating} />
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
                  color={isLiked ? '#e8963a' : '#7a5535'}
                />
                {likeCount > 0 && (
                  <Text style={[s.likeCount, { color: isLiked ? '#e8963a' : '#7a5535' }]}>
                    {likeCount}
                  </Text>
                )}
              </Pressable>
            ) : likeCount > 0 ? (
              // Read-only — own review, just show how many people liked it
              <View style={s.likeBtn}>
                <FontAwesome name="heart" size={13} color="#e8963a" />
                <Text style={[s.likeCount, { color: '#e8963a' }]}>{likeCount}</Text>
              </View>
            ) : null}
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

const COVER_COLORS = ['#2d5a27','#7a4a2e','#1a3018','#d4a017','#7a3a1a','#8b1a1a','#1a5a5a','#4a2818'];

export default function MyReviewsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { loggedAlbums } = useAlbums();
  const { user } = useAuth();
  const { userId: paramUserId } = useLocalSearchParams<{ userId?: string }>();

  const viewingOther = paramUserId || null;
  const [otherReviews, setOtherReviews] = useState<LoggedAlbum[]>([]);
  const [likesMap, setLikesMap] = useState<Map<string, LikeState>>(new Map());

  // ── Load other user's reviews + like state ────────────────────────────────
  useEffect(() => {
    if (!viewingOther) return;

    async function loadReviewsAndLikes() {
      // 1. Fetch the reviews
      const { data } = await supabase
        .from('user_albums')
        .select('spotify_id, title, artist, artwork_url, year, rating, review, listened_at')
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
  const reviewed = viewingOther
    ? otherReviews
    : loggedAlbums.filter((a) => !!a.review);

  // Build the target_id prefix used for likes map lookups
  const ownerId = viewingOther ?? user?.id ?? '';

  return (
    <FlatList
      data={reviewed}
      keyExtractor={(item) => item.id}
      style={[s.container, { backgroundColor: colors.background }]}
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
            onPress={() => router.push({ pathname: '/album-detail', params: { id: item.id } })}
            likeCount={likeState.count}
            isLiked={likeState.liked}
            onLike={viewingOther ? () => handleToggleLike(item) : undefined}
          />
        );
      }}
    />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:   { flex: 1 },
  listContent: { paddingVertical: 8, paddingBottom: 48 },

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
  review: { fontSize: 13, lineHeight: 20, fontStyle: 'italic', marginTop: 2 },

  // Volume badge
  badge:     { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  badgeBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 1.5 },
  badgeBar:  { width: 2.5, borderRadius: 1 },
  badgeNum:  { color: '#e8963a', fontSize: 10, fontWeight: '700', lineHeight: 15 },

  // Like
  likeRow:   { marginTop: 4 },
  likeBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  likeCount: { fontSize: 12, fontWeight: '600' },

  // Empty state
  empty:        { alignItems: 'center', marginTop: 80, paddingHorizontal: 32 },
  emptyTitle:   { fontSize: 17, fontWeight: '600', marginBottom: 8 },
  emptySubtext: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
