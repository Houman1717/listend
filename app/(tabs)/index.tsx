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
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { navigateToProfile } from '@/lib/navigateToProfile';
import { navigateToAlbum } from '@/lib/navigateToAlbum';
import {
  PopularReview,
  fetchTopAlbumsThisWeek,
  fetchTopSongsThisWeek,
  fetchTopArtistsThisWeek,
  fetchPopularReviewsThisWeek,
} from '@/lib/homeData';
import { fetchReviewComments, insertReviewComment } from '@/lib/reviewComments';

// ─── Backend URL ──────────────────────────────────────────────────────────────

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

// ─── Placeholder friends ──────────────────────────────────────────────────────

const PLACEHOLDER_FRIENDS = [
  {
    id: '1', user: 'alex_m', album: 'After Hours', artist: 'The Weeknd', year: '2020',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/6f/bc/e6/6fbce6c4-c38c-72d8-4fd0-66cfff32f679/20UMGIM12176.rgb.jpg/500x500bb.jpg',
    rating: 9, likeCount: 14, loggedDate: 'May 7, 2026',
    review: 'Blinding Lights alone makes this a classic, but the whole album is a cinematic fever dream. The production is immaculate — every synth line feels intentional. Abel at his darkest and most theatrical.',
  },
  {
    id: '2', user: 'sara_k', album: 'folklore', artist: 'Taylor Swift', year: '2020',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/b5/80/dc/b580dca0-349d-036b-e09b-bd849f6affd8/20UMGIM64216.rgb.jpg/500x500bb.jpg',
    rating: 10, likeCount: 31, loggedDate: 'May 6, 2026',
    review: 'This album made me feel things I didn\'t know I needed to feel. The cottagecore aesthetic works perfectly with the stripped-back production. "august" is a masterpiece.',
  },
  {
    id: '3', user: 'jvines', album: 'DAMN.', artist: 'Kendrick Lamar', year: '2017',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/86/c9/bb/86c9bb30-fe3d-442e-33c1-c106c4d23705/17UMGIM88776.rgb.jpg/500x500bb.jpg',
    rating: 10, likeCount: 47, loggedDate: 'May 5, 2026',
    review: null,
  },
  {
    id: '4', user: 'priya_r', album: 'SOS', artist: 'SZA', year: '2022',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/bd/3b/a9/bd3ba9fb-9609-144f-bcfe-ead67b5f6ab3/196589564931.jpg/500x500bb.jpg',
    rating: 8, likeCount: 9, loggedDate: 'May 5, 2026',
    review: 'Long but never boring. SZA somehow makes 23 tracks feel cohesive. Her voice is doing everything.',
  },
  {
    id: '5', user: 'tomfitz', album: 'Random Access Memories', artist: 'Daft Punk', year: '2013',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/500x500bb.jpg',
    rating: null, likeCount: 5, loggedDate: 'May 4, 2026',
    review: null,
  },
  {
    id: '6', user: 'nadia_w', album: 'Currents', artist: 'Tame Impala', year: '2015',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/a8/2e/b4/a82eb490-f30a-a321-461a-0383c88fec95/15UMGIM23316.rgb.jpg/500x500bb.jpg',
    rating: 9, likeCount: 22, loggedDate: 'May 3, 2026',
    review: 'Kevin Parker locked himself in a studio and came out with the most immersive headphone album of the decade. "Eventually" breaks my heart every single time.',
  },
];

const AGO = ['2m ago', '14m ago', '1h ago', '2h ago', '3h ago', '5h ago'];

type FriendEntry = typeof PLACEHOLDER_FRIENDS[number];

const FRIEND_COMMENTS: ReviewComment[] = [
  { id: 'fc1',  reviewId: '1', userId: 'u1', username: 'vinyl_ghost',   body: 'Save Your Tears (Remix) was everywhere but the OG hits different.',       createdAt: '1h ago'    },
  { id: 'fc2',  reviewId: '1', userId: 'u2', username: 'deepcut_dave',  body: 'Faith as the closer is genuinely haunting. Great listen.',                 createdAt: '30m ago'   },
  { id: 'fc3',  reviewId: '2', userId: 'u3', username: 'tape_hiss',     body: 'seven is so underrated on this album. Perfect little track.',              createdAt: '2h ago'    },
  { id: 'fc4',  reviewId: '2', parentCommentId: 'fc3', userId: 'u4', username: 'sara_k', body: 'Agreed! It feels like a secret you weren\'t supposed to hear.', createdAt: '1h ago' },
  { id: 'fc5',  reviewId: '3', userId: 'u5', username: 'freq_check',    body: 'DUCKWORTH closing this out is one of the greatest album endings ever.',    createdAt: '3h ago'    },
  { id: 'fc6',  reviewId: '3', userId: 'u6', username: 'bass_drop_bb',  body: 'Humble is peak but XXX is the real highlight for me.',                     createdAt: '2h ago'    },
  { id: 'fc7',  reviewId: '4', userId: 'u7', username: 'moonrise_mix',  body: 'Kill Bill is a top 5 song of the decade no debate.',                       createdAt: '4h ago'    },
  { id: 'fc8',  reviewId: '5', userId: 'u8', username: 'analog_kid',    body: 'Giorgio by Moroder is 9 minutes of absolute perfection.',                  createdAt: '5h ago'    },
  { id: 'fc9',  reviewId: '5', parentCommentId: 'fc8', userId: 'u9', username: 'tomfitz', body: 'Giorgio knew what he was doing — legend.',              createdAt: '4h ago'    },
  { id: 'fc10', reviewId: '6', userId: 'u10', username: 'lo_freq',      body: 'The Less I Know The Better never gets old. True indie-pop masterpiece.',   createdAt: '6h ago'    },
];

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

export const POPULAR_REVIEW_COMMENTS: ReviewComment[] = [
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

// ─── Volume + bars badge ──────────────────────────────────────────────────────

function VolumeBadge({ rating, showNumber, isDark }: { rating: number; showNumber?: boolean; isDark?: boolean }) {
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
      {showNumber && (
        <Text style={{ color: '#D4A017', fontSize: 10, fontWeight: '700' }}>{rating}</Text>
      )}
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

function SongCard({ item, isDark, onPress }: { item: SpotifyTrack; isDark: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.card, { width: SONG_CARD, opacity: pressed ? 0.7 : 1 }]}>
      {item.artworkUrl ? (
        <ExpoImage source={{ uri: item.artworkUrl }} style={{ width: SONG_CARD, height: SONG_CARD, borderRadius: 6 }} contentFit="cover" cachePolicy="disk" transition={200} />
      ) : (
        <ArtFallback size={SONG_CARD} radius={6} label={item.title} />
      )}
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
  onUsernamePress,
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
  onUsernamePress?: () => void;
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
            <VolumeBadge rating={item.rating} showNumber isDark={isDark} />
          </View>
        </View>
      </Pressable>

      {/* Review snippet */}
      <Text style={[pr.reviewText, { color: isDark ? '#A08060' : '#6B4C35' }]} numberOfLines={3}>
        "{item.review}"
      </Text>

      {/* Footer: avatar + username | comments + like */}
      <View style={pr.footer}>
        <Pressable
          onPress={(e) => { e.stopPropagation?.(); onUsernamePress?.(); }}
          hitSlop={6}
          style={[pr.userRow, { opacity: 1 }]}>
          <View style={[pr.avatar, { backgroundColor: avatarColor(item.username), overflow: 'hidden' }]}>
            {item.avatarUrl
              ? <ExpoImage source={{ uri: item.avatarUrl }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" />
              : <Text style={pr.avatarLetter}>{item.username[0].toUpperCase()}</Text>
            }
          </View>
          <Text style={[pr.username, { color: '#D4A017' }]} numberOfLines={1}>
            @{item.username}
          </Text>
        </Pressable>
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
  onUsernamePress,
  liked,
  onLike,
  isDark,
  colors,
}: {
  review: PopularReview;
  comments: ReviewComment[];
  commentsExpanded: boolean;
  onToggleComments: () => void;
  onAddComment: (body: string, parentId?: string | null, username?: string, replyToUsername?: string, avatarUrl?: string | null) => void;
  onClose: () => void;
  onAlbumPress: () => void;
  onUsernamePress?: (username: string) => void;
  liked: boolean;
  onLike: () => void;
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
                  <VolumeBadge rating={review.rating} showNumber isDark={isDark} />
                </View>
              </View>
            </Pressable>

            {/* Author */}
            <Pressable
              style={rm.authorRow}
              onPress={() => { onClose(); onUsernamePress?.(review.username); }}
              disabled={!onUsernamePress}>
              <View style={[rm.avatar, { backgroundColor: avatarColor(review.username), overflow: 'hidden' }]}>
                {review.avatarUrl
                  ? <ExpoImage source={{ uri: review.avatarUrl }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" />
                  : <Text style={rm.avatarLetter}>{review.username[0].toUpperCase()}</Text>
                }
              </View>
              <Text style={rm.username}>@{review.username}</Text>
            </Pressable>

            {/* Full review */}
            <Text style={[rm.reviewText, { color: isDark ? '#A08060' : '#6B4C35' }]}>
              "{review.review}"
            </Text>

            {/* Like + comment toggle row */}
            <View style={[frm.likeCommentRow, { borderColor: border }]}>
              <Pressable onPress={onLike} hitSlop={8} style={frm.likeBtn}>
                <FontAwesome
                  name={liked ? 'heart' : 'heart-o'}
                  size={15}
                  color={liked ? '#D4A017' : (isDark ? '#A08060' : '#6B4C35')}
                />
                <Text style={[frm.likeCount, { color: liked ? '#D4A017' : (isDark ? '#A08060' : '#6B4C35') }]}>
                  {review.likeCount + (liked ? 1 : 0)}
                </Text>
              </Pressable>
              <Pressable
                onPress={onToggleComments}
                hitSlop={8}
                style={[rm.commentsToggle, { borderColor: border, flex: 1, marginBottom: 0 }]}>
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

// ─── Friend full row (used in See More list — popular-review style) ───────────

// ─── Friend full row (used in See More list — popular-review style) ───────────

function FriendFullRow({
  friend,
  isDark,
  colors,
  onAlbumPress,
  onUsernamePress,
}: {
  friend: FriendEntry;
  isDark: boolean;
  colors: any;
  onAlbumPress: () => void;
  onUsernamePress?: () => void;
}) {
  const router = useRouter();
  const [liked,            setLiked]            = useState(false);
  const [likeCount,        setLikeCount]        = useState(friend.likeCount);
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const [localComments,    setLocalComments]    = useState(
    FRIEND_COMMENTS.filter(c => c.reviewId === friend.id)
  );

  const border  = isDark ? '#2a1e14' : '#e8e8e8';
  const subtext = isDark ? '#6B4C35' : '#A08060';

  function handleAddComment(body: string, parentId?: string | null, commenterUsername?: string, replyToUsername?: string, avatarUrl?: string | null) {
    setLocalComments(prev => [...prev, {
      id: `ffc_${Date.now()}`, reviewId: friend.id,
      userId: 'me', username: commenterUsername ?? 'me', body,
      parentCommentId: parentId ?? undefined,
      replyToUsername: replyToUsername ?? null,
      avatarUrl: avatarUrl ?? null,
      createdAt: 'just now',
    }]);
  }

  return (
    <View style={[flr.card, { backgroundColor: isDark ? '#2e2018' : '#fff', borderColor: border }]}>
      {/* Album row */}
      <Pressable onPress={onAlbumPress} style={({ pressed }) => [flr.topRow, { opacity: pressed ? 0.7 : 1 }]}>
        <ExpoImage source={{ uri: friend.artworkUrl }} style={flr.art} contentFit="cover" cachePolicy="disk" transition={200} />
        <View style={flr.albumInfo}>
          <Text style={[flr.albumTitle, { color: isDark ? '#f5e6c8' : '#1c1410' }]} numberOfLines={2}>{friend.album}</Text>
          <Text style={[flr.albumArtist, { color: isDark ? '#a07850' : '#7a5535' }]} numberOfLines={1}>{friend.artist} · {friend.year}</Text>
          {friend.rating != null && (
            <View style={flr.ratingRow}>
              <VolumeBadge rating={friend.rating} showNumber isDark={isDark} />
            </View>
          )}
        </View>
      </Pressable>

      {/* Review text */}
      {friend.review ? (
        <Text style={[flr.reviewText, { color: isDark ? '#a07850' : '#3a2818' }]}>
          "{friend.review}"
        </Text>
      ) : (
        <Text style={[flr.reviewText, { color: isDark ? '#4a3020' : '#C8B89A', fontStyle: 'italic' }]}>
          No written review.
        </Text>
      )}

      {/* Footer */}
      <View style={[flr.footer, { borderTopColor: border }]}>
        <Pressable
          style={flr.userRow}
          onPress={onUsernamePress}
          hitSlop={6}>
          <View style={[flr.avatar, { backgroundColor: avatarColor(friend.user) }]}>
            <Text style={flr.avatarLetter}>{friend.user[0].toUpperCase()}</Text>
          </View>
          <View>
            <Text style={flr.username}>@{friend.user}</Text>
            <Text style={[flr.listenedDate, { color: isDark ? '#A08060' : '#6B4C35' }]}>Listend {friend.loggedDate}</Text>
          </View>
        </Pressable>
        <View style={flr.footerActions}>
          <Pressable onPress={() => setCommentsExpanded(p => !p)} hitSlop={8} style={flr.actionBtn}>
            <FontAwesome name="comment-o" size={16} color={commentsExpanded ? '#D4A017' : subtext} />
            <Text style={[flr.actionCount, { color: commentsExpanded ? '#D4A017' : subtext }]}>{localComments.length}</Text>
          </Pressable>
          <Pressable onPress={() => { setLiked(p => !p); setLikeCount(n => liked ? n - 1 : n + 1); }} hitSlop={8} style={flr.actionBtn}>
            <FontAwesome name={liked ? 'heart' : 'heart-o'} size={16} color={liked ? '#D4A017' : subtext} />
            <Text style={[flr.actionCount, { color: liked ? '#D4A017' : subtext }]}>{likeCount}</Text>
          </Pressable>
        </View>
      </View>

      {commentsExpanded && (
        <View style={{ paddingHorizontal: 14, paddingBottom: 4 }}>
          <CommentsSection
            comments={localComments}
            isDark={isDark}
            colors={colors}
            onAddComment={handleAddComment}
            onUsernamePress={(username) => navigateToProfile(username, router)}
            large
          />
        </View>
      )}
    </View>
  );
}

// ─── Friend card ──────────────────────────────────────────────────────────────

function FriendCard({
  friend,
  isDark,
  colors,
  onPress,
  onUsernamePress,
}: {
  friend: FriendEntry;
  isDark: boolean;
  colors: any;
  onPress: () => void;
  onUsernamePress?: () => void;
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
      <Pressable onPress={(e) => { e.stopPropagation?.(); onUsernamePress?.(); }} hitSlop={6}>
        <Pressable onPress={(e) => { e.stopPropagation?.(); onUsernamePress?.(); }} hitSlop={6}>
        <Text style={[s.friendUser, { color: '#D4A017' }]} numberOfLines={1}>@{friend.user}</Text>
      </Pressable>
      </Pressable>
      <Text style={[s.cardTitle,  { color: isDark ? '#f5e6c8' : '#1A0F0A' }]} numberOfLines={1}>{friend.album}</Text>
      <Text style={[s.cardSub,    { color: isDark ? '#A08060' : '#6B4C35' }]} numberOfLines={1}>{friend.artist}</Text>
      <Text style={[s.friendAgo, { color: colors.subtext, marginTop: 2 }]}>Listend {friend.loggedDate}</Text>
      {(!!friend.rating || friend.isReListened) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          {!!friend.rating && <VolumeBadge rating={friend.rating} showNumber isDark={isDark} />}
          {friend.isReListened && <FontAwesome name="repeat" size={9} color="#D4A017" />}
        </View>
      )}
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
  comments,
  liked,
  onLike,
  onAddComment,
  isDark,
  colors,
  onClose,
  onAlbumPress,
  onUsernamePress,
}: {
  friend: FriendEntry;
  comments: ReviewComment[];
  liked: boolean;
  onLike: () => void;
  onAddComment: (body: string, parentId?: string | null, username?: string, replyToUsername?: string, avatarUrl?: string | null) => void;
  isDark: boolean;
  colors: any;
  onClose: () => void;
  onAlbumPress: () => void;
  onUsernamePress?: (username: string) => void;
}) {
  const [commentsExpanded, setCommentsExpanded] = useState(false);

  const bg     = isDark ? colors.background : colors.background;
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
            <Text style={[rm.headerTitle, { color: isDark ? '#f5e6c8' : '#1A0F0A' }]}>Listen</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView
            contentContainerStyle={[rm.body, { paddingBottom: 40 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>

            {/* Album row — tappable */}
            <Pressable
              onPress={onAlbumPress}
              style={({ pressed }) => [rm.albumRow, { opacity: pressed ? 0.7 : 1 }]}>
              <ExpoImage source={{ uri: friend.artworkUrl }} style={rm.art} contentFit="cover" cachePolicy="disk" />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[rm.albumTitle, { color: isDark ? '#f5e6c8' : '#1A0F0A' }]}>{friend.album}</Text>
                <Text style={[rm.albumArtist, { color: isDark ? '#A08060' : '#6B4C35' }]}>
                  {friend.artist} · {friend.year}
                </Text>
                {!!friend.rating && (
                  <View style={rm.ratingRow}>
                    <VolumeBadge rating={friend.rating} showNumber isDark={isDark} />
                  </View>
                )}
                {friend.isReListened && (
                  <FontAwesome name="repeat" size={9} color="#D4A017" style={{ marginTop: 2 }} />
                )}
              </View>
            </Pressable>

            {/* Author + date */}
            <Pressable
              style={rm.authorRow}
              onPress={() => { onClose(); onUsernamePress?.(friend.user); }}
              disabled={!onUsernamePress}>
              <View style={[rm.avatar, { backgroundColor: avatarColor(friend.user), overflow: 'hidden' }]}>
                {friend.avatarUrl
                  ? <ExpoImage source={{ uri: friend.avatarUrl }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" />
                  : <Text style={rm.avatarLetter}>{friend.user[0].toUpperCase()}</Text>
                }
              </View>
              <View style={{ gap: 1 }}>
                <Text style={rm.username}>@{friend.user}</Text>
                <Text style={[rm.listenedDate, { color: isDark ? '#A08060' : '#6B4C35' }]}>
                  Listend {friend.loggedDate}
                </Text>
              </View>
            </Pressable>

            {/* Review text */}
            {friend.review ? (
              <Text style={[rm.reviewText, { color: isDark ? '#A08060' : '#6B4C35' }]}>
                "{friend.review}"
              </Text>
            ) : (
              <Text style={[rm.reviewText, { color: isDark ? '#4a3020' : '#C8B89A', fontStyle: 'italic' }]}>
                No written review.
              </Text>
            )}

            {/* Like + comment toggle row */}
            <View style={[frm.likeCommentRow, { borderColor: border }]}>
              <Pressable onPress={onLike} hitSlop={8} style={frm.likeBtn}>
                <FontAwesome
                  name={liked ? 'heart' : 'heart-o'}
                  size={15}
                  color={liked ? '#D4A017' : (isDark ? '#A08060' : '#6B4C35')}
                />
                <Text style={[frm.likeCount, { color: liked ? '#D4A017' : (isDark ? '#A08060' : '#6B4C35') }]}>
                  {friend.likeCount + (liked ? 1 : 0)}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setCommentsExpanded(prev => !prev)}
                hitSlop={8}
                style={[rm.commentsToggle, { borderColor: border, flex: 1, marginBottom: 0 }]}>
                <FontAwesome
                  name="comment-o"
                  size={13}
                  color={commentsExpanded ? '#D4A017' : (isDark ? '#6B4C35' : '#A08060')}
                />
                <Text style={[rm.commentsToggleText, { color: commentsExpanded ? '#D4A017' : (isDark ? '#6B4C35' : '#A08060') }]}>
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

// ─── Friends Recent Activity types + fetch ────────────────────────────────────

type FriendProfile = { id: string; username: string | null; avatarUrl: string | null };

type FriendActivityItem =
  | { kind: 'top5';            key: string; friend: FriendProfile; category: string; itemId: string; itemName: string; itemImageUrl: string | null; position: number; dateMs: number; dateLabel: string }
  | { kind: 'likedArtist';     key: string; friend: FriendProfile; artistId: string; name: string; artworkUrl: string | null; dateMs: number; dateLabel: string }
  | { kind: 'likedPlaylist';   key: string; friend: FriendProfile; targetId: string; name: string; artworkUrls: string[]; dateMs: number; dateLabel: string }
  | { kind: 'createdPlaylist'; key: string; friend: FriendProfile; playlistId: string; name: string; artworkUrls: string[]; dateMs: number; dateLabel: string }
  | { kind: 'wantToListen';    key: string; friend: FriendProfile; albumId: string; title: string; artist: string; artworkUrl: string | null; dateMs: number; dateLabel: string }
  | { kind: 'flippedRecord';   key: string; friend: FriendProfile; albumTitle: string; albumArtist: string; artworkUrl: string | null; dateMs: number; dateLabel: string };

function faDateLabel(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

async function fetchFriendPlaylistArtwork(playlistIds: string[]): Promise<Map<string, string[]>> {
  if (playlistIds.length === 0) return new Map();
  const { data: pas } = await supabase
    .from('playlist_albums').select('playlist_id, spotify_id, position')
    .in('playlist_id', playlistIds).order('position', { ascending: true });
  const allIds = [...new Set((pas ?? []).map((a: any) => a.spotify_id as string))];
  const artMap = new Map<string, string>();
  if (allIds.length > 0) {
    const { data: uas } = await supabase.from('user_albums').select('spotify_id, artwork_url').in('spotify_id', allIds);
    for (const a of (uas ?? []) as any[]) { if (a.artwork_url) artMap.set(a.spotify_id, a.artwork_url); }
  }
  const result = new Map<string, string[]>();
  for (const id of playlistIds) {
    const albums = (pas ?? []).filter((a: any) => a.playlist_id === id).slice(0, 4);
    result.set(id, albums.map((a: any) => artMap.get(a.spotify_id) ?? '').filter(Boolean));
  }
  return result;
}

async function fetchFriendsActivity(uid: string): Promise<FriendActivityItem[]> {
  const [{ data: outRows }, { data: inRows }] = await Promise.all([
    supabase.from('follows').select('following_id').eq('follower_id', uid),
    supabase.from('follows').select('follower_id').eq('following_id', uid),
  ]);
  if (!outRows?.length || !inRows?.length) return [];
  const inSet = new Set((inRows as any[]).map(r => r.follower_id as string));
  const friendIds = [...new Set((outRows as any[]).filter(r => inSet.has(r.following_id)).map(r => r.following_id as string))];
  if (friendIds.length === 0) return [];

  const { data: profiles } = await supabase.from('profiles').select('id, username, avatar_url').in('id', friendIds);
  const profileMap = new Map<string, FriendProfile>();
  for (const p of (profiles ?? []) as any[]) profileMap.set(p.id, { id: p.id, username: p.username, avatarUrl: p.avatar_url });

  const items: FriendActivityItem[] = [];

  const [{ data: top5Rows }, { data: likedArtistRows }, { data: likedPlRows }, { data: createdPlRows }, { data: wantRows }, { data: flipRows }] =
    await Promise.all([
      supabase.from('top5_changes').select('id, user_id, category, item_id, item_name, item_image_url, position, changed_at').in('user_id', friendIds).order('changed_at', { ascending: false }).limit(60),
      supabase.from('liked_artists').select('user_id, artist_id, name, artwork_url, created_at').in('user_id', friendIds).order('created_at', { ascending: false }).limit(60),
      supabase.from('likes').select('user_id, target_id, created_at').in('user_id', friendIds).eq('target_type', 'playlist').not('target_id', 'ilike', 'featured:%').order('created_at', { ascending: false }).limit(60),
      supabase.from('playlists').select('id, user_id, name, created_at').in('user_id', friendIds).order('created_at', { ascending: false }).limit(60),
      supabase.from('want_to_listen').select('user_id, spotify_id, title, artist, artwork_url, created_at').in('user_id', friendIds).order('created_at', { ascending: false }).limit(60),
      supabase.from('flip_records').select('id, user_id, album_title, album_artist, artwork_url, flipped_at').in('user_id', friendIds).order('flipped_at', { ascending: false }).limit(60),
    ]);

  for (const r of (top5Rows ?? []) as any[]) {
    const friend = profileMap.get(r.user_id); if (!friend) continue;
    items.push({ kind: 'top5', key: `top5-${r.id}`, friend, category: r.category, itemId: r.item_id, itemName: r.item_name, itemImageUrl: r.item_image_url ?? null, position: r.position, dateMs: new Date(r.changed_at).getTime(), dateLabel: faDateLabel(r.changed_at) });
  }

  for (const r of (likedArtistRows ?? []) as any[]) {
    const friend = profileMap.get(r.user_id); if (!friend) continue;
    items.push({ kind: 'likedArtist', key: `la-${r.user_id}-${r.artist_id}`, friend, artistId: r.artist_id, name: r.name ?? '', artworkUrl: r.artwork_url ?? null, dateMs: new Date(r.created_at).getTime(), dateLabel: faDateLabel(r.created_at) });
  }

  if (likedPlRows && likedPlRows.length > 0) {
    const plIds = (likedPlRows as any[]).map(r => r.target_id as string);
    const [{ data: plData }, artworkMap] = await Promise.all([supabase.from('playlists').select('id, name').in('id', plIds), fetchFriendPlaylistArtwork(plIds)]);
    const plNameMap = new Map((plData ?? []).map((p: any) => [p.id as string, p.name as string]));
    for (const r of likedPlRows as any[]) {
      const friend = profileMap.get(r.user_id); if (!friend) continue;
      items.push({ kind: 'likedPlaylist', key: `lp-${r.user_id}-${r.target_id}`, friend, targetId: r.target_id, name: plNameMap.get(r.target_id) ?? 'Playlist', artworkUrls: artworkMap.get(r.target_id) ?? [], dateMs: new Date(r.created_at).getTime(), dateLabel: faDateLabel(r.created_at) });
    }
  }

  if (createdPlRows && createdPlRows.length > 0) {
    const plIds = (createdPlRows as any[]).map(r => r.id as string);
    const artworkMap = await fetchFriendPlaylistArtwork(plIds);
    for (const r of createdPlRows as any[]) {
      const friend = profileMap.get(r.user_id); if (!friend) continue;
      items.push({ kind: 'createdPlaylist', key: `cp-${r.user_id}-${r.id}`, friend, playlistId: r.id, name: r.name ?? 'Playlist', artworkUrls: artworkMap.get(r.id) ?? [], dateMs: new Date(r.created_at).getTime(), dateLabel: faDateLabel(r.created_at) });
    }
  }

  for (const r of (wantRows ?? []) as any[]) {
    const friend = profileMap.get(r.user_id); if (!friend) continue;
    items.push({ kind: 'wantToListen', key: `wtl-${r.user_id}-${r.spotify_id}`, friend, albumId: r.spotify_id, title: r.title ?? '', artist: r.artist ?? '', artworkUrl: r.artwork_url ?? null, dateMs: new Date(r.created_at).getTime(), dateLabel: faDateLabel(r.created_at) });
  }

  for (const r of (flipRows ?? []) as any[]) {
    const friend = profileMap.get(r.user_id); if (!friend) continue;
    items.push({ kind: 'flippedRecord', key: `flip-${r.id}`, friend, albumTitle: r.album_title ?? '', albumArtist: r.album_artist ?? '', artworkUrl: r.artwork_url ?? null, dateMs: new Date(r.flipped_at).getTime(), dateLabel: faDateLabel(r.flipped_at) });
  }

  items.sort((a, b) => b.dateMs - a.dateMs);
  return items.slice(0, 30);
}

const FA_PILL: Record<string, { label: string; icon: string }> = {
  top5:            { label: 'Top 5',            icon: 'list-ol'  },
  likedArtist:     { label: 'Liked Artist',     icon: 'heart'    },
  likedPlaylist:   { label: 'Liked Playlist',   icon: 'heart'    },
  createdPlaylist: { label: 'New Playlist',     icon: 'list'     },
  wantToListen:    { label: 'Want to Listen',   icon: 'bookmark' },
  flippedRecord:   { label: 'Flipped a Record', icon: 'random'   },
};

function PlaylistMosaicSmall({ artworkUrls, size, fallback }: { artworkUrls: string[]; size: number; fallback: string }) {
  const half = size / 2;
  const slots = Array.from({ length: 4 }, (_, i) => artworkUrls[i] ?? null);
  return (
    <View style={{ width: size, height: size, borderRadius: 6, overflow: 'hidden', flexDirection: 'row', flexWrap: 'wrap', flexShrink: 0 }}>
      {slots.map((url, i) =>
        url
          ? <ExpoImage key={i} source={{ uri: url }} style={{ width: half, height: half }} contentFit="cover" cachePolicy="disk" />
          : <View key={i} style={{ width: half, height: half, backgroundColor: fallback }} />
      )}
    </View>
  );
}

function FriendActivityCard({
  item, isDark, colors, onPress, onUsernamePress,
}: {
  item: FriendActivityItem;
  isDark: boolean;
  colors: typeof Colors.light;
  onPress: () => void;
  onUsernamePress: () => void;
}) {
  const pill = FA_PILL[item.kind];
  const artSize = FRIEND_CARD - 24;
  const fallback = isDark ? '#2a1e14' : '#e5ddd5';

  let imageUrl: string | null = null;
  let isCircle = false;
  let mosaicUrls: string[] | null = null;
  let itemName = '';
  let itemSub: string | null = null;

  if (item.kind === 'top5') {
    imageUrl = item.itemImageUrl;
    isCircle = item.category === 'artists';
    itemName = item.itemName;
    const cat = item.category.charAt(0).toUpperCase() + item.category.slice(1);
    itemSub = `Top 5 ${cat} · #${item.position}`;
  } else if (item.kind === 'likedArtist') {
    imageUrl = item.artworkUrl; isCircle = true; itemName = item.name;
  } else if (item.kind === 'likedPlaylist') {
    mosaicUrls = item.artworkUrls; itemName = item.name;
    if (item.targetId.startsWith('featured:')) itemSub = 'by Listend';
  } else if (item.kind === 'createdPlaylist') {
    mosaicUrls = item.artworkUrls; itemName = item.name;
  } else if (item.kind === 'wantToListen') {
    imageUrl = item.artworkUrl; itemName = item.title; itemSub = item.artist;
  } else if (item.kind === 'flippedRecord') {
    imageUrl = item.artworkUrl; itemName = item.albumTitle; itemSub = item.albumArtist;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{
        width: FRIEND_CARD, borderRadius: 12, borderWidth: 1, padding: 12,
        gap: 5,
        backgroundColor: isDark ? '#3A2820' : '#FFFFFF',
        borderColor: isDark ? '#2a1e14' : '#DDD5C8',
        opacity: pressed ? 0.7 : 1,
      }]}>
      {mosaicUrls !== null ? (
        <PlaylistMosaicSmall artworkUrls={mosaicUrls} size={artSize} fallback={fallback} />
      ) : imageUrl ? (
        <ExpoImage source={{ uri: imageUrl }} style={{ width: artSize, height: artSize, borderRadius: isCircle ? artSize / 2 : 6 }} contentFit="cover" cachePolicy="disk" />
      ) : (
        <View style={{ width: artSize, height: artSize, borderRadius: isCircle ? artSize / 2 : 6, backgroundColor: fallback, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: isDark ? '#7a5535' : '#a07850', fontSize: 28, fontWeight: '700' }}>{itemName.charAt(0)}</Text>
        </View>
      )}
      <Pressable onPress={(e) => { e.stopPropagation?.(); onUsernamePress(); }} hitSlop={6}>
        <Text style={{ color: '#D4A017', fontSize: 11, fontWeight: '700' }} numberOfLines={1}>@{item.friend.username ?? 'user'}</Text>
      </Pressable>
      <Text style={{ color: isDark ? '#f5e6c8' : '#1A0F0A', fontSize: 12, fontWeight: '600', lineHeight: 16 }} numberOfLines={2}>{itemName}</Text>
      {itemSub ? <Text style={{ color: isDark ? '#A08060' : '#6B4C35', fontSize: 11 }} numberOfLines={1}>{itemSub}</Text> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#D4A017', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
          <FontAwesome name={pill.icon as any} size={8} color="#D4A017" />
          <Text style={{ color: '#D4A017', fontSize: 9, fontWeight: '700', letterSpacing: 0.3 }}>{pill.label}</Text>
        </View>
      </View>
      <Text style={{ color: isDark ? '#7a5535' : '#a07850', fontSize: 10 }} numberOfLines={1}>{item.dateLabel}</Text>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { width } = useWindowDimensions();

  const { user } = useAuth();
  const { loggedAlbums } = useAlbums();
  const loggedIds = new Set(loggedAlbums.map((a) => a.id));

  const [albums,         setAlbums]         = useState<SpotifyAlbum[]>(cache.albums         ?? []);
  const [songs,          setSongs]          = useState<SpotifyTrack[]>(cache.songs          ?? []);
  const [artists,        setArtists]        = useState<SpotifyArtist[]>(cache.artists       ?? []);
  const [popularReviews, setPopularReviews] = useState<PopularReview[]>(cache.popularReviews ?? []);
  const [loading,        setLoading]        = useState(!cache.albums);
  const [friendsListened,        setFriendsListened]        = useState<FriendEntry[]>([]);
  const [friendsListenedLoading, setFriendsListenedLoading] = useState(false);
  const [likedReviews, setLikedReviews] = useState<Set<string>>(new Set());

  const [activeSong, setActiveSong] = useState<SongInfo | null>(null);

  const [friendsActivity,        setFriendsActivity]        = useState<FriendActivityItem[]>([]);
  const [friendsActivityLoading, setFriendsActivityLoading] = useState(false);
  const [showAllFriendActivity,  setShowAllFriendActivity]  = useState(false);
  const [showAllAlbums,          setShowAllAlbums]          = useState(false);
  const [showAllSongs,           setShowAllSongs]           = useState(false);
  const [showAllArtists,         setShowAllArtists]         = useState(false);

  // Friend review modal state
  const [expandedFriend, setExpandedFriend] = useState<FriendEntry | null>(null);
  const [showAllFriends, setShowAllFriends] = useState(false);
  const [showAllFriends, setShowAllFriends] = useState(false);

  // Friend review modal state
  const [expandedFriend, setExpandedFriend] = useState<FriendEntry | null>(null);

  // Comments state for popular reviews
  const [expandedReview,     setExpandedReview]     = useState<PopularReview | null>(null);
  const [expandedCommentsId, setExpandedCommentsId] = useState<string | null>(null);
  const [commentsMap, setCommentsMap] = useState<Map<string, ReviewComment[]>>(new Map());

  useEffect(() => {
    if (!user?.id || popularReviews.length === 0) return;
    const ids = popularReviews.map(r => r.id);
    supabase.from('likes').select('target_id')
      .eq('target_type', 'review').eq('user_id', user.id).in('target_id', ids)
      .then(({ data }) => {
        setLikedReviews(prev => {
          const next = new Set(prev);
          for (const r of (data ?? []) as any[]) next.add(r.target_id as string);
          return next;
        });
      });
  }, [popularReviews.length, user?.id]);

  useEffect(() => {
    if (!user?.id || friendsListened.length === 0) return;
    const ids = friendsListened.map(r => r.id);
    supabase.from('likes').select('target_id')
      .eq('target_type', 'review').eq('user_id', user.id).in('target_id', ids)
      .then(({ data }) => {
        setLikedReviews(prev => {
          const next = new Set(prev);
          for (const r of (data ?? []) as any[]) next.add(r.target_id as string);
          return next;
        });
      });
  }, [friendsListened.length, user?.id]);

  function handleLikeReview(id: string) {
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

  async function searchAndNavigateToAlbum(title: string, artist: string, artworkUrl: string, year: string) {
    navigateToAlbum(router, { id: '', title, artist, artworkUrl, year });
  }

  function openReview(item: PopularReview, openComments = false) {
    setExpandedReview(item);
    setExpandedCommentsId(openComments ? item.id : null);
    if (!commentsMap.has(item.id)) {
      fetchReviewComments(item.id).then(comments => {
        setCommentsMap(prev => {
          const m = new Map(prev);
          if (!m.has(item.id)) m.set(item.id, comments);
          return m;
        });
      });
    }
  }

  function openFriendReview(item: FriendEntry) {
    setExpandedFriend(item);
    if (!commentsMap.has(item.id)) {
      fetchReviewComments(item.id).then(loaded => {
        setCommentsMap(prev => {
          const m = new Map(prev);
          if (!m.has(item.id)) m.set(item.id, loaded);
          return m;
        });
      });
    }
  }

  function handleReviewCardPress(item: PopularReview) {
    openReview(item, false);
  }

  function handleReviewCommentCountPress(item: PopularReview) {
    openReview(item, true);
  }

  function handleAddComment(reviewId: string, body: string, parentId?: string | null, commenterUsername?: string, replyToUsername?: string, avatarUrl?: string | null) {
    const tempId = `local_${Date.now()}`;
    const newComment: ReviewComment = {
      id:              tempId,
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

  useEffect(() => {
    if (!user?.id) return;
    setFriendsActivityLoading(true);
    fetchFriendsActivity(user.id)
      .then(setFriendsActivity)
      .finally(() => setFriendsActivityLoading(false));
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    setFriendsListenedLoading(true);
    fetchFriendsListened(user.id)
      .then(setFriendsListened)
      .finally(() => setFriendsListenedLoading(false));
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      Promise.allSettled([
        fetchTopAlbumsThisWeek(),
        fetchTopSongsThisWeek(),
        fetchTopArtistsThisWeek(),
        fetchPopularReviewsThisWeek(),
      ])
        .then(([albs, sngs, arts, reviews]) => {
          if (albs.status === 'fulfilled')    { cache.albums         = albs.value;    setAlbums(albs.value);         const urls = albs.value.map(a => a.artworkUrl).filter(Boolean) as string[]; if (urls.length) ExpoImage.prefetch(urls); }
          if (sngs.status === 'fulfilled')    { cache.songs          = sngs.value;    setSongs(sngs.value); }
          if (arts.status === 'fulfilled')    { cache.artists        = arts.value;    setArtists(arts.value); }
          if (reviews.status === 'fulfilled') { cache.popularReviews = reviews.value; setPopularReviews(reviews.value); }
          if (albs.status    === 'rejected')    console.error('[Home] albums failed:',  albs.reason?.message);
          if (sngs.status    === 'rejected')    console.error('[Home] songs failed:',   sngs.reason?.message);
          if (arts.status    === 'rejected')    console.error('[Home] artists failed:',  arts.reason?.message);
          if (reviews.status === 'rejected')    console.error('[Home] reviews failed:', reviews.reason?.message);
        })
        .finally(() => setLoading(false));
    }, [])
  );

  function handleFriendActivityPress(item: FriendActivityItem) {
    if (item.kind === 'top5') {
      if (item.category === 'albums') {
        router.push({ pathname: '/album-detail', params: { id: item.itemId, title: item.itemName, artworkUrl: item.itemImageUrl ?? '' } } as any);
      } else {
        router.push({ pathname: '/artist-detail', params: { id: item.itemId, name: item.itemName } });
      }
    } else if (item.kind === 'likedArtist') {
      router.push({ pathname: '/artist-detail', params: { id: item.artistId, name: item.name } });
    } else if (item.kind === 'likedPlaylist') {
      if (item.targetId.startsWith('featured:')) {
        router.push({ pathname: '/discover-featured-playlist', params: { id: item.targetId.replace('featured:', ''), name: item.name } } as any);
      } else {
        router.push({ pathname: '/playlist-detail', params: { id: item.targetId } });
      }
    } else if (item.kind === 'createdPlaylist') {
      router.push({ pathname: '/playlist-detail', params: { id: item.playlistId } });
    } else if (item.kind === 'wantToListen') {
      navigateToAlbum(router, { id: item.albumId, title: item.title, artist: item.artist, artworkUrl: item.artworkUrl ?? '' });
    } else if (item.kind === 'flippedRecord') {
      router.push('/flip-a-record' as any);
    }
  }

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
    <>
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}>

      {/* 1 — Top Listend Albums This Week */}
      <Section title="Top Listend Albums This Week" loading={loading}>
        <FlatList
          horizontal
          data={albums.slice(0, 10)}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.row}
          renderItem={({ item }) => (
            <AlbumCard item={item} isDark={isDark} isLogged={loggedIds.has(item.id)} onPress={() => handleAlbumPress(item)} />
          )}
          ListFooterComponent={
            albums.length > 10 ? (
              <Pressable
                onPress={() => setShowAllAlbums(true)}
                style={({ pressed }) => ({
                  width: ALBUM_CARD, height: ALBUM_CARD, borderRadius: 6,
                  justifyContent: 'center', alignItems: 'center',
                  backgroundColor: isDark ? '#2e2018' : '#EDE8E0',
                  opacity: pressed ? 0.7 : 1,
                })}>
                <Text style={{ fontSize: 13, fontWeight: '700', textAlign: 'center', letterSpacing: -0.2, color: isDark ? '#f5e6c8' : '#1A0F0A' }}>See{'\n'}More</Text>
              </Pressable>
            ) : null
          }
        />
      </Section>

      {/* 2 — Popular Reviews This Week */}
      <Section title="Popular Reviews This Week" loading={loading}>
        <FlatList
          horizontal
          data={popularReviews.slice(0, 10)}
          keyExtractor={item => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[s.row, { alignItems: 'stretch' }]}
          renderItem={({ item }) => (
            <PopularReviewCard
              item={item}
              liked={likedReviews.has(item.id)}
              onLike={() => handleLikeReview(item.id)}
              onPress={() => handleReviewCardPress(item)}
              onAlbumPress={() => searchAndNavigateToAlbum(item.albumTitle, item.albumArtist, item.artworkUrl, item.albumYear)}
              onCommentCountPress={() => handleReviewCommentCountPress(item)}
              commentCount={commentsMap.has(item.id) ? (commentsMap.get(item.id)?.length ?? 0) : item.commentCount}
              isDark={isDark}
              colors={colors}
              onUsernamePress={() => navigateToProfile(item.username, router)}
            />
          )}
          ListFooterComponent={
            <Pressable
              onPress={() => router.push('/popular-reviews')}
              style={({ pressed }) => ({
                width: 120, height: 192, borderRadius: 6,
                justifyContent: 'center', alignItems: 'center',
                backgroundColor: isDark ? '#2e2018' : '#EDE8E0',
                opacity: pressed ? 0.7 : 1,
              })}>
              <Text style={{ fontSize: 13, fontWeight: '700', textAlign: 'center', letterSpacing: -0.2, color: isDark ? '#f5e6c8' : '#1A0F0A' }}>
                See{'\n'}More
              </Text>
            </Pressable>
          }
        />
      </Section>

      {/* 3 — Friends Recent Listend */}
      <Section title="Friends Recent Listend" loading={friendsListenedLoading}>
        <FlatList
          horizontal
          data={friendsListened.slice(0, 10)}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[s.row, { alignItems: 'stretch' }]}
          renderItem={({ item }) => (
            <FriendCard
              friend={item}
              isDark={isDark}
              colors={colors}
              onPress={() => openFriendReview(item)}
              onUsernamePress={() => navigateToProfile(item.user, router)}
            />
          )}
          ListFooterComponent={
            <Pressable
              onPress={() => setShowAllFriends(true)}
              style={({ pressed }) => ({
                width: 120, height: 285, borderRadius: 6,
                justifyContent: 'center', alignItems: 'center',
                backgroundColor: isDark ? '#2e2018' : '#EDE8E0',
                opacity: pressed ? 0.7 : 1,
              })}>
              <Text style={{ fontSize: 13, fontWeight: '700', textAlign: 'center', letterSpacing: -0.2, color: isDark ? '#f5e6c8' : '#1A0F0A' }}>
                See{'\n'}More
              </Text>
            </Pressable>
          }
        />
      </Section>

      {/* 4 — Friends Recent Activity */}
      {(friendsActivityLoading || friendsActivity.length > 0) && (
        <Section title="Friends Recent Activity" loading={friendsActivityLoading}>
          <FlatList
            horizontal
            data={friendsActivity.slice(0, 10)}
            keyExtractor={item => item.key}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[s.row, { alignItems: 'stretch' }]}
            renderItem={({ item }) => (
              <FriendActivityCard
                item={item}
                isDark={isDark}
                colors={colors}
                onUsernamePress={() => navigateToProfile(item.friend.username ?? '', router)}
                onPress={() => handleFriendActivityPress(item)}
              />
            )}
            ListFooterComponent={
              friendsActivity.length > 10 ? (
                <Pressable
                  onPress={() => setShowAllFriendActivity(true)}
                  style={({ pressed }) => ({
                    width: 120, height: 240, borderRadius: 6,
                    justifyContent: 'center', alignItems: 'center',
                    backgroundColor: isDark ? '#2e2018' : '#EDE8E0',
                    opacity: pressed ? 0.7 : 1,
                  })}>
                  <Text style={{ fontSize: 13, fontWeight: '700', textAlign: 'center', letterSpacing: -0.2, color: isDark ? '#f5e6c8' : '#1A0F0A' }}>
                    See{'\n'}More
                  </Text>
                </Pressable>
              ) : null
            }
          />
        </Section>
      )}

      {/* Friends Recent Activity — full list modal */}
      <Modal visible={showAllFriendActivity} animationType="slide" onRequestClose={() => setShowAllFriendActivity(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={[s.allFriendsHeader, { borderBottomColor: isDark ? '#2a1e14' : '#eee' }]}>
              <Text style={[s.allFriendsTitle, { color: colors.text }]}>Friends Recent Activity</Text>
              <Pressable onPress={() => setShowAllFriendActivity(false)} hitSlop={12} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
                <FontAwesome name="times" size={20} color={colors.subtext} />
              </Pressable>
            </View>
            <FlatList
              data={friendsActivity}
              keyExtractor={item => item.key}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 8, paddingBottom: 48 }}
              ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 83 }} />}
              renderItem={({ item }) => {
                let imageUrl: string | null = null;
                let isCircle = false;
                let mosaicUrls: string[] | null = null;
                let itemName = '';
                let itemSub: string | null = null;
                const pill = FA_PILL[item.kind];

                if (item.kind === 'top5') {
                  imageUrl = item.itemImageUrl; isCircle = item.category === 'artists'; itemName = item.itemName;
                  const cat = item.category.charAt(0).toUpperCase() + item.category.slice(1);
                  itemSub = `Top 5 ${cat} · #${item.position}`;
                } else if (item.kind === 'likedArtist') {
                  imageUrl = item.artworkUrl; isCircle = true; itemName = item.name;
                } else if (item.kind === 'likedPlaylist') {
                  mosaicUrls = item.artworkUrls; itemName = item.name;
                  if (item.targetId.startsWith('featured:')) itemSub = 'by Listend';
                } else if (item.kind === 'createdPlaylist') {
                  mosaicUrls = item.artworkUrls; itemName = item.name;
                } else if (item.kind === 'wantToListen') {
                  imageUrl = item.artworkUrl; itemName = item.title; itemSub = item.artist;
                } else if (item.kind === 'flippedRecord') {
                  imageUrl = item.artworkUrl; itemName = item.albumTitle; itemSub = item.albumArtist;
                }

                const fallback = isDark ? '#2a1e14' : '#e5ddd5';
                return (
                  <Pressable
                    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 13, gap: 13, opacity: pressed ? 0.72 : 1 })}
                    onPress={() => { setShowAllFriendActivity(false); handleFriendActivityPress(item); }}>
                    {mosaicUrls !== null ? (
                      <PlaylistMosaicSmall artworkUrls={mosaicUrls} size={52} fallback={fallback} />
                    ) : imageUrl ? (
                      <ExpoImage source={{ uri: imageUrl }} style={{ width: 52, height: 52, borderRadius: isCircle ? 26 : 8, flexShrink: 0 }} contentFit="cover" cachePolicy="disk" />
                    ) : (
                      <View style={{ width: 52, height: 52, borderRadius: isCircle ? 26 : 8, backgroundColor: fallback, justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                        <Text style={{ color: isDark ? '#7a5535' : '#a07850', fontSize: 18, fontWeight: '700' }}>{itemName.charAt(0)}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1, gap: 3 }}>
                      <Pressable onPress={() => { setShowAllFriendActivity(false); navigateToProfile(item.friend.username ?? '', router); }} hitSlop={6}>
                        <Text style={{ color: '#D4A017', fontSize: 12, fontWeight: '700' }} numberOfLines={1}>@{item.friend.username ?? 'user'}</Text>
                      </Pressable>
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{itemName}</Text>
                      {itemSub ? <Text style={{ color: colors.subtext, fontSize: 12 }} numberOfLines={1}>{itemSub}</Text> : null}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#D4A017', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <FontAwesome name={pill.icon as any} size={9} color="#D4A017" />
                          <Text style={{ color: '#D4A017', fontSize: 10, fontWeight: '700', letterSpacing: 0.3 }}>{pill.label}</Text>
                        </View>
                        <Text style={{ color: colors.subtext, fontSize: 11 }}>{item.dateLabel}</Text>
                      </View>
                    </View>
                  </Pressable>
                );
              }}
            />
          </SafeAreaView>
        </View>
      </Modal>

      {/* All friends list modal */}
      <Modal visible={showAllFriends} animationType="slide" onRequestClose={() => setShowAllFriends(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={[s.allFriendsHeader, { borderBottomColor: isDark ? '#2a1e14' : '#eee' }]}>
              <Text style={[s.allFriendsTitle, { color: colors.text }]}>Friends Recent Listend</Text>
              <Pressable onPress={() => setShowAllFriends(false)} hitSlop={12} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
                <FontAwesome name="times" size={20} color={colors.subtext} />
              </Pressable>
            </View>
            <FlatList
              data={friendsListened}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}
              renderItem={({ item }) => (
                <FriendFullRow
                  friend={item}
                  liked={likedReviews.has(item.id)}
                  onLike={() => handleLikeReview(item.id)}
                  isDark={isDark}
                  colors={colors}
                  onAlbumPress={() => {
                    setShowAllFriends(false);
                    navigateToAlbum(router, { id: item.albumId, title: item.album, artist: item.artist, year: item.year, artworkUrl: item.artworkUrl });
                  }}
                  onUsernamePress={() => { setShowAllFriends(false); navigateToProfile(item.user, router); }}
                />
              )}
            />
          </SafeAreaView>
        </View>
      </Modal>

      {/* All friends list modal */}
      <Modal visible={showAllFriends} animationType="slide" onRequestClose={() => setShowAllFriends(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={[s.allFriendsHeader, { borderBottomColor: isDark ? '#2a1e14' : '#eee' }]}>
              <Text style={[s.allFriendsTitle, { color: colors.text }]}>Friends Recent Listend</Text>
              <Pressable onPress={() => setShowAllFriends(false)} hitSlop={12} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
                <FontAwesome name="times" size={20} color={colors.subtext} />
              </Pressable>
            </View>
            <FlatList
              data={PLACEHOLDER_FRIENDS}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}
              renderItem={({ item }) => (
                <FriendFullRow
                  friend={item}
                  isDark={isDark}
                  colors={colors}
                  onAlbumPress={() => {
                    setShowAllFriends(false);
                    navigateToAlbum(item.album, item.artist, item.artworkUrl, item.year);
                  }}
                  onUsernamePress={() => { setShowAllFriends(false); navigateToProfile(item.user, router); }}
                />
              )}
            />
          </SafeAreaView>
        </View>
      </Modal>

      {/* Friend review modal */}
      {expandedFriend && (
        <FriendReviewModal
          friend={expandedFriend}
          comments={commentsMap.get(expandedFriend.id) ?? []}
          liked={likedReviews.has(expandedFriend.id)}
          onLike={() => handleLikeReview(expandedFriend.id)}
          onAddComment={(body, parentId, u, rtu, av) => handleAddComment(expandedFriend.id, body, parentId, u, rtu, av)}
          isDark={isDark}
          colors={colors}
          onClose={() => setExpandedFriend(null)}
          onAlbumPress={() => {
            setExpandedFriend(null);
            navigateToAlbum(router, { id: expandedFriend.albumId, title: expandedFriend.album, artist: expandedFriend.artist, year: expandedFriend.year, artworkUrl: expandedFriend.artworkUrl });
          }}
          onUsernamePress={(username) => { setExpandedFriend(null); navigateToProfile(username, router); }}
        />
      )}

      {/* Friend review modal */}
      {expandedFriend && (
        <FriendReviewModal
          friend={expandedFriend}
          comments={FRIEND_COMMENTS.filter(c => c.reviewId === expandedFriend.id)}
          isDark={isDark}
          colors={colors}
          onClose={() => setExpandedFriend(null)}
          onAlbumPress={() => {
            setExpandedFriend(null);
            navigateToAlbum(expandedFriend.album, expandedFriend.artist, expandedFriend.artworkUrl, expandedFriend.year);
          }}
          onUsernamePress={(username) => { setExpandedFriend(null); navigateToProfile(username, router); }}
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
          onAddComment={(body, parentId, u, rtu, av) => handleAddComment(expandedReview.id, body, parentId, u, rtu, av)}
          onClose={() => { setExpandedReview(null); setExpandedCommentsId(null); }}
          onAlbumPress={() => {
            setExpandedReview(null);
            searchAndNavigateToAlbum(expandedReview.albumTitle, expandedReview.albumArtist, expandedReview.artworkUrl, expandedReview.albumYear);
          }}
          liked={likedReviews.has(expandedReview.id)}
          onLike={() => handleLikeReview(expandedReview.id)}
          onUsernamePress={(username) => { setExpandedReview(null); setExpandedCommentsId(null); navigateToProfile(username, router); }}
          isDark={isDark}
          colors={colors}
        />
      )}

      {/* 4 — Top Listend Songs This Week */}
      <Section title="Top Listend Songs This Week" loading={loading}>
        <FlatList
          horizontal
          data={songs.slice(0, 10)}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.row}
          renderItem={({ item }) => (
            <SongCard item={item} isDark={isDark} onPress={() => handleSongPress(item)} />
          )}
          ListFooterComponent={
            songs.length > 10 ? (
              <Pressable
                onPress={() => setShowAllSongs(true)}
                style={({ pressed }) => ({
                  width: SONG_CARD, height: SONG_CARD, borderRadius: 6,
                  justifyContent: 'center', alignItems: 'center',
                  backgroundColor: isDark ? '#2e2018' : '#EDE8E0',
                  opacity: pressed ? 0.7 : 1,
                })}>
                <Text style={{ fontSize: 13, fontWeight: '700', textAlign: 'center', letterSpacing: -0.2, color: isDark ? '#f5e6c8' : '#1A0F0A' }}>See{'\n'}More</Text>
              </Pressable>
            ) : null
          }
        />
      </Section>

      {/* Top Listend Artists This Week */}
      <Section title="Top Listend Artists This Week" loading={loading}>
        <FlatList
          horizontal
          data={artists.slice(0, 10)}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.row}
          renderItem={({ item }) => (
            <ArtistCard item={item} isDark={isDark} onPress={() => handleArtistPress(item)} />
          )}
          ListFooterComponent={
            artists.length > 10 ? (
              <Pressable
                onPress={() => setShowAllArtists(true)}
                style={({ pressed }) => ({
                  width: ARTIST_CARD, height: ARTIST_CARD, borderRadius: ARTIST_CARD / 2,
                  justifyContent: 'center', alignItems: 'center',
                  backgroundColor: isDark ? '#2e2018' : '#EDE8E0',
                  opacity: pressed ? 0.7 : 1,
                })}>
                <Text style={{ fontSize: 13, fontWeight: '700', textAlign: 'center', letterSpacing: -0.2, color: isDark ? '#f5e6c8' : '#1A0F0A' }}>See{'\n'}More</Text>
              </Pressable>
            ) : null
          }
        />
      </Section>

    </ScrollView>

      {/* Albums — full list modal */}
      <Modal visible={showAllAlbums} animationType="slide" onRequestClose={() => setShowAllAlbums(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={[s.allFriendsHeader, { borderBottomColor: isDark ? '#2a1e14' : '#eee' }]}>
              <Text style={[s.allFriendsTitle, { color: colors.text }]}>Top Listend Albums This Week</Text>
              <Pressable onPress={() => setShowAllAlbums(false)} hitSlop={12} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
                <FontAwesome name="times" size={20} color={colors.subtext} />
              </Pressable>
            </View>
            <FlatList
              data={albums}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 8, paddingBottom: 48 }}
              ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 83 }} />}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 13, gap: 13, opacity: pressed ? 0.72 : 1 })}
                  onPress={() => { setShowAllAlbums(false); handleAlbumPress(item); }}>
                  <View style={{ flexShrink: 0 }}>
                    {item.artworkUrl
                      ? <ExpoImage source={{ uri: item.artworkUrl }} style={{ width: 52, height: 52, borderRadius: 8 }} contentFit="cover" cachePolicy="disk" />
                      : <ArtFallback size={52} radius={8} label={item.title} />}
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{item.title}</Text>
                    {item.artist ? <Text style={{ color: colors.subtext, fontSize: 12 }} numberOfLines={1}>{item.artist}</Text> : null}
                  </View>
                  <FontAwesome name="chevron-right" size={12} color={colors.subtext} />
                </Pressable>
              )}
            />
          </SafeAreaView>
        </View>
      </Modal>

      {/* Songs — full list modal */}
      <Modal visible={showAllSongs} animationType="slide" onRequestClose={() => setShowAllSongs(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={[s.allFriendsHeader, { borderBottomColor: isDark ? '#2a1e14' : '#eee' }]}>
              <Text style={[s.allFriendsTitle, { color: colors.text }]}>Top Listend Songs This Week</Text>
              <Pressable onPress={() => setShowAllSongs(false)} hitSlop={12} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
                <FontAwesome name="times" size={20} color={colors.subtext} />
              </Pressable>
            </View>
            <FlatList
              data={songs}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 8, paddingBottom: 48 }}
              ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 83 }} />}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 13, gap: 13, opacity: pressed ? 0.72 : 1 })}
                  onPress={() => { setShowAllSongs(false); handleSongPress(item); }}>
                  <View style={{ flexShrink: 0 }}>
                    {item.artworkUrl
                      ? <ExpoImage source={{ uri: item.artworkUrl }} style={{ width: 52, height: 52, borderRadius: 8 }} contentFit="cover" cachePolicy="disk" />
                      : <ArtFallback size={52} radius={8} label={item.title} />}
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{item.title}</Text>
                    {item.artist ? <Text style={{ color: colors.subtext, fontSize: 12 }} numberOfLines={1}>{item.artist}</Text> : null}
                  </View>
                </Pressable>
              )}
            />
          </SafeAreaView>
        </View>
      </Modal>

      {/* Artists — full list modal */}
      <Modal visible={showAllArtists} animationType="slide" onRequestClose={() => setShowAllArtists(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={[s.allFriendsHeader, { borderBottomColor: isDark ? '#2a1e14' : '#eee' }]}>
              <Text style={[s.allFriendsTitle, { color: colors.text }]}>Top Listend Artists This Week</Text>
              <Pressable onPress={() => setShowAllArtists(false)} hitSlop={12} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
                <FontAwesome name="times" size={20} color={colors.subtext} />
              </Pressable>
            </View>
            <FlatList
              data={artists}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 8, paddingBottom: 48 }}
              ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 83 }} />}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 13, gap: 13, opacity: pressed ? 0.72 : 1 })}
                  onPress={() => { setShowAllArtists(false); handleArtistPress(item); }}>
                  {item.artworkUrl
                    ? <ExpoImage source={{ uri: item.artworkUrl }} style={{ width: 52, height: 52, borderRadius: 26 }} contentFit="cover" cachePolicy="disk" />
                    : <ArtFallback size={52} radius={26} label={item.name} />}
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{item.name}</Text>
                    {item.genre ? <Text style={{ color: colors.subtext, fontSize: 12 }} numberOfLines={1}>{item.genre}</Text> : null}
                  </View>
                  <FontAwesome name="chevron-right" size={12} color={colors.subtext} />
                </Pressable>
              )}
            />
          </SafeAreaView>
        </View>
      </Modal>
    </>
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

  friendSeeMore: {
    width: 80,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'stretch',
  },
  friendSeeMoreText: { fontSize: 12, fontWeight: '700', textAlign: 'center' },

  // All friends grid modal
  allFriendsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  allFriendsTitle:  { fontSize: 17, fontWeight: '700' },
  allFriendsGrid:   { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 10 },
  allFriendCell: {
    width: '31%',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
    gap: 4,
  },
  allFriendArt:        { width: '100%', aspectRatio: 1, borderRadius: 6 },
  allFriendUser:       { fontSize: 11, fontWeight: '700', marginTop: 2 },
  allFriendAlbum:      { fontSize: 11, fontWeight: '600' },
  allFriendArtist:     { fontSize: 10 },
  allFriendFooter:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  allFriendAgo:        { fontSize: 10 },
  allFriendRatingBadge:{ backgroundColor: '#D4A017', borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1 },
  allFriendRatingNum:  { color: '#fff', fontSize: 9, fontWeight: '700' },
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
    width: 80,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'stretch',
  },
  seeMoreText: { fontSize: 12, fontWeight: '600', textAlign: 'center', lineHeight: 17 },
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
  username:     { color: '#D4A017', fontSize: 13, fontWeight: '600' },
  listenedDate: { fontSize: 11 },

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
  likeCommentRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  likeBtn:        { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 10, paddingHorizontal: 4 },
  likeCount:      { fontSize: 13, fontWeight: '600' },
});

const flr = StyleSheet.create({
  card:         { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  topRow:       { flexDirection: 'row', gap: 12, padding: 14, paddingBottom: 10 },
  art:          { width: 84, height: 84, borderRadius: 8, flexShrink: 0 },
  albumInfo:    { flex: 1, gap: 4, paddingTop: 2 },
  albumTitle:   { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  albumArtist:  { fontSize: 13 },
  ratingRow:    { marginTop: 2 },
  reviewText:   { fontSize: 14, lineHeight: 21, fontStyle: 'italic', paddingHorizontal: 14, paddingBottom: 10 },
  footer:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  userRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar:       { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  avatarLetter: { color: '#fff', fontSize: 11, fontWeight: '700' },
  username:     { color: '#D4A017', fontSize: 13, fontWeight: '600' },
  listenedDate: { fontSize: 11, marginTop: 1 },
  footerActions:{ flexDirection: 'row', gap: 18 },
  actionBtn:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionCount:  { fontSize: 14 },
});

// ─── Friend review modal styles ───────────────────────────────────────────────

const frm = StyleSheet.create({
  likeCommentRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  likeBtn:        { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 10, paddingHorizontal: 4 },
  likeCount:      { fontSize: 13, fontWeight: '600' },
});

const flr = StyleSheet.create({
  card:         { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  topRow:       { flexDirection: 'row', gap: 12, padding: 14, paddingBottom: 10 },
  art:          { width: 84, height: 84, borderRadius: 8, flexShrink: 0 },
  albumInfo:    { flex: 1, gap: 4, paddingTop: 2 },
  albumTitle:   { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  albumArtist:  { fontSize: 13 },
  ratingRow:    { marginTop: 2 },
  reviewText:   { fontSize: 14, lineHeight: 21, fontStyle: 'italic', paddingHorizontal: 14, paddingBottom: 10 },
  footer:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  userRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar:       { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  avatarLetter: { color: '#fff', fontSize: 11, fontWeight: '700' },
  username:     { color: '#D4A017', fontSize: 13, fontWeight: '600' },
  listenedDate: { fontSize: 11, marginTop: 1 },
  footerActions:{ flexDirection: 'row', gap: 18 },
  actionBtn:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionCount:  { fontSize: 14 },
});
