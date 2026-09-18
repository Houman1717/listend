import {
  StyleSheet,
  View,
  Text,
  Pressable,
  FlatList,
  TextInput,
  Alert,
  PixelRatio,
  useWindowDimensions,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { usePro } from '@/context/ProContext';
import { getProTheme, themeToColors } from '@/lib/proThemes';
import { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useAlbums, WantToListenAlbum } from '@/context/AlbumsContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { SortBar, SortSheet, applySort, SortKey, COMMUNITY_SORTS, DURATION_SORTS } from '@/components/SortSheet';
import { fetchCommunityStats, communityStatsKey, CommunityStats } from '@/lib/communityStats';
import { fetchAlbumDurations } from '@/lib/albumDurations';
import { fetchAllRows } from '@/lib/supabaseQuery';

const PADDING = 16;
const GAP     = 12;
const COLS    = 3;
// Height of the title + artist block under each cover. Fixed, so every grid row
// is the same height and the list can place them arithmetically rather than
// mounting and measuring the lot. Measured: card gap 4+4, title 2+~15,
// artist ~14 = 39, plus slack for Android's taller metrics.
//
// Scaled by the device font scale, because Text follows the OS text-size
// setting by default. Read once at load, so a change applies on next launch.
const META_H = Math.ceil(46 * PixelRatio.getFontScale());

// A list big enough to need more pages than this isn't one we can render.
const MAX_LIST_PAGES = 20;

const AlbumCard = memo(function AlbumCard({
  album,
  cardWidth,
  onPress,
  onLongPress,
  textColor,
  subColor,
}: {
  album: WantToListenAlbum;
  cardWidth: number;
  onPress: (album: WantToListenAlbum) => void;
  onLongPress: (album: WantToListenAlbum) => void;
  textColor: string;
  subColor: string;
}) {
  return (
    <Pressable
      onPress={() => onPress(album)}
      onLongPress={() => onLongPress(album)}
      style={({ pressed }) => [s.albumCard, { width: cardWidth, height: cardWidth + META_H, opacity: pressed ? 0.7 : 1 }]}>
      {album.artworkUrl ? (
        <ExpoImage
          source={{ uri: album.artworkUrl }}
          style={{ width: cardWidth, height: cardWidth, borderRadius: 8 }}
          contentFit="cover" cachePolicy="disk"
        />
      ) : (
        <View style={[s.fallback, { width: cardWidth, height: cardWidth }]}>
          <FontAwesome name="music" size={cardWidth * 0.28} color="#7a5535" />
        </View>
      )}
      <Text style={[s.albumTitle, { color: textColor }]} numberOfLines={1}>{album.title}</Text>
      <Text style={[s.albumArtist, { color: subColor }]} numberOfLines={1}>{album.artist}</Text>
    </Pressable>
  );
});

export default function WantToListenScreen() {
  const { width } = useWindowDimensions();
  const cardWidth = (width - PADDING * 2 - GAP * (COLS - 1)) / COLS;
  const colorScheme = useColorScheme();
  const { isPro, proTheme: ownProTheme } = usePro();
  const { userId: paramUserId, proTheme: paramProTheme } = useLocalSearchParams<{ userId?: string; proTheme?: string }>();
  const _themeKey = !paramUserId ? ownProTheme : (paramProTheme ?? 'default');
  // Memoised: themeToColors builds a fresh object every call, and a new colors
  // object on every render would defeat the memo on every card.
  const colors = useMemo(
    () => (((!paramUserId ? isPro : !!paramProTheme) && _themeKey !== 'default')
      ? themeToColors(getProTheme(_themeKey))
      : Colors[colorScheme ?? 'dark']),
    [paramUserId, paramProTheme, isPro, _themeKey, colorScheme],
  );
  const isDark = colors.isDark;
  const rowHeight = cardWidth + META_H + GAP;
  const router = useRouter();
  const { wantToListen, removeFromWantToListen, updateDurations } = useAlbums();
  const { user } = useAuth();

  const viewingOther = paramUserId || null;
  const [otherList, setOtherList] = useState<WantToListenAlbum[]>([]);
  const [sortKey, setSortKey]     = useState<SortKey>('date_new');
  const [shuffled, setShuffled]   = useState<WantToListenAlbum[] | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [query, setQuery]         = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<import('react-native').TextInput>(null);

  useEffect(() => {
    if (!viewingOther) return;
    let cancelled = false;

    (async () => {
      // Paged: a single select stops at PostgREST's 1000-row cap.
      const rows = await fetchAllRows<any>((from, to) => supabase
        .from('want_to_listen')
        .select('spotify_id, title, artist, year, artwork_url, created_at')
        .eq('user_id', viewingOther)
        .order('created_at', { ascending: false })
        .range(from, to), MAX_LIST_PAGES);
      // null means the query failed — never write that back over a real list.
      if (cancelled || !rows) return;

      setOtherList(rows.map((w: any) => ({
        id:         w.spotify_id,
        title:      w.title       ?? '',
        artist:     w.artist      ?? '',
        year:       w.year        ?? 0,
        artworkUrl: w.artwork_url ?? '',
        dateAdded:  w.created_at  ?? undefined,
      })));
    })();

    return () => { cancelled = true; };
  }, [viewingOther]);

  const sourceList = viewingOther ? otherList : wantToListen;

  // ── Community stats (avg rating + popularity) — same source as My Listend ──
  const [communityStatsMap, setCommunityStatsMap] = useState<Map<string, CommunityStats>>(new Map());

  // Loaded lazily — see COMMUNITY_SORTS. Keyed on list length so a list that
  // grows while the screen is open re-asks, without looping on every render.
  const statsForCount = useRef(-1);
  useEffect(() => {
    if (!COMMUNITY_SORTS.has(sortKey)) return;
    if (sourceList.length === 0 || statsForCount.current === sourceList.length) return;
    statsForCount.current = sourceList.length;
    fetchCommunityStats(sourceList)
      .then(setCommunityStatsMap)
      .catch(() => { statsForCount.current = -1; });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortKey, sourceList.length]);

  // Durations for any album that doesn't have one yet — also lazy, and batched
  // both ways: the endpoint rejects a whole list's worth of ids in one query,
  // and applying the answers one at a time re-rendered the grid per album.
  const durationsForCount = useRef(-1);
  useEffect(() => {
    if (!DURATION_SORTS.has(sortKey)) return;
    const missing = sourceList.filter(a => !a.durationMs).map(a => a.id);
    if (missing.length === 0 || durationsForCount.current === missing.length) return;
    durationsForCount.current = missing.length;

    let cancelled = false;
    (async () => {
      const found = await fetchAlbumDurations(missing, () => cancelled);
      if (cancelled || Object.keys(found).length === 0) return;

      if (viewingOther) {
        setOtherList(prev => prev.map(a => (found[a.id] ? { ...a, durationMs: found[a.id] } : a)));
      } else {
        updateDurations(found);
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortKey, sourceList.length, viewingOther]);

  // Sorting is kept out of the search memo so typing doesn't re-sort — and
  // re-key — the whole list on every keystroke.
  const sortedList = useMemo(() => {
    if (shuffled) return shuffled;
    const enriched = communityStatsMap.size === 0 ? sourceList : sourceList.map(a => {
      const stats = communityStatsMap.get(communityStatsKey(a.title, a.artist));
      return stats ? { ...a, communityAvgRating: stats.avg, communityRatingCount: stats.count } : a;
    });
    return applySort(enriched, sortKey);
  }, [sourceList, sortKey, shuffled, communityStatsMap]);

  const displayList = useMemo(() => {
    if (!query.trim()) return sortedList;
    const q = query.toLowerCase();
    return sortedList.filter(a =>
      a.title.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q)
    );
  }, [sortedList, query]);

  function handleSelectSort(key: SortKey) {
    if (key === 'shuffle') {
      setShuffled([...sourceList].sort(() => Math.random() - 0.5));
    } else {
      setShuffled(null);
    }
    setSortKey(key);
  }

  function handleTap(album: WantToListenAlbum) {
    router.push({
      pathname: '/album-detail',
      params: {
        id:         album.id,
        title:      album.title,
        artist:     album.artist,
        year:       String(album.year),
        artworkUrl: album.artworkUrl,
      },
    });
  }

  function handleLongPress(album: WantToListenAlbum) {
    if (viewingOther) return;
    Alert.alert('Remove', `Remove "${album.title}" from Want to Listen?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeFromWantToListen(album.id) },
    ]);
  }

  // Stable so the memoised cards don't all re-render when anything else moves.
  const handleCardPress     = useCallback(handleTap,       [router]);
  const handleCardLongPress = useCallback(handleLongPress, [viewingOther, removeFromWantToListen]);

  const renderItem = useCallback(({ item }: { item: WantToListenAlbum }) => (
    <AlbumCard
      album={item}
      cardWidth={cardWidth}
      onPress={handleCardPress}
      onLongPress={handleCardLongPress}
      textColor={colors.text}
      subColor={colors.subtext}
    />
  ), [cardWidth, colors.text, colors.subtext, handleCardPress, handleCardLongPress]);

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }} />
      <SortBar
        sortKey={sortKey}
        count={sourceList.length}
        noun="albums"
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
            placeholder="Search albums…"
            placeholderTextColor={colors.subtext}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
      )}
      <FlatList
        data={displayList}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={COLS}
        columnWrapperStyle={s.row}
        contentContainerStyle={s.gridWrap}
        // Every row is exactly rowHeight tall (see META_H), so the list can
        // place the whole list without mounting or measuring a single card.
        getItemLayout={(_, index) => ({ length: rowHeight, offset: rowHeight * index, index })}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={5}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={[s.emptyTitle, { color: colors.text }]}>
              {query.trim() ? `No albums matching "${query}"` : 'Nothing here yet'}
            </Text>
            <Text style={[s.emptySubtext, { color: colors.subtext }]}>
              {query.trim() ? '' : viewingOther
                ? 'This user has nothing saved yet.'
                : 'Tap the bookmark icon on any album in Search to save it here.'}
            </Text>
          </View>
        }
      />

      <SortSheet
        visible={sheetOpen}
        activeKey={sortKey}
        onSelect={handleSelectSort}
        onClose={() => setSheetOpen(false)}
        isDark={isDark}
        tint={colors.tint}
        excludeKeys={['my_rating_high', 'my_rating_low']}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  gridWrap:  { padding: PADDING, paddingBottom: 48 },
  row:       { gap: GAP, marginBottom: GAP },

  albumCard:   { gap: 4 },
  albumTitle:  { fontSize: 12, fontWeight: '600', marginTop: 2 },
  albumArtist: { fontSize: 11 },

  fallback:     { borderRadius: 8, backgroundColor: '#2a1e14', justifyContent: 'center', alignItems: 'center' },
  fallbackText: { color: 'rgba(255,255,255,0.5)', fontWeight: '700' },

  empty:        { alignItems: 'center', marginTop: 80, paddingHorizontal: 32 },
  emptyTitle:   { fontSize: 17, fontWeight: '600', marginBottom: 8 },
  emptySubtext: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, fontSize: 15, height: 36 },
});
