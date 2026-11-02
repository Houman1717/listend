import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { LoggedAlbum } from '@/context/AlbumsContext';
import { useSongReviews } from '@/context/SongReviewsContext';
import { effectiveRating } from '@/lib/effectiveRating';
import { fetchUserSongReviews, type SongReview } from '@/lib/songReviews';
import { StatTile } from '@/components/StatTile';
import VolumeBars from '@/components/VolumeBars';

// Songs are the secondary log: the card stays hidden until there's enough to
// say anything. Same pieces as the rest of the stats screens (tiles, a column
// chart with a cover on its peak, artist photos) so it doesn't read as an
// afterthought.
const MIN_SONG_LOGS = 10;
const TOP_ARTISTS   = 5;
const STANDOUTS     = 5;
// Favourites are one per album, so a big library has hundreds — show the latest.
const FAVOURITES    = 20;
// A track only counts as a standout when it beats its album by this much.
const STANDOUT_MIN_GAP = 2;

const GROW_CLR = '#a8c44a';
const GROW_BG  = 'rgba(168,196,74,0.16)';
const FADE_CLR = '#B85040';

type CardColors = { text: string; subtext: string; textMuted: string; tint: string; border: string; surface: string };

const norm = (s: string | undefined) => (s ?? '').trim().toLowerCase();

const fmtDelta = (d: number) => `${d > 0 ? '+' : ''}${d.toFixed(1)}`;

export function SongStatsCard({
  userId,
  albums,
  colors,
  onSongPress,
  within,
  minSongs = MIN_SONG_LOGS,
}: {
  /** Whose songs: null for your own (from context), else fetched once. */
  userId: string | null;
  /** The same user's album library, for "tracks vs their albums". */
  albums: LoggedAlbum[];
  colors: CardColors;
  onSongPress: (song: SongReview) => void;
  /** Month / Year in Review: keep only songs logged in that period. */
  within?: (listenedAt: Date) => boolean;
  /** Hide the card below this many songs; a month has far fewer than a library. */
  minSongs?: number;
}) {
  const { songReviews } = useSongReviews();
  const [otherSongs, setOtherSongs] = useState<SongReview[] | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchUserSongReviews(userId).then(list => { if (!cancelled && list) setOtherSongs(list); });
    return () => { cancelled = true; };
  }, [userId]);

  const allSongs = userId ? (otherSongs ?? []) : songReviews;
  const songs = useMemo(
    () => (within ? allSongs.filter(s => within(new Date(s.listenedAt))) : allSongs),
    [allSongs, within],
  );

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

  // Column width, so the cover on the peak bar can fill it.
  const [chartW, setChartW] = useState(0);

  // Artist photos for Top Artists: one search each, only for the ones shown.
  const [artistImages, setArtistImages] = useState<Record<string, string>>({});
  const requestedArtists = useRef(new Set<string>());
  useEffect(() => {
    const names = stats.topArtists.map(a => a.artist).filter(n => !requestedArtists.current.has(n));
    if (names.length === 0) return;
    names.forEach(n => requestedArtists.current.add(n));
    const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
    Promise.allSettled(
      names.map(name =>
        fetch(`${API_URL}/search?q=${encodeURIComponent(name)}&type=artist`)
          .then(r => (r.ok ? r.json() : []))
          .then((results: { artworkUrl: string }[]) => ({ name, url: results[0]?.artworkUrl ?? '' })),
      ),
    ).then(results => {
      const images: Record<string, string> = {};
      for (const r of results) if (r.status === 'fulfilled' && r.value.url) images[r.value.name] = r.value.url;
      if (Object.keys(images).length > 0) setArtistImages(prev => ({ ...prev, ...images }));
    });
  }, [stats.topArtists]);

  if (songs.length < minSongs) return null;

  const theirs = userId ? 'their' : 'your';
  const Theirs = userId ? 'Their' : 'Your';
  const tileProps = { tint: colors.tint, textColor: colors.text, subtextColor: colors.subtext, bg: colors.surface, border: colors.border };
  const vsColor = stats.vsAlbums === null ? colors.text : stats.vsAlbums >= 0.5 ? GROW_CLR : stats.vsAlbums <= -0.5 ? FADE_CLR : colors.text;

  // The rating most songs get; a tie goes to the higher rating.
  const maxCount = Math.max(...stats.distribution, 1);
  const peak = stats.distribution.reduce((best, n, i) => (n >= stats.distribution[best] ? i : best), 0) + 1;
  const peakCount = stats.distribution[peak - 1];
  // On the peak bar: a favourite with that rating if there is one, else the latest.
  const peakSongs = songs.filter(s => s.rating === peak);
  const peakSong = peakSongs.find(s => s.isFavorite && s.artworkUrl) ?? peakSongs.find(s => s.artworkUrl);
  const cover = chartW > 0 ? Math.floor((chartW - 9 * BAR_GAP) / 10) - 6 : 0;
  const ratingHeadline = stats.ratedCount < 5
    ? `${Theirs} song ratings`
    : `Most of ${theirs} songs land on ${peak === 8 ? 'an' : 'a'} ${peak}`;

  return (
    <View style={[st.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={st.titleRow}>
        <Text style={[st.title, { color: colors.textMuted }]}>SONGS</Text>
        <Text style={[st.titleValue, { color: colors.text }]}>{songs.length} logged</Text>
      </View>

      <View style={{ gap: 8 }}>
        <View style={st.tileRow}>
          <StatTile icon="star" value={stats.ratedCount || '—'} label="Rated" {...tileProps} />
          <StatTile icon="volume-up" value={stats.ratedCount > 0 ? stats.avg.toFixed(1) : '—'} unit=" /10" label="Avg rating"
            extra={stats.ratedCount > 0 ? (
              <VolumeBars rating={Math.round(stats.avg)} activeColor={colors.tint} inactiveColor={colors.border} />
            ) : undefined}
            {...tileProps} />
        </View>
        <View style={st.tileRow}>
          <StatTile icon="pencil" value={stats.written || '—'} label="Reviews" {...tileProps} />
          <StatTile
            icon={stats.vsAlbums !== null && stats.vsAlbums < 0 ? 'arrow-down' : 'arrow-up'}
            value={stats.vsAlbums === null ? '—' : fmtDelta(stats.vsAlbums)}
            label="Vs albums"
            {...tileProps}
            tint={stats.vsAlbums === null ? colors.tint : vsColor === colors.text ? colors.tint : vsColor}
            textColor={vsColor} />
        </View>
      </View>

      {/* Rating breakdown: one column per rating, the most common one gold with a cover */}
      {stats.ratedCount > 0 && (
        <View style={st.section}>
          <View>
            <Text style={[st.sectionTitle, { color: colors.text }]}>{ratingHeadline}</Text>
            {stats.ratedCount >= 5 && (
              <Text style={[st.sub, { color: colors.subtext, marginTop: 2 }]}>
                {peakCount} of {stats.ratedCount} rated song{stats.ratedCount !== 1 ? 's' : ''}
              </Text>
            )}
          </View>
          <View style={st.chart} onLayout={e => setChartW(e.nativeEvent.layout.width)}>
            {stats.distribution.map((count, i) => {
              const rating = i + 1;
              const isPeak = rating === peak && count > 0;
              const h = count > 0 ? Math.max((count / maxCount) * CHART_H, 4) : 0;
              return (
                <View key={rating} style={st.col}>
                  {count > 0 && (
                    <Text style={[st.colCount, { color: isPeak ? colors.text : colors.subtext }]} numberOfLines={1}>{count}</Text>
                  )}
                  {count > 0 ? (
                    <Pressable
                      disabled={!isPeak || !peakSong}
                      onPress={() => peakSong && onSongPress(peakSong)}
                      style={[st.bar, { height: h, backgroundColor: colors.tint, opacity: isPeak ? 1 : 0.32 }]}>
                      {isPeak && peakSong?.artworkUrl && cover >= 16 && h >= cover + 6 && (
                        <ExpoImage source={{ uri: peakSong.artworkUrl }} style={{ width: cover, height: cover, borderRadius: 3 }} contentFit="cover" cachePolicy="disk" />
                      )}
                    </Pressable>
                  ) : (
                    <View style={[st.dot, { backgroundColor: colors.border }]} />
                  )}
                </View>
              );
            })}
          </View>
          <View style={st.axis}>
            {stats.distribution.map((_, i) => (
              <Text key={i} style={[st.axisLabel, { color: i + 1 === peak && peakCount > 0 ? colors.tint : colors.subtext }]}>{i + 1}</Text>
            ))}
          </View>
        </View>
      )}

      {/* Tracks vs their albums */}
      <View style={st.section}>
        <View>
          <Text style={[st.sectionTitle, { color: colors.text }]}>Tracks vs Their Albums</Text>
          <Text style={[st.sub, { color: colors.subtext, marginTop: 2 }]}>
            {stats.vsAlbums === null
              ? `Rate a few tracks from albums ${userId ? 'they' : 'you'}'ve rated to see how they compare.`
              : `${Theirs} tracks average ${Math.abs(stats.vsAlbums) < 0.05 ? 'the same as' : `${Math.abs(stats.vsAlbums).toFixed(1)} ${stats.vsAlbums > 0 ? 'higher' : 'lower'} than`} their albums, across ${stats.vsAlbumsCount} album${stats.vsAlbumsCount !== 1 ? 's' : ''}.`}
          </Text>
        </View>
        {stats.standouts.map(({ song, albumRating }) => (
          <Pressable key={song.songId} onPress={() => onSongPress(song)} style={({ pressed }) => [st.songRow, { opacity: pressed ? 0.7 : 1 }]}>
            <SongThumb uri={song.artworkUrl} bg={colors.border} />
            <View style={{ flex: 1 }}>
              <Text style={[st.songTitle, { color: colors.text }]} numberOfLines={1}>{song.title}</Text>
              <Text style={[st.songSub, { color: colors.subtext }]} numberOfLines={1}>{song.albumTitle || song.artist}</Text>
            </View>
            <View style={[st.chip, { backgroundColor: GROW_BG }]}>
              <Text style={[st.chipText, { color: GROW_CLR }]}>{song.rating}</Text>
            </View>
            <Text style={[st.vs, { color: colors.subtext }]}>vs</Text>
            <View style={[st.chip, { backgroundColor: colors.border }]}>
              <Text style={[st.chipText, { color: colors.subtext }]}>{albumRating % 1 === 0 ? albumRating : albumRating.toFixed(1)}</Text>
            </View>
          </Pressable>
        ))}
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.carousel}>
            {stats.topArtists.map(a => {
              const img = artistImages[a.artist];
              return (
                <View key={a.artist} style={st.artistCard}>
                  {img ? (
                    <ExpoImage source={{ uri: img }} style={st.artistPhoto} contentFit="cover" cachePolicy="disk" />
                  ) : (
                    <View style={[st.artistPhoto, { backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={[st.artistInitial, { color: colors.subtext }]}>{a.artist.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <Text style={[st.artistName, { color: colors.text }]} numberOfLines={1}>{a.artist}</Text>
                  <Text style={[st.artistSub, { color: colors.subtext }]} numberOfLines={1}>
                    {a.count} song{a.count !== 1 ? 's' : ''}{a.rated > 0 ? ` · ${(a.sum / a.rated).toFixed(1)}` : ''}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function SongThumb({ uri, bg }: { uri?: string; bg: string }) {
  return uri
    ? <ExpoImage source={{ uri }} style={st.thumb} contentFit="cover" cachePolicy="disk" />
    : <View style={[st.thumb, { backgroundColor: bg }]} />;
}

const CHART_H = 110;
const BAR_GAP = 4;

const st = StyleSheet.create({
  card:         { borderRadius: 14, padding: 18, borderWidth: StyleSheet.hairlineWidth },
  titleRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title:        { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  titleValue:   { fontSize: 15, fontWeight: '700' },
  tileRow:      { flexDirection: 'row', gap: 8 },
  section:      { paddingTop: 22, gap: 10 },
  sectionHeader:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  sub:          { fontSize: 12, fontWeight: '500', lineHeight: 17 },
  chart:        { flexDirection: 'row', alignItems: 'flex-end', gap: BAR_GAP, height: CHART_H + 16 },
  col:          { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 3 },
  colCount:     { fontSize: 10, fontWeight: '700' },
  bar:          { alignSelf: 'stretch', borderRadius: 4, alignItems: 'center', paddingTop: 3, overflow: 'hidden' },
  dot:          { width: 4, height: 4, borderRadius: 2 },
  axis:         { flexDirection: 'row', gap: BAR_GAP, marginTop: -4 },
  axisLabel:    { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700' },
  songRow:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumb:        { width: 42, height: 42, borderRadius: 4 },
  songTitle:    { fontSize: 14, fontWeight: '600' },
  songSub:      { fontSize: 12, marginTop: 2 },
  chip:         { minWidth: 30, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, alignItems: 'center' },
  chipText:     { fontSize: 13, fontWeight: '800' },
  vs:           { fontSize: 11, fontWeight: '600' },
  carousel:     { gap: 12, paddingBottom: 4 },
  favCard:      { width: 96, gap: 5 },
  favArt:       { width: 96, height: 96, borderRadius: 6 },
  favTitle:     { fontSize: 12, fontWeight: '600' },
  favArtist:    { fontSize: 11 },
  artistCard:   { width: 84, alignItems: 'center', gap: 3 },
  artistPhoto:  { width: 68, height: 68, borderRadius: 34, marginBottom: 3 },
  artistInitial:{ fontSize: 22, fontWeight: '700' },
  artistName:   { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  artistSub:    { fontSize: 11, textAlign: 'center' },
});
