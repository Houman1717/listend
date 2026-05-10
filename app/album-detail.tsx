import {
  StyleSheet,
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ActivityIndicator,
  SafeAreaView,
  Linking,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
import { useState, useRef, useEffect } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAlbums } from '@/context/AlbumsContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { ReviewComment, CommentsSection, avatarColor } from '@/components/ReviewComments';
import { navigateToProfile } from '@/lib/navigateToProfile';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<a[^>]*>.*?<\/a>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function formatListeners(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M listeners`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K listeners`;
  return `${n} listeners`;
}

function formatRuntime(totalMs: number): string {
  const totalSec = Math.floor(totalMs / 1000);
  const hours    = Math.floor(totalSec / 3600);
  const mins     = Math.round((totalSec % 3600) / 60);
  if (hours > 0) return `${hours} hr ${mins} min`;
  return `${mins} min`;
}

function formatLoggedDate(raw: string): string {
  const d = new Date(raw);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return raw;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Track = {
  number: number;
  id: string;
  title: string;
  durationMs: number;
  featuredArtists: string[];
};

type LastfmAlbum = {
  listeners: number;
  description: string;
  tags: string[];
};

type GeniusCredits = {
  producers: string[] | null;
  writers:   string[] | null;
  credits:   { label: string; artists: string[] }[];
};

type SimilarAlbum = {
  id:         string;
  title:      string;
  artist:     string;
  artworkUrl: string;
  year:       number;
};

type LikeState = { liked: boolean; count: number };

type CommunityReview = {
  id:       string;   // target_id = `${userId}_${albumId}`
  userId:   string;
  username: string;
  rating:   number;
  text?:    string;
  dateStr?: string;
};

// ─── Fake review data ─────────────────────────────────────────────────────────

type FakeReview = {
  id: string;
  username: string;
  rating: number;
  text: string;
  dateStr: string;
  likeCount: number;
};

const FAKE_ALBUM_REVIEWS: FakeReview[] = [
  { id: 'f1', username: 'vinylhead_92',  rating: 9,  text: 'This album completely changed how I listen to music. Every track flows perfectly into the next — no skips whatsoever.',       dateStr: '3 days ago', likeCount: 41 },
  { id: 'f2', username: 'moodboard_mel', rating: 8,  text: 'Production is immaculate. A few tracks feel like filler but the highs are so high it barely matters. Standout project.',    dateStr: '5 days ago', likeCount: 27 },
  { id: 'f3', username: 'crate_digger',  rating: 10, text: 'Genuinely one of the best listening experiences I\'ve had all year. The emotion and craft on display here is unmatched.',   dateStr: '1 week ago', likeCount: 88 },
  { id: 'f4', username: 'lofi_lyric',    rating: 7,  text: 'Really solid album, grew on me more and more with each listen. The second half especially hits different late at night.',   dateStr: '1 week ago', likeCount: 19 },
];

// ─── Review mock data ─────────────────────────────────────────────────────────

const MOCK_COMMENTS: ReviewComment[] = [
  // f1 – vinylhead_92 (2 comments + 1 reply)
  { id: 'c1', reviewId: 'f1', userId: 'u1', username: 'tape_collector', body: 'Completely agree — the transitions are insane on this one.',          createdAt: '2 days ago' },
  { id: 'c2', reviewId: 'f1', userId: 'u2', username: 'nightfreq',      body: 'Which track hit you hardest on first listen?',                        createdAt: '2 days ago' },
  { id: 'c3', reviewId: 'f1', parentCommentId: 'c2', userId: 'u3', username: 'vinylhead_92', body: 'Track 5, no question. The way it builds out of nowhere…', createdAt: '1 day ago' },
  // f2 – moodboard_mel (2 comments)
  { id: 'c4', reviewId: 'f2', userId: 'u4', username: 'lo_hz',        body: 'Curious which tracks you thought were filler?',                       createdAt: '4 days ago' },
  { id: 'c5', reviewId: 'f2', userId: 'u5', username: 'wavelength_w', body: 'The highs are genuinely unreal. Standout for sure.',                   createdAt: '3 days ago' },
  // f3 – crate_digger (3 comments + 1 reply)
  { id: 'c6', reviewId: 'f3', userId: 'u6', username: 'deep_cuts99',  body: 'GOTY contender. Shared this with three people already.',               createdAt: '6 days ago' },
  { id: 'c7', reviewId: 'f3', userId: 'u7', username: 'auralfix',     body: 'The craft is what separates it — nothing sounds accidental.',           createdAt: '5 days ago' },
  { id: 'c8', reviewId: 'f3', parentCommentId: 'c7', userId: 'u8', username: 'crate_digger', body: 'Exactly. Every detail feels intentional.',       createdAt: '5 days ago' },
  { id: 'c9', reviewId: 'f3', userId: 'u9', username: 'sideB_fan',    body: 'Emotion and craft — that\'s the perfect way to put it.',               createdAt: '4 days ago' },
];

// ─── Rating picker ────────────────────────────────────────────────────────────

const RATING_LABELS: Record<number, string> = {
  1: 'Skip', 2: 'Rough', 3: 'Forgettable', 4: 'Underwhelming',
  5: 'Basic', 6: 'Likable', 7: 'Strong', 8: 'Standout',
  9: 'Classic', 10: 'Timeless / No Skips',
};
const BAR_HEIGHTS = [6, 9, 12, 15, 18, 22, 26, 30, 34, 38];

function RatingPicker({ rating, onChange, isDark }: { rating: number; onChange: (r: number) => void; isDark: boolean }) {
  const [trackWidth, setTrackWidth] = useState(0);
  const activeColor   = '#D4A017';
  const inactiveColor = isDark ? '#2a1e14' : '#e0e0e0';

  const tap = Gesture.Tap()
    .runOnJS(true)
    .onEnd(e => {
      const val = Math.ceil((e.x / trackWidth) * 10);
      onChange(Math.max(1, Math.min(10, val)));
    });

  const pan = Gesture.Pan()
    .runOnJS(true)
    .onUpdate(e => {
      const val = Math.ceil((e.x / trackWidth) * 10);
      onChange(Math.max(1, Math.min(10, val)));
    });

  const gesture = Gesture.Simultaneous(tap, pan);

  return (
    <View style={s.ratingContainer}>
      <View style={s.ratingRow}>
        <FontAwesome name="volume-up" size={22} color={rating > 0 ? activeColor : inactiveColor} />
        <View style={{ flex: 1 }} onLayout={e => setTrackWidth(e.nativeEvent.layout.width)}>
          {trackWidth > 0 && (
            <GestureDetector gesture={gesture}>
              <View style={s.barsTrack}>
                {BAR_HEIGHTS.map((h, i) => (
                  <View key={i} style={[s.bar, { height: h, backgroundColor: i + 1 <= rating ? activeColor : inactiveColor }]} />
                ))}
              </View>
            </GestureDetector>
          )}
        </View>
        <View style={s.ratingNumBox}>
          <Text style={[s.ratingNumLarge, { color: rating > 0 ? activeColor : inactiveColor }]}>
            {rating > 0 ? rating : '–'}
          </Text>
        </View>
      </View>
      <Text style={[s.ratingHint, { color: isDark ? '#a07850' : '#a07850' }]}>
        {rating > 0 ? RATING_LABELS[rating] : ' '}
      </Text>
    </View>
  );
}

// ─── Volume badge (speaker + bars + number) ──────────────────────────────────

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

// ─── Mini rating bar (read-only display) ─────────────────────────────────────

function MiniRatingBar({ rating, isDark }: { rating: number; isDark: boolean }) {
  const activeColor = '#D4A017';
  const inactiveColor = isDark ? '#3a2818' : '#ddd';
  return (
    <View style={s.miniBarRow}>
      <View style={s.miniBarTrack}>
        {BAR_HEIGHTS.map((h, i) => (
          <View
            key={i}
            style={[s.miniBar, { height: Math.round(h * 0.55), backgroundColor: i + 1 <= rating ? activeColor : inactiveColor }]}
          />
        ))}
      </View>
      <Text style={[s.miniBarNum, { color: rating > 0 ? activeColor : inactiveColor }]}>{rating > 0 ? rating : '–'}</Text>
    </View>
  );
}

// ─── Community Rating ─────────────────────────────────────────────────────────

// Mock distribution: index i = rating (i+1), value = count of ratings at that score
// In production this would come from an API
const COMMUNITY_DISTRIBUTION = [2, 3, 5, 8, 14, 22, 35, 48, 62, 41];
const COMMUNITY_TOTAL = COMMUNITY_DISTRIBUTION.reduce((a, b) => a + b, 0);
const COMMUNITY_AVG = (
  COMMUNITY_DISTRIBUTION.reduce((sum, count, i) => sum + count * (i + 1), 0) / COMMUNITY_TOTAL
).toFixed(1);

function CommunityRatingSection({
  isDark,
  colors,
  sectionBg,
  borderColor,
}: {
  isDark: boolean;
  colors: { text: string; subtext: string; background: string };
  sectionBg: string;
  borderColor: string;
}) {
  const fillLevel = parseFloat(COMMUNITY_AVG); // e.g. 7.7
  const activeColor = '#D4A017';
  const inactiveColor = isDark ? '#2a1e14' : '#e0e0e0';

  return (
    <View style={[s.section, { backgroundColor: sectionBg, borderColor }]}>
      <Text style={[s.sectionLabel, { color: colors.subtext, marginTop: 0 }]}>Community Rating</Text>

      <View style={s.communityRow}>
        {/* Avg score */}
        <View style={s.communityAvgBlock}>
          <Text style={[s.communityAvg, { color: colors.text }]}>{COMMUNITY_AVG}</Text>
          <Text style={[s.communityAvgSub, { color: colors.subtext }]}>
            {COMMUNITY_TOTAL} ratings
          </Text>
        </View>

        {/* Volume bar — filled to avg, same visual language as the rating picker */}
        <View style={s.communityVolumeWrap}>
          <FontAwesome name="volume-up" size={18} color={activeColor} />
          <View style={s.communityVolumeTrack}>
            {BAR_HEIGHTS.map((h, i) => {
              const scaledH = Math.round(h * 1.35);
              const isActive  = i + 1 <= Math.floor(fillLevel);
              const isPartial = i === Math.floor(fillLevel);
              const frac = fillLevel % 1;
              return (
                <View
                  key={i}
                  style={[
                    s.communityVolumeBar,
                    {
                      height: scaledH,
                      backgroundColor: (isActive || isPartial) ? activeColor : inactiveColor,
                      opacity: isPartial ? Math.max(0.25, frac) : 1,
                    },
                  ]}
                />
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Review Card ──────────────────────────────────────────────────────────────

function ReviewCard({
  username,
  rating,
  text,
  dateStr,
  isOwn,
  isDark,
  colors,
  sectionBg,
  borderColor,
  likeCount = 0,
  isLiked = false,
  onLike,
}: {
  username: string;
  rating: number;
  text?: string;
  dateStr?: string;
  isOwn?: boolean;
  isDark: boolean;
  colors: { text: string; subtext: string; background: string };
  sectionBg: string;
  borderColor: string;
  likeCount?: number;
  isLiked?: boolean;
  /** Defined only when the viewer can like this review (i.e. belongs to another user). */
  onLike?: () => void;
}) {
  return (
    <View
      style={[
        s.reviewCard,
        { backgroundColor: sectionBg, borderColor },
        isOwn && s.reviewCardOwn,
      ]}>
      <View style={s.reviewCardHeader}>
        <Text style={[s.reviewCardUsername, { color: isOwn ? '#D4A017' : colors.text }]}>
          {username}
        </Text>
        {rating >= 1 && (
          <View style={s.ratingBadge}>
            <Text style={s.ratingBadgeText}>{rating}</Text>
          </View>
        )}
      </View>
      {text ? (
        <Text style={[s.reviewCardText, { color: colors.text }]} numberOfLines={4}>
          {text}
        </Text>
      ) : (
        <Text style={[s.reviewCardNoText, { color: colors.subtext }]}>No review written.</Text>
      )}
      {dateStr && (
        <Text style={[s.reviewCardDate, { color: colors.subtext }]}>{dateStr}</Text>
      )}
      {(onLike !== undefined || likeCount > 0) && (
        <View style={s.reviewCardLikeRow}>
          {onLike !== undefined ? (
            <Pressable onPress={onLike} hitSlop={8} style={s.reviewCardLikeBtn}>
              <FontAwesome
                name={isLiked ? 'heart' : 'heart-o'}
                size={12}
                color={isLiked ? '#D4A017' : '#7a5535'}
              />
              {likeCount > 0 && (
                <Text style={[s.reviewCardLikeCount, { color: isLiked ? '#D4A017' : '#7a5535' }]}>
                  {likeCount}
                </Text>
              )}
            </Pressable>
          ) : likeCount > 0 ? (
            <View style={s.reviewCardLikeBtn}>
              <FontAwesome name="heart" size={12} color="#D4A017" />
              <Text style={[s.reviewCardLikeCount, { color: '#D4A017' }]}>{likeCount}</Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

// ─── Album review card (home-screen style) ────────────────────────────────────

function AlbumReviewCard({
  review,
  liked,
  onLike,
  onPress,
  onUsernamePress,
  isDark,
  colors,
  borderColor,
  isOwn = false,
  fullWidth = false,
  highlighted = false,
  onLayout,
  commentCount = 0,
  onCommentCountPress,
  comments,
  commentsExpanded = false,
  onAddComment,
}: {
  review: FakeReview;
  liked: boolean;
  onLike: () => void;
  onPress?: () => void;
  onUsernamePress?: (username: string) => void;
  isDark: boolean;
  colors: { text: string; subtext: string; background: string };
  borderColor: string;
  isOwn?: boolean;
  fullWidth?: boolean;
  highlighted?: boolean;
  onLayout?: (y: number) => void;
  commentCount?: number;
  onCommentCountPress?: () => void;
  comments?: ReviewComment[];
  commentsExpanded?: boolean;
  onAddComment?: (body: string, parentId?: string | null, username?: string, replyToUsername?: string, avatarUrl?: string | null) => void;
}) {
  const displayCount = review.likeCount + (liked ? 1 : 0);
  const cardStyle = [
    s.reviewCard,
    { backgroundColor: isDark ? '#2e2018' : '#fff', borderColor },
    isOwn && s.reviewCardOwn,
    fullWidth && { width: '100%' },
    highlighted && { borderColor: '#D4A017', borderWidth: 1.5 },
  ];
  const layoutHandler = onLayout ? (e: any) => onLayout(e.nativeEvent.layout.y) : undefined;

  const cardContent = (
    <>
      {/* Header: avatar + username + rating under username */}
      <View style={s.reviewCardHeader}>
        <Pressable
          style={[arc.userRow, { alignItems: 'flex-start' }]}
          onPress={isOwn ? undefined : () => onUsernamePress?.(review.username)}
          hitSlop={6}>
          <View style={[arc.avatar, { backgroundColor: isOwn ? '#D4A017' : avatarColor(review.username) }]}>
            <Text style={arc.avatarLetter}>{review.username[0].toUpperCase()}</Text>
          </View>
          <View style={{ gap: 3 }}>
            <Text style={[arc.username, { color: '#D4A017' }]} numberOfLines={1}>
              @{review.username}
            </Text>
            {review.rating >= 1 && <VolumeBadge rating={review.rating} isDark={isDark} />}
          </View>
        </Pressable>
      </View>

      {/* Review text */}
      <Text style={[arc.reviewText, { color: isDark ? '#a07850' : '#4a3020' }]} numberOfLines={fullWidth ? 0 : 3}>
        "{review.text}"
      </Text>

      {/* Footer: date | comments | like */}
      <View style={arc.footer}>
        <Text style={[s.reviewCardDate, { color: colors.subtext }]}>{review.dateStr}</Text>
        <View style={arc.footerRight}>
          {commentCount > 0 || fullWidth ? (
            <Pressable
              onPress={onCommentCountPress}
              hitSlop={8}
              style={arc.commentCountBtn}>
              <FontAwesome name="comment-o" size={11} color={commentsExpanded ? '#D4A017' : (isDark ? '#7a5535' : '#a07850')} />
              <Text style={[arc.commentCountText, { color: commentsExpanded ? '#D4A017' : (isDark ? '#7a5535' : '#a07850') }]}>
                {commentCount > 0 ? `${commentCount}` : '0'}
              </Text>
            </Pressable>
          ) : null}
          {!isOwn && (
            <Pressable onPress={onLike} hitSlop={8} style={s.reviewCardLikeBtn}>
              <FontAwesome
                name={liked ? 'heart' : 'heart-o'}
                size={12}
                color={liked ? '#D4A017' : (isDark ? '#7a5535' : '#a07850')}
              />
              <Text style={[s.reviewCardLikeCount, { color: liked ? '#D4A017' : (isDark ? '#7a5535' : '#a07850') }]}>
                {displayCount}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Comments section — only in full-width (modal) expanded mode */}
      {commentsExpanded && fullWidth && (
        <CommentsSection
          comments={comments ?? []}
          isDark={isDark}
          colors={colors}
          onAddComment={onAddComment}
          onUsernamePress={onUsernamePress}
        />
      )}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        onLayout={layoutHandler}
        style={({ pressed }) => [...cardStyle, pressed && { opacity: 0.75 }]}>
        {cardContent}
      </Pressable>
    );
  }
  return (
    <View style={cardStyle} onLayout={layoutHandler}>
      {cardContent}
    </View>
  );
}

// ─── Single review modal (home-page style) ────────────────────────────────────

function AlbumSingleReviewModal({
  review,
  albumTitle,
  albumArtist,
  albumYear,
  albumArtwork,
  liked,
  onLike,
  comments,
  commentsExpanded,
  onToggleComments,
  onAddComment,
  onClose,
  onUsernamePress,
  isDark,
  colors,
}: {
  review: FakeReview;
  albumTitle: string;
  albumArtist: string;
  albumYear: number;
  albumArtwork: string;
  liked: boolean;
  onLike: () => void;
  comments: ReviewComment[];
  commentsExpanded: boolean;
  onToggleComments: () => void;
  onAddComment: (body: string, parentId?: string | null, username?: string, replyToUsername?: string, avatarUrl?: string | null) => void;
  onClose: () => void;
  onUsernamePress?: (username: string) => void;
  isDark: boolean;
  colors: { text: string; subtext: string; background: string };
}) {
  const [localLiked, setLocalLiked] = useState(liked);
  const [localLikeCount, setLocalLikeCount] = useState(review.likeCount);
  const border = isDark ? '#2a1e14' : '#e5e5e5';

  function handleLike() {
    setLocalLiked(prev => {
      setLocalLikeCount(c => prev ? c - 1 : c + 1);
      return !prev;
    });
    onLike();
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: colors.background }}>
        <SafeAreaView style={{ flex: 1 }}>

          {/* Header */}
          <View style={[arm.header, { borderBottomColor: border }]}>
            <Pressable onPress={onClose} hitSlop={12}>
              <FontAwesome name="chevron-down" size={16} color={isDark ? '#A08060' : '#6B4C35'} />
            </Pressable>
            <Text style={[arm.headerTitle, { color: isDark ? '#f5e6c8' : '#1A0F0A' }]}>Review</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView
            contentContainerStyle={[arm.body, { paddingBottom: 40 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>

            {/* Album row */}
            <View style={arm.albumRow}>
              {albumArtwork ? (
                <ExpoImage source={{ uri: albumArtwork }} style={arm.art} contentFit="cover" cachePolicy="disk" />
              ) : (
                <View style={[arm.art, { backgroundColor: isDark ? '#2e2018' : '#e0e0e0', justifyContent: 'center', alignItems: 'center' }]}>
                  <FontAwesome name="music" size={20} color="#7a5535" />
                </View>
              )}
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[arm.albumTitle, { color: isDark ? '#f5e6c8' : '#1A0F0A' }]}>{albumTitle}</Text>
                <Text style={[arm.albumArtist, { color: isDark ? '#A08060' : '#6B4C35' }]}>
                  {albumArtist}{albumYear > 0 ? ` · ${albumYear}` : ''}
                </Text>
              </View>
            </View>

            {/* Author + date + rating */}
            <Pressable
              style={arm.authorRow}
              onPress={() => { onClose(); onUsernamePress?.(review.username); }}
              disabled={!onUsernamePress}>
              <View style={[arm.avatar, { backgroundColor: avatarColor(review.username) }]}>
                <Text style={arm.avatarLetter}>{review.username[0].toUpperCase()}</Text>
              </View>
              <View style={{ gap: 3 }}>
                <Text style={arm.username}>@{review.username}</Text>
                {review.rating >= 1 && <VolumeBadge rating={review.rating} isDark={isDark} />}
                <Text style={[arm.dateText, { color: isDark ? '#A08060' : '#6B4C35' }]}>{review.dateStr}</Text>
              </View>
            </Pressable>

            {/* Review text */}
            {review.text ? (
              <Text style={[arm.reviewText, { color: isDark ? '#A08060' : '#6B4C35' }]}>
                "{review.text}"
              </Text>
            ) : (
              <Text style={[arm.reviewText, { color: isDark ? '#4a3020' : '#C8B89A', fontStyle: 'italic' }]}>
                No written review.
              </Text>
            )}

            {/* Like + comments row */}
            <View style={[arm.likeCommentRow, { borderColor: border }]}>
              <Pressable onPress={handleLike} hitSlop={8} style={arm.likeBtn}>
                <FontAwesome
                  name={localLiked ? 'heart' : 'heart-o'}
                  size={15}
                  color={localLiked ? '#D4A017' : (isDark ? '#A08060' : '#6B4C35')}
                />
                <Text style={[arm.likeCount, { color: localLiked ? '#D4A017' : (isDark ? '#A08060' : '#6B4C35') }]}>
                  {localLikeCount}
                </Text>
              </Pressable>

              <Pressable
                onPress={onToggleComments}
                hitSlop={8}
                style={[arm.commentsToggle, { borderColor: border, flex: 1, marginBottom: 0 }]}>
                <FontAwesome
                  name="comment-o"
                  size={13}
                  color={commentsExpanded ? '#D4A017' : (isDark ? '#6B4C35' : '#A08060')}
                />
                <Text style={[arm.commentsToggleText, { color: commentsExpanded ? '#D4A017' : (isDark ? '#6B4C35' : '#A08060') }]}>
                  {comments.length === 0
                    ? 'No comments yet'
                    : `${comments.length} comment${comments.length !== 1 ? 's' : ''}`}
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
                comments={comments}
                isDark={isDark}
                colors={colors}
                onAddComment={onAddComment}
                onUsernamePress={(username) => { onClose(); onUsernamePress?.(username); }}
              />
            )}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const arm = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 15, fontWeight: '700' },
  body: { paddingHorizontal: 20, paddingTop: 20, gap: 14 },
  albumRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  art: { width: 64, height: 64, borderRadius: 8 },
  albumTitle: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  albumArtist: { fontSize: 13 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  ratingBadge: { backgroundColor: '#D4A017', borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 },
  ratingNum: { color: '#fff', fontSize: 11, fontWeight: '700' },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  avatarLetter: { color: '#fff', fontSize: 12, fontWeight: '700' },
  username: { fontSize: 13, fontWeight: '700', color: '#D4A017' },
  dateText: { fontSize: 11 },
  reviewText: { fontSize: 15, lineHeight: 24, fontStyle: 'italic' },
  likeCommentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingRight: 4 },
  likeCount: { fontSize: 14, fontWeight: '600' },
  commentsToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, marginBottom: 4 },
  commentsToggleText: { fontSize: 13, fontWeight: '500' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AlbumDetailScreen() {
  const colorScheme  = useColorScheme();
  const colors       = Colors[colorScheme ?? 'light'];
  const isDark       = colorScheme === 'dark';
  const router       = useRouter();
  const headerHeight = useHeaderHeight();

  const params = useLocalSearchParams<{
    id: string; title?: string; artist?: string; year?: string; artworkUrl?: string;
  }>();

  const { user } = useAuth();
  const [myUsername, setMyUsername] = useState('');
  useEffect(() => {
    if (!user?.id) return;
    supabase.from('profiles').select('username').eq('id', user.id).single()
      .then(({ data }) => { if (data?.username) setMyUsername(data.username); });
  }, [user?.id]);

  const {
    loggedAlbums, updateReview, updateDuration, playlists, addAlbumToPlaylist, removeAlbumFromPlaylist,
    wantToListen, addToWantToListen, removeFromWantToListen,
    setPendingAlbum,
  } = useAlbums();

  const loggedAlbum = loggedAlbums.find(a => a.id === params.id);

  const albumId       = params.id ?? '';
  const albumTitle    = params.title    ?? loggedAlbum?.title    ?? '';
  const albumArtist   = params.artist   ?? loggedAlbum?.artist   ?? '';
  const albumYear     = params.year ? parseInt(params.year, 10) : (loggedAlbum?.year ?? 0);
  const albumArtwork  = params.artworkUrl ?? loggedAlbum?.artworkUrl ?? '';
  const albumCoverColor = loggedAlbum?.coverColor ?? '#2e2018';

  // Edit state (logged albums only)
  const [rating, setRating]       = useState(loggedAlbum?.rating ?? 0);
  const [review, setReview]       = useState(loggedAlbum?.review ?? '');
  const [editMode, setEditMode]         = useState(false);
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [highlightedReviewId, setHighlightedReviewId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const modalScrollRef = useRef<ScrollView>(null);
  const reviewYPositions = useRef<Map<string, number>>(new Map());
  const [likedAlbumReviews, setLikedAlbumReviews] = useState<Set<string>>(new Set());
  const [expandedCommentsId, setExpandedCommentsId] = useState<string | null>(null);
  const [expandedAlbumReview, setExpandedAlbumReview] = useState<FakeReview | null>(null);
  const [singleReviewCommentsOpen, setSingleReviewCommentsOpen] = useState(false);
  const [commentsMap, setCommentsMap] = useState<Map<string, ReviewComment[]>>(() => {
    const m = new Map<string, ReviewComment[]>();
    for (const c of MOCK_COMMENTS) {
      m.set(c.reviewId, [...(m.get(c.reviewId) ?? []), c]);
    }
    return m;
  });

  function handleToggleComments(reviewId: string) {
    setExpandedCommentsId(prev => prev === reviewId ? null : reviewId);
  }

  function handleAddComment(reviewId: string, body: string, parentId?: string | null, commenterUsername?: string, replyToUsername?: string, avatarUrl?: string | null) {
    const newComment: ReviewComment = {
      id:              `local_${Date.now()}`,
      reviewId,
      parentCommentId: parentId ?? null,
      replyToUsername: replyToUsername ?? null,
      userId:          user?.id ?? 'local',
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
  }

  function handleReviewCardPress(review: FakeReview) {
    setExpandedAlbumReview(review);
    setSingleReviewCommentsOpen(false);
  }

  function handleReviewCommentCountPress(review: FakeReview) {
    setExpandedAlbumReview(review);
    setSingleReviewCommentsOpen(true);
  }


  function handleLikeAlbumReview(id: string) {
    setLikedAlbumReviews(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // Build review list — user's own review pinned first when available
  const userOwnReview: FakeReview | null =
    isLogged && loggedAlbum!.review
      ? {
          id: 'own',
          username: myUsername || 'me',
          rating: loggedAlbum!.rating,
          text: loggedAlbum!.review!,
          dateStr: formatLoggedDate(loggedAlbum!.dateLogged),
          likeCount: 0,
        }
      : null;

  const displayReviews: FakeReview[] = userOwnReview
    ? [userOwnReview, ...FAKE_ALBUM_REVIEWS]
    : FAKE_ALBUM_REVIEWS;

  // Remote data
  const [tracks, setTracks]               = useState<Track[] | null>(null);
  const [tracksLoading, setTracksLoading] = useState(true);
  const [lastfm, setLastfm]               = useState<LastfmAlbum | null>(null);
  const [albumTags, setAlbumTags]         = useState<string[]>([]);
  const [genius, setGenius]               = useState<GeniusCredits | null>(null);
  const [similar, setSimilar]             = useState<SimilarAlbum[] | null>(null);
  const [bioExpanded, setBioExpanded]     = useState(false);
  const [creditsExpanded, setCreditsExpanded] = useState(false);

  // Streaming links — constructed client-side; Odesli doesn't index Spotify/YTM for albums
  type StreamingLinks = { appleMusic: string | null; spotify: string | null; youtubeMusic: string | null; amazonMusic: string | null };
  const [showStreamSheet, setShowStreamSheet] = useState(false);

  const streamLinks: StreamingLinks = {
    appleMusic:   `https://music.apple.com/us/album/${albumId}`,
    spotify:      `https://open.spotify.com/search/${encodeURIComponent(`${albumTitle} ${albumArtist}`)}`,
    youtubeMusic: `https://music.youtube.com/search?q=${encodeURIComponent(`${albumTitle} ${albumArtist}`)}`,
    amazonMusic:  `https://music.amazon.com/search?q=${encodeURIComponent(`${albumTitle} ${albumArtist}`)}`,
  };

  // Community reviews + likes
  const [communityReviews, setCommunityReviews] = useState<CommunityReview[]>([]);
  const [reviewLikesMap, setReviewLikesMap]     = useState<Map<string, LikeState>>(new Map());

  const isLogged = !!loggedAlbum;
  const isWanted = wantToListen.some(a => a.id === albumId);
  const dirty    = isLogged && (rating !== loggedAlbum!.rating || review !== (loggedAlbum!.review ?? ''));

  // ── Fetch tracklist + Last.fm ──────────────────────────────────────────────
  useEffect(() => {
    if (!albumId) return;
    let cancelled = false;

    fetch(`${API_URL}/spotify/album/${albumId}/tracks`)
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then((data: Track[]) => {
        if (cancelled) return;
        setTracks(data);
        // Cache total duration so the Duration sort filter works.
        // Called unconditionally — updateDuration is a no-op if this album
        // isn't in loggedAlbums, and skips Supabase if the user isn't signed in.
        const totalMs = data.reduce((sum, t) => sum + (t.durationMs ?? 0), 0);
        if (totalMs > 0) updateDuration(albumId, totalMs);
      })
      .catch(err => { console.warn('[album-detail] tracklist error:', err); if (!cancelled) setTracks([]); })
      .finally(() => { if (!cancelled) setTracksLoading(false); });

    if (albumArtist && albumTitle) {
      const lfmUrl = `${API_URL}/lastfm/album?artist=${encodeURIComponent(albumArtist)}&album=${encodeURIComponent(albumTitle)}`;
      const tagsUrl = `${API_URL}/album-tags?artist=${encodeURIComponent(albumArtist)}&album=${encodeURIComponent(albumTitle)}${albumId ? `&amId=${encodeURIComponent(albumId)}` : ''}`;

      fetch(lfmUrl)
        .then(r => r.ok ? r.json() : r.json().then(b => Promise.reject(`HTTP ${r.status}: ${JSON.stringify(b)}`)))
        .then(data => {
          if (cancelled) return;
          let description = stripHtml(data.description ?? '');
          if (!description) {
            description = `${albumTitle} is an album by ${albumArtist}${albumYear > 0 ? `, released in ${albumYear}` : ''}.`;
          }
          setLastfm({ listeners: data.listeners ?? 0, description, tags: [] });
        })
        .catch(err => {
          console.warn('[album-detail] Last.fm error:', err);
          if (!cancelled) {
            setLastfm({ listeners: 0, description: `${albumTitle} is an album by ${albumArtist}${albumYear > 0 ? `, released in ${albumYear}` : ''}.`, tags: [] });
          }
        });

      fetch(tagsUrl)
        .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
        .then(data => { if (!cancelled) setAlbumTags(data.tags ?? []); })
        .catch(err => console.warn('[album-detail] album-tags error:', err));
    }

    return () => { cancelled = true; };
  }, [albumId, albumArtist, albumTitle]);

  // ── Fetch Genius credits ───────────────────────────────────────────────────
  useEffect(() => {
    if (!tracks || tracks.length === 0 || !albumArtist) return;
    let cancelled = false;
    const trackParams = tracks.slice(0, 3).map(t => `tracks=${encodeURIComponent(t.title)}`).join('&');
    fetch(`${API_URL}/genius/credits?artist=${encodeURIComponent(albumArtist)}&${trackParams}`)
      .then(r => r.ok ? r.json() : r.json().then(b => Promise.reject(`HTTP ${r.status}: ${JSON.stringify(b)}`)))
      .then(data => {
        if (!cancelled && (data.producers?.length || data.writers?.length)) setGenius(data);
      })
      .catch(err => console.warn('[album-detail] Genius error:', err));
    return () => { cancelled = true; };
  }, [tracks, albumArtist]);

  // ── Fetch similar albums ───────────────────────────────────────────────────
  useEffect(() => {
    if (!tracks || tracks.length === 0 || !albumId) return;
    let cancelled = false;
    const seedIds = tracks.slice(0, 2).map(t => `trackIds=${encodeURIComponent(t.id)}`).join('&');
    fetch(`${API_URL}/spotify/recommendations?${seedIds}&excludeAlbumId=${encodeURIComponent(albumId)}`)
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then(data => { if (!cancelled && Array.isArray(data) && data.length > 0) setSimilar(data); })
      .catch(err => console.warn('[album-detail] recommendations error:', err));
    return () => { cancelled = true; };
  }, [tracks, albumId]);

  // ── Fetch community reviews for this album ─────────────────────────────────
  useEffect(() => {
    if (!albumId) return;

    async function loadCommunityReviews() {
      // 1. Fetch all rows for this album that have a review, excluding the current user
      let query = supabase
        .from('user_albums')
        .select('user_id, rating, review, listened_at')
        .eq('spotify_id', albumId)
        .not('review', 'is', null)
        .order('listened_at', { ascending: false });

      if (user?.id) query = query.neq('user_id', user.id);

      const { data: rows } = await query;
      if (!rows || rows.length === 0) { setCommunityReviews([]); return; }

      // 2. Batch-fetch profiles for the reviewers
      const userIds = [...new Set(rows.map((r: any) => r.user_id as string))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', userIds);

      const profileMap = new Map<string, string>();
      for (const p of (profiles ?? []) as any[]) {
        profileMap.set(p.id, p.username ?? p.id);
      }

      setCommunityReviews(rows.map((r: any) => ({
        id:      `${r.user_id}_${albumId}`,
        userId:  r.user_id,
        username: profileMap.get(r.user_id) ?? r.user_id,
        rating:  r.rating ?? 0,
        text:    r.review ?? undefined,
        dateStr: r.listened_at ? formatLoggedDate(r.listened_at) : undefined,
      })));
    }

    loadCommunityReviews();
  }, [albumId, user?.id]);

  // ── Fetch like state for this album's reviews ──────────────────────────────
  useEffect(() => {
    if (!albumId) return;

    supabase
      .from('likes')
      .select('user_id, target_id')
      .eq('target_type', 'review')
      .like('target_id', `%_${albumId}`)
      .then(({ data }) => {
        const newMap = new Map<string, LikeState>();
        for (const like of (data ?? []) as any[]) {
          const existing = newMap.get(like.target_id) ?? { liked: false, count: 0 };
          newMap.set(like.target_id, {
            count: existing.count + 1,
            liked: existing.liked || like.user_id === user?.id,
          });
        }
        setReviewLikesMap(newMap);
      });
  }, [albumId, user?.id]);

  // ── Toggle like on a community review ─────────────────────────────────────
  async function handleToggleLike(review: CommunityReview) {
    if (!user) return;
    const targetId = review.id; // already `${userId}_${albumId}`
    const current  = reviewLikesMap.get(targetId) ?? { liked: false, count: 0 };

    // Optimistic update
    const updated = new Map(reviewLikesMap);
    updated.set(targetId, {
      liked: !current.liked,
      count: Math.max(0, current.liked ? current.count - 1 : current.count + 1),
    });
    setReviewLikesMap(updated);

    if (current.liked) {
      const { error } = await supabase
        .from('likes')
        .delete()
        .eq('user_id',     user.id)
        .eq('target_type', 'review')
        .eq('target_id',   targetId);
      if (error) {
        console.error('[album-detail] unlike error:', error.message);
        setReviewLikesMap(new Map(reviewLikesMap)); // revert
      }
    } else {
      const { error } = await supabase
        .from('likes')
        .insert({
          user_id:         user.id,
          target_type:     'review',
          target_id:       targetId,
          target_owner_id: review.userId,
        });
      if (error) {
        console.error('[album-detail] like error:', error.message);
        setReviewLikesMap(new Map(reviewLikesMap)); // revert
      } else {
        supabase.from('notifications').insert({
          user_id:  review.userId,
          type:     'like_review',
          actor_id: user.id,
        }).then(({ error: notifErr }) => {
          if (notifErr) console.error('[album-detail] notification error:', notifErr.message);
        });
      }
    }
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  function handleSave() {
    updateReview(albumId, rating, review);
    setEditMode(false);
  }

  function handleCancelEdit() {
    setRating(loggedAlbum?.rating ?? 0);
    setReview(loggedAlbum?.review ?? '');
    setEditMode(false);
  }

  function handleLog() {
    setPendingAlbum({ spotifyId: albumId, title: albumTitle, artist: albumArtist, year: albumYear, artworkUrl: albumArtwork });
    router.push('/log-album');
  }

  function handleWantToListen() {
    if (isWanted) {
      removeFromWantToListen(albumId);
    } else {
      addToWantToListen({ id: albumId, title: albumTitle, artist: albumArtist, year: albumYear, artworkUrl: albumArtwork });
    }
  }

  function handleStream() {
    setShowStreamSheet(true);
  }

  function handleArtistPress() {
    router.push({ pathname: '/artist-detail', params: { name: albumArtist } });
  }

  const sectionBg  = isDark ? '#1c1410' : '#f5f5f5';
  const borderColor = isDark ? '#2a1e14' : '#e8e8e8';
  const mutedText  = isDark ? '#7a5535' : '#a07850';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={headerHeight}>
      <Stack.Screen
        options={{
          headerRight: () => (
              <Pressable
                onPress={() => setShowPlaylists(true)}
                hitSlop={12}
                style={({ pressed }) => [s.headerBtn, { opacity: pressed ? 0.5 : 1 }]}>
                <FontAwesome name="list-alt" size={19} color="#D4A017" />
              </Pressable>
            ),
        }}
      />
      <ScrollView
        ref={scrollRef}
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={s.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        {/* ── 1. Header ─────────────────────────────────────────────────────── */}
        {albumArtwork ? (
          <ExpoImage source={{ uri: albumArtwork }} style={s.artwork} contentFit="cover" cachePolicy="disk" transition={200} />
        ) : (
          <View style={[s.artwork, s.artworkPlaceholder, { backgroundColor: albumCoverColor }]}>
            <Text style={s.artworkInitial}>{albumTitle.charAt(0)}</Text>
          </View>
        )}

        <Text style={[s.title, { color: colors.text }]} numberOfLines={2}>{albumTitle}</Text>

        <Pressable onPress={handleArtistPress}>
          <Text style={[s.artist, { color: '#D4A017' }]}>
            {albumArtist}{albumYear > 0 ? ` · ${albumYear}` : ''}
          </Text>
        </Pressable>

        {albumTags.length > 0 ? (
          <View style={s.metaRow}>
            {albumTags.slice(0, 4).map(tag => (
              <View key={tag} style={[s.pill, { backgroundColor: isDark ? '#2a1e14' : '#ebebeb' }]}>
                <Text style={[s.pillText, { color: colors.subtext }]}>{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* ── 2. About This Album ───────────────────────────────────────────── */}
        {lastfm?.description ? (
          <View style={[s.section, { backgroundColor: sectionBg, borderColor }]}>
            <Text style={[s.sectionLabel, { color: colors.subtext, marginTop: 0 }]}>About This Album</Text>
            <Text
              style={[s.bioText, { color: colors.text }]}
              numberOfLines={bioExpanded ? undefined : 3}>
              {lastfm.description}
            </Text>
            {lastfm.description.length > 120 && (
              <Pressable onPress={() => setBioExpanded(v => !v)}>
                <Text style={s.bioToggle}>{bioExpanded ? 'Show less' : 'Read more'}</Text>
              </Pressable>
            )}
          </View>
        ) : null}

        {/* ── 3. Log / Save buttons ─────────────────────────────────────────── */}
        {isLogged ? (
          editMode ? (
            <View style={s.editBlock}>
              <Text style={[s.sectionLabel, { color: colors.subtext }]}>Rating</Text>
              <RatingPicker rating={rating} onChange={setRating} isDark={isDark} />
              <Text style={[s.sectionLabel, { color: colors.subtext, marginTop: 20 }]}>
                Review <Text style={{ fontWeight: '400' }}>(optional)</Text>
              </Text>
              <TextInput
                style={[s.reviewInput, { color: colors.text, backgroundColor: isDark ? '#2e2018' : '#f2f2f2', borderColor: isDark ? '#3a2818' : '#e0e0e0' }]}
                placeholder="What did you think?"
                placeholderTextColor={colors.subtext}
                value={review}
                onChangeText={setReview}
                multiline
                textAlignVertical="top"
                maxLength={500}
                onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300)}
              />
              {review.length > 0 && (
                <Text style={[s.charCount, { color: colors.subtext }]}>{review.length}/500</Text>
              )}
              <View style={s.editBtnRow}>
                <Pressable
                  style={[s.primaryBtn, s.editBtnFlex, { backgroundColor: '#D4A017' }]}
                  onPress={handleSave}>
                  <Text style={[s.primaryBtnText, { color: '#fff' }]}>Save</Text>
                </Pressable>
                <Pressable
                  style={[s.secondaryBtn, s.editBtnFlex, { borderColor: isDark ? '#3a2818' : '#ddd' }]}
                  onPress={handleCancelEdit}>
                  <Text style={[s.secondaryBtnText, { color: colors.subtext }]}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={s.editLogRow}>
              <View style={s.listendLeft}>
                <View style={s.listendBadge}>
                  <FontAwesome name="headphones" size={12} color="#fff" />
                  <Text style={s.listendBadgeText}>Listend</Text>
                </View>
                <Text style={[s.editLogDate, { color: colors.subtext }]}>
                  {formatLoggedDate(loggedAlbum!.dateLogged)}
                </Text>
              </View>
              <View style={s.editLogRight}>
                <FontAwesome name="volume-up" size={14} color={loggedAlbum!.rating > 0 ? '#D4A017' : (isDark ? '#3a2818' : '#ddd')} />
                {loggedAlbum!.rating >= 1 && <MiniRatingBar rating={loggedAlbum!.rating} isDark={isDark} />}
                <Pressable onPress={() => setEditMode(true)} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
                  <FontAwesome name="pencil" size={13} color={colors.subtext} />
                </Pressable>
              </View>
            </View>
          )
        ) : (
          <View style={s.ctaRow}>
            <Pressable
              style={({ pressed }) => [s.listenBtn, s.ctaFlex, { borderColor: isDark ? '#4a3020' : '#a07850', opacity: pressed ? 0.7 : 1 }]}
              onPress={handleLog}>
              <FontAwesome name="headphones" size={16} color={colors.text} />
              <Text style={[s.listenBtnText, { color: colors.text }]}>Listen</Text>
            </Pressable>
            <Pressable
              style={[s.secondaryBtn, s.ctaFlex, { borderColor: isDark ? '#3a2818' : '#ddd' }]}
              onPress={handleWantToListen}>
              <FontAwesome name={isWanted ? 'bookmark' : 'bookmark-o'} size={14} color={isWanted ? '#D4A017' : colors.subtext} />
              <Text style={[s.secondaryBtnText, { color: isWanted ? '#D4A017' : colors.subtext }]}>
                {isWanted ? 'Saved' : 'Want to Listen'}
              </Text>
            </Pressable>
          </View>
        )}

        {/* ── 3b. Stream button ─────────────────────────────────────────────── */}
        <Pressable
          style={({ pressed }) => [s.streamBtn, { borderColor: isDark ? '#3a2818' : '#ddd', opacity: pressed ? 0.7 : 1 }]}
          onPress={handleStream}>
          <FontAwesome name="music" size={15} color="#D4A017" />
          <Text style={[s.streamBtnText, { color: '#D4A017' }]}>Stream</Text>
        </Pressable>

        {/* ── 4. Community Rating ───────────────────────────────────────────── */}
        <CommunityRatingSection
          isDark={isDark}
          colors={colors}
          sectionBg={sectionBg}
          borderColor={borderColor}
        />

        {/* ── 5. Reviews ────────────────────────────────────────────────────── */}
        <View style={[s.section, { backgroundColor: sectionBg, borderColor }]}>
          <Text style={[s.sectionLabel, { color: colors.subtext, marginTop: 0, marginBottom: 12 }]}>Reviews</Text>
          <FlatList
            horizontal
            data={displayReviews}
            keyExtractor={item => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[s.reviewsScroll, { alignItems: 'stretch' }]}
            style={s.reviewsScrollView}
            renderItem={({ item }) => (
              <AlbumReviewCard
                review={item}
                liked={likedAlbumReviews.has(item.id)}
                onLike={() => handleLikeAlbumReview(item.id)}
                onPress={() => handleReviewCardPress(item)}
                onUsernamePress={(username) => navigateToProfile(username, router)}
                onCommentCountPress={() => handleReviewCommentCountPress(item)}
                commentCount={commentsMap.get(item.id)?.length ?? 0}
                isDark={isDark}
                colors={colors}
                borderColor={borderColor}
                isOwn={item.id === 'own'}
              />
            )}
            ListFooterComponent={
              <Pressable
                style={({ pressed }) => [
                  s.reviewCard,
                  s.showMoreCard,
                  { backgroundColor: isDark ? '#2e2018' : '#fff', borderColor, opacity: pressed ? 0.7 : 1 },
                ]}
                onPress={() => setShowAllReviews(true)}>
                <FontAwesome name="comments" size={22} color={isDark ? '#7a5535' : '#a07850'} />
                <Text style={[s.showMoreText, { color: colors.subtext }]}>See{'\n'}More</Text>
              </Pressable>
            }
          />
        </View>

        {/* ── 6. Tracklist ──────────────────────────────────────────────────── */}
        <View style={[s.section, { backgroundColor: sectionBg, borderColor }]}>
          <View style={s.tracklistHeader}>
            <Text style={[s.sectionLabel, { color: colors.subtext, marginTop: 0, marginBottom: 0 }]}>Tracklist</Text>
            {tracks && tracks.length > 0 && (
              <Text style={[s.runtimeText, { color: colors.subtext }]}>
                {tracks.length} tracks · {formatRuntime(tracks.reduce((sum, t) => sum + t.durationMs, 0))}
              </Text>
            )}
          </View>
          {tracksLoading ? (
            <ActivityIndicator size="small" color="#D4A017" style={{ marginVertical: 16 }} />
          ) : tracks && tracks.length > 0 ? (
            tracks.map(track => (
              <View key={track.id} style={[s.trackRow, { borderBottomColor: borderColor }]}>
                <Text style={[s.trackNumber, { color: mutedText }]}>{track.number}</Text>
                <View style={s.trackInfo}>
                  <Text style={[s.trackTitle, { color: colors.text }]} numberOfLines={1}>
                    {track.title}
                  </Text>
                  {track.featuredArtists.length > 0 && (
                    <Text style={[s.trackFeat, { color: colors.subtext }]} numberOfLines={1}>
                      feat. {track.featuredArtists.join(', ')}
                    </Text>
                  )}
                </View>
                <Text style={[s.trackDuration, { color: colors.subtext }]}>
                  {formatDuration(track.durationMs)}
                </Text>
              </View>
            ))
          ) : (
            <Text style={[s.emptyText, { color: mutedText }]}>No tracks available</Text>
          )}
        </View>

        {/* ── Credits ───────────────────────────────────────────────────────── */}
        {genius && (genius.credits?.length || genius.producers?.length || genius.writers?.length) ? (() => {
          const PRODUCED_RE = /produced/i;
          const WRITTEN_RE  = /written|lyric/i;

          const pinnedRows: { label: string; artists: string[] }[] = [
            ...(genius.producers?.length ? [{ label: 'Produced By', artists: genius.producers }] : []),
            ...(genius.writers?.length   ? [{ label: 'Written By',  artists: genius.writers   }] : []),
          ];
          const extraRows = (genius.credits ?? []).filter(
            row => !PRODUCED_RE.test(row.label) && !WRITTEN_RE.test(row.label)
          );
          const allRows = [...pinnedRows, ...extraRows];
          if (!allRows.length) return null;

          const PREVIEW = 2;
          const visibleRows = creditsExpanded ? allRows : allRows.slice(0, PREVIEW);
          const hasMore = allRows.length > PREVIEW;

          return (
            <View style={[s.section, { backgroundColor: sectionBg, borderColor }]}>
              <Text style={[s.sectionLabel, { color: colors.subtext, marginTop: 0 }]}>Credits</Text>
              {visibleRows.map((row, i) => (
                <View key={i} style={[s.creditRow, i < visibleRows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: borderColor }]}>
                  <Text style={[s.creditLabel, { color: colors.subtext }]}>{row.label}</Text>
                  <Text style={[s.creditValue, { color: colors.text }]}>{row.artists.join(', ')}</Text>
                </View>
              ))}
              {hasMore && (
                <Pressable onPress={() => setCreditsExpanded(v => !v)} style={s.creditsToggle}>
                  <Text style={s.creditsToggleText}>
                    {creditsExpanded ? 'See Less' : `See More (${allRows.length - PREVIEW} more)`}
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })() : null}

        {/* ── Similar Albums ────────────────────────────────────────────────── */}
        {similar && similar.length > 0 && (
          <View style={[s.section, { backgroundColor: sectionBg, borderColor }]}>
            <Text style={[s.sectionLabel, { color: colors.subtext, marginTop: 0 }]}>Similar Albums</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
              {similar.map(album => (
                <Pressable
                  key={album.id}
                  style={({ pressed }) => [s.similarCard, { opacity: pressed ? 0.7 : 1 }]}
                  onPress={() => router.push({
                    pathname: '/album-detail',
                    params: { id: album.id, title: album.title, artist: album.artist, year: String(album.year), artworkUrl: album.artworkUrl },
                  })}>
                  {album.artworkUrl ? (
                    <ExpoImage source={{ uri: album.artworkUrl }} style={s.similarArt} contentFit="cover" cachePolicy="disk" transition={200} />
                  ) : (
                    <View style={[s.similarArt, { backgroundColor: isDark ? '#2a1e14' : '#e0e0e0', justifyContent: 'center', alignItems: 'center' }]}>
                      <FontAwesome name="music" size={20} color="#7a5535" />
                    </View>
                  )}
                  <Text style={[s.similarTitle, { color: colors.text }]} numberOfLines={1}>{album.title}</Text>
                  <Text style={[s.similarArtist, { color: colors.subtext }]} numberOfLines={1}>{album.artist}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

      </ScrollView>

      {/* ── Single review modal (focused, home-page style) ───────────────────── */}
      {expandedAlbumReview && (
        <AlbumSingleReviewModal
          review={expandedAlbumReview}
          albumTitle={albumTitle}
          albumArtist={albumArtist}
          albumYear={albumYear}
          albumArtwork={albumArtwork}
          liked={likedAlbumReviews.has(expandedAlbumReview.id)}
          onLike={() => handleLikeAlbumReview(expandedAlbumReview.id)}
          comments={commentsMap.get(expandedAlbumReview.id) ?? []}
          commentsExpanded={singleReviewCommentsOpen}
          onToggleComments={() => setSingleReviewCommentsOpen(prev => !prev)}
          onAddComment={(body, parentId, u, rtu, av) => handleAddComment(expandedAlbumReview.id, body, parentId, u, rtu, av)}
          onClose={() => { setExpandedAlbumReview(null); setSingleReviewCommentsOpen(false); }}
          onUsernamePress={(username) => { setExpandedAlbumReview(null); setSingleReviewCommentsOpen(false); navigateToProfile(username, router); }}
          isDark={isDark}
          colors={colors}
        />
      )}

      {/* ── All Reviews modal ────────────────────────────────────────────────── */}
      <Modal
        visible={showAllReviews}
        animationType="slide"
        onRequestClose={() => { setShowAllReviews(false); setHighlightedReviewId(null); setExpandedCommentsId(null); }}>
        <View style={[s.allReviewsModal, { backgroundColor: colors.background }]}>
          <View style={[s.allReviewsHeader, { borderBottomColor: isDark ? '#2a1e14' : '#eee' }]}>
            <Text style={[s.allReviewsTitle, { color: colors.text }]}>Reviews</Text>
            <Pressable
              onPress={() => { setShowAllReviews(false); setHighlightedReviewId(null); setExpandedCommentsId(null); }}
              hitSlop={12}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
              <FontAwesome name="times" size={20} color={colors.subtext} />
            </Pressable>
          </View>
          <ScrollView
            ref={modalScrollRef}
            contentContainerStyle={[s.allReviewsList, { gap: 12, paddingHorizontal: 16 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {displayReviews.map(r => (
              <AlbumReviewCard
                key={r.id}
                review={{ ...r }}
                liked={likedAlbumReviews.has(r.id)}
                onLike={() => handleLikeAlbumReview(r.id)}
                onUsernamePress={() => navigateToProfile(r.username, router)}
                onCommentCountPress={() => handleToggleComments(r.id)}
                commentCount={commentsMap.get(r.id)?.length ?? 0}
                comments={commentsMap.get(r.id) ?? []}
                commentsExpanded={expandedCommentsId === r.id}
                onAddComment={(body, parentId, u, rtu, av) => handleAddComment(r.id, body, parentId, u, rtu, av)}
                isDark={isDark}
                colors={colors}
                borderColor={borderColor}
                isOwn={r.id === 'own'}
                fullWidth
                highlighted={r.id === highlightedReviewId}
                onLayout={(y) => { reviewYPositions.current.set(r.id, y); }}
              />
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* ── Streaming links sheet ────────────────────────────────────────────── */}
      <Modal visible={showStreamSheet} transparent animationType="slide" onRequestClose={() => setShowStreamSheet(false)}>
        <Pressable style={s.modalOverlay} onPress={() => setShowStreamSheet(false)}>
          <Pressable style={[s.modalSheet, { backgroundColor: isDark ? '#141414' : '#fff' }]} onPress={() => {}}>
            <View style={s.modalHandle} />
            <Text style={[s.modalTitle, { color: colors.text }]}>Stream on…</Text>
            {streamLinks && ([
              { key: 'appleMusic',   label: 'Apple Music',   icon: 'apple'         as const, color: '#FC3C44' },
              { key: 'spotify',      label: 'Spotify',       icon: 'spotify'       as const, color: '#1DB954' },
              { key: 'youtubeMusic', label: 'YouTube Music', icon: 'youtube-play'  as const, color: '#FF0000' },
              { key: 'amazonMusic',  label: 'Amazon Music',  icon: 'amazon'        as const, color: '#00A8E1' },
            ] as const).filter(p => streamLinks[p.key]).map(platform => (
              <Pressable
                key={platform.key}
                style={({ pressed }) => [s.streamPlatformRow, { borderBottomColor: isDark ? '#2a1e14' : '#f0f0f0', opacity: pressed ? 0.6 : 1 }]}
                onPress={() => { Linking.openURL(streamLinks[platform.key]!); setShowStreamSheet(false); }}>
                <FontAwesome name={platform.icon} size={20} color={platform.color} />
                <Text style={[s.streamPlatformLabel, { color: colors.text }]}>{platform.label}</Text>
                <FontAwesome name="chevron-right" size={13} color={colors.subtext} />
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Playlist picker modal ─────────────────────────────────────────────── */}
      <Modal visible={showPlaylists} transparent animationType="slide" onRequestClose={() => setShowPlaylists(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowPlaylists(false)} />
          <View style={[s.modalSheet, { backgroundColor: isDark ? '#141414' : '#fff' }]}>
            <View style={s.modalHandle} />
            <Text style={[s.modalTitle, { color: colors.text }]}>Add to Playlist</Text>
            {playlists.length === 0 ? (
              <View style={s.modalEmpty}>
                <Text style={[s.modalEmptyText, { color: colors.subtext }]}>
                  No playlists yet. Create one from the Playlists tab.
                </Text>
              </View>
            ) : (
              playlists.map(playlist => {
                const inPlaylist = playlist.albumIds.includes(albumId);
                return (
                  <Pressable
                    key={playlist.id}
                    onPress={() => { inPlaylist ? removeAlbumFromPlaylist(playlist.id, albumId) : addAlbumToPlaylist(playlist.id, albumId); }}
                    style={({ pressed }) => [s.playlistRow, { borderBottomColor: isDark ? '#2a1e14' : '#f5e6c8', opacity: pressed ? 0.6 : 1 }]}>
                    <View style={s.playlistRowText}>
                      <Text style={[s.playlistRowName, { color: colors.text }]} numberOfLines={1}>{playlist.name}</Text>
                      <Text style={[s.playlistRowCount, { color: colors.subtext }]}>{playlist.albumIds.length} albums</Text>
                    </View>
                    <View style={[s.checkBox, inPlaylist && s.checkBoxActive]}>
                      {inPlaylist && <FontAwesome name="check" size={11} color="#fff" />}
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { alignItems: 'center', paddingTop: 36, paddingHorizontal: 20, paddingBottom: 48 },

  // Header
  artwork: { width: 180, height: 180, borderRadius: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 20 },
  artworkPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  artworkInitial: { color: 'rgba(255,255,255,0.7)', fontSize: 60, fontWeight: '700' },
  title: { marginTop: 20, fontSize: 20, fontWeight: '700', textAlign: 'center', letterSpacing: -0.5 },
  artist: { marginTop: 4, fontSize: 14, fontWeight: '500', textAlign: 'center' },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 12 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  pillText: { fontSize: 11, fontWeight: '500' },
  listeners: { fontSize: 12, alignSelf: 'center' },

  // Section label
  sectionLabel: { marginTop: 24, alignSelf: 'flex-start', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10 },

  // Content sections
  section: { width: '100%', marginTop: 20, borderRadius: 14, padding: 16, borderWidth: StyleSheet.hairlineWidth },

  // About
  bioText: { fontSize: 14, lineHeight: 22 },
  bioToggle: { color: '#D4A017', fontSize: 13, fontWeight: '500', marginTop: 8 },

  // Log / Edit buttons
  ctaRow: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 20 },
  ctaFlex: { flex: 1, marginTop: 0 },
  primaryBtn: { marginTop: 20, width: '100%', height: 50, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  primaryBtnText: { fontSize: 16, fontWeight: '600' },
  secondaryBtn: { height: 50, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, borderWidth: 1 },
  secondaryBtnText: { fontSize: 15, fontWeight: '500' },

  // Listen CTA (unlogged)
  listenBtn: { height: 50, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, borderWidth: 1 },
  listenBtnText: { fontSize: 16, fontWeight: '600' },

  // Listend badge (logged)
  listendLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  listendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#D4A017',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  listendBadgeText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Logged / edit
  editLogRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: 16 },
  editLogDate: { fontSize: 12 },
  editLogRight: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },

  editBlock: { width: '100%', marginTop: 16 },
  editBtnRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  editBtnFlex: { flex: 1, marginTop: 0 },

  // Rating picker
  ratingContainer: { width: '100%', marginTop: 10 },
  ratingRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  barsTrack: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, paddingBottom: 2, height: 44 },
  bar: { flex: 1, borderRadius: 2 },
  ratingHint: { marginTop: 10, fontSize: 13, textAlign: 'center', height: 18 },
  ratingNumBox: { width: 30, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 2 },
  ratingNumLarge: { fontSize: 20, fontWeight: '700' },

  // Review input
  reviewInput: { width: '100%', minHeight: 90, marginTop: 10, borderRadius: 10, borderWidth: 1, padding: 12, fontSize: 15, lineHeight: 22 },
  charCount: { alignSelf: 'flex-end', fontSize: 12, marginTop: 4 },

  // Mini rating bar (logged date row)
  miniBarRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  miniBarTrack: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  miniBar: { width: 4, borderRadius: 1 },
  miniBarNum: { fontSize: 13, fontWeight: '700', lineHeight: 15 },

  // Community Rating (volume bar style)
  communityRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 16 },
  communityAvgBlock: { alignItems: 'flex-start', minWidth: 52 },
  communityAvg: { fontSize: 38, fontWeight: '700', letterSpacing: -1, lineHeight: 44 },
  communityAvgSub: { fontSize: 11, marginTop: 2 },
  communityVolumeWrap: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  communityVolumeTrack: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  communityVolumeBar: { flex: 1, borderRadius: 2 },

  // Reviews
  reviewsScrollView: { marginHorizontal: -4 },
  reviewsScroll: { paddingHorizontal: 4, gap: 10 },
  reviewCard: {
    width: 210,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 8,
  },
  reviewCardOwn: { borderLeftWidth: 2, borderLeftColor: '#D4A017' },
  reviewCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewCardUsername: { fontSize: 13, fontWeight: '700', flex: 1, marginRight: 8 },
  ratingBadge: { backgroundColor: '#D4A017', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, minWidth: 26, alignItems: 'center' },
  ratingBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  reviewCardText: { fontSize: 13, lineHeight: 19 },
  reviewCardNoText: { fontSize: 13, fontStyle: 'italic' },
  reviewCardDate: { fontSize: 11, marginTop: 2 },
  reviewCardLikeRow: { marginTop: 2 },
  reviewCardLikeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  reviewCardLikeCount: { fontSize: 11, fontWeight: '600' },

  // Show More card
  showMoreCard: { justifyContent: 'center', alignItems: 'center', gap: 8, alignSelf: 'stretch' },
  showMoreText: { fontSize: 12, fontWeight: '600', textAlign: 'center', lineHeight: 17 },

  // All Reviews modal
  allReviewsModal: { flex: 1 },
  allReviewsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  allReviewsTitle: { fontSize: 18, fontWeight: '700' },
  allReviewsList: { paddingBottom: 40 },
  allReviewRow: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, gap: 6 },
  allReviewTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  allReviewUsername: { fontSize: 14, fontWeight: '700' },
  allReviewText: { fontSize: 14, lineHeight: 21 },
  allReviewNoText: { fontSize: 14, fontStyle: 'italic' },
  allReviewDate: { fontSize: 12, marginTop: 2 },
  allReviewLikeBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: 4 },
  allReviewLikeCount: { fontSize: 12, fontWeight: '600' },

  // Tracklist
  tracklistHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  runtimeText: { fontSize: 11, fontWeight: '500' },
  trackRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  trackNumber: { width: 24, fontSize: 13, textAlign: 'right', marginRight: 12 },
  trackInfo: { flex: 1, gap: 2 },
  trackTitle: { fontSize: 14, fontWeight: '500' },
  trackFeat: { fontSize: 12 },
  trackDuration: { fontSize: 13, marginLeft: 12 },
  emptyText: { fontSize: 13, textAlign: 'center', paddingVertical: 16 },

  // Credits
  creditRow: { marginBottom: 8 },
  creditLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  creditValue: { fontSize: 14 },
  creditsToggle: { marginTop: 6 },
  creditsToggleText: { color: '#D4A017', fontSize: 13, fontWeight: '500' },

  // Similar Albums
  similarCard:   { width: 110, marginHorizontal: 4, gap: 4 },
  similarArt:    { width: 110, height: 110, borderRadius: 8 },
  similarTitle:  { fontSize: 12, fontWeight: '600' },
  similarArtist: { fontSize: 11 },

  // Stream button
  streamBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', height: 44, borderRadius: 12, borderWidth: 1, marginTop: 10 },
  streamBtnText: { fontSize: 15, fontWeight: '600' },

  // Streaming sheet
  streamPlatformRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  streamPlatformLabel: { flex: 1, fontSize: 16, fontWeight: '500' },

  // Header button
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  // Playlist modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 12, paddingBottom: 40 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#4a3020', alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: '700', paddingHorizontal: 20, marginBottom: 12 },
  modalEmpty: { paddingHorizontal: 20, paddingVertical: 24 },
  modalEmptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  playlistRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  playlistRowText: { flex: 1, gap: 2 },
  playlistRowName: { fontSize: 15, fontWeight: '500' },
  playlistRowCount: { fontSize: 12 },
  checkBox: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#7a5535', alignItems: 'center', justifyContent: 'center' },
  checkBoxActive: { backgroundColor: '#D4A017', borderColor: '#D4A017' },
});

// ─── Album review card styles ─────────────────────────────────────────────────

const arc = StyleSheet.create({
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
    marginRight: 8,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: { color: '#fff', fontSize: 10, fontWeight: '700' },
  username:     { fontSize: 12, fontWeight: '600', flexShrink: 1 },
  reviewText:   { fontSize: 12, lineHeight: 18, fontStyle: 'italic' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  commentCountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  commentCountText: {
    fontSize: 11,
    fontWeight: '600',
  },
});

// ─── Comment section styles ───────────────────────────────────────────────────

