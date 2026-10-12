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
  colors: { text: string; subtext: string; background?: string; tint?: string; border?: string };
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

  // The favourite lives only in its card (with its review); the list is
  // everything else, so a favourite-only review is just the card.
  const favorite = songs.find(s => s.isFavorite);
  const others   = favorite ? songs.filter(s => s !== favorite) : songs;
  const favNum   = favorite ? positions?.get(favorite.songId)?.number : undefined;

  const border   = colors.border ?? (isDark ? '#2a1e14' : '#ececec');
  // Pro theme accent (every theme accent is #RRGGBB, so alpha can be appended).
  const accent   = colors.tint ?? ACCENT;
  const shown    = expanded ? others : others.slice(0, PREVIEW_COUNT);

  return (
    <View style={[s.wrap, { borderTopColor: border }]}>
      {favorite && (
        <Pressable
          onPress={() => setOpenSong(favorite)}
          style={({ pressed }) => [s.favCard, { backgroundColor: `${accent}14`, borderColor: `${accent}33`, opacity: pressed ? 0.7 : 1 }]}>
          <View style={s.favHead}>
            <View style={[s.favIcon, { backgroundColor: `${accent}26` }]}>
              <Ionicons name="trophy" size={14} color={accent} />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={[s.favLabel, { color: accent }]}>
                FAVOURITE TRACK{favNum ? <Text style={{ color: colors.subtext }}>{`  ·  TRACK ${favNum}`}</Text> : null}
              </Text>
              <Text style={[s.favTitle, { color: colors.text }]} numberOfLines={1}>{favorite.title}</Text>
            </View>
            {favorite.rating > 0 && <CompactRating value={favorite.rating} color={accent} size={13} />}
          </View>
          {!!favorite.review && (
            <Text style={[s.favReview, { color: colors.subtext }]} numberOfLines={3}>"{favorite.review}"</Text>
          )}
        </Pressable>
      )}
      {others.length > 0 && (
        <Text style={[s.label, { color: colors.subtext, marginTop: favorite ? 14 : 0 }]}>TRACK RATINGS</Text>
      )}
      {shown.map(song => (
        <Pressable
          key={song.songId}
          onPress={() => setOpenSong(song)}
          style={({ pressed }) => [s.row, { borderBottomColor: border, opacity: pressed ? 0.6 : 1 }]}>
          <View style={s.head}>
            <Text style={[s.num, { color: colors.subtext }]}>{positions?.get(song.songId)?.number ?? '·'}</Text>
            <Text style={[s.title, { color: colors.text }]} numberOfLines={1}>
              {song.title}
            </Text>
            {song.rating > 0 ? (
              <CompactRating value={song.rating} color={accent} />
            ) : (
              <Text style={[s.listened, { color: colors.subtext }]}>Listened</Text>
            )}
          </View>
          {!!song.review && (
            <Text style={[s.review, { color: colors.subtext }]} numberOfLines={2}>"{song.review}"</Text>
          )}
        </Pressable>
      ))}
      {others.length > PREVIEW_COUNT && (
        <Pressable
          hitSlop={8}
          onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setExpanded(v => !v);
          }}
          style={({ pressed }) => [s.more, { opacity: pressed ? 0.6 : 1 }]}>
          <Text style={[s.moreText, { color: accent }]}>{expanded ? 'Show less' : `Show all ${others.length} tracks`}</Text>
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
  favCard: { padding: 10, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, gap: 6 },
  favHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  favReview: { fontSize: 13, lineHeight: 18, fontStyle: 'italic', marginLeft: 40 },
  favIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  favLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  favTitle: { fontSize: 14, fontWeight: '600' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  num: { width: 18, fontSize: 12, textAlign: 'right' },
  title: { flex: 1, fontSize: 14, fontWeight: '500' },
  listened: { fontSize: 11 },
  review: { fontSize: 13, lineHeight: 18, fontStyle: 'italic', marginLeft: 26 },
  more: { alignSelf: 'flex-start', paddingTop: 10 },
  moreText: { fontSize: 13, fontWeight: '600' },
});
