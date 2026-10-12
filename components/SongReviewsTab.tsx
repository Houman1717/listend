import { View, Text, Pressable, FlatList, TextInput, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CompactRating } from '@/components/CompactRating';
import { SortBar, SortSheet, applySort, SortKey } from '@/components/SortSheet';
import { useSongReviews } from '@/context/SongReviewsContext';
import { fetchUserSongReviews, type SongReview } from '@/lib/songReviews';

// My Reviews → Songs: the user's written song reviews (rated-only songs live
// in My Songs). Own reviews come from context; another user's are fetched.

const SORTS_WITHOUT_DATA: SortKey[] = [
  'release_new', 'release_old', 'avg_rating_high', 'avg_rating_low',
  'num_ratings_high', 'num_ratings_low', 'duration_long', 'duration_short',
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function SongReviewsTab({ viewingUserId, colors, isDark, onOpen }: {
  /** Another user's id, or null for your own. */
  viewingUserId: string | null;
  colors: any;
  isDark: boolean;
  onOpen: (song: SongReview) => void;
}) {
  const { songReviews, songsLoaded } = useSongReviews();
  const [other, setOther] = useState<SongReview[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('date_new');
  const [shuffled, setShuffled] = useState<SongReview[] | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!viewingUserId) return;
    let cancelled = false;
    setFailed(false);
    fetchUserSongReviews(viewingUserId).then(list => {
      if (cancelled) return;
      if (list) setOther(list); else setFailed(true);
    });
    return () => { cancelled = true; };
  }, [viewingUserId]);

  const loaded  = viewingUserId ? other !== null : songsLoaded;
  const written = useMemo(
    () => (viewingUserId ? (other ?? []) : songReviews).filter(x => !!x.review),
    [viewingUserId, other, songReviews],
  );

  const sorted = useMemo(() => {
    if (shuffled) return shuffled;
    return applySort(written.map(x => ({ ...x, year: 0, dateLogged: x.listenedAt })), sortKey);
  }, [written, sortKey, shuffled]);

  const display = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(x =>
      x.title.toLowerCase().includes(q) ||
      x.artist.toLowerCase().includes(q) ||
      (x.review ?? '').toLowerCase().includes(q));
  }, [sorted, query]);

  const divider  = isDark ? '#2e2018' : '#ebebeb';

  return (
    <>
      <SortBar
        sortKey={sortKey}
        count={display.length}
        noun="song reviews"
        isDark={isDark}
        onPress={() => setSheetOpen(true)}
        onSearchPress={() => {
          const next = !searchOpen;
          setSearchOpen(next);
          if (!next) setQuery('');
          else setTimeout(() => searchRef.current?.focus(), 50);
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
        <View style={[s.searchBar, { borderBottomColor: divider }]}>
          <FontAwesome name="search" size={14} color={colors.subtext} />
          <TextInput
            ref={searchRef}
            style={[s.searchInput, { color: colors.text }]}
            value={query}
            onChangeText={setQuery}
            placeholder="Search song reviews…"
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
        keyExtractor={item => item.songId}
        style={{ flex: 1 }}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View style={[s.separator, { backgroundColor: divider }]} />}
        ListEmptyComponent={() => (
          <View style={s.empty}>
            <Text style={[s.emptyTitle, { color: colors.text }]}>
              {!loaded
                ? (failed ? "Couldn't load song reviews." : 'Loading…')
                : query.trim() ? `No song reviews matching "${query.trim()}"` : 'No song reviews yet'}
            </Text>
            {loaded && !query.trim() && !viewingUserId && (
              <Text style={[s.emptySub, { color: colors.subtext }]}>
                Tap any track on an album, or a song in Search, to write about it.
              </Text>
            )}
          </View>
        )}
        renderItem={({ item }) => (
          <Pressable onPress={() => onOpen(item)} style={({ pressed }) => [s.row, { opacity: pressed ? 0.7 : 1 }]}>
            {item.artworkUrl ? (
              <ExpoImage source={{ uri: item.artworkUrl }} style={s.art} contentFit="cover" cachePolicy="disk" />
            ) : (
              <View style={[s.art, { backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }]}>
                <FontAwesome name="music" size={16} color={colors.subtext} />
              </View>
            )}
            <View style={s.body}>
              <View style={s.titleRow}>
                <Text style={[s.title, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
                {item.isFavorite && <Ionicons name="trophy" size={11} color={colors.tint} />}
              </View>
              <Text style={[s.sub, { color: colors.subtext }]} numberOfLines={1}>
                {item.artist}{item.albumTitle ? ` · ${item.albumTitle}` : ''}
              </Text>
              <View style={s.metaRow}>
                {item.rating > 0 && (
                  <CompactRating value={item.rating} color={colors.tint} size={11} />
                )}
                <Text style={[s.date, { color: colors.subtext }]}>{formatDate(item.listenedAt)}</Text>
              </View>
              <Text style={[s.review, { color: colors.text }]} numberOfLines={3}>"{item.review}"</Text>
            </View>
          </Pressable>
        )}
      />
      <SortSheet
        visible={sheetOpen}
        activeKey={sortKey}
        onSelect={key => {
          setShuffled(key === 'shuffle' ? [...written].sort(() => Math.random() - 0.5) : null);
          setSortKey(key);
        }}
        onClose={() => setSheetOpen(false)}
        isDark={isDark}
        tint={colors.tint}
        excludeKeys={SORTS_WITHOUT_DATA}
      />
    </>
  );
}

const s = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingBottom: 48 },
  separator: { height: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 14 },
  art: { width: 56, height: 56, borderRadius: 6 },
  body: { flex: 1, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  sub: { fontSize: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 1 },
  date: { fontSize: 11 },
  review: { fontSize: 14, lineHeight: 20, fontStyle: 'italic', marginTop: 3 },
  empty: { alignItems: 'center', marginTop: 80, paddingHorizontal: 32, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, fontSize: 15, height: 36 },
});
