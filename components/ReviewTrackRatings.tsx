import { View, Text, Pressable, StyleSheet, LayoutAnimation } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Ionicons from '@expo/vector-icons/Ionicons';
import { VOLUME_EMPTY_DARK, VOLUME_EMPTY_LIGHT } from '@/constants/Colors';
import VolumeBars from '@/components/VolumeBars';
import { useAuth } from '@/context/AuthContext';
import { useSongReviews } from '@/context/SongReviewsContext';
import { fetchUserAlbumSongReviews, songsMatchingAlbum, type SongReview } from '@/lib/songReviews';

const ACCENT = '#D4A017';
const PREVIEW_COUNT = 5;

/**
 * "Track ratings" block shown inside a full album review: the reviewer's
 * ratings for songs on that album, favourite first. Renders nothing when they
 * haven't rated any — so review cards without song ratings look as before.
 */
export function ReviewTrackRatings({ userId, album, isDark, colors }: {
  userId: string | null | undefined;
  album:  { id?: string; title: string; artist: string };
  isDark: boolean;
  colors: { text: string; subtext: string };
}) {
  const { user } = useAuth();
  const { songReviews, songsLoaded } = useSongReviews();
  const isOwn = !!userId && userId === user?.id;
  const [fetched, setFetched] = useState<SongReview[] | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Your own reviews come from context so edits show up straight away.
  useEffect(() => {
    if (!userId || isOwn) return;
    let cancelled = false;
    setFetched(null);
    fetchUserAlbumSongReviews(userId, album).then(list => { if (!cancelled && list) setFetched(list); });
    return () => { cancelled = true; };
  }, [userId, isOwn, album.id, album.title, album.artist]);

  const songs = useMemo(() => {
    const list = isOwn ? (songsLoaded ? songsMatchingAlbum(songReviews, album) : []) : (fetched ?? []);
    return [...list].sort((a, b) =>
      Number(b.isFavorite) - Number(a.isFavorite) || b.rating - a.rating || a.title.localeCompare(b.title));
  }, [isOwn, songsLoaded, songReviews, fetched, album.id, album.title, album.artist]);

  if (songs.length === 0) return null;

  const inactive = isDark ? VOLUME_EMPTY_DARK : VOLUME_EMPTY_LIGHT;
  const border   = isDark ? '#2a1e14' : '#ececec';
  const shown    = expanded ? songs : songs.slice(0, PREVIEW_COUNT);

  return (
    <View style={[s.wrap, { borderTopColor: border }]}>
      <Text style={[s.label, { color: colors.subtext }]}>TRACK RATINGS</Text>
      {shown.map(song => (
        <View key={song.songId} style={[s.row, { borderBottomColor: border }]}>
          <View style={s.head}>
            {song.isFavorite && <Ionicons name="trophy" size={12} color={ACCENT} />}
            <Text style={[s.title, { color: colors.text, fontWeight: song.isFavorite ? '700' : '500' }]} numberOfLines={1}>
              {song.title}
            </Text>
            {song.rating > 0 ? (
              <View style={s.rating}>
                <FontAwesome name="volume-up" size={10} color={ACCENT} />
                <VolumeBars rating={song.rating} activeColor={ACCENT} inactiveColor={inactive} />
                <Text style={s.ratingNum}>{song.rating}</Text>
              </View>
            ) : (
              <Text style={[s.listened, { color: colors.subtext }]}>Listened</Text>
            )}
          </View>
          {!!song.review && (
            <Text style={[s.review, { color: colors.subtext }]}>"{song.review}"</Text>
          )}
        </View>
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
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginTop: 18, marginBottom: 14, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 4 },
  row: { paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, gap: 4 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flex: 1, fontSize: 14 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingNum: { color: ACCENT, fontSize: 11, fontWeight: '700', minWidth: 14, textAlign: 'right' },
  listened: { fontSize: 11 },
  review: { fontSize: 13, lineHeight: 18, fontStyle: 'italic' },
  more: { alignSelf: 'flex-start', paddingTop: 10 },
  moreText: { color: ACCENT, fontSize: 13, fontWeight: '600' },
});
