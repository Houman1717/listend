import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  FlatList,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Stack, useRouter } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { AlbumGridCard, cardWidth, GAP, PADDING } from '@/components/AlbumGridCard';
import { SortBar, SortSheet, applySort, SortKey, DURATION_SORTS } from '@/components/SortSheet';
import { fetchAlbumDurations } from '@/lib/albumDurations';
import { useAlbums } from '@/context/AlbumsContext';
import { useLibraryFilters } from '@/hooks/useLibraryFilters';
import { navigateToAlbum } from '@/lib/navigateToAlbum';
import { ChartAlbum, ChartKind, cachedChartLists, loadChartLists } from '@/lib/chartLists';

// The Genre and By Decade list screens: one stat-ranked list (most-listend
// first, hand-picked albums topping up thin lists), with My Listend's Sort &
// Filter sheet to re-order by rating, release date and so on.

// When *you* added an album means nothing on a list you didn't build.
const EXCLUDED_SORTS: SortKey[] = ['date_new', 'date_old'];
// These lists are about what people play and rate, so those sorts lead.
const LEAD_SORTS: SortKey[] = ['num_ratings_high', 'avg_rating_high'];

type Row = ChartAlbum & {
  rating: number;               // your own rating, for the My Rating sort
  logged: boolean;
  communityAvgRating: number;   // what applySort reads for Average Rating
  communityRatingCount: number; // …and for Popularity (distinct listeners)
  durationMs?: number;          // filled in when a duration sort is picked
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export function ChartListGrid({ kind, label, title }: { kind: ChartKind; label: string; title: string }) {
  const { width } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const cw = cardWidth(width);

  const [albums, setAlbums]   = useState<ChartAlbum[]>(() => cachedChartLists(kind)?.[label] ?? []);
  const [loading, setLoading] = useState(() => !cachedChartLists(kind));

  useEffect(() => {
    let cancelled = false;
    loadChartLists(kind)
      .then((data) => { if (!cancelled) setAlbums(data[label] ?? []); })
      .catch((err) => console.error(`[ChartListGrid] ${kind} lists failed:`, err?.message ?? err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [kind, label]);

  // Your own logs, matched by id or by title+artist (a different edition's id).
  const { loggedAlbums } = useAlbums();
  const mine = useMemo(() => {
    const byId = new Map<string, number>();
    const byKey = new Map<string, number>();
    for (const a of loggedAlbums) {
      byId.set(a.id, a.rating ?? 0);
      byKey.set(`${norm(a.title)}::${norm(a.artist)}`, a.rating ?? 0);
    }
    return { byId, byKey };
  }, [loggedAlbums]);

  // ── Sort ────────────────────────────────────────────────────────────────────
  const [sortKey, setSortKey]     = useState<SortKey>('num_ratings_high');

  // Durations only decide the order, so they're fetched the first time a
  // duration sort asks — in one pass, applied in one state update.
  const [durations, setDurations] = useState<Record<string, number>>({});
  const durationsLoaded = useRef<ChartAlbum[] | null>(null);
  useEffect(() => {
    if (!DURATION_SORTS.has(sortKey) || albums.length === 0) return;
    if (durationsLoaded.current === albums) return; // Longest ↔ Shortest reuses them
    let cancelled = false;
    fetchAlbumDurations(albums.map((a) => a.id), () => cancelled)
      .then((found) => {
        if (cancelled) return;
        durationsLoaded.current = albums;
        setDurations(found);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [sortKey, albums]);

  const source: Row[] = useMemo(() => albums.map((a) => {
    const key = `${norm(a.title)}::${norm(a.artist)}`;
    const rating = mine.byId.get(a.id) ?? mine.byKey.get(key);
    return {
      ...a,
      rating: rating ?? 0,
      logged: rating !== undefined,
      communityAvgRating: a.avgRating ?? 0,
      communityRatingCount: a.listeners ?? 0,
      durationMs: durations[a.id],
    };
  }), [albums, mine, durations]);

  const [shuffled, setShuffled]   = useState<Row[] | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const sorted = useMemo(
    () => shuffled ?? applySort(source, sortKey),
    [source, sortKey, shuffled],
  );

  function handleSelectSort(key: SortKey) {
    setShuffled(key === 'shuffle' ? [...source].sort(() => Math.random() - 0.5) : null);
    setSortKey(key);
  }

  // ── Filter: decade on a genre list, genre on a decade list ─────────────────
  const genreOf = useCallback((a: Row) => a.genre ?? undefined, []);
  const { filters, filtered, label: filterLabel, filterActive } =
    useLibraryFilters(source, sorted, genreOf);
  const shownFilters = useMemo(
    () => filters.filter((f) => f.title !== (kind === 'genre' ? 'Genre' : 'Decade')),
    [filters, kind],
  );

  // ── Search ──────────────────────────────────────────────────────────────────
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery]           = useState('');
  const searchInputRef              = useRef<TextInput>(null);

  const display = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return filtered;
    return filtered.filter((a) => a.title.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q));
  }, [filtered, query]);

  // Listened share is of the whole list, whatever the filter.
  const loggedCount = source.filter((a) => a.logged).length;
  const listenedPct = source.length > 0 ? Math.round((loggedCount / source.length) * 100) : 0;

  const renderItem = useCallback(({ item }: { item: Row }) => (
    <AlbumGridCard
      album={item}
      width={cw}
      onPress={() => navigateToAlbum(router, item)}
      textColor={colors.text}
      subColor={colors.subtext}
      isDark={isDark}
      isLogged={item.logged}
    />
  ), [cw, router, colors.text, colors.subtext, isDark]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title, headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text, headerShadowVisible: false }} />

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator color="#D4A017" size="large" />
        </View>
      ) : (
        <>
          <SortBar
            sortKey={sortKey}
            count={filtered.length}
            noun={filterLabel ? `${filterLabel} albums` : 'albums'}
            isDark={isDark}
            onPress={() => setSheetOpen(true)}
            onSearchPress={() => {
              const next = !searchOpen;
              setSearchOpen(next);
              if (!next) setQuery('');
              else setTimeout(() => searchInputRef.current?.focus(), 50);
            }}
            searchActive={searchOpen}
            filterActive={filterActive}
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
            data={display}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            numColumns={3}
            columnWrapperStyle={s.row}
            contentContainerStyle={s.gridWrap}
            initialNumToRender={12}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <View style={s.statsHeader}>
                <View style={s.listenedRow}>
                  <FontAwesome name="headphones" size={13} color="#D4A017" />
                  <Text style={s.listenedPct}>{listenedPct}%</Text>
                </View>
                <Text style={[s.listenedSub, { color: colors.subtext }]}>
                  {loggedCount} of {source.length} albums listend
                </Text>
              </View>
            }
            ListEmptyComponent={
              <Text style={[s.emptyText, { color: colors.subtext }]}>
                {query.trim() ? `No albums matching "${query}"` : 'No albums here yet.'}
              </Text>
            }
          />
        </>
      )}

      <SortSheet
        visible={sheetOpen}
        activeKey={sortKey}
        onSelect={handleSelectSort}
        onClose={() => setSheetOpen(false)}
        isDark={isDark}
        tint={colors.tint}
        excludeKeys={EXCLUDED_SORTS}
        leadKeys={LEAD_SORTS}
        filters={shownFilters}
      />
    </View>
  );
}

const s = StyleSheet.create({
  centered:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  gridWrap:    { padding: PADDING, paddingTop: 12, paddingBottom: 48 },
  row:         { gap: GAP, marginBottom: GAP },
  statsHeader: { alignItems: 'center', paddingBottom: 16, gap: 4 },
  listenedRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  listenedPct: { color: '#D4A017', fontSize: 15, fontWeight: '700' },
  listenedSub: { fontSize: 13 },
  searchBar:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 2 },
  emptyText:   { textAlign: 'center', marginTop: 40, fontSize: 14 },
});
