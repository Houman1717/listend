import {
  StyleSheet,
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  Modal,
  ScrollView,
  Platform,
  SafeAreaView,
  KeyboardAvoidingView,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { usePro } from '@/context/ProContext';
import { getProTheme, themeToColors } from '@/lib/proThemes';
import { useMemo, useState, useEffect, useRef } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useAlbums } from '@/context/AlbumsContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { type ColorsShape } from '@/constants/Colors';
import { ReviewComment, CommentsSection, avatarColor } from '@/components/ReviewComments';
import { navigateToProfile } from '@/lib/navigateToProfile';
import { useLikedFeaturedPlaylists } from '@/context/LikedFeaturedPlaylistsContext';
import { ProBadge } from '@/components/ProBadge';

// ─── Static metadata ──────────────────────────────────────────────────────────

const TYPE_META = {
  reviewed:     { label: 'Reviewed',       color: '#D4A017', icon: 'quote-left' },
  rated:        { label: 'Rated',           color: '#D4A017', icon: 'star'       },
  listened:     { label: 'Listened',        color: '#D4A017', icon: 'headphones' },
  wantToListen: { label: 'Want to Listen',  color: '#8B6914', icon: 'bookmark'   },
  reListened:   { label: 'Re-Listend',      color: '#D4A017', icon: 'repeat'     },
} as const;

const TOP5_CATEGORY_LABEL: Record<string, string> = {
  albums:  'Top 5 Albums',
  songs:   'Top 5 Songs',
  artists: 'Top 5 Artists',
};

type ActivityType = keyof typeof TYPE_META;

// ─── Types ────────────────────────────────────────────────────────────────────

type ActivityItem = {
  key:        string;
  type:       ActivityType;
  id:         string;
  title:      string;
  artist:     string;
  year:       number;
  artworkUrl: string | undefined;
  coverColor: string | undefined;
  dateMs:     number | null;
  dateLabel:  string;
  rating:     number;
  review?:    string;
};

type FriendItem = {
  key:       string;
  friendId:  string;
  name:      string;
  username:  string | null;
  avatarUrl: string | null;
  isPro?:    boolean;
  dateMs:    number;
  dateLabel: string;
};

type LikedArtistItem = {
  key:        string;
  artistId:   string;
  name:       string;
  artworkUrl: string | null;
  dateMs:     number;
  dateLabel:  string;
};

type LikedPlaylistItem = {
  key:         string;
  targetId:    string;
  name:        string;
  artworkUrls: string[];
  dateMs:      number;
  dateLabel:   string;
};

type CreatedPlaylistItem = {
  key:         string;
  playlistId:  string;
  name:        string;
  artworkUrls: string[];
  dateMs:      number;
  dateLabel:   string;
};

type Top5ChangeItem = {
  key:          string;
  category:     string;
  itemId:       string;
  itemName:     string;
  itemArtist:   string | null;
  itemImageUrl: string | null;
  position:     number;
  dateMs:       number;
  dateLabel:    string;
};

type FlipItem = {
  key:         string;
  albumTitle:  string;
  albumArtist: string;
  albumYear:   number | null;
  artworkUrl:  string | null;
  dateMs:      number;
  dateLabel:   string;
};

type FeedItem =
  | { kind: 'activity';        data: ActivityItem }
  | { kind: 'friend';          data: FriendItem }
  | { kind: 'top5';            data: Top5ChangeItem }
  | { kind: 'likedArtist';     data: LikedArtistItem }
  | { kind: 'likedPlaylist';   data: LikedPlaylistItem }
  | { kind: 'createdPlaylist'; data: CreatedPlaylistItem }
  | { kind: 'flippedRecord';   data: FlipItem };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BAR_HEIGHTS = [3, 4, 5, 6, 7, 9, 11, 13, 15, 17];

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const MONTH_MAP: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

function parseDate(s: string): number | null {
  if (!s) return null;
  let ms = new Date(s).getTime();
  if (!isNaN(ms)) return ms;
  const m = s.match(/^(\w{3})\s+(\d{1,2}),\s+(\d{4})$/);
  if (m && MONTH_MAP[m[1]] !== undefined) {
    ms = new Date(parseInt(m[3], 10), MONTH_MAP[m[1]], parseInt(m[2], 10)).getTime();
    if (!isNaN(ms)) return ms;
  }
  return null;
}

async function fetchFriendsForUser(uid: string): Promise<FriendItem[]> {
  // People uid follows
  const { data: outRows } = await supabase
    .from('follows')
    .select('following_id, created_at')
    .eq('follower_id', uid);

  // People who follow uid
  const { data: inRows } = await supabase
    .from('follows')
    .select('follower_id, created_at')
    .eq('following_id', uid);

  if (!outRows || !inRows || outRows.length === 0 || inRows.length === 0) return [];

  const inSet = new Map<string, string>(inRows.map((r: any) => [r.follower_id, r.created_at]));
  const friends: FriendItem[] = [];

  const mutualIds: string[] = [];
  const friendsSinceMap = new Map<string, number>();
  for (const r of outRows as any[]) {
    if (inSet.has(r.following_id)) {
      mutualIds.push(r.following_id);
      // "friends since" = when the second follow was made
      const outMs = new Date(r.created_at).getTime();
      const inMs  = new Date(inSet.get(r.following_id)!).getTime();
      friendsSinceMap.set(r.following_id, Math.max(outMs, inMs));
    }
  }

  if (mutualIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, username, avatar_url, is_pro')
    .in('id', mutualIds);

  for (const id of mutualIds) {
    const prof = (profiles ?? []).find((p: any) => p.id === id);
    const ms   = friendsSinceMap.get(id) ?? 0;
    friends.push({
      key:       `friend-${id}`,
      friendId:  id,
      name:      prof?.display_name || prof?.username || 'User',
      username:  prof?.username   ?? null,
      avatarUrl: prof?.avatar_url ?? null,
      isPro:     !!(prof?.is_pro),
      dateMs:    ms,
      dateLabel: new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    });
  }

  return friends;
}

async function fetchLikedArtistsForUser(uid: string): Promise<LikedArtistItem[]> {
  const { data } = await supabase
    .from('liked_artists')
    .select('artist_id, name, artwork_url, created_at')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
    .limit(30);

  return (data ?? []).map((r: any): LikedArtistItem => ({
    key:        `liked-artist-${r.artist_id}`,
    artistId:   r.artist_id,
    name:       r.name ?? '',
    artworkUrl: r.artwork_url ?? null,
    dateMs:     new Date(r.created_at).getTime(),
    dateLabel:  formatDateLabel(r.created_at),
  }));
}

async function fetchPlaylistArtwork(playlistIds: string[]): Promise<Map<string, string[]>> {
  if (playlistIds.length === 0) return new Map();

  const { data: pas } = await supabase
    .from('playlist_albums')
    .select('playlist_id, spotify_id, position')
    .in('playlist_id', playlistIds)
    .order('position', { ascending: true });

  const allSpotifyIds = [...new Set((pas ?? []).map((a: any) => a.spotify_id as string))];
  const artMap = new Map<string, string>();

  if (allSpotifyIds.length > 0) {
    const { data: uas } = await supabase
      .from('user_albums')
      .select('spotify_id, artwork_url')
      .in('spotify_id', allSpotifyIds);
    for (const a of (uas ?? []) as any[]) {
      if (a.artwork_url) artMap.set(a.spotify_id, a.artwork_url);
    }
  }

  const result = new Map<string, string[]>();
  for (const id of playlistIds) {
    const albums = (pas ?? []).filter((a: any) => a.playlist_id === id).slice(0, 4);
    result.set(id, albums.map((a: any) => artMap.get(a.spotify_id) ?? '').filter(Boolean));
  }
  return result;
}

async function fetchLikedPlaylistsForUser(uid: string): Promise<LikedPlaylistItem[]> {
  // Only user-created playlists; featured playlists are handled via context for own
  // user or separately for other users below
  const { data: likedRows } = await supabase
    .from('likes')
    .select('target_id, created_at')
    .eq('user_id', uid)
    .eq('target_type', 'playlist')
    .not('target_id', 'ilike', 'featured:%')
    .order('created_at', { ascending: false })
    .limit(30);

  if (!likedRows || likedRows.length === 0) return [];

  const userIds = (likedRows as any[]).map((r: any) => r.target_id as string);
  const nameMap    = new Map<string, string>();
  const artworkMap = new Map<string, string[]>();

  const { data: pls } = await supabase.from('playlists').select('id, name').in('id', userIds);
  for (const p of (pls ?? []) as any[]) nameMap.set(p.id, p.name);
  const plArtwork = await fetchPlaylistArtwork(userIds);
  plArtwork.forEach((urls, id) => artworkMap.set(id, urls));

  return (likedRows as any[]).map((r: any): LikedPlaylistItem => ({
    key:         `liked-pl-${r.target_id}`,
    targetId:    r.target_id,
    name:        nameMap.get(r.target_id) ?? 'Playlist',
    artworkUrls: artworkMap.get(r.target_id) ?? [],
    dateMs:      new Date(r.created_at).getTime(),
    dateLabel:   formatDateLabel(r.created_at),
  }));
}

async function fetchLikedFeaturedPlaylistsForUser(uid: string): Promise<LikedPlaylistItem[]> {
  const { data: rows } = await supabase
    .from('likes')
    .select('target_id, created_at')
    .eq('user_id', uid)
    .eq('target_type', 'playlist')
    .ilike('target_id', 'featured:%')
    .order('created_at', { ascending: false });

  if (!rows || rows.length === 0) return [];

  const featuredIds = (rows as any[]).map((r: any) => (r.target_id as string).replace('featured:', ''));
  const dateByRawId = new Map((rows as any[]).map((r: any) => [r.target_id as string, r.created_at as string]));

  try {
    const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
    const resp = await fetch(`${API_URL}/api/featured-playlists`);
    const all: any[] = await resp.json();
    return all
      .filter(pl => featuredIds.includes(pl.id))
      .map(pl => {
        const rawId    = `featured:${pl.id}`;
        const dateStr  = dateByRawId.get(rawId) ?? new Date().toISOString();
        return {
          key:         `liked-pl-${rawId}`,
          targetId:    rawId,
          name:        pl.name ?? 'Listend Playlist',
          artworkUrls: (pl.artworkUrls ?? []).slice(0, 4) as string[],
          dateMs:      new Date(dateStr).getTime(),
          dateLabel:   formatDateLabel(dateStr),
        };
      });
  } catch {
    return [];
  }
}

async function fetchCreatedPlaylistsForUser(uid: string): Promise<CreatedPlaylistItem[]> {
  const { data } = await supabase
    .from('playlists')
    .select('id, name, created_at')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
    .limit(30);

  if (!data || data.length === 0) return [];

  const ids = data.map((r: any) => r.id as string);
  const artworkMap = await fetchPlaylistArtwork(ids);

  return data.map((r: any): CreatedPlaylistItem => ({
    key:         `created-pl-${r.id}`,
    playlistId:  r.id,
    name:        r.name ?? 'Playlist',
    artworkUrls: artworkMap.get(r.id) ?? [],
    dateMs:      new Date(r.created_at).getTime(),
    dateLabel:   formatDateLabel(r.created_at),
  }));
}

async function fetchActivityForUser(uid: string): Promise<ActivityItem[]> {
  const items: ActivityItem[] = [];

  const { data: logged } = await supabase
    .from('user_albums')
    .select('spotify_id, title, artist, year, artwork_url, rating, review, listened_at')
    .eq('user_id', uid)
    .order('listened_at', { ascending: false });

  if (logged) {
    for (const a of logged) {
      const type: ActivityType = a.review ? 'reviewed' : a.rating > 0 ? 'rated' : 'listened';
      items.push({
        key:        `logged-${a.spotify_id}`,
        type,
        id:         a.spotify_id,
        title:      a.title      ?? '',
        artist:     a.artist     ?? '',
        year:       a.year       ?? 0,
        artworkUrl: a.artwork_url ?? undefined,
        coverColor: undefined,
        dateMs:     a.listened_at ? new Date(a.listened_at).getTime() : null,
        dateLabel:  a.listened_at ? formatDateLabel(a.listened_at) : '',
        rating:     a.rating     ?? 0,
        review:     a.review     ?? undefined,
      });
    }
  }

  const { data: want } = await supabase
    .from('want_to_listen')
    .select('spotify_id, title, artist, year, artwork_url, created_at')
    .eq('user_id', uid)
    .order('created_at', { ascending: false });

  if (want) {
    for (const w of want) {
      items.push({
        key:        `want-${w.spotify_id}`,
        type:       'wantToListen',
        id:         w.spotify_id,
        title:      w.title      ?? '',
        artist:     w.artist     ?? '',
        year:       w.year       ?? 0,
        artworkUrl: w.artwork_url ?? undefined,
        coverColor: undefined,
        dateMs:     w.created_at ? new Date(w.created_at).getTime() : null,
        dateLabel:  w.created_at ? formatDateLabel(w.created_at) : '',
        rating:     0,
      });
    }
  }

  const { data: reListens } = await supabase
    .from('re_listens')
    .select('spotify_id, title, artist, artwork_url, rating, review, listened_at')
    .eq('user_id', uid)
    .order('listened_at', { ascending: false });

  if (reListens) {
    for (const r of reListens) {
      items.push({
        key:        `relisten-${r.spotify_id}-${r.listened_at}`,
        type:       'reListened',
        id:         r.spotify_id,
        title:      r.title       ?? '',
        artist:     r.artist      ?? '',
        year:       0,
        artworkUrl: r.artwork_url ?? undefined,
        coverColor: undefined,
        dateMs:     r.listened_at ? new Date(r.listened_at).getTime() : null,
        dateLabel:  r.listened_at ? formatDateLabel(r.listened_at) : '',
        rating:     r.rating      ?? 0,
        review:     r.review      ?? undefined,
      });
    }
  }

  return items;
}

async function fetchTop5ChangesForUser(uid: string): Promise<Top5ChangeItem[]> {
  const { data, error } = await supabase
    .from('top5_changes')
    .select('id, category, item_id, item_name, item_image_url, position, changed_at')
    .eq('user_id', uid)
    .order('changed_at', { ascending: false })
    .limit(30);

  if (error || !data) return [];

  return data.map((r: any): Top5ChangeItem => ({
    key:          `top5-${r.id}`,
    category:     r.category,
    itemId:       r.item_id,
    itemName:     r.item_name,
    itemArtist:   null,
    itemImageUrl: r.item_image_url ?? null,
    position:     r.position,
    dateMs:       new Date(r.changed_at).getTime(),
    dateLabel:    formatDateLabel(r.changed_at),
  }));
}

async function fetchFlipsForUser(uid: string): Promise<FlipItem[]> {
  const { data } = await supabase
    .from('flip_records')
    .select('id, album_title, album_artist, album_year, artwork_url, flipped_at')
    .eq('user_id', uid)
    .order('flipped_at', { ascending: false })
    .limit(50);
  if (!data) return [];
  return data.map((r: any, i: number): FlipItem => ({
    key:         `flip-${r.id}-${i}`,
    albumTitle:  r.album_title  ?? '',
    albumArtist: r.album_artist ?? '',
    albumYear:   r.album_year   ?? null,
    artworkUrl:  r.artwork_url  ?? null,
    dateMs:      new Date(r.flipped_at).getTime(),
    dateLabel:   formatDateLabel(r.flipped_at),
  }));
}

// ─── Review card modal ────────────────────────────────────────────────────────

function ReviewCardModal({
  item,
  colors,
  isDark,
  reviewerUsername,
  likeState,
  onLike,
  onClose,
  onAlbumPress,
  onUsernamePress,
}: {
  item: ActivityItem;
  colors: ColorsShape;
  isDark: boolean;
  reviewerUsername: string;
  likeState: { liked: boolean; count: number };
  onLike?: () => void;
  onClose: () => void;
  onAlbumPress: () => void;
  onUsernamePress?: (username: string) => void;
}) {
  const router = useRouter();
  const border = isDark ? '#2a1e14' : '#e5e5e5';
  const inactive = isDark ? '#2a1e14' : '#e0e0e0';
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const [localComments, setLocalComments] = useState<ReviewComment[]>([]);

  function handleAddComment(body: string, parentId?: string | null, commenterUsername?: string, replyToUsername?: string, avatarUrl?: string | null) {
    setLocalComments(prev => [...prev, {
      id: `rev_${Date.now()}`,
      reviewId: item.id,
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
          <View style={[rm.header, { borderBottomColor: border }]}>
            <Pressable onPress={onClose} hitSlop={12}>
              <FontAwesome name="chevron-down" size={16} color={isDark ? '#A08060' : '#6B4C35'} />
            </Pressable>
            <Text style={[rm.headerTitle, { color: colors.text }]}>Review</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView
            contentContainerStyle={{ paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>

            {/* Album row */}
            <Pressable
              onPress={onAlbumPress}
              style={({ pressed }) => [rm.albumRow, { opacity: pressed ? 0.7 : 1 }]}>
              {item.artworkUrl ? (
                <ExpoImage source={{ uri: item.artworkUrl }} style={rm.art} contentFit="cover" cachePolicy="disk" />
              ) : (
                <View style={[rm.art, { backgroundColor: item.coverColor ?? colors.border, justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 28, fontWeight: '700' }}>{item.title.charAt(0)}</Text>
                </View>
              )}
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[rm.albumTitle, { color: colors.text }]} numberOfLines={2}>{item.title}</Text>
                <Text style={[rm.albumArtist, { color: colors.subtext }]} numberOfLines={1}>
                  {item.artist}{item.year ? ` · ${item.year}` : ''}
                </Text>
                {item.rating > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, marginTop: 2 }}>
                    <FontAwesome name="volume-up" size={11} color={colors.tint} />
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
                      {BAR_HEIGHTS.map((h, i) => (
                        <View key={i} style={{ width: 2.5, borderRadius: 1, height: h, backgroundColor: i + 1 <= item.rating ? colors.tint : inactive }} />
                      ))}
                    </View>
                    <Text style={{ color: colors.tint, fontSize: 11, fontWeight: '700', lineHeight: 16 }}>{item.rating}</Text>
                  </View>
                )}
              </View>
            </Pressable>

            {/* Author row */}
            <Pressable
              style={rm.authorRow}
              onPress={() => onUsernamePress?.(reviewerUsername)}
              disabled={!onUsernamePress}>
              <View style={[rm.avatar, { backgroundColor: reviewerUsername === 'you' ? colors.tint : avatarColor(reviewerUsername) }]}>
                <Text style={rm.avatarLetter}>{reviewerUsername[0]?.toUpperCase()}</Text>
              </View>
              <View style={{ gap: 2 }}>
                <Text style={rm.username}>@{reviewerUsername}</Text>
                {item.dateLabel ? (
                  <Text style={[rm.listenedDate, { color: colors.subtext }]}>Listend {item.dateLabel}</Text>
                ) : null}
              </View>
            </Pressable>

            {/* Review text */}
            {item.review ? (
              <Text style={[rm.reviewText, { color: isDark ? '#A08060' : '#6B4C35' }]}>
                "{item.review}"
              </Text>
            ) : (
              <Text style={[rm.reviewText, { color: isDark ? '#4a3020' : '#C8B89A', fontStyle: 'italic' }]}>
                No written review.
              </Text>
            )}

            {/* Like + comments row */}
            <View style={[rm.likeCommentRow, { borderColor: border }]}>
              {onLike ? (
                <Pressable onPress={onLike} hitSlop={8} style={rm.likeBtn}>
                  <FontAwesome
                    name={likeState.liked ? 'heart' : 'heart-o'}
                    size={15}
                    color={likeState.liked ? colors.tint : (isDark ? '#A08060' : '#6B4C35')}
                  />
                  <Text style={[rm.likeCount, { color: likeState.liked ? colors.tint : (isDark ? '#A08060' : '#6B4C35') }]}>
                    {likeState.count}
                  </Text>
                </Pressable>
              ) : (
                <View style={rm.likeBtn}>
                  <FontAwesome name="heart" size={15} color={likeState.count > 0 ? colors.tint : (isDark ? '#3a2818' : '#ddd')} />
                  <Text style={[rm.likeCount, { color: likeState.count > 0 ? colors.tint : (isDark ? '#3a2818' : '#bbb') }]}>
                    {likeState.count}
                  </Text>
                </View>
              )}
              <Pressable
                onPress={() => setCommentsExpanded(p => !p)}
                hitSlop={8}
                style={[rm.commentsToggle, { borderColor: border, flex: 1 }]}>
                <FontAwesome
                  name="comment-o"
                  size={13}
                  color={commentsExpanded ? '#D4A017' : (isDark ? '#6B4C35' : '#A08060')}
                />
                <Text style={[rm.commentsToggleText, { color: commentsExpanded ? '#D4A017' : (isDark ? '#6B4C35' : '#A08060') }]}>
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

// ─── Row components ───────────────────────────────────────────────────────────

type ColorsType = ColorsShape;

function ActivityRow({ item, onPress, colors }: { item: ActivityItem; onPress: () => void; colors: ColorsType }) {
  const meta = TYPE_META[item.type];
  return (
    <Pressable
      style={({ pressed }) => [s.row, { opacity: pressed ? 0.72 : 1 }]}
      onPress={onPress}>

      {item.artworkUrl ? (
        <ExpoImage source={{ uri: item.artworkUrl }} style={s.art} 
            contentFit="cover" cachePolicy="disk"
          />
      ) : (
        <View style={[s.art, { backgroundColor: item.coverColor ?? colors.border, justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={s.artInitial}>{item.title.charAt(0)}</Text>
        </View>
      )}

      <View style={s.info}>
        <Text style={[s.title, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
        <Text style={[s.artist, { color: colors.subtext }]} numberOfLines={1}>{item.artist}{item.year ? ` · ${item.year}` : ''}</Text>
        <View style={s.meta}>
          <View style={[s.typePill, { borderColor: colors.tint }]}>
            <FontAwesome name={meta.icon as any} size={9} color={colors.tint} />
            <Text style={[s.typeLabel, { color: colors.tint }]}>{meta.label}</Text>
          </View>
          {item.dateLabel ? <Text style={[s.date, { color: colors.subtext }]}>{item.dateLabel}</Text> : null}
        </View>
      </View>

      {item.rating > 0 && (
        <View style={s.bars}>
          <FontAwesome name="volume-up" size={10} color={colors.tint} />
          {BAR_HEIGHTS.map((h, i) => (
            <View
              key={i}
              style={[s.bar, { height: h, backgroundColor: i + 1 <= item.rating ? colors.tint : colors.border }]}
            />
          ))}
          <Text style={[s.ratingNum, { color: colors.tint }]}>{item.rating}</Text>
        </View>
      )}
    </Pressable>
  );
}

function FriendRow({ item, onPress, colors }: { item: FriendItem; onPress: () => void; colors: ColorsType }) {
  return (
    <Pressable style={({ pressed }) => [s.row, { opacity: pressed ? 0.72 : 1 }]} onPress={onPress}>
      {item.avatarUrl ? (
        <ExpoImage source={{ uri: item.avatarUrl }} style={s.followAvatar} contentFit="cover" cachePolicy="disk" />
      ) : (
        <View style={[s.followAvatar, { backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={[s.followInitial, { color: colors.subtext }]}>{item.name.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <View style={s.info}>
        <Text style={[s.title, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
        {item.username ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={[s.artist, { color: colors.subtext }]} numberOfLines={1}>@{item.username}</Text>
            {item.isPro && <ProBadge size="xs" />}
          </View>
        ) : null}
        <View style={s.meta}>
          <View style={[s.typePill, { borderColor: colors.tint }]}>
            <FontAwesome name="handshake-o" size={9} color={colors.tint} />
            <Text style={[s.typeLabel, { color: colors.tint }]}>Friends</Text>
          </View>
          {item.dateLabel ? <Text style={[s.date, { color: colors.subtext }]}>{item.dateLabel}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

function LikedArtistRow({ item, onPress, colors }: { item: LikedArtistItem; onPress: () => void; colors: ColorsType }) {
  return (
    <Pressable style={({ pressed }) => [s.row, { opacity: pressed ? 0.72 : 1 }]} onPress={onPress}>
      {item.artworkUrl ? (
        <ExpoImage source={{ uri: item.artworkUrl }} style={[s.art, s.artCircle]} contentFit="cover" cachePolicy="disk" />
      ) : (
        <View style={[s.art, s.artCircle, { backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={s.artInitial}>{item.name.charAt(0)}</Text>
        </View>
      )}
      <View style={s.info}>
        <Text style={[s.title, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
        <View style={s.meta}>
          <View style={[s.typePill, { borderColor: colors.tint }]}>
            <FontAwesome name="heart" size={9} color={colors.tint} />
            <Text style={[s.typeLabel, { color: colors.tint }]}>Liked Artist</Text>
          </View>
          {item.dateLabel ? <Text style={[s.date, { color: colors.subtext }]}>{item.dateLabel}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

function PlaylistMosaic({ artworkUrls, size, fallback }: { artworkUrls: string[]; size: number; fallback: string }) {
  const half  = size / 2;
  const slots = Array.from({ length: 4 }, (_, i) => artworkUrls[i] ?? null);
  return (
    <View style={{ width: size, height: size, borderRadius: 8, overflow: 'hidden', flexDirection: 'row', flexWrap: 'wrap', flexShrink: 0 }}>
      {slots.map((url, i) =>
        url ? (
          <ExpoImage key={i} source={{ uri: url }} style={{ width: half, height: half }} contentFit="cover" cachePolicy="disk" />
        ) : (
          <View key={i} style={{ width: half, height: half, backgroundColor: fallback }} />
        )
      )}
    </View>
  );
}

function LikedPlaylistRow({ item, onPress, colors }: { item: LikedPlaylistItem; onPress: () => void; colors: ColorsType }) {
  const isByListend = item.targetId.startsWith('featured:');
  return (
    <Pressable style={({ pressed }) => [s.row, { opacity: pressed ? 0.72 : 1 }]} onPress={onPress}>
      <PlaylistMosaic artworkUrls={item.artworkUrls} size={52} fallback={colors.border} />
      <View style={s.info}>
        <Text style={[s.title, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
        {isByListend && (
          <Text style={[s.artist, { color: colors.tint, fontWeight: '600' }]}>by Listend</Text>
        )}
        <View style={s.meta}>
          <View style={[s.typePill, { borderColor: colors.tint }]}>
            <FontAwesome name="heart" size={9} color={colors.tint} />
            <Text style={[s.typeLabel, { color: colors.tint }]}>Liked Playlist</Text>
          </View>
          {item.dateLabel ? <Text style={[s.date, { color: colors.subtext }]}>{item.dateLabel}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

function CreatedPlaylistRow({ item, onPress, colors }: { item: CreatedPlaylistItem; onPress: () => void; colors: ColorsType }) {
  return (
    <Pressable style={({ pressed }) => [s.row, { opacity: pressed ? 0.72 : 1 }]} onPress={onPress}>
      <PlaylistMosaic artworkUrls={item.artworkUrls} size={52} fallback={colors.border} />
      <View style={s.info}>
        <Text style={[s.title, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
        <View style={s.meta}>
          <View style={[s.typePill, { borderColor: colors.tint }]}>
            <FontAwesome name="list" size={9} color={colors.tint} />
            <Text style={[s.typeLabel, { color: colors.tint }]}>Created Playlist</Text>
          </View>
          {item.dateLabel ? <Text style={[s.date, { color: colors.subtext }]}>{item.dateLabel}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

function FlippedRecordRow({ item, colors }: { item: FlipItem; colors: ColorsType }) {
  return (
    <View style={s.row}>
      {item.artworkUrl ? (
        <ExpoImage source={{ uri: item.artworkUrl }} style={s.art} contentFit="cover" cachePolicy="disk" />
      ) : (
        <View style={[s.art, { backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 8 }]}>
          <FontAwesome name="random" size={18} color={colors.tint} />
        </View>
      )}
      <View style={s.info}>
        <Text style={[s.title, { color: colors.text }]} numberOfLines={1}>{item.albumTitle}</Text>
        <Text style={[s.artist, { color: colors.subtext }]} numberOfLines={1}>
          {item.albumArtist}{item.albumYear ? ` · ${item.albumYear}` : ''}
        </Text>
        <View style={s.meta}>
          <View style={[s.typePill, { borderColor: colors.tint }]}>
            <FontAwesome name="random" size={9} color={colors.tint} />
            <Text style={[s.typeLabel, { color: colors.tint }]}>Flipped a Record</Text>
          </View>
          {item.dateLabel ? <Text style={[s.date, { color: colors.subtext }]}>{item.dateLabel}</Text> : null}
        </View>
      </View>
    </View>
  );
}

function Top5Row({ item, onPress, colors }: { item: Top5ChangeItem; onPress: () => void; colors: ColorsType }) {
  const catLabel = TOP5_CATEGORY_LABEL[item.category] ?? 'Top 5';
  return (
    <Pressable
      style={({ pressed }) => [s.row, { opacity: pressed ? 0.72 : 1 }]}
      onPress={onPress}>
      {item.itemImageUrl ? (
        <ExpoImage
          source={{ uri: item.itemImageUrl }}
          style={[s.art, item.category === 'artists' ? s.artCircle : null]}
        
            contentFit="cover" cachePolicy="disk"
          />
      ) : (
        <View style={[s.art, { backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' },
          item.category === 'artists' ? s.artCircle : null]}>
          <Text style={s.artInitial}>{item.itemName.charAt(0)}</Text>
        </View>
      )}
      <View style={s.info}>
        <Text style={[s.title, { color: colors.text }]} numberOfLines={1}>{item.itemName}</Text>
        {item.itemArtist ? (
          <Text style={[s.artist, { color: colors.subtext }]} numberOfLines={1}>{item.itemArtist}</Text>
        ) : null}
        <View style={s.meta}>
          <View style={[s.typePill, s.typePillFilled, { backgroundColor: colors.tint }]}>
            <FontAwesome name="list-ol" size={9} color="#1A0F0A" />
            <Text style={[s.typeLabel, { color: '#1A0F0A' }]}>
              {`Updated ${catLabel} · #${item.position}`}
            </Text>
          </View>
          {item.dateLabel ? <Text style={[s.date, { color: colors.subtext }]}>{item.dateLabel}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function RecentActivityScreen() {
  const colorScheme = useColorScheme();
  const { isPro, proTheme: ownProTheme } = usePro();
  const { userId: paramUserId, proTheme: paramProTheme } = useLocalSearchParams<{ userId?: string; proTheme?: string }>();
  const _themeKey = !paramUserId ? ownProTheme : (paramProTheme ?? 'default');
  const colors = ((!paramUserId ? isPro : !!paramProTheme) && _themeKey !== 'default')
    ? themeToColors(getProTheme(_themeKey))
    : Colors[colorScheme ?? 'dark'];

  const router = useRouter();
  const { user } = useAuth();
  const { loggedAlbums, wantToListen } = useAlbums();
  const { likedPlaylists: featuredLikedPlaylists } = useLikedFeaturedPlaylists();

  const viewingOther = paramUserId || null;

  const [ownFriendItems,       setOwnFriendItems]       = useState<FriendItem[]>([]);
  const [ownTop5Items,         setOwnTop5Items]         = useState<Top5ChangeItem[]>([]);
  const [ownLikedArtists,      setOwnLikedArtists]      = useState<LikedArtistItem[]>([]);
  const [ownLikedPlaylists,    setOwnLikedPlaylists]    = useState<LikedPlaylistItem[]>([]);
  const [ownCreatedPlaylists,  setOwnCreatedPlaylists]  = useState<CreatedPlaylistItem[]>([]);
  const [ownFlips,             setOwnFlips]             = useState<FlipItem[]>([]);
  const [ownReListens,         setOwnReListens]         = useState<ActivityItem[]>([]);
  const [otherActivity,        setOtherActivity]        = useState<ActivityItem[]>([]);
  const [otherFriends,         setOtherFriends]         = useState<FriendItem[]>([]);
  const [otherTop5Items,       setOtherTop5Items]       = useState<Top5ChangeItem[]>([]);
  const [otherLikedArtists,    setOtherLikedArtists]    = useState<LikedArtistItem[]>([]);
  const [otherLikedPlaylists,  setOtherLikedPlaylists]  = useState<LikedPlaylistItem[]>([]);
  const [otherCreatedPlaylists,setOtherCreatedPlaylists]= useState<CreatedPlaylistItem[]>([]);
  const [otherFlips,           setOtherFlips]           = useState<FlipItem[]>([]);
  const [loadingOther,         setLoadingOther]         = useState(false);
  const [selectedReview,       setSelectedReview]       = useState<ActivityItem | null>(null);
  const [reviewLikeState,      setReviewLikeState]      = useState<{ liked: boolean; count: number }>({ liked: false, count: 0 });
  const pendingLikeToggle = useRef(false);
  const [reviewUsername,       setReviewUsername]       = useState('');
  const isDark = colors.isDark;

  useEffect(() => {
    if (!user || viewingOther) return;
    fetchFriendsForUser(user.id).then(setOwnFriendItems);
    fetchTop5ChangesForUser(user.id).then(setOwnTop5Items);
    fetchLikedArtistsForUser(user.id).then(setOwnLikedArtists);
    fetchLikedPlaylistsForUser(user.id).then(setOwnLikedPlaylists);
    fetchCreatedPlaylistsForUser(user.id).then(setOwnCreatedPlaylists);
    fetchFlipsForUser(user.id).then(setOwnFlips);
    // Fetch own re-listens
    supabase
      .from('re_listens')
      .select('spotify_id, title, artist, artwork_url, rating, review, listened_at')
      .eq('user_id', user.id)
      .order('listened_at', { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        const items: ActivityItem[] = data.map((r: any) => ({
          key:        `relisten-${r.spotify_id}-${r.listened_at}`,
          type:       'reListened' as ActivityType,
          id:         r.spotify_id,
          title:      r.title       ?? '',
          artist:     r.artist      ?? '',
          year:       0,
          artworkUrl: r.artwork_url ?? undefined,
          coverColor: undefined,
          dateMs:     r.listened_at ? new Date(r.listened_at).getTime() : null,
          dateLabel:  r.listened_at ? formatDateLabel(r.listened_at) : '',
          rating:     r.rating      ?? 0,
          review:     r.review      ?? undefined,
        }));
        setOwnReListens(items);
      });
  }, [user?.id, viewingOther]);

  useEffect(() => {
    if (!viewingOther) return;
    setLoadingOther(true);
    Promise.all([
      fetchActivityForUser(viewingOther),
      fetchFriendsForUser(viewingOther),
      fetchTop5ChangesForUser(viewingOther),
      fetchLikedArtistsForUser(viewingOther),
      fetchLikedPlaylistsForUser(viewingOther),
      fetchLikedFeaturedPlaylistsForUser(viewingOther),
      fetchCreatedPlaylistsForUser(viewingOther),
      fetchFlipsForUser(viewingOther),
    ]).then(([activity, friends, top5, likedArtists, likedPlaylists, likedFeatured, createdPlaylists, flips]) => {
      setOtherActivity(activity as ActivityItem[]);
      setOtherFriends(friends as FriendItem[]);
      setOtherTop5Items(top5 as Top5ChangeItem[]);
      setOtherLikedArtists(likedArtists as LikedArtistItem[]);
      setOtherLikedPlaylists([...(likedPlaylists as LikedPlaylistItem[]), ...(likedFeatured as LikedPlaylistItem[])]);
      setOtherCreatedPlaylists(createdPlaylists as CreatedPlaylistItem[]);
      setOtherFlips(flips as FlipItem[]);
      setLoadingOther(false);
    });
  }, [viewingOther]);

  // Fetch like state + username whenever a review is opened
  useEffect(() => {
    if (!selectedReview) return;
    const ownerId = viewingOther ?? user?.id ?? '';
    const targetId = `${ownerId}_${selectedReview.id}`;

    // Fetch like counts and own like state
    supabase
      .from('likes')
      .select('user_id')
      .eq('target_type', 'review')
      .eq('target_id', targetId)
      .then(({ data }) => {
        const rows = data ?? [];
        setReviewLikeState({
          count: rows.length,
          liked: rows.some((r: any) => r.user_id === user?.id),
        });
      });

    // Fetch reviewer username
    supabase
      .from('profiles')
      .select('username')
      .eq('id', ownerId)
      .single()
      .then(({ data }) => {
        setReviewUsername(data?.username ?? 'you');
      });
  }, [selectedReview?.id, selectedReview?.type]);

  const ownActivityItems = useMemo((): ActivityItem[] => {
    if (viewingOther) return [];
    const items: ActivityItem[] = [];

    for (const a of loggedAlbums) {
      const type: ActivityType = a.review ? 'reviewed' : a.rating > 0 ? 'rated' : 'listened';
      items.push({
        key:        `logged-${a.id}`,
        type,
        id:         a.id,
        title:      a.title,
        artist:     a.artist,
        year:       a.year,
        artworkUrl: a.artworkUrl,
        coverColor: a.coverColor,
        dateMs:     parseDate(a.dateLogged),
        dateLabel:  formatDateLabel(a.dateLogged),
        rating:     a.rating,
        review:     a.review,
      });
    }

    for (const w of wantToListen) {
      const dateMs = w.dateAdded ? new Date(w.dateAdded).getTime() : null;
      items.push({
        key:        `want-${w.id}`,
        type:       'wantToListen',
        id:         w.id,
        title:      w.title,
        artist:     w.artist,
        year:       w.year,
        artworkUrl: w.artworkUrl,
        coverColor: undefined,
        dateMs,
        dateLabel:  w.dateAdded
          ? new Date(w.dateAdded).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : '',
        rating:     0,
      });
    }

    return items;
  }, [loggedAlbums, wantToListen, viewingOther]);

  // Fetch like dates for featured playlists (context has playlist data but not timestamps)
  const [featuredLikeDates, setFeaturedLikeDates] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    if (viewingOther || !user || featuredLikedPlaylists.length === 0) return;
    supabase
      .from('likes')
      .select('target_id, created_at')
      .eq('user_id', user.id)
      .eq('target_type', 'playlist')
      .ilike('target_id', 'featured:%')
      .then(({ data }) => {
        if (!data) return;
        setFeaturedLikeDates(new Map((data as any[]).map(r => [r.target_id as string, r.created_at as string])));
      });
  }, [featuredLikedPlaylists.length, user?.id, viewingOther]);

  // For own user, merge featured liked playlists from context (always up-to-date)
  const ownFeaturedLikedPlaylists = useMemo((): LikedPlaylistItem[] => {
    if (viewingOther) return [];
    return featuredLikedPlaylists.map(pl => {
      const rawId  = `featured:${pl.id}`;
      const dateStr = featuredLikeDates.get(rawId) ?? new Date().toISOString();
      return {
        key:         `liked-pl-${rawId}`,
        targetId:    rawId,
        name:        pl.name,
        artworkUrls: pl.artworkUrls.slice(0, 4),
        dateMs:      new Date(dateStr).getTime(),
        dateLabel:   formatDateLabel(dateStr),
      };
    });
  }, [featuredLikedPlaylists, featuredLikeDates, viewingOther]);

  const feed = useMemo((): FeedItem[] => {
    const activityItems      = viewingOther ? otherActivity         : [...ownActivityItems, ...ownReListens];
    const friendItems        = viewingOther ? otherFriends          : ownFriendItems;
    const top5Items          = viewingOther ? otherTop5Items        : ownTop5Items;
    const likedArtistItems   = viewingOther ? otherLikedArtists     : ownLikedArtists;
    const likedPlaylistItems = viewingOther
      ? otherLikedPlaylists
      : [...ownLikedPlaylists, ...ownFeaturedLikedPlaylists];
    const createdPlaylistItems = viewingOther ? otherCreatedPlaylists : ownCreatedPlaylists;

    const flipItems = viewingOther ? otherFlips : ownFlips;

    const combined: FeedItem[] = [
      ...activityItems.map(d       => ({ kind: 'activity'        as const, data: d })),
      ...friendItems.map(d         => ({ kind: 'friend'          as const, data: d })),
      ...top5Items.map(d           => ({ kind: 'top5'            as const, data: d })),
      ...likedArtistItems.map(d   => ({ kind: 'likedArtist'     as const, data: d })),
      ...likedPlaylistItems.map(d  => ({ kind: 'likedPlaylist'   as const, data: d })),
      ...createdPlaylistItems.map(d=> ({ kind: 'createdPlaylist' as const, data: d })),
      ...flipItems.map(d           => ({ kind: 'flippedRecord'   as const, data: d })),
    ];

    combined.sort((a, b) => {
      const msA = a.data.dateMs;
      const msB = b.data.dateMs;
      if (msA === null && msB === null) return 0;
      if (msA === null) return 1;
      if (msB === null) return -1;
      return msB - msA;
    });

    return combined;
  }, [
    ownActivityItems, ownReListens, otherActivity,
    ownFriendItems, otherFriends,
    ownTop5Items, otherTop5Items,
    ownLikedArtists, otherLikedArtists,
    ownLikedPlaylists, otherLikedPlaylists, ownFeaturedLikedPlaylists, featuredLikeDates,
    ownCreatedPlaylists, otherCreatedPlaylists,
    ownFlips, otherFlips,
    viewingOther,
  ]);

  if (loadingOther) {
    return (
      <View style={[s.loadingWrap, { backgroundColor: colors.background }]}>
        <ActivityIndicator color="#D4A017" size="large" />
      </View>
    );
  }

  if (feed.length === 0) {
    return (
      <View style={[s.emptyWrap, { backgroundColor: colors.background }]}>
        <View style={[s.emptyRing, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <FontAwesome name="clock-o" size={36} color="#D4A017" />
        </View>
        <Text style={[s.emptyTitle, { color: colors.text }]}>No activity yet</Text>
        <Text style={[s.emptySub, { color: colors.subtext }]}>
          {viewingOther
            ? 'This user has no public activity yet.'
            : 'Log your first album to see\nyour activity here.'}
        </Text>
      </View>
    );
  }

  function handleTop5Press(item: Top5ChangeItem) {
    if (item.category === 'albums') {
      router.push({ pathname: '/album-detail', params: { id: item.itemId, title: item.itemName, artist: item.itemArtist ?? '', artworkUrl: item.itemImageUrl ?? '' } });
    } else if (item.category === 'artists') {
      router.push({ pathname: '/artist-detail', params: { id: item.itemId, name: item.itemName } });
    } else {
      router.push({ pathname: '/artist-detail', params: { name: item.itemArtist ?? item.itemName } });
    }
  }

  return (
    <>
      <Stack.Screen options={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }} />
    <FlatList
      data={feed}
      keyExtractor={item => item.data.key}
      style={[s.container, { backgroundColor: colors.background }]}
      contentContainerStyle={s.list}
      showsVerticalScrollIndicator={false}
      ItemSeparatorComponent={() => <View style={[s.sep, { backgroundColor: colors.border }]} />}
      renderItem={({ item }) => {
        if (item.kind === 'friend') {
          return (
            <FriendRow
              item={item.data}
              colors={colors}
              onPress={() => router.push({ pathname: '/user-profile', params: { userId: item.data.friendId } })}
            />
          );
        }
        if (item.kind === 'top5') {
          return (
            <Top5Row
              item={item.data}
              colors={colors}
              onPress={() => handleTop5Press(item.data)}
            />
          );
        }
        if (item.kind === 'likedArtist') {
          return (
            <LikedArtistRow
              item={item.data}
              colors={colors}
              onPress={() => router.push({ pathname: '/artist-detail', params: { id: item.data.artistId, name: item.data.name } })}
            />
          );
        }
        if (item.kind === 'likedPlaylist') {
          return (
            <LikedPlaylistRow
              item={item.data}
              colors={colors}
              onPress={() => {
                const isFeature = item.data.targetId.startsWith('featured:');
                if (isFeature) {
                  router.push({ pathname: '/discover-featured-playlist', params: { id: item.data.targetId.replace('featured:', ''), name: item.data.name } } as any);
                } else {
                  router.push({ pathname: '/playlist-detail', params: { id: item.data.targetId } });
                }
              }}
            />
          );
        }
        if (item.kind === 'createdPlaylist') {
          return (
            <CreatedPlaylistRow
              item={item.data}
              colors={colors}
              onPress={() => router.push({ pathname: '/playlist-detail', params: { id: item.data.playlistId } })}
            />
          );
        }
        if (item.kind === 'flippedRecord') {
          return <FlippedRecordRow item={item.data} colors={colors} />;
        }
        return (
          <ActivityRow
            item={item.data}
            colors={colors}
            onPress={() => {
              if (item.data.type === 'reviewed') {
                setSelectedReview(item.data);
              } else {
                router.push({ pathname: '/album-detail', params: { id: item.data.id, title: item.data.title, artist: item.data.artist, year: String(item.data.year ?? ''), artworkUrl: item.data.artworkUrl ?? '' } });
              }
            }}
          />
        );
      }}
    />

      {selectedReview && (
        <ReviewCardModal
          item={selectedReview}
          colors={colors}
          isDark={isDark}
          reviewerUsername={reviewUsername}
          likeState={reviewLikeState}
          onLike={viewingOther ? async () => {
            if (pendingLikeToggle.current) return;
            pendingLikeToggle.current = true;
            const ownerId = viewingOther;
            const targetId = `${ownerId}_${selectedReview.id}`;
            const current = reviewLikeState;
            setReviewLikeState({ liked: !current.liked, count: Math.max(0, current.liked ? current.count - 1 : current.count + 1) });
            try {
              if (current.liked) {
                await supabase.from('likes').delete().eq('user_id', user!.id).eq('target_type', 'review').eq('target_id', targetId);
              } else {
                const { error } = await supabase.from('likes').insert({ user_id: user!.id, target_type: 'review', target_id: targetId, target_owner_id: ownerId });
                if (!error && ownerId !== user!.id) {
                  supabase.from('notifications').insert({
                    user_id: ownerId, type: 'like_review', actor_id: user!.id, target_id: targetId,
                  }).then(({ error: notifErr }) => {
                    if (notifErr) console.error('[recent-activity] notification error:', notifErr.message);
                  });
                }
              }
            } finally {
              pendingLikeToggle.current = false;
            }
          } : undefined}
          onClose={() => setSelectedReview(null)}
          onAlbumPress={() => {
            const a = selectedReview;
            setSelectedReview(null);
            router.push({ pathname: '/album-detail', params: { id: a.id, title: a.title, artist: a.artist, year: String(a.year ?? ''), artworkUrl: a.artworkUrl ?? '' } });
          }}
          onUsernamePress={viewingOther ? (username) => { setSelectedReview(null); navigateToProfile(username, router); } : undefined}
        />
      )}
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1 },
  list:      { paddingVertical: 8, paddingBottom: 48 },

  loadingWrap: {
    flex: 1,
    alignItems: 'center', justifyContent: 'center',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 13,
    gap: 13,
  },
  art:        { width: 52, height: 52, borderRadius: 8, flexShrink: 0 },
  artCircle:  { borderRadius: 26 },
  artInitial: { color: 'rgba(255,255,255,0.45)', fontSize: 18, fontWeight: '700' },

  info:   { flex: 1, gap: 3 },
  title:  { fontSize: 14, fontWeight: '600' },
  artist: { fontSize: 12 },

  meta:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3, flexWrap: 'wrap' },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  typePillFilled: {
    backgroundColor: '#D4A017',
    borderWidth: 0,
  },
  typeLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  date:      { fontSize: 11 },

  bars:      { flexDirection: 'row', alignItems: 'flex-end', gap: 2.5, flexShrink: 0 },
  bar:       { width: 2.5, borderRadius: 1 },
  ratingNum: { color: '#D4A017', fontSize: 10, fontWeight: '700', lineHeight: 15, marginLeft: 1 },

  sep: { height: StyleSheet.hairlineWidth, marginLeft: 83 },

  followAvatar:  { width: 52, height: 52, borderRadius: 26, flexShrink: 0 },
  followInitial: { fontSize: 18, fontWeight: '700' },

  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyRing: {
    width: 84, height: 84, borderRadius: 42,
    borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 10 },
  emptySub:   { fontSize: 14, lineHeight: 21, textAlign: 'center' },
});

const rm = StyleSheet.create({
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle:  { fontSize: 16, fontWeight: '700' },
  albumRow:     { flexDirection: 'row', gap: 14, padding: 20, paddingBottom: 12 },
  art:          { width: 80, height: 80, borderRadius: 8, flexShrink: 0 },
  albumTitle:   { fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
  albumArtist:  { fontSize: 13 },
  authorRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 10 },
  avatar:       { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  avatarLetter: { color: '#fff', fontSize: 12, fontWeight: '700' },
  username:     { color: '#D4A017', fontWeight: '600', fontSize: 14 },
  listenedDate: { fontSize: 12 },
  reviewText:   { fontSize: 14, lineHeight: 22, fontStyle: 'italic', paddingHorizontal: 20, paddingVertical: 6 },
  likeCommentRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, marginTop: 6 },
  likeBtn:            { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 6 },
  likeCount:          { fontSize: 13, fontWeight: '600' },
  commentsToggle:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth },
  commentsToggleText: { fontSize: 12 },
});
