import {
  StyleSheet,
  View,
  Text,
  Pressable,
  FlatList,
  TextInput,
  PixelRatio,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { CompactRating } from '@/components/CompactRating';
import { usePro } from '@/context/ProContext';
import { getProTheme, themeToColors } from '@/lib/proThemes';
import { useSongReviews } from '@/context/SongReviewsContext';
import { SongReviewCard } from '@/components/SongReviewCard';
import { SortBar, SortSheet, applySort, SortKey, COMMUNITY_SORTS } from '@/components/SortSheet';
import { useAuth } from '@/context/AuthContext';
import { SONG_MIN_RATINGS, fetchSongCommunityRatings, fetchUserSongReviews, type SongReview, type SongRatingStats } from '@/lib/songReviews';

// My Songs — every song the user has logged (rated, reviewed or just marked
// listened), like My Listend but a list, since songs are secondary to albums.
// With ?userId= it shows another user's songs read-only; tapping a song still
// opens the rate/review sheet for *your* rating of it.

// Songs have no release year here, so the release sorts don't apply.
const EXCLUDED_SORTS: SortKey[] = ['release_new', 'release_old'];

// Fixed row height so the list can lay out a big library arithmetically.
const ROW_H = Math.ceil(68 * PixelRatio.getFontScale());

type SortableSong = SongReview & {
  year: number;
  dateLogged: string;
  communityAvgRating?: number;
  communityRatingCount?: number;
};

const SongRow = memo(function SongRow({ song, colors, isDark, onPress }: {
  song: SongReview;
  colors: any;
  isDark: boolean;
  onPress: (song: SongReview) => void;
}) {
  return (
    <Pressable
      onPress={() => onPress(song)}
      style={({ pressed }) => [s.row, { height: ROW_H, borderBottomColor: colors.border, opacity: pressed ? 0.7 : 1 }]}>
      {song.artworkUrl ? (
        <ExpoImage source={{ uri: song.artworkUrl }} style={s.art} contentFit="cover" cachePolicy="disk" transition={200} />
      ) : (
        <View style={[s.art, { backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }]}>
          <FontAwesome name="music" size={16} color={colors.subtext} />
        </View>
      )}
      <View style={s.text}>
        <View style={s.titleRow}>
          <Text style={[s.title, { color: colors.text }]} numberOfLines={1}>{song.title}</Text>
          {song.isFavorite && <Ionicons name="trophy" size={11} color={colors.tint} />}
        </View>
        <Text style={[s.sub, { color: colors.subtext }]} numberOfLines={1}>
          {song.artist}{song.albumTitle ? ` · ${song.albumTitle}` : ''}
        </Text>
      </View>
      <View style={s.right}>
        {song.rating > 0 ? (
          <CompactRating value={song.rating} color={colors.tint} />
        ) : (
          <Text style={[s.listened, { color: colors.subtext }]}>Listened</Text>
        )}
        {!!song.review && <FontAwesome name="quote-left" size={9} color={colors.tint} />}
      </View>
    </Pressable>
  );
});

export default function MySongsScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { isPro, proTheme: ownProTheme } = usePro();
  const { userId: paramUserId, proTheme: paramProTheme } = useLocalSearchParams<{ userId?: string; proTheme?: string }>();
  const viewingOther = paramUserId || null;
  const themeKey = !viewingOther ? ownProTheme : (paramProTheme ?? 'default');
  const colors = useMemo(
    () => (((!viewingOther ? isPro : !!paramProTheme) && themeKey !== 'default')
      ? themeToColors(getProTheme(themeKey))
      : Colors[colorScheme ?? 'dark']),
    [viewingOther, paramProTheme, isPro, themeKey, colorScheme],
  );
  const isDark = colors.isDark;

  const { songReviews, songsLoaded } = useSongReviews();
  const [otherSongs, setOtherSongs] = useState<SongReview[] | null>(null);
  const [otherFailed, setOtherFailed] = useState(false);
  const [sortKey, setSortKey]       = useState<SortKey>('date_new');
  const [shuffled, setShuffled]     = useState<SongReview[] | null>(null);
  const [sheetOpen, setSheetOpen]   = useState(false);
  const [query, setQuery]           = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [stats, setStats]           = useState<Map<string, SongRatingStats>>(new Map());
  const [cardSong, setCardSong]     = useState<SongReview | null>(null);
  const { user } = useAuth();
  const searchInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!viewingOther) return;
    let cancelled = false;
    setOtherFailed(false);
    fetchUserSongReviews(viewingOther).then(list => {
      if (cancelled) return;
      if (list) setOtherSongs(list);
      else setOtherFailed(true);
    });
    return () => { cancelled = true; };
  }, [viewingOther]);

  const source: SongReview[] = viewingOther ? (otherSongs ?? []) : songReviews;
  const loaded = viewingOther ? otherSongs !== null : songsLoaded;

  // Community averages only matter for the community sorts — fetch lazily.
  const statsForCount = useRef(-1);
  useEffect(() => {
    if (!COMMUNITY_SORTS.has(sortKey)) return;
    if (source.length === 0 || statsForCount.current === source.length) return;
    statsForCount.current = source.length;
    fetchSongCommunityRatings(source.map(x => x.songId)).then(m => {
      if (m) setStats(m); else statsForCount.current = -1;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortKey, source.length]);

  const sorted = useMemo(() => {
    if (shuffled) return shuffled;
    const sortable: SortableSong[] = source.map(x => {
      const st = stats.get(x.songId);
      return {
        ...x,
        year: 0,
        dateLogged: x.listenedAt,
        // Hidden averages (under SONG_MIN_RATINGS) sort as "no rating", like albums.
        communityAvgRating:   st && st.count >= SONG_MIN_RATINGS ? st.sum / st.count : undefined,
        communityRatingCount: st?.count ?? 0,
      };
    });
    return applySort(sortable, sortKey);
  }, [source, sortKey, shuffled, stats]);

  const display = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(x =>
      x.title.toLowerCase().includes(q) ||
      x.artist.toLowerCase().includes(q) ||
      (x.albumTitle ?? '').toLowerCase().includes(q));
  }, [sorted, query]);

  function handleSelectSort(key: SortKey) {
    setShuffled(key === 'shuffle' ? [...source].sort(() => Math.random() - 0.5) : null);
    setSortKey(key);
  }

  // Like My Listend: a song opens its review card; the card links to the Song page.
  const handlePress = useCallback((song: SongReview) => setCardSong(song), []);
  const renderItem = useCallback(({ item }: { item: SongReview }) => (
    <SongRow song={item} colors={colors} isDark={isDark} onPress={handlePress} />
  ), [colors, isDark, handlePress]);

  let empty: string;
  if (!loaded) empty = otherFailed ? "Couldn't load songs. Try again in a moment." : 'Loading…';
  else if (query.trim()) empty = `No songs matching "${query.trim()}"`;
  else empty = viewingOther
    ? 'No songs logged yet.'
    : 'No songs logged yet — rate a track from any album\'s tracklist, or search for a song.';

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{
        title: viewingOther ? 'Songs' : 'My Songs',
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }} />
      <SortBar
        sortKey={sortKey}
        count={display.length}
        noun="songs"
        isDark={isDark}
        onPress={() => setSheetOpen(true)}
        onSearchPress={() => {
          const next = !searchOpen;
          setSearchOpen(next);
          if (!next) setQuery('');
          else setTimeout(() => searchInputRef.current?.focus(), 50);
        }}
        searchActive={searchOpen}
        tint={colors.tint}
        bg={colors.background}
        surface={colors.surface}
        border={colors.border}
        subtext={colors.subtext}
        labelColor={colors.text}
      />
      {searchOpen && (
        <View style={[s.searchBar, { borderBottomColor: colors.border }]}>
          <FontAwesome name="search" size={14} color={colors.subtext} />
          <TextInput
            ref={searchInputRef}
            style={[s.searchInput, { color: colors.text }]}
            value={query}
            onChangeText={setQuery}
            placeholder="Search songs…"
            placeholderTextColor={colors.subtext}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
      )}
      <FlatList
        data={display}
        renderItem={renderItem}
        keyExtractor={item => item.songId}
        getItemLayout={(_, index) => ({ length: ROW_H, offset: ROW_H * index, index })}
        contentContainerStyle={s.list}
        initialNumToRender={14}
        maxToRenderPerBatch={14}
        windowSize={7}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Text style={[s.emptyText, { color: colors.subtext }]}>{empty}</Text>}
      />

      <SortSheet
        visible={sheetOpen}
        activeKey={sortKey}
        onSelect={handleSelectSort}
        onClose={() => setSheetOpen(false)}
        isDark={isDark}
        tint={colors.tint}
        excludeKeys={EXCLUDED_SORTS}
      />

      <SongReviewCard
        userId={viewingOther ?? user?.id}
        review={cardSong}
        onClose={() => setCardSong(null)}
        isDark={isDark}
        colors={colors}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  list: { paddingHorizontal: 16, paddingBottom: 48 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  art: { width: 48, height: 48, borderRadius: 6 },
  text: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  sub: { fontSize: 12 },
  right: { alignItems: 'flex-end', gap: 5 },
  listened: { fontSize: 11 },
  emptyText: { textAlign: 'center', marginTop: 80, fontSize: 15, paddingHorizontal: 32, lineHeight: 21 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, fontSize: 15, height: 36 },
});
