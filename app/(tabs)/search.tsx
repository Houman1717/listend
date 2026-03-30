import {
  StyleSheet,
  View,
  Text,
  TextInput,
  FlatList,
  ScrollView,
  Image,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useState, useRef, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAlbums, PendingAlbum, WantToListenAlbum } from '@/context/AlbumsContext';
import {
  spotifyGet,
  albumFromSpotify,
  trackFromSpotify,
  artistFromSpotify,
  SpotifyAlbum,
  SpotifyTrack,
  SpotifyArtist,
} from '@/context/SpotifyService';

// ─── Types ────────────────────────────────────────────────────────────────────

type SearchTab = 'albums' | 'songs' | 'artists' | 'users';

type ResultItem =
  | (SpotifyAlbum  & { kind: 'album'  })
  | (SpotifyTrack  & { kind: 'song'   })
  | (SpotifyArtist & { kind: 'artist' });

const TABS: { key: SearchTab; label: string }[] = [
  { key: 'albums',  label: 'Albums'  },
  { key: 'songs',   label: 'Songs'   },
  { key: 'artists', label: 'Artists' },
  { key: 'users',   label: 'Users'   },
];

const RECENT_KEY = '@listend:recentSearches_v1';
const MAX_RECENT = 8;

// ─── Spotify search helpers ───────────────────────────────────────────────────

async function searchSpotify(tab: SearchTab, query: string): Promise<ResultItem[]> {
  if (tab === 'users') return [];

  const type = tab === 'albums' ? 'album' : tab === 'songs' ? 'track' : 'artist';
  const q = encodeURIComponent(query.trim());
  const data = await spotifyGet(`/search?q=${q}&type=${type}&limit=10`);

  console.log('[searchSpotify] tab:', tab, 'albums:', data.albums?.items?.length, 'tracks:', data.tracks?.items?.length, 'artists:', data.artists?.items?.length);

  if (tab === 'albums') {
    const items = (data.albums?.items ?? []).filter(Boolean);
    console.log('[searchSpotify] mapping', items.length, 'album items');
    return items.map((i: any) => ({ kind: 'album' as const, ...albumFromSpotify(i) }));
  }
  if (tab === 'songs') {
    const items = (data.tracks?.items ?? []).filter(Boolean);
    console.log('[searchSpotify] mapping', items.length, 'track items');
    return items.map((i: any) => ({ kind: 'song' as const, ...trackFromSpotify(i) }));
  }
  const items = (data.artists?.items ?? []).filter(Boolean);
  console.log('[searchSpotify] mapping', items.length, 'artist items');
  return items.map((i: any) => ({ kind: 'artist' as const, ...artistFromSpotify(i) }));
}

// ─── Row components ───────────────────────────────────────────────────────────

function AlbumRow({
  item, isDark, colors, isBookmarked, onLog, onBookmark,
}: {
  item: SpotifyAlbum & { kind: 'album' };
  isDark: boolean;
  colors: typeof Colors.light;
  isBookmarked: boolean;
  onLog: () => void;
  onBookmark: () => void;
}) {
  return (
    <View style={s.resultRow}>
      <Pressable
        style={({ pressed }) => [
          s.resultMain,
          { backgroundColor: pressed ? (isDark ? '#222' : '#f0f0f0') : 'transparent' },
        ]}
        onPress={onLog}>
        {item.artworkUrl ? (
          <Image source={{ uri: item.artworkUrl }} style={s.artwork} />
        ) : (
          <View style={[s.artwork, s.artPlaceholder, { backgroundColor: isDark ? '#2a2a2a' : '#e0e0e0' }]} />
        )}
        <View style={s.resultText}>
          <Text style={[s.resultTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
          <Text style={[s.resultSub, { color: colors.subtext }]} numberOfLines={1}>
            {item.artist}{item.year ? ` · ${item.year}` : ''}
          </Text>
        </View>
      </Pressable>
      <Pressable onPress={onBookmark} hitSlop={12} style={s.actionBtn}>
        <FontAwesome
          name={isBookmarked ? 'bookmark' : 'bookmark-o'}
          size={17}
          color={isBookmarked ? '#FF3CAC' : colors.subtext}
        />
      </Pressable>
      <Pressable onPress={onLog} hitSlop={8} style={s.actionBtn}>
        <Text style={[s.plusIcon, { color: colors.tint }]}>+</Text>
      </Pressable>
    </View>
  );
}

function SongRow({ item, isDark, colors }: {
  item: SpotifyTrack & { kind: 'song' };
  isDark: boolean;
  colors: typeof Colors.light;
}) {
  return (
    <View style={[s.resultRow, { paddingRight: 16 }]}>
      <View style={s.resultMain}>
        {item.artworkUrl ? (
          <Image source={{ uri: item.artworkUrl }} style={s.artwork} />
        ) : (
          <View style={[s.artwork, s.artPlaceholder, { backgroundColor: isDark ? '#2a2a2a' : '#e0e0e0' }]}>
            <FontAwesome name="music" size={18} color={colors.subtext} />
          </View>
        )}
        <View style={s.resultText}>
          <Text style={[s.resultTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
          <Text style={[s.resultSub, { color: colors.subtext }]} numberOfLines={1}>{item.artist}</Text>
        </View>
      </View>
    </View>
  );
}

function ArtistRow({ item, isDark, colors }: {
  item: SpotifyArtist & { kind: 'artist' };
  isDark: boolean;
  colors: typeof Colors.light;
}) {
  return (
    <View style={[s.resultRow, { paddingRight: 16 }]}>
      <View style={s.resultMain}>
        {item.artworkUrl ? (
          <Image source={{ uri: item.artworkUrl }} style={[s.artwork, { borderRadius: 26 }]} />
        ) : (
          <View style={[s.artwork, { borderRadius: 26, backgroundColor: isDark ? '#2a2a2a' : '#e5e5e5', justifyContent: 'center', alignItems: 'center' }]}>
            <Text style={[s.artistInitial, { color: colors.subtext }]}>{item.name.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={s.resultText}>
          <Text style={[s.resultTitle, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
          {item.genre ? (
            <Text style={[s.resultSub, { color: colors.subtext }]} numberOfLines={1}>{item.genre}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SearchScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { setPendingAlbum, wantToListen, addToWantToListen, removeFromWantToListen } = useAlbums();

  const [activeTab, setActiveTab] = useState<SearchTab>('albums');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(RECENT_KEY)
      .then((v) => { if (v) setRecentSearches(JSON.parse(v)); })
      .catch(() => {});
  }, []);

  function saveRecentSearch(term: string) {
    const trimmed = term.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => {
      const next = [trimmed, ...prev.filter((s) => s !== trimmed)].slice(0, MAX_RECENT);
      AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }

  function removeRecentSearch(term: string) {
    setRecentSearches((prev) => {
      const next = prev.filter((s) => s !== term);
      AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }

  function clearRecentSearches() {
    setRecentSearches([]);
    AsyncStorage.removeItem(RECENT_KEY).catch(() => {});
  }

  const search = useCallback(async (text: string, tab: SearchTab) => {
    if (!text.trim()) { setResults([]); setSearched(false); return; }
    setLoading(true);
    setSearched(true);
    try {
      const items = await searchSpotify(tab, text);
      console.log('[Search] Setting', items.length, 'results, searched=true');
      setResults(items);
    } catch (e) {
      console.error('[Search] Error:', e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleChangeText(text: string) {
    setQuery(text);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => search(text, activeTab), 400);
  }

  function handleSubmit() {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    search(query, activeTab);
    saveRecentSearch(query);
  }

  function handleClear() { setQuery(''); setResults([]); setSearched(false); }

  function handleTabChange(tab: SearchTab) {
    setActiveTab(tab);
    setResults([]);
    setSearched(false);
    if (query.trim()) {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      search(query, tab);
    }
  }

  function handleRecentTap(term: string) {
    setQuery(term);
    search(term, activeTab);
    saveRecentSearch(term);
  }

  function handleLogAlbum(item: SpotifyAlbum) {
    const pending: PendingAlbum = {
      spotifyId: item.id,
      title: item.title,
      artist: item.artist,
      year: item.year,
      artworkUrl: item.artworkUrl,
    };
    setPendingAlbum(pending);
    router.push('/log-album');
  }

  function handleToggleBookmark(item: SpotifyAlbum) {
    if (wantToListen.find((a) => a.id === item.id)) {
      removeFromWantToListen(item.id);
    } else {
      const wtl: WantToListenAlbum = {
        id: item.id,
        title: item.title,
        artist: item.artist,
        year: item.year,
        artworkUrl: item.artworkUrl,
      };
      addToWantToListen(wtl);
    }
  }

  const isEmpty = query.length === 0;

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>

      {/* Search bar */}
      <View style={[s.searchBar, { backgroundColor: isDark ? '#1e1e1e' : '#efefef' }]}>
        <FontAwesome name="search" size={15} color={colors.subtext} style={s.searchIcon} />
        <TextInput
          style={[s.input, { color: colors.text }]}
          placeholder={
            activeTab === 'albums'  ? 'Search albums…'  :
            activeTab === 'songs'   ? 'Search songs…'   :
            activeTab === 'artists' ? 'Search artists…' : 'Search users…'
          }
          placeholderTextColor={colors.subtext}
          value={query}
          onChangeText={handleChangeText}
          returnKeyType="search"
          onSubmitEditing={handleSubmit}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <Pressable onPress={handleClear} hitSlop={8}>
            <FontAwesome name="times-circle" size={15} color={colors.subtext} />
          </Pressable>
        )}
      </View>

      {/* Filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.tabsRow}
        style={[s.tabsContainer, { borderBottomColor: isDark ? '#222' : '#e5e5e5' }]}>
        {TABS.map(({ key, label }) => {
          const active = activeTab === key;
          return (
            <Pressable
              key={key}
              onPress={() => handleTabChange(key)}
              style={[
                s.tabPill,
                active ? s.tabPillActive : { backgroundColor: isDark ? '#1e1e1e' : '#f0f0f0' },
              ]}>
              <Text style={[s.tabLabel, { color: active ? '#fff' : colors.subtext }]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Body */}
      {isEmpty ? (
        recentSearches.length > 0 ? (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.recentContainer}>
            <View style={s.recentHeader}>
              <Text style={[s.recentTitle, { color: colors.text }]}>Recent</Text>
              <Pressable onPress={clearRecentSearches} hitSlop={8}>
                <Text style={s.clearAll}>Clear All</Text>
              </Pressable>
            </View>
            {recentSearches.map((term) => (
              <View key={term} style={[s.recentRow, { borderBottomColor: isDark ? '#222' : '#eee' }]}>
                <Pressable style={s.recentMain} onPress={() => handleRecentTap(term)}>
                  <FontAwesome name="clock-o" size={14} color={colors.subtext} style={s.recentIcon} />
                  <Text style={[s.recentTerm, { color: colors.text }]} numberOfLines={1}>{term}</Text>
                </Pressable>
                <Pressable onPress={() => removeRecentSearch(term)} hitSlop={12} style={s.recentRemove}>
                  <FontAwesome name="times" size={13} color={colors.subtext} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={s.emptyState}>
            <FontAwesome name="search" size={36} color={isDark ? '#2a2a2a' : '#ddd'} />
            <Text style={[s.emptyTitle, { color: colors.text }]}>
              {activeTab === 'users' ? 'Find friends' : `Search ${activeTab}`}
            </Text>
            <Text style={[s.emptySub, { color: colors.subtext }]}>
              {activeTab === 'albums'  ? 'Find albums to log or save for later.'
               : activeTab === 'songs'   ? 'Discover songs and explore music.'
               : activeTab === 'artists' ? 'Look up artists and their work.'
               : 'User profiles coming soon.'}
            </Text>
          </View>
        )
      ) : loading ? (
        <ActivityIndicator style={s.spinner} color="#FF3CAC" />
      ) : searched && results.length === 0 ? (
        <View style={s.emptyState}>
          <Text style={[s.emptyTitle, { color: colors.text }]}>No results</Text>
          <Text style={[s.emptySub, { color: colors.subtext }]}>
            {activeTab === 'users'
              ? 'User search is coming soon.'
              : `No ${activeTab} found for "${query}".`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.kind + item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 40 }}
          ItemSeparatorComponent={() => (
            <View style={[s.separator, { backgroundColor: isDark ? '#222' : '#eee' }]} />
          )}
          renderItem={({ item }) => {
            if (item.kind === 'album') {
              return (
                <AlbumRow
                  item={item}
                  isDark={isDark}
                  colors={colors}
                  isBookmarked={!!wantToListen.find((a) => a.id === item.id)}
                  onLog={() => handleLogAlbum(item)}
                  onBookmark={() => handleToggleBookmark(item)}
                />
              );
            }
            if (item.kind === 'song') {
              return <SongRow item={item} isDark={isDark} colors={colors} />;
            }
            return <ArtistRow item={item} isDark={isDark} colors={colors} />;
          }}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1 },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchIcon: { marginTop: 1 },
  input: { flex: 1, fontSize: 15, height: '100%' },

  tabsContainer: { flexGrow: 0, borderBottomWidth: StyleSheet.hairlineWidth },
  tabsRow: { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 10, gap: 8 },
  tabPill: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20 },
  tabPillActive: { backgroundColor: '#FF3CAC' },
  tabLabel: { fontSize: 14, fontWeight: '600' },

  recentContainer: { paddingBottom: 40 },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  recentTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  clearAll: { fontSize: 13, color: '#FF3CAC' },
  recentRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  recentMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  recentIcon: { width: 16, textAlign: 'center' },
  recentTerm: { fontSize: 15 },
  recentRemove: { paddingHorizontal: 16, paddingVertical: 13 },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 10,
    marginBottom: 60,
  },
  emptyTitle: { fontSize: 17, fontWeight: '600', marginTop: 12 },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  spinner: { marginTop: 48 },

  resultRow: { flexDirection: 'row', alignItems: 'center', paddingRight: 12 },
  resultMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  artwork: { width: 52, height: 52, borderRadius: 4, flexShrink: 0 },
  artPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  artistInitial: { fontSize: 20, fontWeight: '700' },
  resultText: { flex: 1, marginLeft: 12, gap: 3 },
  resultTitle: { fontSize: 15, fontWeight: '600' },
  resultSub: { fontSize: 13 },
  actionBtn: { paddingHorizontal: 8 },
  plusIcon: { fontSize: 24, fontWeight: '300' },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 80 },
});
