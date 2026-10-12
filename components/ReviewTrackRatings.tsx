import { View, Text, Pressable, StyleSheet, LayoutAnimation } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Ionicons from '@expo/vector-icons/Ionicons';
import { CompactRating } from '@/components/CompactRating';
import { useAuth } from '@/context/AuthContext';
import { useSongReviews } from '@/context/SongReviewsContext';
import { fetchUserAlbumSongReviews, songsMatchingAlbum, type SongReview } from '@/lib/songReviews';
import { supabase } from '@/lib/supabase';
import { SongReviewDetailModal, type SongReviewAuthor } from '@/components/SongReviewDetailModal';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';
const ACCENT = '#D4A017';
const PREVIEW_COUNT = 5;

type TrackPos = { index: number; number: number };

// Tracklists per album id, shared across review modals for the session.
const tracklistCache = new Map<string, Promise<Map<string, TrackPos> | null>>();

function fetchTrackPositions(albumId: string): Promise<Map<string, TrackPos> | null> {
  let p = tracklistCache.get(albumId);
  if (!p) {
    p = fetch(`${API_URL}/catalog/album/${albumId}/tracks`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: { id: string; number: number }[]) =>
        new Map(data.map((t, index) => [t.id, { index, number: t.number }])))
      .catch(() => { tracklistCache.delete(albumId); return null; });
    tracklistCache.set(albumId, p);
  }
  return p;
}

/** The album id most of these songs were logged under (falls back to the review's). */
function songsAlbumId(songs: SongReview[], fallback?: string): string | undefined {
  const counts = new Map<string, number>();
  for (const s of songs) if (s.albumId) counts.set(s.albumId, (counts.get(s.albumId) ?? 0) + 1);
  let best = fallback; let bestN = 0;
  for (const [id, n] of counts) if (n > bestN) { best = id; bestN = n; }
  return best;
}

/**
 * "Track ratings" block shown inside a full album review: the reviewer's
 * ratings for songs on that album in tracklist order, with their favourite
 * called out on top. Renders nothing when they haven't rated any — so review
 * cards without song ratings look as before.
 */
export function ReviewTrackRatings({ userId, album, isDark, colors }: {
  userId: string | null | undefined;
  album:  { id?: string; title: string; artist: string };
  isDark: boolean;
  colors: { text: string; subtext: string; background?: string };
}) {
  const { user } = useAuth();
  const { songReviews, songsLoaded } = useSongReviews();
  const isOwn = !!userId && userId === user?.id;
  const [fetched, setFetched] = useState<SongReview[] | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [positions, setPositions] = useState<Map<string, TrackPos> | null>(null);
  const [openSong, setOpenSong] = useState<SongReview | null>(null);
  const [author, setAuthor] = useState<SongReviewAuthor | null>(null);

  // The reviewer's name/avatar, for the single-review page.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase.from('profiles').select('username, display_name, avatar_url').eq('id', userId).maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setAuthor({ userId, username: (data as any).username, displayName: (data as any).display_name, avatarUrl: (data as any).avatar_url });
      });
    return () => { cancelled = true; };
  }, [userId]);

  // Your own reviews come from context so edits show up straight away.
  useEffect(() => {
    if (!userId || isOwn) return;
    let cancelled = false;
    setFetched(null);
    fetchUserAlbumSongReviews(userId, album).then(list => { if (!cancelled && list) setFetched(list); });
    return () => { cancelled = true; };
  }, [userId, isOwn, album.id, album.title, album.artist]);

  const matched = useMemo(
    () => isOwn ? (songsLoaded ? songsMatchingAlbum(songReviews, album) : []) : (fetched ?? []),
    [isOwn, songsLoaded, songReviews, fetched, album.id, album.title, album.artist],
  );

  // Tracklist order comes from the album the songs were logged under.
  const tracklistId = songsAlbumId(matched, album.id);
  useEffect(() => {
    setPositions(null);
    if (!tracklistId || matched.length === 0) return;
    let cancelled = false;
    fetchTrackPositions(tracklistId).then(m => { if (!cancelled) setPositions(m); });
    return () => { cancelled = true; };
  }, [tracklistId, matched.length > 0]);

  // Album order; anything not on that tracklist (another edition) goes last.
  const songs = useMemo(() => [...matched].sort((a, b) => {
    const pa = positions?.get(a.songId)?.index ?? Infinity;
    const pb = positions?.get(b.songId)?.index ?? Infinity;
    return pa - pb || a.title.localeCompare(b.title);
  }), [matched, positions]);

  if (songs.length === 0) return null;

  const favorite = songs.find(s => s.isFavorite);

  const border   = isDark ? '#2a1e14' : '#ececec';
  const shown    = expanded ? songs : songs.slice(0, PREVIEW_COUNT);

  return (
    <View style={[s.wrap, { borderTopColor: border }]}>
      <Text style={[s.label, { color: colors.subtext }]}>TRACK RATINGS</Text>
      {favorite && (
        <View style={s.favLine}>
          <Ionicons name="trophy" size={13} color={ACCENT} />
          <Text style={[s.favLabel, { color: colors.subtext }]}>Favourite track</Text>
          <Text style={[s.favTitle, { color: colors.text }]} numberOfLines={1}>{favorite.title}</Text>
        </View>
      )}
      {shown.map(song => (
        <Pressable
          key={song.songId}
          onPress={() => setOpenSong(song)}
          style={({ pressed }) => [s.row, { borderBottomColor: border, opacity: pressed ? 0.6 : 1 }]}>
          <View style={s.head}>
            <Text style={[s.num, { color: colors.subtext }]}>{positions?.get(song.songId)?.number ?? '·'}</Text>
            <Text style={[s.title, { color: colors.text, fontWeight: song.isFavorite ? '700' : '500' }]} numberOfLines={1}>
              {song.title}
            </Text>
            {song.isFavorite && <Ionicons name="trophy" size={12} color={ACCENT} />}
            {song.rating > 0 ? (
              <CompactRating value={song.rating} />
            ) : (
              <Text style={[s.listened, { color: colors.subtext }]}>Listened</Text>
            )}
          </View>
          {!!song.review && (
            <Text style={[s.review, { color: colors.subtext }]} numberOfLines={2}>"{song.review}"</Text>
          )}
        </Pressable>
      ))}
      {songs.length > PREVIEW_COUNT && (
        <Pressable
          hitSlop={8}
          onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setExpanded(v => !v);
          }}
          style={({ pressed }) => [s.more, { opacity: pressed ? 0.6 : 1 }]}>
          <Text style={s.moreText}>{expanded ? 'Show less' : `Show all ${songs.length} tracks`}</Text>
        </Pressable>
      )}
      {openSong && userId && (
        <SongReviewDetailModal
          song={{
            id: openSong.songId, title: openSong.title, artist: openSong.artist,
            albumId: openSong.albumId, albumTitle: openSong.albumTitle, artworkUrl: openSong.artworkUrl,
          }}
          entry={{
            ...(author ?? { userId }),
            rating: openSong.rating,
            review: openSong.review,
            isFavorite: openSong.isFavorite,
            listenedAt: openSong.listenedAt,
          }}
          isDark={isDark}
          // Full theme when the caller passed one, otherwise the default palette.
          colors={colors.background ? colors : undefined}
          onClose={() => setOpenSong(null)}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginTop: 18, marginBottom: 14, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 4 },
  row: { paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, gap: 4 },
  favLine: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  favLabel: { fontSize: 12 },
  favTitle: { flex: 1, fontSize: 14, fontWeight: '700' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  num: { width: 18, fontSize: 12, textAlign: 'right' },
  title: { flex: 1, fontSize: 14 },
  listened: { fontSize: 11 },
  review: { fontSize: 13, lineHeight: 18, fontStyle: 'italic', marginLeft: 26 },
  more: { alignSelf: 'flex-start', paddingTop: 10 },
  moreText: { color: ACCENT, fontSize: 13, fontWeight: '600' },
});
