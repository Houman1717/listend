import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, LayoutAnimation } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { LoggedAlbum } from '@/context/AlbumsContext';
import { useSongReviews } from '@/context/SongReviewsContext';
import { effectiveRating } from '@/lib/effectiveRating';
import { fetchUserSongReviews, type SongReview } from '@/lib/songReviews';

// Songs are the secondary log, so the card stays out of the way: hidden until
// there's enough to say anything, and collapsed to a summary strip by default.
const MIN_SONG_LOGS = 10;
const TOP_ARTISTS   = 5;
const STANDOUTS     = 5;
// Favourites are one per album, so a big library has hundreds — show the latest.
const FAVOURITES    = 20;
// A track only counts as a standout when it beats its album by this much.
const STANDOUT_MIN_GAP = 2;

const GROW_CLR = '#a8c44a';
const FADE_CLR = '#B85040';

type CardColors = { text: string; subtext: string; textMuted: string; tint: string; border: string; surface: string };

const norm = (s: string | undefined) => (s ?? '').trim().toLowerCase();

const fmtDelta = (d: number) => `${d > 0 ? '+' : ''}${d.toFixed(1)}`;

export function SongStatsCard({
  userId,
  albums,
  colors,
  onSongPress,
}: {
  /** Whose songs: null for your own (from context), else fetched once. */
  userId: string | null;
  /** The same user's album library, for "tracks vs their albums". */
  albums: LoggedAlbum[];
  colors: CardColors;
  onSongPress: (song: SongReview) => void;
}) {
  const { songReviews } = useSongReviews();
  const [otherSongs, setOtherSongs] = useState<SongReview[] | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchUserSongReviews(userId).then(list => { if (!cancelled && list) setOtherSongs(list); });
    return () => { cancelled = true; };
  }, [userId]);

  const songs = userId ? (otherSongs ?? []) : songReviews;

  const stats = useMemo(() => {
    const rated = songs.filter(s => s.rating > 0);
    const avg = rated.length > 0 ? rated.reduce((n, s) => n + s.rating, 0) / rated.length : 0;
    const favourites = songs.filter(s => s.isFavorite);
    const latestFavourites = [...favourites].sort((a, b) => b.listenedAt.localeCompare(a.listenedAt)).slice(0, FAVOURITES);
    const written = songs.filter(s => !!s.review).length;

    const distribution = Array.from({ length: 10 }, (_, i) => rated.filter(s => s.rating === i + 1).length);

    // Rated albums by id and by title+artist — same matching as songsMatchingAlbum,
    // since logging can canonicalise the album id the songs were saved under.
    const albumById = new Map<string, LoggedAlbum>();
    const albumByName = new Map<string, LoggedAlbum>();
    for (const a of albums) {
      if (effectiveRating(a) <= 0) continue;
      albumById.set(a.id, a);
      albumByName.set(`${norm(a.title)}|${norm(a.artist)}`, a);
    }
    const albumFor = (s: SongReview) =>
      (s.albumId ? albumById.get(s.albumId) : undefined) ??
      (s.albumTitle ? albumByName.get(`${norm(s.albumTitle)}|${norm(s.artist)}`) : undefined);

    // Each album counts once (its tracks' average vs its rating), so one album
    // with every track rated doesn't outweigh the rest.
    const tracksByAlbum = new Map<string, { album: LoggedAlbum; ratings: number[] }>();
    const standouts: { song: SongReview; albumRating: number; gap: number }[] = [];
    for (const s of rated) {
      const album = albumFor(s);
      if (!album) continue;
      const entry = tracksByAlbum.get(album.id);
      if (entry) entry.ratings.push(s.rating); else tracksByAlbum.set(album.id, { album, ratings: [s.rating] });
      const gap = s.rating - effectiveRating(album);
      if (gap >= STANDOUT_MIN_GAP) standouts.push({ song: s, albumRating: effectiveRating(album), gap });
    }
    const albumGaps = [...tracksByAlbum.values()].map(({ album, ratings }) =>
      ratings.reduce((n, r) => n + r, 0) / ratings.length - effectiveRating(album));
    const vsAlbums = albumGaps.length > 0 ? albumGaps.reduce((n, d) => n + d, 0) / albumGaps.length : null;
    standouts.sort((a, b) => b.gap - a.gap || b.song.rating - a.song.rating);

    const byArtist = new Map<string, { artist: string; count: number; sum: number; rated: number }>();
    for (const s of songs) {
      const k = norm(s.artist);
      if (!k) continue;
      const e = byArtist.get(k) ?? { artist: s.artist, count: 0, sum: 0, rated: 0 };
      e.count += 1;
      if (s.rating > 0) { e.sum += s.rating; e.rated += 1; }
      byArtist.set(k, e);
    }
    const topArtists = [...byArtist.values()]
      .sort((a, b) => b.count - a.count || (b.rated ? b.sum / b.rated : 0) - (a.rated ? a.sum / a.rated : 0))
      .slice(0, TOP_ARTISTS);

    return {
      ratedCount: rated.length, avg, favourites, latestFavourites, written, distribution,
      vsAlbums, vsAlbumsCount: albumGaps.length, standouts: standouts.slice(0, STANDOUTS), topArtists,
    };
  }, [songs, albums]);

  if (songs.length < MIN_SONG_LOGS) return null;

  const theirs = userId ? 'Their' : 'Your';
  const maxCount = Math.max(...stats.distribution, 1);

  function toggle() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(v => !v);
  }

  return (
    <View style={[st.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Pressable onPress={toggle} hitSlop={8} style={({ pressed }) => [st.titleRow, { opacity: pressed ? 0.7 : 1 }]}>
        <Text style={[st.title, { color: colors.textMuted }]}>SONGS</Text>
        <View style={st.titleRight}>
          <Text style={[st.titleValue, { color: colors.text }]}>{songs.length} logged</Text>
          <FontAwesome name={expanded ? 'chevron-up' : 'chevron-down'} size={12} color={colors.subtext} />
        </View>
      </Pressable>

      {/* Summary strip — always visible */}
      <View style={[st.strip, { borderColor: colors.border }]}>
        <View style={st.cell}>
          <Text style={[st.val, { color: colors.text }]}>{stats.ratedCount}</Text>
          <Text style={[st.lbl, { color: colors.subtext }]}>Rated</Text>
        </View>
        <View style={[st.divider, { backgroundColor: colors.border }]} />
        <View style={st.cell}>
          <Text style={[st.val, { color: colors.text }]}>{stats.ratedCount > 0 ? stats.avg.toFixed(1) : '—'}</Text>
          <Text style={[st.lbl, { color: colors.subtext }]}>Avg Rating</Text>
        </View>
        <View style={[st.divider, { backgroundColor: colors.border }]} />
        <View style={st.cell}>
          <Text style={[st.val, { color: colors.text }]}>{stats.written}</Text>
          <Text style={[st.lbl, { color: colors.subtext }]}>Reviews</Text>
        </View>
        <View style={[st.divider, { backgroundColor: colors.border }]} />
        <View style={st.cell}>
          <Text style={[st.val, { color: stats.vsAlbums === null ? colors.text : stats.vsAlbums >= 0.5 ? GROW_CLR : stats.vsAlbums <= -0.5 ? FADE_CLR : colors.text }]}>
            {stats.vsAlbums === null ? '—' : fmtDelta(stats.vsAlbums)}
          </Text>
          <Text style={[st.lbl, { color: colors.subtext }]}>Vs Albums</Text>
        </View>
      </View>

      {!expanded && (
        <Pressable onPress={toggle} style={({ pressed }) => [st.more, { opacity: pressed ? 0.6 : 1 }]}>
          <Text style={[st.moreText, { color: colors.tint }]}>See song stats</Text>
        </Pressable>
      )}

      {expanded && (
        <>
          {/* Rating breakdown */}
          {stats.ratedCount > 0 && (
            <View style={st.section}>
              <Text style={[st.sectionTitle, { color: colors.text }]}>Rating Breakdown</Text>
              <View style={{ gap: 8 }}>
                {[...stats.distribution].map((count, i) => ({ rating: i + 1, count })).reverse().map(({ rating, count }) => {
                  const filled = count > 0 ? Math.max(count / maxCount, 0.02) : 0;
                  return (
                    <View key={rating} style={st.barRow}>
                      <Text style={[st.barLabel, { color: colors.subtext }]}>{rating}</Text>
                      <View style={[st.track, { backgroundColor: colors.border }]}>
                        <View style={[st.fill, { flex: filled, opacity: 0.4 + (count / maxCount) * 0.6, backgroundColor: colors.tint }]} />
                        {filled < 1 && <View style={{ flex: 1 - filled }} />}
                      </View>
                      <Text style={[st.barCount, { color: colors.text }]}>{count}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Tracks vs their albums */}
          <View style={st.section}>
            <Text style={[st.sectionTitle, { color: colors.text }]}>Tracks vs Their Albums</Text>
            {stats.vsAlbums === null ? (
              <Text style={[st.empty, { color: colors.subtext }]}>
                Rate a few tracks from albums {userId ? 'they' : 'you'}'ve rated to see how they compare.
              </Text>
            ) : (
              <Text style={[st.body, { color: colors.subtext }]}>
                {theirs} tracks average{' '}
                <Text style={{ color: colors.text, fontWeight: '700' }}>
                  {Math.abs(stats.vsAlbums) < 0.05 ? 'the same as' : `${Math.abs(stats.vsAlbums).toFixed(1)} ${stats.vsAlbums > 0 ? 'higher' : 'lower'} than`}
                </Text>
                {' '}the albums they're on, across {stats.vsAlbumsCount} album{stats.vsAlbumsCount !== 1 ? 's' : ''}.
              </Text>
            )}
            {stats.standouts.length > 0 && (
              <View style={{ gap: 10, marginTop: 4 }}>
                <Text style={[st.sub, { color: colors.subtext }]}>Standout tracks — rated well above their album</Text>
                {stats.standouts.map(({ song, albumRating, gap }) => (
                  <Pressable key={song.songId} onPress={() => onSongPress(song)} style={({ pressed }) => [st.songRow, { opacity: pressed ? 0.7 : 1 }]}>
                    <SongThumb uri={song.artworkUrl} bg={colors.border} />
                    <View style={{ flex: 1 }}>
                      <Text style={[st.songTitle, { color: colors.text }]} numberOfLines={1}>{song.title}</Text>
                      <Text style={[st.songSub, { color: colors.subtext }]} numberOfLines={1}>
                        {song.rating} · album {albumRating}{song.albumTitle ? ` · ${song.albumTitle}` : ''}
                      </Text>
                    </View>
                    <Text style={[st.gap, { color: GROW_CLR }]}>+{gap}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Favourite tracks */}
          {stats.favourites.length > 0 && (
            <View style={st.section}>
              <View style={st.sectionHeader}>
                <Ionicons name="trophy" size={13} color={colors.tint} />
                <Text style={[st.sectionTitle, { color: colors.text }]}>Favourite Tracks</Text>
                <Text style={[st.sub, { color: colors.subtext }]}>{stats.favourites.length}</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.carousel}>
                {stats.latestFavourites.map(song => (
                  <Pressable key={song.songId} onPress={() => onSongPress(song)} style={({ pressed }) => [st.favCard, { opacity: pressed ? 0.75 : 1 }]}>
                    {song.artworkUrl ? (
                      <ExpoImage source={{ uri: song.artworkUrl }} style={st.favArt} contentFit="cover" cachePolicy="disk" />
                    ) : (
                      <View style={[st.favArt, { backgroundColor: colors.border }]} />
                    )}
                    <Text style={[st.favTitle, { color: colors.text }]} numberOfLines={2}>{song.title}</Text>
                    <Text style={[st.favArtist, { color: colors.subtext }]} numberOfLines={1}>{song.artist}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Most logged artists, by songs */}
          {stats.topArtists.length > 0 && (
            <View style={st.section}>
              <Text style={[st.sectionTitle, { color: colors.text }]}>Most Listend Artists by Songs</Text>
              <View style={{ gap: 10 }}>
                {stats.topArtists.map((a, i) => (
                  <View key={a.artist} style={st.artistRow}>
                    <Text style={[st.rank, { color: colors.subtext }]}>{i + 1}</Text>
                    <Text style={[st.artistName, { color: colors.text }]} numberOfLines={1}>{a.artist}</Text>
                    <Text style={[st.artistSub, { color: colors.subtext }]}>
                      {a.count} song{a.count !== 1 ? 's' : ''}{a.rated > 0 ? ` · ${(a.sum / a.rated).toFixed(1)} avg` : ''}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <Pressable onPress={toggle} style={({ pressed }) => [st.more, { opacity: pressed ? 0.6 : 1 }]}>
            <Text style={[st.moreText, { color: colors.tint }]}>Show less</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

function SongThumb({ uri, bg }: { uri?: string; bg: string }) {
  return uri
    ? <ExpoImage source={{ uri }} style={st.thumb} contentFit="cover" cachePolicy="disk" />
    : <View style={[st.thumb, { backgroundColor: bg }]} />;
}

const st = StyleSheet.create({
  card:         { borderRadius: 14, padding: 18, borderWidth: StyleSheet.hairlineWidth },
  titleRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  title:        { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  titleRight:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleValue:   { fontSize: 15, fontWeight: '700' },
  strip:        { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  cell:         { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 3 },
  divider:      { width: StyleSheet.hairlineWidth, height: 32 },
  val:          { fontSize: 17, fontWeight: '700' },
  lbl:          { fontSize: 10, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.6, textAlign: 'center' },
  more:         { alignItems: 'center', paddingTop: 14 },
  moreText:     { fontSize: 14, fontWeight: '600' },
  section:      { paddingTop: 20, gap: 10 },
  sectionHeader:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '700' },
  sub:          { fontSize: 12, fontWeight: '500' },
  body:         { fontSize: 13, lineHeight: 19 },
  empty:        { fontSize: 13, lineHeight: 19 },
  barRow:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barLabel:     { fontSize: 13, fontWeight: '600', width: 18, textAlign: 'right' },
  track:        { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden', flexDirection: 'row' },
  fill:         { height: 6, borderRadius: 3 },
  barCount:     { fontSize: 13, fontWeight: '600', width: 28, textAlign: 'right' },
  songRow:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumb:        { width: 40, height: 40, borderRadius: 4 },
  songTitle:    { fontSize: 14, fontWeight: '600' },
  songSub:      { fontSize: 12, marginTop: 2 },
  gap:          { fontSize: 14, fontWeight: '700' },
  carousel:     { gap: 12, paddingBottom: 4 },
  favCard:      { width: 96, gap: 5 },
  favArt:       { width: 96, height: 96, borderRadius: 6 },
  favTitle:     { fontSize: 12, fontWeight: '600' },
  favArtist:    { fontSize: 11 },
  artistRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rank:         { fontSize: 13, fontWeight: '700', width: 16, textAlign: 'right' },
  artistName:   { flex: 1, fontSize: 14, fontWeight: '600' },
  artistSub:    { fontSize: 12 },
});
