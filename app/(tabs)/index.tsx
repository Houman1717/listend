import { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  FlatList,
  Pressable,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { SpotifyAlbum, SpotifyTrack, SpotifyArtist } from '@/context/SpotifyService';
import { ReviewComment, CommentsSection, avatarColor } from '@/components/ReviewComments';
import { SongInfoModal, SongInfo } from '@/components/SongInfoModal';
import { useAlbums } from '@/context/AlbumsContext';

// ─── Backend URL ──────────────────────────────────────────────────────────────

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

// ─── Placeholder friends ──────────────────────────────────────────────────────

const PLACEHOLDER_FRIENDS = [
  {
    id: '1', user: 'alex_m', album: 'After Hours', artist: 'The Weeknd', year: '2020',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/6f/bc/e6/6fbce6c4-c38c-72d8-4fd0-66cfff32f679/20UMGIM12176.rgb.jpg/500x500bb.jpg',
    rating: 9, loggedDate: 'May 4, 2025',
    review: 'Blinding Lights alone makes this a classic, but the whole album is a cinematic fever dream. The production is immaculate — every synth line feels intentional. Abel at his darkest and most theatrical.',
  },
  {
    id: '2', user: 'sara_k', album: 'folklore', artist: 'Taylor Swift', year: '2020',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/b5/80/dc/b580dca0-349d-036b-e09b-bd849f6affd8/20UMGIM64216.rgb.jpg/500x500bb.jpg',
    rating: 10, loggedDate: 'May 4, 2025',
    review: 'This album made me feel things I didn\'t know I needed to feel. The cottagecore aesthetic works perfectly with the stripped-back production. "august" is a masterpiece.',
  },
  {
    id: '3', user: 'jvines', album: 'DAMN.', artist: 'Kendrick Lamar', year: '2017',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/86/c9/bb/86c9bb30-fe3d-442e-33c1-c106c4d23705/17UMGIM88776.rgb.jpg/500x500bb.jpg',
    rating: 10, loggedDate: 'May 3, 2025',
    review: null,
  },
  {
    id: '4', user: 'priya_r', album: 'SOS', artist: 'SZA', year: '2022',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/bd/3b/a9/bd3ba9fb-9609-144f-bcfe-ead67b5f6ab3/196589564931.jpg/500x500bb.jpg',
    rating: 8, loggedDate: 'May 3, 2025',
    review: 'Long but never boring. SZA somehow makes 23 tracks feel cohesive. Her voice is doing everything.',
  },
  {
    id: '5', user: 'tomfitz', album: 'Random Access Memories', artist: 'Daft Punk', year: '2013',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/500x500bb.jpg',
    rating: null, loggedDate: 'May 2, 2025',
    review: null,
  },
  {
    id: '6', user: 'nadia_w', album: 'Currents', artist: 'Tame Impala', year: '2015',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/a8/2e/b4/a82eb490-f30a-a321-461a-0383c88fec95/15UMGIM23316.rgb.jpg/500x500bb.jpg',
    rating: 9, loggedDate: 'May 2, 2025',
    review: 'Kevin Parker locked himself in a studio and came out with the most immersive headphone album of the decade. "Eventually" breaks my heart every single time.',
  },
];

const AGO = ['2m ago', '14m ago', '1h ago', '2h ago', '3h ago', '5h ago'];

type FriendEntry = typeof PLACEHOLDER_FRIENDS[number];

// ─── Module-level cache — persists across navigations ─────────────────────────

const cache: {
  albums?:  SpotifyAlbum[];
  songs?:   SpotifyTrack[];
  artists?: SpotifyArtist[];
} = {};

// ─── Fetcher ──────────────────────────────────────────────────────────────────

async function fetchHome(): Promise<{ albums: SpotifyAlbum[]; songs: SpotifyTrack[]; artists: SpotifyArtist[] }> {
  const res = await fetch(`${API_URL}/home`);
  if (!res.ok) throw new Error(`/home → ${res.status}`);
  return res.json();
}

// ─── Popular Reviews fake data ────────────────────────────────────────────────

export type PopularReview = {
  id: string;
  username: string;
  albumTitle: string;
  albumArtist: string;
  albumYear: string;
  artworkUrl: string;
  rating: number;
  review: string;
  likeCount: number;
};

export const POPULAR_REVIEWS_DATA: PopularReview[] = [
  {
    id: '1',
    username: 'vinylhead_92',
    albumTitle: 'After Hours',
    albumArtist: 'The Weeknd',
    albumYear: '2020',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/6f/bc/e6/6fbce6c4-c38c-72d8-4fd0-66cfff32f679/20UMGIM12176.rgb.jpg/500x500bb.jpg',
    rating: 8,
    review: 'Blinding Lights alone makes this a classic, but the whole album is a cinematic fever dream. Abel at his darkest and best.',
    likeCount: 61,
  },
  {
    id: '2',
    username: 'moodboard_mel',
    albumTitle: 'folklore',
    albumArtist: 'Taylor Swift',
    albumYear: '2020',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/b5/80/dc/b580dca0-349d-036b-e09b-bd849f6affd8/20UMGIM64216.rgb.jpg/500x500bb.jpg',
    rating: 9,
    review: 'Taylor proved she can do indie folk better than most indie folk artists. Cardigan is perfection.',
    likeCount: 104,
  },
  {
    id: '3',
    username: 'crate_digger',
    albumTitle: 'DAMN.',
    albumArtist: 'Kendrick Lamar',
    albumYear: '2017',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/86/c9/bb/86c9bb30-fe3d-442e-33c1-c106c4d23705/17UMGIM88776.rgb.jpg/500x500bb.jpg',
    rating: 10,
    review: 'Every track on this hits different. HUMBLE. to DUCKWORTH — it\'s a full experience, not just songs. Kendrick is built different.',
    likeCount: 132,
  },
  {
    id: '4',
    username: 'nightowl_nina',
    albumTitle: 'SOS',
    albumArtist: 'SZA',
    albumYear: '2022',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/bd/3b/a9/bd3ba9fb-9609-144f-bcfe-ead67b5f6ab3/196589564931.jpg/500x500bb.jpg',
    rating: 9,
    review: 'Kill Bill is already a top-5 song of the decade. The whole album oozes emotion and SZA\'s voice is otherworldly.',
    likeCount: 89,
  },
  {
    id: '5',
    username: 'bass_notes_ben',
    albumTitle: 'Random Access Memories',
    albumArtist: 'Daft Punk',
    albumYear: '2013',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/500x500bb.jpg',
    rating: 10,
    review: 'Get Lucky aside, this whole record is a love letter to the golden age of funk. Daft Punk\'s magnum opus without a doubt.',
    likeCount: 78,
  },
  {
    id: '6',
    username: 'lofi_lyric',
    albumTitle: 'Currents',
    albumArtist: 'Tame Impala',
    albumYear: '2015',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/a8/2e/b4/a82eb490-f30a-a321-461a-0383c88fec95/15UMGIM23316.rgb.jpg/500x500bb.jpg',
    rating: 9,
    review: "The Less I Know The Better is just pure indie-pop joy but the whole album is a psychedelic journey worth taking.",
    likeCount: 54,
  },
];

// avatarColor is re-exported so popular-reviews.tsx can import it from here
export { avatarColor };

// ─── Popular review mock comments ────────────────────────────────────────────

const POPULAR_REVIEW_COMMENTS: ReviewComment[] = [
  // Review 1 — After Hours
  { id: 'pr_c1', reviewId: '1', userId: 'u1', username: 'nightfreq',     body: 'Blinding Lights is one of those songs that transcends the whole album.',  createdAt: '1 day ago'  },
  { id: 'pr_c2', reviewId: '1', userId: 'u2', username: 'wavesurfer',    body: 'The whole aesthetic is so coherent from start to finish.',                 createdAt: '2 days ago' },
  // Review 2 — folklore
  { id: 'pr_c3', reviewId: '2', userId: 'u3', username: 'indie_ears',    body: 'Cardigan is legitimately one of her best tracks ever written.',            createdAt: '3 days ago' },
  { id: 'pr_c4', reviewId: '2', parentCommentId: 'pr_c3', userId: 'u4', username: 'moodboard_mel', body: 'Totally agree — the production on that one is so delicate.', createdAt: '2 days ago' },
  // Review 3 — DAMN.
  { id: 'pr_c5', reviewId: '3', userId: 'u5', username: 'deep_cuts99',   body: 'DUCKWORTH as the closer is a masterclass in sequencing.',                 createdAt: '5 days ago' },
  { id: 'pr_c6', reviewId: '3', userId: 'u6', username: 'tape_collector',body: '"Built different" is an understatement.',                                  createdAt: '4 days ago' },
  { id: 'pr_c7', reviewId: '3', userId: 'u7', username: 'lofi_lyric',    body: 'Still holds up perfectly years later.',                                    createdAt: '1 week ago' },
  // Review 4 — SOS
  { id: 'pr_c8', reviewId: '4', userId: 'u8', username: 'auralfix',      body: "Kill Bill is perfect. SZA's voice is on another level here.",             createdAt: '2 days ago' },
  // Review 5 — Random Access Memories
  { id: 'pr_c9',  reviewId: '5', userId: 'u9',  username: 'bass_notes_ben',  body: 'Touch is so underrated. Giorgio by Moroder too.',              createdAt: '6 days ago' },
  { id: 'pr_c10', reviewId: '5', parentCommentId: 'pr_c9', userId: 'u10', username: 'nightowl_nina', body: 'Giorgio by Moroder is an absolute journey.', createdAt: '5 days ago' },
  // Review 6 — Currents
  { id: 'pr_c11', reviewId: '6', userId: 'u11', username: 'sideB_fan',   body: 'The Less I Know is just perfect indie-pop. Full stop.',                   createdAt: '1 week ago' },
];

// ─── Card sizes ───────────────────────────────────────────────────────────────

const ALBUM_CARD       = 120;
const ARTIST_CARD      = 90;
const SONG_CARD        = 120;
const FRIEND_CARD      = 140;
const REVIEW_CARD_W    = 220;
const FALLBACK_BG      = '#2e2018';

// ─── Shared components ────────────────────────────────────────────────────────

function Section({ title, loading, children }: { title: string; loading: boolean; children: React.ReactNode }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  return (
    <View style={s.section}>
      <Text style={[s.sectionLabel, { color: colors.text }]}>{title}</Text>
      {loading ? (
        <View style={s.sectionLoader}>
          <ActivityIndicator color="#D4A017" />
        </View>
      ) : children}
    </View>
  );
}

function ArtFallback({ size, radius, label }: { size: number; radius: number; label: string }) {
  return (
    <View style={[s.fallback, { width: size, height: size, borderRadius: radius }]}>
      <Text style={[s.fallbackText, { fontSize: size * 0.32 }]}>{label[0]?.toUpperCase()}</Text>
    </View>
  );
}

// ─── Album card ───────────────────────────────────────────────────────────────

function AlbumCard({ item, isDark, isLogged, onPress }: { item: SpotifyAlbum; isDark: boolean; isLogged?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.card, { width: ALBUM_CARD, opacity: pressed ? 0.7 : 1 }]}>
      <View>
        {item.artworkUrl ? (
          <ExpoImage source={{ uri: item.artworkUrl }} style={{ width: ALBUM_CARD, height: ALBUM_CARD, borderRadius: 6 }} contentFit="cover" cachePolicy="disk" transition={200} />
        ) : (
          <ArtFallback size={ALBUM_CARD} radius={6} label={item.title} />
        )}
        {isLogged && (
          <View style={s.loggedBadge}>
            <Ionicons name="checkmark" size={9} color="#D4A017" />
          </View>
        )}
      </View>
      <Text style={[s.cardTitle, { color: isDark ? '#f5e6c8' : '#1A0F0A' }]} numberOfLines={1}>{item.title}</Text>
      <Text style={[s.cardSub,   { color: isDark ? '#A08060' : '#6B4C35' }]} numberOfLines={1}>{item.artist}</Text>
    </Pressable>
  );
}

// ─── Song card ────────────────────────────────────────────────────────────────

function SongCard({ item, index, isDark, onPress }: { item: SpotifyTrack; index: number; isDark: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.card, { width: SONG_CARD, opacity: pressed ? 0.7 : 1 }]}>
      <View>
        {item.artworkUrl ? (
          <ExpoImage source={{ uri: item.artworkUrl }} style={{ width: SONG_CARD, height: SONG_CARD, borderRadius: 6 }} contentFit="cover" cachePolicy="disk" transition={200} />
        ) : (
          <ArtFallback size={SONG_CARD} radius={6} label={item.title} />
        )}
        <View style={s.rankBadge}>
          <Text style={s.rankText}>#{index + 1}</Text>
        </View>
      </View>
      <Text style={[s.cardTitle, { color: isDark ? '#f5e6c8' : '#1A0F0A' }]} numberOfLines={1}>{item.title}</Text>
      <Text style={[s.cardSub,   { color: isDark ? '#A08060' : '#6B4C35' }]} numberOfLines={1}>{item.artist}</Text>
    </Pressable>
  );
}

// ─── Artist card (circular) ───────────────────────────────────────────────────

function ArtistCard({ item, isDark, onPress }: { item: SpotifyArtist; isDark: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.card, { width: ARTIST_CARD, alignItems: 'center', opacity: pressed ? 0.7 : 1 }]}>
      {item.artworkUrl ? (
        <ExpoImage source={{ uri: item.artworkUrl }} style={{ width: ARTIST_CARD, height: ARTIST_CARD, borderRadius: ARTIST_CARD / 2 }} contentFit="cover" cachePolicy="disk" transition={200} />
      ) : (
        <ArtFallback size={ARTIST_CARD} radius={ARTIST_CARD / 2} label={item.name} />
      )}
      <Text style={[s.cardTitle, { color: isDark ? '#f5e6c8' : '#1A0F0A', textAlign: 'center' }]} numberOfLines={1}>{item.name}</Text>
      <Text style={[s.cardSub,   { color: isDark ? '#A08060' : '#6B4C35', textAlign: 'center' }]} numberOfLines={1}>{item.genre}</Text>
    </Pressable>
  );
}

// ─── Popular review card ──────────────────────────────────────────────────────

function PopularReviewCard({
  item,
  liked,
  onLike,
  onPress,
  onAlbumPress,
  onCommentCountPress,
  commentCount = 0,
  isDark,
  colors,
}: {
  item: PopularReview;
  liked: boolean;
  onLike: () => void;
  onPress: () => void;
  onAlbumPress: () => void;
  onCommentCountPress: () => void;
  commentCount?: number;
  isDark: boolean;
  colors: any;
}) {
  const displayCount = item.likeCount + (liked ? 1 : 0);
  const subtext = isDark ? '#6B4C35' : '#A08060';
  return (
    <Pressable
      onPress={onPress}
      style={[
        pr.card,
        {
          width: REVIEW_CARD_W,
          backgroundColor: isDark ? '#3A2820' : '#FFFFFF',
          borderColor: isDark ? '#2a1e14' : '#DDD5C8',
        },
      ]}>
      {/* Top row: art + album info — tappable to go to album profile */}
      <Pressable
        onPress={(e) => { e.stopPropagation?.(); onAlbumPress(); }}
        style={({ pressed }) => [pr.topRow, { opacity: pressed ? 0.7 : 1 }]}>
        <ExpoImage source={{ uri: item.artworkUrl }} style={pr.art} contentFit="cover" cachePolicy="disk" transition={200} />
        <View style={pr.albumInfo}>
          <Text style={[pr.albumTitle, { color: isDark ? '#f5e6c8' : '#1A0F0A' }]} numberOfLines={2}>
            {item.albumTitle}
          </Text>
          <Text style={[pr.albumArtist, { color: isDark ? '#A08060' : '#6B4C35' }]} numberOfLines={1}>
            {item.albumArtist}
          </Text>
          <Text style={[pr.albumYear, { color: isDark ? '#6B4C35' : '#A08060' }]}>
            {item.albumYear}
          </Text>
          <View style={pr.ratingRow}>
            <FontAwesome name="volume-up" size={10} color="#D4A017" />
            <View style={pr.ratingBadge}>
              <Text style={pr.ratingNum}>{item.rating}</Text>
            </View>
          </View>
        </View>
      </Pressable>

      {/* Review snippet */}
      <Text style={[pr.reviewText, { color: isDark ? '#A08060' : '#6B4C35' }]} numberOfLines={3}>
        "{item.review}"
      </Text>

      {/* Footer: avatar + username | comments + like */}
      <View style={pr.footer}>
        <View style={pr.userRow}>
          <View style={[pr.avatar, { backgroundColor: avatarColor(item.username) }]}>
            <Text style={pr.avatarLetter}>{item.username[0].toUpperCase()}</Text>
          </View>
          <Text style={[pr.username, { color: '#D4A017' }]} numberOfLines={1}>
            @{item.username}
          </Text>
        </View>
        <View style={pr.footerActions}>
          <Pressable
            onPress={(e) => { e.stopPropagation?.(); onCommentCountPress(); }}
            hitSlop={8}
            style={pr.actionBtn}>
            <FontAwesome name="comment-o" size={12} color={subtext} />
            <Text style={[pr.actionCount, { color: subtext }]}>{commentCount}</Text>
          </Pressable>
          <Pressable
            onPress={(e) => { e.stopPropagation?.(); onLike(); }}
            hitSlop={8}
            style={pr.actionBtn}>
            <FontAwesome
              name={liked ? 'heart' : 'heart-o'}
              size={12}
              color={liked ? '#D4A017' : subtext}
            />
            <Text style={[pr.actionCount, { color: liked ? '#D4A017' : subtext }]}>
              {displayCount}
            </Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Expanded popular review modal ────────────────────────────────────────────

function PopularReviewModal({
  review,
  comments,
  commentsExpanded,
  onToggleComments,
  onAddComment,
  onClose,
  onAlbumPress,
  isDark,
  colors,
}: {
  review: PopularReview;
  comments: ReviewComment[];
  commentsExpanded: boolean;
  onToggleComments: () => void;
  onAddComment: (body: string, parentId?: string | null) => void;
  onClose: () => void;
  onAlbumPress: () => void;
  isDark: boolean;
  colors: any;
}) {
  const commentCount = comments.length;
  const bg = isDark ? colors.background : colors.background;
  const border = isDark ? '#2a1e14' : '#e5e5e5';

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: bg }}>
        <SafeAreaView style={{ flex: 1 }}>

          {/* Header */}
          <View style={[rm.header, { borderBottomColor: border }]}>
            <Pressable onPress={onClose} hitSlop={12}>
              <FontAwesome name="chevron-down" size={16} color={isDark ? '#A08060' : '#6B4C35'} />
            </Pressable>
            <Text style={[rm.headerTitle, { color: isDark ? '#f5e6c8' : '#1A0F0A' }]}>Review</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView
            contentContainerStyle={[rm.body, { paddingBottom: 40 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>

            {/* Album row — tappable to open album profile */}
            <Pressable
              onPress={onAlbumPress}
              style={({ pressed }) => [rm.albumRow, { opacity: pressed ? 0.7 : 1 }]}>
              <ExpoImage source={{ uri: review.artworkUrl }} style={rm.art} contentFit="cover" cachePolicy="disk" />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[rm.albumTitle, { color: isDark ? '#f5e6c8' : '#1A0F0A' }]}>{review.albumTitle}</Text>
                <Text style={[rm.albumArtist, { color: isDark ? '#A08060' : '#6B4C35' }]}>
                  {review.albumArtist} · {review.albumYear}
                </Text>
                <View style={rm.ratingRow}>
                  <FontAwesome name="volume-up" size={10} color="#D4A017" />
                  <View style={rm.ratingBadge}>
                    <Text style={rm.ratingNum}>{review.rating}</Text>
                  </View>
                </View>
              </View>
            </Pressable>

            {/* Author */}
            <View style={rm.authorRow}>
              <View style={[rm.avatar, { backgroundColor: avatarColor(review.username) }]}>
                <Text style={rm.avatarLetter}>{review.username[0].toUpperCase()}</Text>
              </View>
              <Text style={rm.username}>@{review.username}</Text>
            </View>

            {/* Full review */}
            <Text style={[rm.reviewText, { color: isDark ? '#A08060' : '#6B4C35' }]}>
              "{review.review}"
            </Text>

            {/* Comment toggle */}
            <Pressable
              onPress={onToggleComments}
              hitSlop={8}
              style={[rm.commentsToggle, { borderColor: border }]}>
              <FontAwesome
                name="comment-o"
                size={13}
                color={commentsExpanded ? '#D4A017' : (isDark ? '#6B4C35' : '#A08060')}
              />
              <Text style={[rm.commentsToggleText, { color: commentsExpanded ? '#D4A017' : (isDark ? '#6B4C35' : '#A08060') }]}>
                {commentCount === 0
                  ? 'No comments yet'
                  : `${commentCount} comment${commentCount !== 1 ? 's' : ''}`}
              </Text>
              <FontAwesome
                name={commentsExpanded ? 'chevron-up' : 'chevron-down'}
                size={10}
                color={isDark ? '#6B4C35' : '#A08060'}
                style={{ marginLeft: 'auto' }}
              />
            </Pressable>

            {commentsExpanded && (
              <CommentsSection
                comments={comments}
                isDark={isDark}
                colors={colors}
                onAddComment={onAddComment}
              />
            )}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Friend card ──────────────────────────────────────────────────────────────

function FriendCard({
  friend,
  ago,
  isDark,
  colors,
  onPress,
}: {
  friend: FriendEntry;
  ago: string;
  isDark: boolean;
  colors: any;
  onPress: () => void;
}) {
  const artSize = FRIEND_CARD - 24;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.friendCard,
        {
          width: FRIEND_CARD,
          backgroundColor: isDark ? '#3A2820' : '#FFFFFF',
          borderColor: isDark ? '#2a1e14' : '#DDD5C8',
          opacity: pressed ? 0.7 : 1,
        },
      ]}>
      {friend.artworkUrl ? (
        <ExpoImage source={{ uri: friend.artworkUrl }} style={{ width: artSize, height: artSize, borderRadius: 6 }} contentFit="cover" cachePolicy="disk" transition={200} />
      ) : (
        <ArtFallback size={artSize} radius={6} label={friend.album} />
      )}
      <Text style={[s.friendUser, { color: '#D4A017' }]} numberOfLines={1}>@{friend.user}</Text>
      <Text style={[s.cardTitle,  { color: isDark ? '#f5e6c8' : '#1A0F0A' }]} numberOfLines={1}>{friend.album}</Text>
      <Text style={[s.cardSub,    { color: isDark ? '#A08060' : '#6B4C35' }]} numberOfLines={1}>{friend.artist}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
        <Text style={[s.friendAgo, { color: colors.subtext }]}>{ago}</Text>
        {friend.rating != null && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <FontAwesome name="volume-up" size={9} color="#D4A017" />
            <View style={s.friendRatingBadge}>
              <Text style={s.friendRatingNum}>{friend.rating}</Text>
            </View>
          </View>
        )}
      </View>
      {friend.review ? (
        <Text style={[s.friendReviewSnippet, { color: isDark ? '#A08060' : '#6B4C35' }]} numberOfLines={2}>
          "{friend.review}"
        </Text>
      ) : null}
    </Pressable>
  );
}

// ─── Friend review modal ───────────────────────────────────────────────────────

function FriendReviewModal({
  friend,
  isDark,
  onClose,
  onAlbumPress,
}: {
  friend: FriendEntry;
  isDark: boolean;
  onClose: () => void;
  onAlbumPress: () => void;
}) {
  const bg     = isDark ? '#0F0A07' : '#FAF7F2';
  const border = isDark ? '#2a1e14' : '#E8E0D4';
  const text   = isDark ? '#f5e6c8' : '#1A0F0A';
  const sub    = isDark ? '#A08060' : '#6B4C35';

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
        {/* Header */}
        <View style={[frm.header, { borderBottomColor: border }]}>
          <Pressable onPress={onClose} hitSlop={12}>
            <FontAwesome name="chevron-down" size={16} color={sub} />
          </Pressable>
          <Text style={[frm.headerTitle, { color: text }]}>Listen</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={frm.body} showsVerticalScrollIndicator={false}>
          {/* Album row */}
          <Pressable
            onPress={onAlbumPress}
            style={({ pressed }) => [frm.albumRow, { opacity: pressed ? 0.7 : 1 }]}>
            <ExpoImage source={{ uri: friend.artworkUrl }} style={frm.art} contentFit="cover" cachePolicy="disk" />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[frm.albumTitle, { color: text }]} numberOfLines={2}>{friend.album}</Text>
              <Text style={[frm.albumArtist, { color: sub }]}>{friend.artist} · {friend.year}</Text>
              {friend.rating != null && (
                <View style={frm.ratingRow}>
                  <FontAwesome name="volume-up" size={10} color="#D4A017" />
                  <View style={frm.ratingBadge}>
                    <Text style={frm.ratingNum}>{friend.rating}</Text>
                  </View>
                </View>
              )}
            </View>
          </Pressable>

          {/* Who + when */}
          <View style={[frm.metaRow, { borderColor: border }]}>
            <View style={[frm.avatar, { backgroundColor: avatarColor(friend.user) }]}>
              <Text style={frm.avatarLetter}>{friend.user[0].toUpperCase()}</Text>
            </View>
            <View style={{ gap: 2 }}>
              <Text style={[frm.username, { color: '#D4A017' }]}>@{friend.user}</Text>
              <Text style={[frm.date, { color: sub }]}>Logged {friend.loggedDate}</Text>
            </View>
          </View>

          {/* Review */}
          {friend.review ? (
            <Text style={[frm.reviewText, { color: sub }]}>"{friend.review}"</Text>
          ) : (
            <Text style={[frm.noReview, { color: isDark ? '#4a3020' : '#C8B89A' }]}>No written review.</Text>
          )}

          {/* View album button */}
          <Pressable
            onPress={onAlbumPress}
            style={({ pressed }) => [frm.viewAlbumBtn, { opacity: pressed ? 0.75 : 1 }]}>
            <Text style={frm.viewAlbumText}>View Album</Text>
            <FontAwesome name="chevron-right" size={12} color="#0F0A07" />
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  const { loggedAlbums } = useAlbums();
  const loggedIds = new Set(loggedAlbums.map((a) => a.id));

  const [albums,  setAlbums]  = useState<SpotifyAlbum[]>(cache.albums   ?? []);
  const [songs,   setSongs]   = useState<SpotifyTrack[]>(cache.songs    ?? []);
  const [artists, setArtists] = useState<SpotifyArtist[]>(cache.artists ?? []);
  const [loading, setLoading] = useState(!cache.albums);
  const [likedReviews, setLikedReviews] = useState<Set<string>>(new Set());

  const [activeSong, setActiveSong] = useState<SongInfo | null>(null);

  // Friend review modal state
  const [expandedFriend, setExpandedFriend] = useState<FriendEntry | null>(null);

  // Comments state for popular reviews
  const [expandedReview,     setExpandedReview]     = useState<PopularReview | null>(null);
  const [expandedCommentsId, setExpandedCommentsId] = useState<string | null>(null);
  const [commentsMap, setCommentsMap] = useState<Map<string, ReviewComment[]>>(() => {
    const m = new Map<string, ReviewComment[]>();
    for (const c of POPULAR_REVIEW_COMMENTS) {
      m.set(c.reviewId, [...(m.get(c.reviewId) ?? []), c]);
    }
    return m;
  });

  function handleLikeReview(id: string) {
    setLikedReviews(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
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

  function handleReviewCardPress(item: PopularReview) {
    setExpandedReview(item);
    setExpandedCommentsId(null);
  }

  function handleReviewCommentCountPress(item: PopularReview) {
    setExpandedReview(item);
    setExpandedCommentsId(item.id);
  }

  function handleAddComment(reviewId: string, body: string, parentId?: string | null) {
    const newComment: ReviewComment = {
      id:              `local_${Date.now()}`,
      reviewId,
      parentCommentId: parentId ?? null,
      userId:          'local',
      username:        'you',
      body,
      createdAt:       'just now',
    };
    setCommentsMap(prev => {
      const m = new Map(prev);
      m.set(reviewId, [...(m.get(reviewId) ?? []), newComment]);
      return m;
    });
  }

  useFocusEffect(
    useCallback(() => {
      fetchHome()
        .then((data) => {
          cache.albums  = data.albums;
          cache.songs   = data.songs;
          cache.artists = data.artists;
          setAlbums(data.albums);
          setSongs(data.songs);
          setArtists(data.artists);
          const urls = data.albums.map(a => a.artworkUrl).filter(Boolean) as string[];
          if (urls.length) ExpoImage.prefetch(urls);
        })
        .catch((err) => console.error('[Home] fetchHome failed:', err?.message ?? err))
        .finally(() => setLoading(false));
    }, [])
  );

  function handleAlbumPress(item: SpotifyAlbum) {
    router.push({
      pathname: '/album-detail',
      params: { id: item.id, title: item.title, artist: item.artist, year: String(item.year), artworkUrl: item.artworkUrl },
    });
  }

  function handleArtistPress(item: SpotifyArtist) {
    router.push({
      pathname: '/artist-detail',
      params: { id: item.id, name: item.name, artworkUrl: item.artworkUrl },
    });
  }

  function handleSongPress(item: SpotifyTrack) {
    setActiveSong({ id: item.id, title: item.title, artist: item.artist, artworkUrl: item.artworkUrl, releaseDate: item.releaseDate });
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}>

      {/* 1 — Top Listend Albums This Week */}
      <Section title="Top Listend Albums This Week" loading={loading}>
        <FlatList
          horizontal
          data={albums}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.row}
          renderItem={({ item }) => (
            <AlbumCard item={item} isDark={isDark} isLogged={loggedIds.has(item.id)} onPress={() => handleAlbumPress(item)} />
          )}
        />
      </Section>

      {/* 2 — Friends Recent Listend */}
      <Section title="Friends Recent Listend" loading={false}>
        <FlatList
          horizontal
          data={PLACEHOLDER_FRIENDS}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.row}
          renderItem={({ item, index }) => (
            <FriendCard
              friend={item}
              ago={AGO[index] ?? ''}
              isDark={isDark}
              colors={colors}
              onPress={() => setExpandedFriend(item)}
            />
          )}
        />
      </Section>

      {/* 3 — Popular Reviews This Week */}
      <Section title="Popular Reviews This Week" loading={false}>
        <FlatList
          horizontal
          data={POPULAR_REVIEWS_DATA}
          keyExtractor={item => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.row}
          renderItem={({ item }) => (
            <PopularReviewCard
              item={item}
              liked={likedReviews.has(item.id)}
              onLike={() => handleLikeReview(item.id)}
              onPress={() => handleReviewCardPress(item)}
              onAlbumPress={() => navigateToAlbum(item.albumTitle, item.albumArtist, item.artworkUrl, item.albumYear)}
              onCommentCountPress={() => handleReviewCommentCountPress(item)}
              commentCount={commentsMap.get(item.id)?.length ?? 0}
              isDark={isDark}
              colors={colors}
            />
          )}
          ListFooterComponent={
            <Pressable
              onPress={() => router.push('/popular-reviews')}
              style={({ pressed }) => [
                pr.seeMoreCard,
                {
                  backgroundColor: isDark ? '#3A2820' : '#FFFFFF',
                  borderColor: isDark ? '#2a1e14' : '#DDD5C8',
                  opacity: pressed ? 0.7 : 1,
                },
              ]}>
              <FontAwesome name="arrow-right" size={20} color="#D4A017" />
              <Text style={[pr.seeMoreText, { color: isDark ? '#f5e6c8' : '#1A0F0A' }]}>
                See{'\n'}All
              </Text>
            </Pressable>
          }
        />
      </Section>

      {/* Friend review modal */}
      {expandedFriend && (
        <FriendReviewModal
          friend={expandedFriend}
          isDark={isDark}
          onClose={() => setExpandedFriend(null)}
          onAlbumPress={() => {
            setExpandedFriend(null);
            navigateToAlbum(expandedFriend.album, expandedFriend.artist, expandedFriend.artworkUrl, expandedFriend.year);
          }}
        />
      )}

      {/* Song info modal */}
      <SongInfoModal
        song={activeSong}
        onClose={() => setActiveSong(null)}
        onArtistPress={(name) => router.push({ pathname: '/artist-detail', params: { name } })}
        onAlbumPress={(p) => router.push({ pathname: '/album-detail', params: p } as any)}
      />

      {/* Expanded review modal */}
      {expandedReview && (
        <PopularReviewModal
          review={expandedReview}
          comments={commentsMap.get(expandedReview.id) ?? []}
          commentsExpanded={expandedCommentsId === expandedReview.id}
          onToggleComments={() =>
            setExpandedCommentsId(prev => prev === expandedReview.id ? null : expandedReview.id)
          }
          onAddComment={(body, parentId) => handleAddComment(expandedReview.id, body, parentId)}
          onClose={() => { setExpandedReview(null); setExpandedCommentsId(null); }}
          onAlbumPress={() => {
            setExpandedReview(null);
            navigateToAlbum(expandedReview.albumTitle, expandedReview.albumArtist, expandedReview.artworkUrl, expandedReview.albumYear);
          }}
          isDark={isDark}
          colors={colors}
        />
      )}

      {/* 4 — Top Listend Songs This Week */}
      <Section title="Top Listend Songs This Week" loading={loading}>
        <FlatList
          horizontal
          data={songs}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.row}
          renderItem={({ item, index }) => (
            <SongCard item={item} index={index} isDark={isDark} onPress={() => handleSongPress(item)} />
          )}
        />
      </Section>

      {/* 4 — Top Listend Artists This Week */}
      <Section title="Top Listend Artists This Week" loading={loading}>
        <FlatList
          horizontal
          data={artists}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.row}
          renderItem={({ item }) => (
            <ArtistCard item={item} isDark={isDark} onPress={() => handleArtistPress(item)} />
          )}
        />
      </Section>

    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  content: { paddingTop: 20, paddingBottom: 48, gap: 32 },

  section:      { gap: 12 },
  sectionLabel: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3, paddingHorizontal: 16 },
  sectionLoader:{ height: ALBUM_CARD, justifyContent: 'center', alignItems: 'center' },
  row:          { paddingHorizontal: 16, gap: 12 },

  card: { gap: 5 },

  fallback: {
    backgroundColor: FALLBACK_BG,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackText: {
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '700',
  },

  cardTitle: { fontSize: 12, fontWeight: '600' },
  cardSub:   { fontSize: 11 },

  loggedBadge: { position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1.5, borderColor: '#D4A017', alignItems: 'center', justifyContent: 'center' },

  rankBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  rankText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  friendCard: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 5,
  },
  friendUser:          { fontSize: 11, fontWeight: '600', marginTop: 4 },
  friendAgo:           { fontSize: 10 },
  friendRatingBadge:   { backgroundColor: '#D4A017', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  friendRatingNum:     { color: '#fff', fontSize: 10, fontWeight: '700' },
  friendReviewSnippet: { fontSize: 11, lineHeight: 15, fontStyle: 'italic', marginTop: 2 },
});

// ─── Popular review card styles ───────────────────────────────────────────────

const pr = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 10,
  },
  topRow: {
    flexDirection: 'row',
    gap: 10,
  },
  art: {
    width: 72,
    height: 72,
    borderRadius: 6,
  },
  albumInfo: {
    flex: 1,
    gap: 3,
    justifyContent: 'center',
  },
  albumTitle:  { fontSize: 12, fontWeight: '700', lineHeight: 16 },
  albumArtist: { fontSize: 11 },
  albumYear:   { fontSize: 10 },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  ratingBadge: {
    backgroundColor: '#D4A017',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignItems: 'center',
  },
  ratingNum: { color: '#fff', fontSize: 11, fontWeight: '700' },
  reviewText: { fontSize: 12, lineHeight: 18, fontStyle: 'italic' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: { color: '#fff', fontSize: 10, fontWeight: '700' },
  username: { fontSize: 11, fontWeight: '600' },
  likeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  likeCount: { fontSize: 11 },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  actionCount: { fontSize: 11, fontWeight: '600' },
  seeMoreCard: {
    width: 72,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'stretch',
  },
  seeMoreText: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
});

// ─── Review modal styles ──────────────────────────────────────────────────────

const rm = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  body: { padding: 16, gap: 14 },

  albumRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  art: { width: 80, height: 80, borderRadius: 8 },
  albumTitle:  { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  albumArtist: { fontSize: 13 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  ratingBadge: {
    backgroundColor: '#D4A017',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ratingNum: { color: '#fff', fontSize: 11, fontWeight: '700' },

  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: { color: '#fff', fontSize: 11, fontWeight: '700' },
  username: { color: '#D4A017', fontSize: 13, fontWeight: '600' },

  reviewText: { fontSize: 14, lineHeight: 22, fontStyle: 'italic' },

  commentsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  commentsToggleText: { fontSize: 13, fontWeight: '600', flex: 1 },
});

// ─── Friend review modal styles ───────────────────────────────────────────────

const frm = StyleSheet.create({
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  body:        { padding: 20, gap: 20, paddingBottom: 48 },
  albumRow:    { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  art:         { width: 80, height: 80, borderRadius: 8 },
  albumTitle:  { fontSize: 16, fontWeight: '700', lineHeight: 22 },
  albumArtist: { fontSize: 13 },
  ratingRow:   { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  ratingBadge: { backgroundColor: '#D4A017', borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 },
  ratingNum:   { color: '#fff', fontSize: 12, fontWeight: '700' },
  metaRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  avatar:      { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  avatarLetter:{ color: '#fff', fontSize: 15, fontWeight: '700' },
  username:    { fontSize: 14, fontWeight: '600' },
  date:        { fontSize: 12 },
  reviewText:  { fontSize: 14, lineHeight: 22, fontStyle: 'italic' },
  noReview:    { fontSize: 13, fontStyle: 'italic' },
  viewAlbumBtn:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#D4A017', borderRadius: 12, paddingVertical: 13 },
  viewAlbumText:{ color: '#0F0A07', fontSize: 14, fontWeight: '700' },
});
