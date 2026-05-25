import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  Platform,
  SafeAreaView,
  KeyboardAvoidingView,
  useWindowDimensions,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { usePro } from '@/context/ProContext';
import { getProTheme, themeToColors } from '@/lib/proThemes';
import { useFocusEffect } from '@react-navigation/native';
import { useState, useMemo, useEffect, useCallback } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useAlbums, LoggedAlbum } from '@/context/AlbumsContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { navigateToAlbum } from '@/lib/navigateToAlbum';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { ReviewComment, CommentsSection, avatarColor } from '@/components/ReviewComments';

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// "Mar 24, 2026" → Date object (returns null if unparseable)
function parseLogged(s: string): Date | null {
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// Date → "YYYY-MM-DD" key
function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Rating badge
function RatingPip({ rating }: { rating: number }) {
  const colorScheme = useColorScheme();
  const colors      = Colors[colorScheme ?? 'light'];
  if (!rating) return null;
  return (
    <View style={[rb.wrap, { backgroundColor: colors.surface, borderColor: '#D4A017' }]}>
      <Text style={rb.text}>{rating}</Text>
    </View>
  );
}
const rb = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  text: { color: '#D4A017', fontSize: 11, fontWeight: '700' },
});

const COVER_COLORS = ['#2d5a27','#7a4a2e','#1a3018','#d4a017','#7a3a1a','#8b1a1a','#1a5a5a','#4a2818'];

// ─── Volume badge ─────────────────────────────────────────────────────────────

function VolumeBadge({ rating, isDark, tint = '#D4A017' }: { rating: number; isDark?: boolean; tint?: string }) {
  const inactive = isDark ? '#2a1e14' : '#e0e0e0';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <FontAwesome name="volume-up" size={9} color={tint} />
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 1 }}>
        {Array.from({ length: 10 }, (_, i) => {
          const h = Math.round(3 + i * 1);
          return (
            <View
              key={i}
              style={{ width: 2, height: h, borderRadius: 1, backgroundColor: i + 1 <= rating ? tint : inactive }}
            />
          );
        })}
      </View>
      <Text style={{ color: tint, fontSize: 10, fontWeight: '700' }}>{rating}</Text>
    </View>
  );
}

// ─── Review modal (matches my-listend AlbumReviewModal) ───────────────────────

function AlbumReviewModal({
  album,
  username,
  isDark,
  colors,
  onClose,
  onAlbumPress,
  onUsernamePress,
}: {
  album: LoggedAlbum;
  username: string;
  isDark: boolean;
  colors: any;
  onClose: () => void;
  onAlbumPress: () => void;
  onUsernamePress?: () => void;
}) {
  const [liked,            setLiked]            = useState(false);
  const [likeCount,        setLikeCount]        = useState(0);
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const [localComments,    setLocalComments]    = useState<ReviewComment[]>([]);

  const border  = isDark ? '#2a1e14' : '#e5e5e5';
  const dateStr = album.dateLogged
    ? new Date(album.dateLogged).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  function handleAddComment(body: string, parentId?: string | null, commenterUsername?: string, replyToUsername?: string, avatarUrl?: string | null) {
    const c: ReviewComment = {
      id:              `sc_${Date.now()}`,
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

            {/* Album row */}
            <Pressable
              onPress={onAlbumPress}
              style={({ pressed }) => [rm.albumRow, { opacity: pressed ? 0.7 : 1 }]}>
              {album.artworkUrl ? (
                <ExpoImage source={{ uri: album.artworkUrl }} style={rm.art} contentFit="cover" cachePolicy="disk" />
              ) : (
                <View style={[rm.art, { backgroundColor: album.coverColor, justifyContent: 'center', alignItems: 'center' }]}>
                  <FontAwesome name="music" size={20} color="rgba(255,255,255,0.4)" />
                </View>
              )}
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[rm.albumTitle, { color: isDark ? '#f5e6c8' : '#1A0F0A' }]}>{album.title}</Text>
                <Text style={[rm.albumArtist, { color: isDark ? '#A08060' : '#6B4C35' }]}>
                  {album.artist}{album.year > 0 ? ` · ${album.year}` : ''}
                </Text>
                {(album.lastRating ?? album.rating) > 0 && (
                  <View style={rm.ratingRow}>
                    <VolumeBadge rating={album.lastRating ?? album.rating} isDark={isDark} tint={colors.tint} />
                  </View>
                )}
                {album.isRelistened && (
                  <FontAwesome name="repeat" size={9} color={colors.tint} style={{ marginTop: 2 }} />
                )}
              </View>
            </Pressable>

            {/* Author + date */}
            <Pressable style={rm.authorRow} onPress={onUsernamePress} disabled={!onUsernamePress}>
              <View style={[rm.avatar, { backgroundColor: avatarColor(username || '?') }]}>
                <Text style={rm.avatarLetter}>{(username || '?')[0].toUpperCase()}</Text>
              </View>
              <View style={{ gap: 1 }}>
                <Text style={[rm.username, { color: colors.tint }]}>@{username || '…'}</Text>
                {dateStr ? (
                  <Text style={[rm.listenedDate, { color: isDark ? '#A08060' : '#6B4C35' }]}>
                    {(album as any).isReListenEvent ? 'Re-listend' : 'Listend'} {dateStr}
                  </Text>
                ) : null}
              </View>
            </Pressable>

            {/* Review text — each entry shows its own review for that specific listen */}
            {album.review ? (
              <Text style={[rm.reviewText, { color: isDark ? '#A08060' : '#6B4C35' }]}>
                "{album.review}"
              </Text>
            ) : (
              <Text style={[rm.reviewText, { color: isDark ? '#4a3020' : '#C8B89A', fontStyle: 'italic' }]}>
                No written review.
              </Text>
            )}

            {/* Like + comment toggle */}
            <View style={[rm.likeCommentRow, { borderColor: border }]}>
              <Pressable onPress={() => { setLiked(p => !p); setLikeCount(p => liked ? p - 1 : p + 1); }} hitSlop={8} style={rm.likeBtn}>
                <FontAwesome
                  name={liked ? 'heart' : 'heart-o'}
                  size={15}
                  color={liked ? '#D4A017' : (isDark ? '#A08060' : '#6B4C35')}
                />
                <Text style={[rm.likeCount, { color: liked ? '#D4A017' : (isDark ? '#A08060' : '#6B4C35') }]}>
                  {likeCount}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setCommentsExpanded(p => !p)}
                hitSlop={8}
                style={[rm.commentsToggle, { borderColor: border, flex: 1, marginBottom: 0 }]}>
                <FontAwesome
                  name="comment-o"
                  size={13}
                  color={commentsExpanded ? '#D4A017' : (isDark ? '#6B4C35' : '#A08060')}
                />
                <Text style={[rm.commentsToggleText, { color: commentsExpanded ? '#D4A017' : (isDark ? '#6B4C35' : '#A08060') }]}>
                  {localComments.length === 0 ? 'No comments yet' : `${localComments.length} comment${localComments.length !== 1 ? 's' : ''}`}
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
              />
            )}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const rm = StyleSheet.create({
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  body:        { paddingHorizontal: 20, paddingTop: 20, gap: 20 },
  albumRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  art:         { width: 72, height: 72, borderRadius: 8, flexShrink: 0 },
  albumTitle:  { fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
  albumArtist: { fontSize: 13 },
  ratingRow:   { marginTop: 2 },
  authorRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar:      { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarLetter:{ color: '#fff', fontSize: 14, fontWeight: '700' },
  username:    { color: '#D4A017', fontSize: 13, fontWeight: '600' },
  listenedDate:{ fontSize: 12 },
  reviewText:  { fontSize: 15, lineHeight: 22, fontStyle: 'italic' },
  likeCommentRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  likeBtn:          { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 4 },
  likeCount:        { fontSize: 13, fontWeight: '600' },
  commentsToggle:   { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10 },
  commentsToggleText: { fontSize: 12, flex: 1 },
});

export default function SessionsScreen() {
  const colorScheme = useColorScheme();
  const { isPro, proTheme: ownProTheme } = usePro();
  const { userId: paramUserId, proTheme: paramProTheme } = useLocalSearchParams<{ userId?: string; proTheme?: string }>();
  const _themeKey = !paramUserId ? ownProTheme : (paramProTheme ?? 'default');
  const colors = ((!paramUserId ? isPro : !!paramProTheme) && _themeKey !== 'default')
    ? themeToColors(getProTheme(_themeKey))
    : Colors[colorScheme ?? 'dark'];
  const isDark      = colorScheme === 'dark';

  const { width } = useWindowDimensions();
  const router    = useRouter();
  const { loggedAlbums } = useAlbums();
  const { user } = useAuth();

  const viewingOther = paramUserId || null;
  const [otherAlbums, setOtherAlbums] = useState<LoggedAlbum[]>([]);
  const [otherReListens, setOtherReListens] = useState<LoggedAlbum[]>([]);
  const [ownReListens, setOwnReListens] = useState<LoggedAlbum[]>([]);

  useEffect(() => {
    if (!viewingOther) return;
    Promise.all([
      supabase
        .from('user_albums')
        .select('spotify_id, title, artist, artwork_url, year, rating, review, listened_at')
        .eq('user_id', viewingOther)
        .not('listened_at', 'is', null)
        .order('listened_at', { ascending: false }),
      supabase
        .from('re_listens')
        .select('spotify_id, title, artist, artwork_url, year, rating, review, listened_at')
        .eq('user_id', viewingOther)
        .order('listened_at', { ascending: false }),
    ]).then(([{ data: albums }, { data: reListens }]) => {
      if (!albums) return;

      type RLSummary = { count: number; lastRating: number; lastReview?: string };
      const rlMap = new Map<string, RLSummary>();
      for (const r of (reListens ?? []) as any[]) {
        const existing = rlMap.get(r.spotify_id);
        if (!existing) {
          rlMap.set(r.spotify_id, { count: 1, lastRating: r.rating ?? 0, lastReview: r.review ?? undefined });
        } else {
          existing.count++;
        }
      }

      setOtherAlbums(albums.map((a, i) => {
        const rl = rlMap.get(a.spotify_id);
        return {
          id:            a.spotify_id,
          title:         a.title      ?? '',
          artist:        a.artist     ?? '',
          year:          a.year       ?? 0,
          rating:        a.rating     ?? 0,
          review:        a.review     ?? undefined,
          dateLogged:    a.listened_at ?? new Date().toISOString(),
          artworkUrl:    a.artwork_url ?? undefined,
          coverColor:    COVER_COLORS[i % COVER_COLORS.length],
          isRelistened:  !!rl,
          reListenCount: rl?.count,
          lastRating:    rl?.lastRating,
          lastReview:    rl?.lastReview,
        };
      }));

      const seen = new Set<string>();
      const deduped = (reListens ?? []).filter((a: any) => {
        const key = `${a.spotify_id}_${a.listened_at}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setOtherReListens(deduped.map((a: any, i: number) => ({
        id:              a.spotify_id,
        title:           a.title      ?? '',
        artist:          a.artist     ?? '',
        year:            a.year       ?? 0,
        rating:          a.rating     ?? 0,
        review:          a.review     ?? undefined,
        dateLogged:      a.listened_at ?? new Date().toISOString(),
        artworkUrl:      a.artwork_url ?? undefined,
        coverColor:      COVER_COLORS[i % COVER_COLORS.length],
        isRelistened:    true,
        isReListenEvent: true,
      } as LoggedAlbum & { isReListenEvent: boolean })));
    });
  }, [viewingOther]);

  useFocusEffect(useCallback(() => {
    if (viewingOther || !user?.id) return;
    supabase
      .from('re_listens')
      .select('spotify_id, title, artist, artwork_url, year, rating, review, listened_at')
      .eq('user_id', user.id)
      .order('listened_at', { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        // Deduplicate by id+dateLogged in case DB has duplicate rows
        const seen = new Set<string>();
        const deduped = data.filter(a => {
          const key = `${a.spotify_id}_${a.listened_at}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setOwnReListens(deduped.map((a, i) => ({
          id:              a.spotify_id,
          title:           a.title      ?? '',
          artist:          a.artist     ?? '',
          year:            a.year       ?? 0,
          rating:          a.rating     ?? 0,
          review:          a.review     ?? undefined,
          dateLogged:      a.listened_at ?? new Date().toISOString(),
          artworkUrl:      a.artwork_url ?? undefined,
          coverColor:      COVER_COLORS[i % COVER_COLORS.length],
          isRelistened:    true,
          isReListenEvent: true,
        } as LoggedAlbum & { isReListenEvent: boolean })));
      });
  }, [viewingOther, user?.id]));

  // When context's loggedAlbums gets an optimistic re-listen edit, mirror it into
  // ownReListens so sessions shows the updated rating without waiting for a DB refetch.
  useEffect(() => {
    if (viewingOther) return;
    setOwnReListens(prev => {
      if (prev.length === 0) return prev;
      return prev.map(r => {
        const ctx = loggedAlbums.find(a => a.id === r.id);
        if (!ctx?.isRelistened) return r;
        // Only update the most-recent re-listen entry for this album
        const latestDate = prev
          .filter(x => x.id === r.id)
          .reduce<string>((max, x) => (x.dateLogged > max ? x.dateLogged : max), '');
        if (r.dateLogged !== latestDate) return r;
        return {
          ...r,
          rating: ctx.lastRating  ?? r.rating,
          review: ctx.lastReview  !== undefined ? ctx.lastReview : r.review,
        };
      });
    });
  }, [loggedAlbums, viewingOther]);

  const sourceAlbums = viewingOther
    ? [...otherAlbums, ...otherReListens].sort(
        (a, b) => new Date(b.dateLogged).getTime() - new Date(a.dateLogged).getTime()
      )
    : [...loggedAlbums, ...ownReListens].sort(
        (a, b) => new Date(b.dateLogged).getTime() - new Date(a.dateLogged).getTime()
      );

  // Review modal state
  const [selectedAlbum,   setSelectedAlbum]   = useState<LoggedAlbum | null>(null);
  const [profileUsername, setProfileUsername] = useState('');

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

  function handleAlbumPress(album: LoggedAlbum) {
    setSelectedAlbum(album);
  }

  // Calendar navigation state — start at current month
  const now = new Date();
  const [viewYear,  setViewYear]  = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth()); // 0-indexed
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Build lookup: dateKey → albums[]
  const albumsByDate = useMemo(() => {
    const map = new Map<string, LoggedAlbum[]>();
    for (const album of sourceAlbums) {
      const d = parseLogged(album.dateLogged);
      if (!d) continue;
      const k = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(album);
    }
    return map;
  }, [sourceAlbums]);

  // Monthly & yearly stats
  const monthlyCount = useMemo(() => {
    let n = 0;
    for (const album of sourceAlbums) {
      if ((album as any).isReListenEvent) continue;
      const d = parseLogged(album.dateLogged);
      if (d && d.getFullYear() === viewYear && d.getMonth() === viewMonth) n++;
    }
    return n;
  }, [sourceAlbums, viewYear, viewMonth]);

  const yearlyCount = useMemo(() => {
    return sourceAlbums.filter(a => {
      if ((a as any).isReListenEvent) return false;
      const d = parseLogged(a.dateLogged);
      return d && d.getFullYear() === viewYear;
    }).length;
  }, [sourceAlbums, viewYear]);

  const monthlyAlbums = useMemo(() => {
    return sourceAlbums.filter(a => {
      const d = parseLogged(a.dateLogged);
      return d && d.getFullYear() === viewYear && d.getMonth() === viewMonth;
    });
  }, [sourceAlbums, viewYear, viewMonth]);

  // Navigate months
  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
    setSelectedKey(null);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
    setSelectedKey(null);
  }

  // Build calendar grid cells
  const daysInMonth  = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstWeekDay = new Date(viewYear, viewMonth, 1).getDay();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const cellSize = Math.floor((width - 40) / 7); // 20px padding each side

  const selectedAlbums = selectedKey ? (albumsByDate.get(selectedKey) ?? []) : [];

  return (
    <>
      <Stack.Screen options={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }} />
    <ScrollView
      style={[s.container, { backgroundColor: colors.background }]}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}>

      {/* ── Month navigator ───────────────────────────────────────────────────── */}
      <View style={s.monthNav}>
        <Pressable onPress={prevMonth} style={s.navBtn} hitSlop={12}>
          <FontAwesome name="chevron-left" size={15} color={colors.text} />
        </Pressable>
        <Text style={[s.monthTitle, { color: colors.text }]}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
        <Pressable onPress={nextMonth} style={s.navBtn} hitSlop={12}>
          <FontAwesome name="chevron-right" size={15} color={colors.text} />
        </Pressable>
      </View>

      {/* ── Day-of-week header ────────────────────────────────────────────────── */}
      <View style={s.weekRow}>
        {DAY_LABELS.map(d => (
          <Text key={d} style={[s.weekLabel, { width: cellSize, color: colors.subtext }]}>{d}</Text>
        ))}
      </View>

      {/* ── Calendar grid ────────────────────────────────────────────────────── */}
      <View style={s.calGrid}>
        {cells.map((day, idx) => {
          if (!day) {
            return <View key={`e-${idx}`} style={{ width: cellSize, height: cellSize + 10 }} />;
          }
          const k = dateKey(viewYear, viewMonth, day);
          const hasAlbums = albumsByDate.has(k);
          const isSelected = selectedKey === k;
          const isToday =
            day === now.getDate() &&
            viewMonth === now.getMonth() &&
            viewYear === now.getFullYear();

          return (
            <Pressable
              key={k}
              style={[
                s.dayCell,
                { width: cellSize, height: cellSize + 10 },
                isSelected && { backgroundColor: colors.tint },
                isToday && !isSelected && { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
              ]}
              onPress={() => setSelectedKey(isSelected ? null : k)}>
              <Text style={[
                s.dayNum,
                { color: colors.text },
                isSelected && s.dayNumSelected,
                isToday && !isSelected && { color: colors.tint },
              ]}>
                {day}
              </Text>
              {hasAlbums && (
                <View style={[s.dot, isSelected ? s.dotSelected : { backgroundColor: colors.tint }]} />
              )}
            </Pressable>
          );
        })}
      </View>

      {/* ── This Month ───────────────────────────────────────────────────────── */}
      <View style={s.monthSection}>
        <Text style={[s.monthSectionTitle, { color: colors.text }]}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </Text>
        {monthlyAlbums.length === 0 ? (
          <Text style={[s.noMonthAlbums, { color: colors.subtext }]}>No albums logged this month.</Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.monthRow}>
            {monthlyAlbums.map(album => (
              <Pressable
                key={`${album.id}_${album.dateLogged}`}
                style={({ pressed }) => [s.monthCard, { opacity: pressed ? 0.7 : 1 }]}
                onPress={() => handleAlbumPress(album)}>
                {album.artworkUrl ? (
                  <ExpoImage source={{ uri: album.artworkUrl }} style={s.monthArt}
            contentFit="cover" cachePolicy="disk"
          />
                ) : (
                  <View style={[s.monthArt, { backgroundColor: album.coverColor ?? colors.border, justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={s.monthArtInitial}>{album.title.charAt(0)}</Text>
                  </View>
                )}
                <Text style={[s.monthCardTitle, { color: colors.text }]} numberOfLines={1}>{album.title}</Text>
                <Text style={[s.monthCardArtist, { color: colors.subtext }]} numberOfLines={1}>{album.artist}</Text>
                {((album.lastRating ?? album.rating) > 0 || album.isRelistened) && (
                  <View style={{ marginTop: 3, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    {(album.lastRating ?? album.rating) > 0 && <VolumeBadge rating={album.lastRating ?? album.rating} isDark={isDark} tint={colors.tint} />}
                    {!!(album.lastReview ?? album.review) && <FontAwesome name="quote-left" size={8} color={colors.tint} />}
                    {album.isRelistened && <FontAwesome name="repeat" size={8} color={colors.tint} />}
                  </View>
                )}
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      {/* ── Selected date albums ─────────────────────────────────────────────── */}
      {selectedKey && (
        <View style={[s.dayDetail, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[s.dayDetailTitle, { color: colors.text }]}>
            {MONTH_NAMES[viewMonth]} {parseInt(selectedKey.split('-')[2], 10)}, {viewYear}
          </Text>
          <Text style={[s.dayAlbumCount, { color: colors.subtext }]}>
            {selectedAlbums.length === 1 ? '1 album' : `${selectedAlbums.length} albums`}
          </Text>
          {selectedAlbums.length === 0 ? (
            <Text style={[s.noAlbums, { color: colors.subtext }]}>No albums logged this day.</Text>
          ) : (
            selectedAlbums.map(album => (
              <Pressable
                key={`${album.id}_${album.dateLogged}`}
                style={({ pressed }) => [s.albumRow, { borderTopColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                onPress={() => handleAlbumPress(album)}>
                {album.artworkUrl ? (
                  <ExpoImage source={{ uri: album.artworkUrl }} style={s.albumArt}
            contentFit="cover" cachePolicy="disk"
          />
                ) : (
                  <View style={[s.albumArt, { backgroundColor: album.coverColor, justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={s.albumInitial}>{album.title.charAt(0)}</Text>
                  </View>
                )}
                <View style={s.albumInfo}>
                  <Text style={[s.albumTitle, { color: colors.text }]} numberOfLines={1}>{album.title}</Text>
                  <Text style={[s.albumArtist, { color: colors.subtext }]} numberOfLines={1}>{album.artist}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  {(album.lastRating ?? album.rating) > 0 && <VolumeBadge rating={album.lastRating ?? album.rating} isDark={isDark} tint={colors.tint} />}
                  <View style={{ flexDirection: 'row', gap: 5 }}>
                    {!!(album.lastReview ?? album.review) && <FontAwesome name="quote-left" size={10} color={colors.tint} />}
                    {album.isRelistened && <FontAwesome name="repeat" size={10} color={colors.tint} />}
                  </View>
                </View>
              </Pressable>
            ))
          )}
        </View>
      )}

      {/* ── Monthly + yearly stats ────────────────────────────────────────────── */}
      <View style={[s.statsRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={s.statBox}>
          <Text style={[s.statValue, { color: colors.text }]}>{monthlyCount}</Text>
          <Text style={[s.statLabel, { color: colors.subtext }]}>{MONTH_NAMES[viewMonth].slice(0, 3)}</Text>
        </View>
        <View style={[s.statDivider, { backgroundColor: colors.border }]} />
        <View style={s.statBox}>
          <Text style={[s.statValue, { color: colors.text }]}>{yearlyCount}</Text>
          <Text style={[s.statLabel, { color: colors.subtext }]}>{viewYear}</Text>
        </View>
      </View>

    </ScrollView>

      {/* ── Review modal ─────────────────────────────────────────────────────── */}
      {selectedAlbum && (
        <AlbumReviewModal
          album={selectedAlbum}
          username={profileUsername}
          isDark={isDark}
          colors={colors}
          onClose={() => setSelectedAlbum(null)}
          onAlbumPress={() => {
            const a = selectedAlbum;
            setSelectedAlbum(null);
            navigateToAlbum(router, a);
          }}
          onUsernamePress={viewingOther ? () => {
            setSelectedAlbum(null);
            router.push({ pathname: '/user-profile', params: { userId: viewingOther } });
          } : undefined}
        />
      )}
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content:   { paddingBottom: 48 },

  // Month nav
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  navBtn:     { padding: 4 },
  monthTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },

  // Day labels
  weekRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  weekLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Grid
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    rowGap: 2,
  },
  dayCell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    gap: 3,
  },
  dayCellSelected: { backgroundColor: '#D4A017' },
  dayNum:         { fontSize: 13, fontWeight: '500' },
  dayNumSelected: { color: '#fff', fontWeight: '700' },
  dot:         { width: 4, height: 4, borderRadius: 2, backgroundColor: '#D4A017' },
  dotSelected: { backgroundColor: '#fff' },

  // This Month section
  monthSection: {
    marginHorizontal: 20,
    marginTop: 24,
  },
  monthSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 14,
    letterSpacing: -0.2,
  },
  noMonthAlbums: { fontSize: 14 },
  monthRow: { gap: 12, paddingBottom: 4 },
  monthCard: { width: 100 },
  monthArt: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginBottom: 6,
  },
  monthArtInitial: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 24,
    fontWeight: '700',
  },
  monthCardTitle:  { fontSize: 12, fontWeight: '600' },
  monthCardArtist: { fontSize: 11, marginTop: 1 },

  // Day detail
  dayDetail: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  dayDetailTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  dayAlbumCount:  { fontSize: 12, marginBottom: 12 },
  noAlbums:       { fontSize: 14 },
  albumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  albumArt:     { width: 44, height: 44, borderRadius: 6 },
  albumInitial: { color: 'rgba(255,255,255,0.5)', fontSize: 16, fontWeight: '700' },
  albumInfo:    { flex: 1, gap: 3 },
  albumTitle:   { fontSize: 14, fontWeight: '600' },
  albumArtist:  { fontSize: 12 },

  // Stats
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 24,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 18,
  },
  statBox: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 26, fontWeight: '700' },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
});
