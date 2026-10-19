import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { VOLUME_EMPTY_DARK, VOLUME_EMPTY_LIGHT } from '@/constants/Colors';
import VolumeBars from '@/components/VolumeBars';
import { CompactRating } from '@/components/CompactRating';
import { AverageVolume } from '@/components/AverageVolume';
import { avatarColor } from '@/components/ReviewComments';
import { SongReviewModal } from '@/components/SongReviewModal';
import { SongReviewDetailModal, type SongReviewEntry } from '@/components/SongReviewDetailModal';
import { AddToSongPlaylistSheet } from '@/components/AddToSongPlaylistSheet';
import { SendAlbumSheet } from '@/components/SendAlbumSheet';
import { useAuth } from '@/context/AuthContext';
import { useSongReviews } from '@/context/SongReviewsContext';
import { handleOrName } from '@/lib/userHandle';
import { supabase } from '@/lib/supabase';
import {
  fetchCommunitySongReviews,
  fetchSongCommunityRatings,
  withOwnRating,
  type CommunitySongReview,
  type SongMeta,
  type SongRatingStats,
} from '@/lib/songReviews';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';
const ACCENT = '#D4A017';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// The Song page — the song equivalent of album-detail. Every song tap in the
// app lands here (lib/openSong.ts): your rating, the Listend average, and
// everyone's reviews, each of which opens on its own.
export default function SongDetailScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string; title?: string; artist?: string; artworkUrl?: string;
    albumId?: string; albumTitle?: string; releaseDate?: string; durationMs?: string;
    /** '1' opens your rating editor straight away (Edit on a review card). */
    edit?: string;
  }>();
  const { user } = useAuth();
  const { getSongReview } = useSongReviews();

  const [fetched, setFetched] = useState<{ albumId?: string; albumTitle?: string; artist?: string; releaseDate?: string } | null>(null);
  const [stats, setStats] = useState<SongRatingStats | undefined>(undefined);
  const [reviews, setReviews] = useState<CommunitySongReview[] | null>(null);
  // Everyone else who rated or reviewed it — the Friends row picks from this.
  const [others, setOthers] = useState<CommunitySongReview[]>([]);
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [reviewsFailed, setReviewsFailed] = useState(false);
  const [editing, setEditing] = useState(params.edit === '1');
  const [addingToPlaylist, setAddingToPlaylist] = useState(false);
  const [sending, setSending] = useState(false);
  const [openEntry, setOpenEntry] = useState<SongReviewEntry | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [me, setMe] = useState<{ username?: string; displayName?: string; avatarUrl?: string | null } | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from('profiles').select('username, display_name, avatar_url').eq('id', user.id).maybeSingle()
      .then(({ data }) => {
        if (data) setMe({ username: (data as any).username, displayName: (data as any).display_name, avatarUrl: (data as any).avatar_url });
      });
  }, [user?.id]);

  const song: SongMeta = {
    id:         params.id,
    title:      params.title ?? '',
    artist:     params.artist || fetched?.artist || '',
    artworkUrl: params.artworkUrl || undefined,
    albumId:    params.albumId || fetched?.albumId || undefined,
    albumTitle: params.albumTitle || fetched?.albumTitle || undefined,
    durationMs: params.durationMs ? Number(params.durationMs) : undefined,
  };
  const releaseDate = params.releaseDate || fetched?.releaseDate || '';
  // Your log of this song — this version or another one (single vs album).
  const mine = getSongReview({ id: params.id, title: params.title ?? '', artist: params.artist || fetched?.artist || '' });

  // Fill in album / artist / date the caller didn't have.
  useEffect(() => {
    if (!params.id || (params.albumId && params.albumTitle && params.artist && params.releaseDate)) return;
    let cancelled = false;
    fetch(`${API_URL}/catalog/track/${params.id}`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (cancelled || !data) return;
        setFetched({ albumId: data.albumId, albumTitle: data.albumTitle, artist: data.artist, releaseDate: data.releaseDate });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [params.id]);

  // The artist's id via the song's album, so tapping the name opens this
  // artist rather than whichever same-named one search ranks first.
  const [artistId, setArtistId] = useState<string | null>(null);
  const songAlbumId = params.albumId || fetched?.albumId || '';
  const songArtist  = params.artist || fetched?.artist || '';
  useEffect(() => {
    setArtistId(null);
    if (!songAlbumId) return;
    let cancelled = false;
    fetch(`${API_URL}/catalog/album/${encodeURIComponent(songAlbumId)}/artist?name=${encodeURIComponent(songArtist)}`)
      .then(r => (r.ok ? r.json() : null))
      .then((a: { id?: string } | null) => { if (!cancelled && a?.id) setArtistId(a.id); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [songAlbumId, songArtist]);

  // Ratings + reviews; re-fetched after you save or remove your own.
  useEffect(() => {
    if (!params.id) return;
    let cancelled = false;
    setReviewsFailed(false);
    const ref = { id: params.id, title: song.title, artist: song.artist };
    fetchSongCommunityRatings([ref]).then(m => { if (!cancelled && m) setStats(m.get(params.id)); });
    fetchCommunitySongReviews(ref, user?.id).then(list => {
      if (cancelled) return;
      if (list) { setReviews(list.filter(r => !!r.review)); setOthers(list); }
      else setReviewsFailed(true);
    });
    return () => { cancelled = true; };
  }, [params.id, song.artist, refreshTick, user?.id]);

  // Friends = mutual follows, same as the album page's Friends row.
  useEffect(() => {
    if (!user?.id) return;
    Promise.all([
      supabase.from('follows').select('following_id').eq('follower_id', user.id),
      supabase.from('follows').select('follower_id').eq('following_id', user.id),
    ]).then(([{ data: outRows }, { data: inRows }]) => {
      if (!outRows?.length || !inRows?.length) return;
      const inSet = new Set((inRows as any[]).map(r => r.follower_id as string));
      setFriendIds(new Set(
        (outRows as any[]).filter(r => inSet.has(r.following_id)).map(r => r.following_id as string)
      ));
    });
  }, [user?.id]);

  const community = withOwnRating(stats, mine?.rating);
  const friends   = others.filter(r => friendIds.has(r.userId));
  const inactive  = isDark ? VOLUME_EMPTY_DARK : VOLUME_EMPTY_LIGHT;
  const sectionBg = isDark ? '#1c1410' : '#f5f5f5';
  const border    = isDark ? '#2a1e14' : '#e8e8e8';
  const muted     = isDark ? '#7a5535' : '#a07850';

  const year = releaseDate.slice(0, 4);

  const ownEntry: SongReviewEntry | null = useMemo(() => mine && user ? {
    userId: user.id, username: me?.username, displayName: me?.displayName, avatarUrl: me?.avatarUrl,
    rating: mine.rating, review: mine.review, isFavorite: mine.isFavorite, listenedAt: mine.listenedAt,
  } : null, [mine, user?.id, me]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{
        title: 'Song',
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        // Same pair as album-detail: DM it to a friend, add it to a playlist.
        headerRight: () => (
          <View style={s.headerBtnRow}>
            <Pressable onPress={() => setSending(true)} hitSlop={8} style={({ pressed }) => [s.headerBtn, { opacity: pressed ? 0.5 : 1 }]}>
              <FontAwesome name="paper-plane-o" size={18} color={ACCENT} />
            </Pressable>
            <Pressable onPress={() => setAddingToPlaylist(true)} hitSlop={8} style={({ pressed }) => [s.headerBtn, { opacity: pressed ? 0.5 : 1 }]}>
              <FontAwesome name="list" size={18} color={ACCENT} />
            </Pressable>
          </View>
        ),
      }} />
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
        {/* ── Song ─────────────────────────────────────────────────────── */}
        {song.artworkUrl ? (
          <ExpoImage source={{ uri: song.artworkUrl }} style={s.artwork} contentFit="cover" cachePolicy="disk" transition={200} />
        ) : (
          <View style={[s.artwork, { backgroundColor: sectionBg, alignItems: 'center', justifyContent: 'center' }]}>
            <FontAwesome name="music" size={48} color={muted} />
          </View>
        )}
        <Text style={[s.title, { color: colors.text }]}>{song.title}</Text>
        <Pressable
          disabled={!song.artist}
          onPress={() => router.push({ pathname: '/artist-detail', params: artistId ? { id: artistId, name: song.artist } : { name: song.artist } })}>
          <Text style={s.artist}>{song.artist}{year ? ` · ${year}` : ''}</Text>
        </Pressable>
        {song.albumId && song.albumTitle ? (
          <Pressable
            style={({ pressed }) => [s.albumCard, { backgroundColor: sectionBg, borderColor: border, opacity: pressed ? 0.7 : 1 }]}
            onPress={() => router.push({
              pathname: '/album-detail',
              params: { id: song.albumId!, title: song.albumTitle!, artist: song.artist, year, artworkUrl: song.artworkUrl ?? '' },
            } as any)}>
            {song.artworkUrl ? (
              <ExpoImage source={{ uri: song.artworkUrl }} style={s.albumCardArt} contentFit="cover" cachePolicy="disk" />
            ) : (
              <View style={[s.albumCardArt, { backgroundColor: border }]} />
            )}
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[s.albumCardLabel, { color: muted }]}>FROM THE ALBUM</Text>
              <Text style={[s.albumCardTitle, { color: colors.text }]} numberOfLines={1}>{song.albumTitle}</Text>
              <Text style={[s.albumCardSub, { color: colors.subtext }]} numberOfLines={1}>
                {song.artist}{year ? ` · ${year}` : ''}
              </Text>
            </View>
            <FontAwesome name="chevron-right" size={13} color={muted} />
          </Pressable>
        ) : null}

        {/* ── You ──────────────────────────────────────────────────────── */}
        {mine ? (
          <View style={s.youRow}>
            <View style={s.youLeft}>
              <View style={s.listendBadge}>
                <FontAwesome name="headphones" size={12} color="#fff" />
                <Text style={s.listendBadgeText}>Listend</Text>
              </View>
              {mine.isFavorite && <Ionicons name="trophy" size={15} color={ACCENT} />}
            </View>
            <View style={s.youRight}>
              {mine.rating > 0 && (
                <>
                  <FontAwesome name="volume-up" size={14} color={ACCENT} />
                  <VolumeBars rating={mine.rating} activeColor={ACCENT} inactiveColor={inactive} heights={[4, 5, 7, 8, 10, 11, 13, 14, 16, 18]} barWidth={3} gap={1.5} />
                  <Text style={s.youNum}>{mine.rating}</Text>
                </>
              )}
              <Pressable
                onPress={() => setEditing(true)}
                hitSlop={10}
                style={({ pressed }) => [s.editBtn, { opacity: pressed ? 0.6 : 1 }]}>
                <FontAwesome name="pencil" size={11} color={ACCENT} />
                <Text style={s.editBtnText}>Edit</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={() => setEditing(true)}
            style={({ pressed }) => [s.rateBtn, { opacity: pressed ? 0.85 : 1 }]}>
            <FontAwesome name="headphones" size={16} color="#fff" />
            <Text style={s.rateBtnText}>Rate & Review</Text>
          </Pressable>
        )}
        {mine?.review ? (
          <Pressable
            onPress={() => ownEntry && setOpenEntry(ownEntry)}
            style={({ pressed }) => [s.yourReview, { borderColor: border, opacity: pressed ? 0.7 : 1 }]}>
            <Text style={[s.yourReviewLabel, { color: muted }]}>YOUR REVIEW</Text>
            <Text style={[s.yourReviewText, { color: colors.text }]} numberOfLines={4}>"{mine.review}"</Text>
          </Pressable>
        ) : null}

        {/* ── Ratings ──────────────────────────────────────────────────── */}
        <View style={[s.section, { backgroundColor: sectionBg, borderColor: border }]}>
          <Text style={[s.sectionLabel, { color: colors.subtext }]}>Ratings</Text>
          {community?.revealed ? (
            <View style={s.ratingsRow}>
              <View>
                <Text style={[s.ratingsAvg, { color: colors.text }]}>{community.avg.toFixed(1)}</Text>
                <Text style={[s.ratingsCount, { color: colors.subtext }]}>{community.count} ratings</Text>
              </View>
              <AverageVolume avg={community.avg} isDark={isDark} size="lg" showNumber={false} />
            </View>
          ) : community ? (
            <Text style={[s.emptyText, { color: muted, lineHeight: 19 }]}>
              Ratings are revealed once more listeners have rated this song.
            </Text>
          ) : (
            <Text style={[s.emptyText, { color: muted }]}>No ratings yet — be the first.</Text>
          )}
        </View>

        {/* ── Reviews ──────────────────────────────────────────────────── */}
        <View style={[s.section, { backgroundColor: sectionBg, borderColor: border }]}>
          <Text style={[s.sectionLabel, { color: colors.subtext }]}>Reviews</Text>
          {reviews === null && !reviewsFailed ? (
            <ActivityIndicator color={ACCENT} style={{ marginVertical: 12 }} />
          ) : reviewsFailed ? (
            <Text style={[s.emptyText, { color: muted }]}>Couldn't load reviews. Try again in a moment.</Text>
          ) : reviews!.length === 0 ? (
            <Text style={[s.emptyText, { color: muted }]}>No reviews yet.</Text>
          ) : (
            reviews!.map((r, i) => {
              const handle = handleOrName(r.username, r.displayName, r.userId);
              return (
                <Pressable
                  key={r.userId}
                  onPress={() => setOpenEntry(r)}
                  style={({ pressed }) => [s.reviewCard, i > 0 && { borderTopColor: border, borderTopWidth: StyleSheet.hairlineWidth }, { opacity: pressed ? 0.7 : 1 }]}>
                  <View style={s.reviewHead}>
                    {r.avatarUrl ? (
                      <ExpoImage source={{ uri: r.avatarUrl }} style={s.avatar} contentFit="cover" cachePolicy="disk" />
                    ) : (
                      <View style={[s.avatar, { backgroundColor: avatarColor(r.username || r.userId), alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={s.avatarLetter}>{handle.replace(/^@/, '').charAt(0).toUpperCase() || '?'}</Text>
                      </View>
                    )}
                    <Text style={s.reviewHandle} numberOfLines={1}>{handle}</Text>
                    {r.isFavorite && <Ionicons name="trophy" size={12} color={ACCENT} />}
                    <View style={{ flex: 1 }} />
                    {r.rating > 0 && (
                      <CompactRating value={r.rating} />
                    )}
                  </View>
                  <Text style={[s.reviewText, { color: colors.text }]} numberOfLines={4}>"{r.review}"</Text>
                  <Text style={[s.reviewDate, { color: muted }]}>{formatDate(r.listenedAt)}</Text>
                </Pressable>
              );
            })
          )}
        </View>

        {/* ── Friends ──────────────────────────────────────────────────── */}
        {friends.length > 0 && (
          <View style={[s.section, { backgroundColor: sectionBg, borderColor: border }]}>
            <Text style={[s.sectionLabel, { color: colors.subtext }]}>Friends</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
              <View style={{ flexDirection: 'row', gap: 16, paddingHorizontal: 4, paddingBottom: 2 }}>
                {friends.map(f => {
                  const handle = handleOrName(f.username, f.displayName, f.userId);
                  return (
                    <Pressable
                      key={f.userId}
                      onPress={() => setOpenEntry(f)}
                      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, alignItems: 'center', gap: 6 })}>
                      <View style={{ position: 'relative' }}>
                        <View style={[s.friendAvatar, { backgroundColor: avatarColor(f.username || f.userId) }]}>
                          {f.avatarUrl
                            ? <ExpoImage source={{ uri: f.avatarUrl }} style={[StyleSheet.absoluteFill, { borderRadius: 24 }]} contentFit="cover" cachePolicy="disk" />
                            : <Text style={s.friendAvatarText}>{(f.username || '?').slice(0, 2).toUpperCase()}</Text>}
                        </View>
                        {f.rating > 0 && (
                          <View style={s.friendRatingBadge}>
                            <Text style={s.friendRatingText}>{f.rating}</Text>
                          </View>
                        )}
                        {!!f.review && (
                          <View style={s.friendPenBadge}>
                            <FontAwesome name="quote-left" size={7} color="#fff" />
                          </View>
                        )}
                      </View>
                      <Text style={[s.friendUsername, { color: colors.subtext }]} numberOfLines={1}>{handle}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        )}
      </ScrollView>

      <SongReviewModal
        song={editing ? song : null}
        isDark={isDark}
        colors={colors}
        onClose={() => { setEditing(false); setRefreshTick(t => t + 1); }}
      />
      <SendAlbumSheet
        visible={sending}
        song={song}
        isDark={isDark}
        colors={{ text: colors.text, subtext: colors.subtext, border: colors.border, tint: colors.tint, surface: colors.surface }}
        onClose={() => setSending(false)}
      />
      <AddToSongPlaylistSheet
        song={song}
        visible={addingToPlaylist}
        onClose={() => setAddingToPlaylist(false)}
        isDark={isDark}
        colors={{ text: colors.text, subtext: colors.subtext, border: colors.border, tint: colors.tint }}
      />
      <SongReviewDetailModal
        song={song}
        entry={openEntry}
        isDark={isDark}
        colors={colors}
        onClose={() => setOpenEntry(null)}
        onUserPress={(userId) => { setOpenEntry(null); router.push({ pathname: '/user-profile', params: { userId } }); }}
        onEdit={() => { setOpenEntry(null); setEditing(true); }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { alignItems: 'center', paddingTop: 28, paddingHorizontal: 20, paddingBottom: 48 },
  artwork: { width: 200, height: 200, borderRadius: 10 },
  title: { marginTop: 18, fontSize: 22, fontWeight: '800', textAlign: 'center', letterSpacing: -0.3 },
  artist: { marginTop: 4, fontSize: 15, fontWeight: '600', color: ACCENT, textAlign: 'center' },
  headerBtnRow: { flexDirection: 'row', alignItems: 'center' },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  albumCard: { marginTop: 18, width: '100%', flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  albumCardArt: { width: 52, height: 52, borderRadius: 6 },
  albumCardLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  albumCardTitle: { fontSize: 16, fontWeight: '700' },
  albumCardSub: { fontSize: 12 },

  youRow: { marginTop: 22, width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  youLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  youRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  listendBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: ACCENT, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  listendBadgeText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  youNum: { color: ACCENT, fontSize: 15, fontWeight: '800', marginRight: 6 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: ACCENT, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  editBtnText: { color: ACCENT, fontSize: 13, fontWeight: '600' },
  rateBtn: { marginTop: 22, width: '100%', height: 50, borderRadius: 12, backgroundColor: ACCENT, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  rateBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  yourReview: { marginTop: 14, width: '100%', borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14, gap: 6 },
  yourReviewLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  yourReviewText: { fontSize: 14, lineHeight: 20, fontStyle: 'italic' },

  section: { marginTop: 18, width: '100%', borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  sectionLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 },
  ratingsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 16 },
  ratingsAvg: { fontSize: 44, fontWeight: '800', lineHeight: 48 },
  ratingsCount: { fontSize: 11, marginTop: 2 },
  friendAvatar:       { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  friendAvatarText:   { color: '#fff', fontSize: 15, fontWeight: '700' },
  friendUsername:     { fontSize: 11, maxWidth: 56, textAlign: 'center' },
  friendRatingBadge:  { position: 'absolute', bottom: -2, left: -4, backgroundColor: ACCENT, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1 },
  friendRatingText:   { color: '#fff', fontSize: 9, fontWeight: '700' },
  friendPenBadge:     { position: 'absolute', bottom: -2, left: 16, width: 16, height: 16, borderRadius: 8, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 14 },

  reviewCard: { paddingVertical: 12, gap: 6 },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 28, height: 28, borderRadius: 14 },
  avatarLetter: { color: '#fff', fontSize: 12, fontWeight: '700' },
  reviewHandle: { color: ACCENT, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  reviewText: { fontSize: 14, lineHeight: 20, fontStyle: 'italic' },
  reviewDate: { fontSize: 12 },
});
