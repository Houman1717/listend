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
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAlbums, LoggedAlbum } from '@/context/AlbumsContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { SortBar, SortSheet, applySort, SortKey, COMMUNITY_SORTS, DURATION_SORTS } from '@/components/SortSheet';
import { fetchCommunityStats, communityStatsKey } from '@/lib/communityStats';
import { fetchAllRows } from '@/lib/supabaseQuery';
import { fetchAlbumDurations } from '@/lib/albumDurations';
import { AlbumReviewModal } from '@/components/AlbumReviewModal';
import { navigateToProfile } from '@/lib/navigateToProfile';
import { reportContent } from '@/lib/reports';
import { navigateToAlbum } from '@/lib/navigateToAlbum';

const PADDING = 16;
const GAP     = 12;
const COLS    = 3;
// Height of the title + artist + badge block under each cover. Fixed, so every
// grid row is exactly as tall as the next and the list can lay 900 albums out
// arithmetically instead of measuring them. Measured: title 5+14, artist 1+13,
// badges 3+13 = 49, plus slack for Android's taller bold metrics.
//
// Scaled by the device font scale, because Text scales with the OS text-size
// setting by default — without this, a reader on large type overflows the row.
// Read once at load, so a text-size change applies on next launch.
const META_H = Math.ceil(54 * PixelRatio.getFontScale());

// A library big enough to need more pages than this isn't one we can render.
const MAX_LIBRARY_PAGES = 20;

const COVER_COLORS = ['#2d5a27','#7a4a2e','#1a3018','#d4a017','#7a3a1a','#8b1a1a','#1a5a5a','#4a2818'];

// ─── Volume + bars badge ──────────────────────────────────────────────────────

function VolumeBadge({ rating, showNumber, isDark, tint = '#D4A017' }: { rating: number; showNumber?: boolean; isDark?: boolean; tint?: string }) {
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
      {showNumber && (
        <Text style={{ color: tint, fontSize: 10, fontWeight: '700' }}>{rating}</Text>
      )}
    </View>
  );
}


// ─── Album card ───────────────────────────────────────────────────────────────

const AlbumCard = memo(function AlbumCard({
  album,
  cardWidth,
  colors,
  isDark,
  onPress,
}: {
  album: LoggedAlbum;
  cardWidth: number;
  colors: any;
  isDark: boolean;
  onPress: (album: LoggedAlbum) => void;
}) {
  return (
    <Pressable
      onPress={() => onPress(album)}
      style={({ pressed }) => [s.card, { width: cardWidth, height: cardWidth + META_H, opacity: pressed ? 0.7 : 1 }]}>
      {album.artworkUrl ? (
        <ExpoImage
          source={{ uri: album.artworkUrl }}
          style={{ width: cardWidth, height: cardWidth, borderRadius: 8 }}
          contentFit="cover"
          cachePolicy="disk"
          transition={200}
        />
      ) : (
        <View style={[s.fallback, { width: cardWidth, height: cardWidth, backgroundColor: album.coverColor }]}>
          <Text style={[s.fallbackText, { fontSize: cardWidth * 0.32 }]}>{album.title.charAt(0)}</Text>
        </View>
      )}
      <Text style={[s.cardTitle,  { color: colors.text    }]} numberOfLines={1}>{album.title}</Text>
      <Text style={[s.cardArtist, { color: colors.subtext }]} numberOfLines={1}>{album.artist}</Text>
      {((album.lastRating ?? album.rating) > 0 || album.isRelistened) && (
        <View style={{ marginTop: 3, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          {(album.lastRating ?? album.rating) > 0 && (
            <VolumeBadge rating={album.lastRating ?? album.rating} showNumber isDark={isDark} tint={colors.tint} />
          )}
          {!!(album.lastReview ?? album.review) && (
            <FontAwesome name="quote-left" size={8} color={colors.tint} />
          )}
          {!!album.isRelistened && (
            <FontAwesome name="repeat" size={8} color={colors.tint} />
          )}
        </View>
      )}
    </Pressable>
  );
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MyListendScreen() {
  const { width } = useWindowDimensions();
  const cardWidth = (width - PADDING * 2 - GAP * (COLS - 1)) / COLS;
  const colorScheme = useColorScheme();
  const { isPro, proTheme: ownProTheme } = usePro();
  const { userId: paramUserId, username: paramUsername, proTheme: paramProTheme } = useLocalSearchParams<{ userId?: string; username?: string; proTheme?: string }>();
  const _themeKey = !paramUserId ? ownProTheme : (paramProTheme ?? 'default');
  // Memoised: themeToColors builds a fresh object every call, and a new colors
  // object on every render would defeat the memo on all 900 cards.
  const colors = useMemo(
    () => (((!paramUserId ? isPro : !!paramProTheme) && _themeKey !== 'default')
      ? themeToColors(getProTheme(_themeKey))
      : Colors[colorScheme ?? 'dark']),
    [paramUserId, paramProTheme, isPro, _themeKey, colorScheme],
  );
  const isDark = colors.isDark;
  const rowHeight = cardWidth + META_H + GAP;
  const router = useRouter();
  const { loggedAlbums, removeLoggedAlbum, updateDurations, undoLastReListenEntry } = useAlbums();
  const { user } = useAuth();

  const viewingOther = paramUserId || null;
  const [otherAlbums, setOtherAlbums] = useState<LoggedAlbum[]>([]);
  const [sortKey, setSortKey]       = useState<SortKey>('date_new');
  const [shuffled, setShuffled]     = useState<LoggedAlbum[] | null>(null);
  const [sheetOpen, setSheetOpen]   = useState(false);
  const [query, setQuery]           = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<import('react-native').TextInput>(null);

  // Review modal state
  const [selectedAlbum,  setSelectedAlbum]  = useState<LoggedAlbum | null>(null);
  const [profileUsername, setProfileUsername] = useState<string>(paramUsername ?? '');
  const [profileDisplayName, setProfileDisplayName] = useState('');
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);

  // Fetch the profile username + avatar for author row in the modal
  useEffect(() => {
    const uid = viewingOther || user?.id;
    if (!uid) return;
    supabase
      .from('profiles')
      .select('username, display_name, avatar_url')
      .eq('id', uid)
      .single()
      .then(({ data }) => {
        if (data?.username) setProfileUsername(data.username);
        setProfileDisplayName((data as any)?.display_name ?? '');
        if (data?.avatar_url) setProfileAvatarUrl(data.avatar_url);
      });
  }, [viewingOther, user?.id]);

  useEffect(() => {
    if (!viewingOther) return;
    let cancelled = false;

    (async () => {
      // Paged: a single select stops at PostgREST's 1000-row cap, which a
      // heavy library is already brushing against.
      const [albums, reListens] = await Promise.all([
        fetchAllRows<any>((from, to) => supabase
          .from('user_albums')
          .select('spotify_id, title, artist, artwork_url, year, rating, review, listened_at, duration_ms')
          .eq('user_id', viewingOther)
          .not('listened_at', 'is', null)
          .order('listened_at', { ascending: false })
          .range(from, to), MAX_LIBRARY_PAGES),
        fetchAllRows<any>((from, to) => supabase
          .from('re_listens')
          .select('spotify_id, rating, review, listened_at')
          .eq('user_id', viewingOther)
          .order('listened_at', { ascending: false })
          .range(from, to), MAX_LIBRARY_PAGES),
      ]);
      if (cancelled || !albums) return;

      // Build per-album re-listen summary (rows already ordered newest-first)
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
          durationMs:    a.duration_ms ?? undefined,
          isRelistened:  !!rl,
          reListenCount: rl?.count,
          lastRating:    rl?.lastRating,
          lastReview:    rl?.lastReview,
        };
      }));
    })();

    return () => { cancelled = true; };
  }, [viewingOther]);

  const sourceAlbums = viewingOther ? otherAlbums : loggedAlbums;

  // ── Community stats (avg rating + popularity) — matched by title+artist,
  // popularity = distinct listeners (not just ratings), same as Discover ──────
  const [communityStatsMap, setCommunityStatsMap] = useState<Map<string, import('@/lib/communityStats').CommunityStats>>(new Map());

  // Loaded lazily — see COMMUNITY_SORTS. Keyed on list length so a library that
  // grows while the screen is open re-asks, without looping on every render.
  const statsForCount = useRef(-1);
  useEffect(() => {
    if (!COMMUNITY_SORTS.has(sortKey)) return;
    if (sourceAlbums.length === 0 || statsForCount.current === sourceAlbums.length) return;
    statsForCount.current = sourceAlbums.length;
    fetchCommunityStats(sourceAlbums)
      .then(setCommunityStatsMap)
      .catch(() => { statsForCount.current = -1; });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortKey, sourceAlbums.length]);

  // Durations for any album that doesn't have one yet — also lazy, and batched
  // both ways: the endpoint rejects a full library's worth of ids in one query,
  // and applying the answers one at a time re-rendered the grid per album.
  const durationsForCount = useRef(-1);
  useEffect(() => {
    if (!DURATION_SORTS.has(sortKey)) return;
    const missing = sourceAlbums.filter(a => !a.durationMs).map(a => a.id);
    if (missing.length === 0 || durationsForCount.current === missing.length) return;
    durationsForCount.current = missing.length;

    let cancelled = false;

    (async () => {
      const found = await fetchAlbumDurations(missing, () => cancelled);
      if (cancelled || Object.keys(found).length === 0) return;

      if (viewingOther) {
        setOtherAlbums(prev => prev.map(a => (found[a.id] ? { ...a, durationMs: found[a.id] } : a)));
      } else {
        updateDurations(found);
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortKey, sourceAlbums.length, viewingOther]);

  // Sorting is kept out of the search memo so typing doesn't re-sort — and
  // re-key — the whole library on every keystroke.
  const sortedAlbums = useMemo(() => {
    if (shuffled) return shuffled;
    const enriched = communityStatsMap.size === 0 ? sourceAlbums : sourceAlbums.map(a => {
      const stats = communityStatsMap.get(communityStatsKey(a.title, a.artist));
      return stats ? { ...a, communityAvgRating: stats.avg, communityRatingCount: stats.count } : a;
    });
    return applySort(enriched, sortKey);
  }, [sourceAlbums, sortKey, shuffled, communityStatsMap]);

  const displayAlbums = useMemo(() => {
    if (!query.trim()) return sortedAlbums;
    const q = query.toLowerCase();
    return sortedAlbums.filter(a =>
      a.title.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q)
    );
  }, [sortedAlbums, query]);

  function handleSelectSort(key: SortKey) {
    if (key === 'shuffle') {
      setShuffled([...sourceAlbums].sort(() => Math.random() - 0.5));
    } else {
      setShuffled(null);
    }
    setSortKey(key);
  }

  function handleAlbumNavigate(album: LoggedAlbum) {
    navigateToAlbum(router, album);
  }

  // Stable so the memoised cards don't all re-render when anything else moves.
  const handleAlbumPress = useCallback((album: LoggedAlbum) => setSelectedAlbum(album), []);

  const renderItem = useCallback(({ item }: { item: LoggedAlbum }) => (
    <AlbumCard
      album={item}
      cardWidth={cardWidth}
      colors={colors}
      isDark={isDark}
      onPress={handleAlbumPress}
    />
  ), [cardWidth, colors, isDark, handleAlbumPress]);

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }} />
      <SortBar
        sortKey={sortKey}
        count={sourceAlbums.length}
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
        data={displayAlbums}
        renderItem={renderItem}
        // Keyed on the album, not its position (user_albums is unique per
        // user+spotify_id), so filtering the list as you type reuses the cards
        // that survive the filter instead of remounting every visible cover.
        keyExtractor={(item) => item.id}
        numColumns={COLS}
        columnWrapperStyle={s.row}
        contentContainerStyle={s.gridWrap}
        // Every row is exactly rowHeight tall (see META_H), so the list can
        // place all 900 albums without mounting or measuring a single one.
        getItemLayout={(_, index) => ({ length: rowHeight, offset: rowHeight * index, index })}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={5}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text style={[s.emptyText, { color: colors.subtext }]}>
            {query.trim() ? `No albums matching "${query}"` : 'No albums logged yet — head to Search!'}
          </Text>
        }
      />

      <SortSheet
        visible={sheetOpen}
        activeKey={sortKey}
        onSelect={handleSelectSort}
        onClose={() => setSheetOpen(false)}
        isDark={isDark}
        tint={colors.tint}
      />

      {selectedAlbum && (
        <AlbumReviewModal
          album={selectedAlbum}
          reviewUserId={viewingOther || user!.id}
          username={profileUsername}
          displayName={profileDisplayName}
          avatarUrl={profileAvatarUrl}
          onClose={() => setSelectedAlbum(null)}
          onAlbumPress={() => {
            const a = selectedAlbum;
            setSelectedAlbum(null);
            handleAlbumNavigate(a!);
          }}
          onUsernamePress={viewingOther
            ? (username) => { setSelectedAlbum(null); navigateToProfile(username, router); }
            : undefined}
          isDark={isDark}
          colors={colors}
          isOwner={!viewingOther}
          onReport={viewingOther ? () => reportContent({
            contentType: 'review',
            contentId: `${viewingOther}_${selectedAlbum.id}`,
            reportedUser: viewingOther,
            label: 'review',
          }) : undefined}
          onDelete={() => {
            const id = selectedAlbum.id;
            setSelectedAlbum(null);
            Alert.alert(
              'Remove from Listend',
              'This will permanently delete this album and its review.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: () => removeLoggedAlbum(id) },
              ],
            );
          }}
          onUndoReListen={selectedAlbum.isRelistened ? () => {
            const id = selectedAlbum.id;
            setSelectedAlbum(null);
            undoLastReListenEntry(id);
          } : undefined}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:    { flex: 1 },
  gridWrap:{ padding: PADDING, paddingBottom: 48 },
  row:     { gap: GAP, marginBottom: GAP },
  card:    { gap: 0 },
  fallback:     { borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  fallbackText: { color: 'rgba(255,255,255,0.5)', fontWeight: '700' },
  cardTitle:    { marginTop: 5, fontSize: 11, fontWeight: '600', lineHeight: 14 },
  cardArtist:   { fontSize: 10, lineHeight: 13, marginTop: 1 },
  emptyText:    { textAlign: 'center', marginTop: 80, fontSize: 15 },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, fontSize: 15, height: 36 },
});
