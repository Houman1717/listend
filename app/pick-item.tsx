import {
  StyleSheet,
  View,
  Text,
  TextInput,
  FlatList,
  Image,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useRef, useCallback } from 'react';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAlbums, TopAlbum, TopSong } from '@/context/AlbumsContext';

type ResultItem = {
  id: string;
  title: string;
  artist: string;
  year?: number;
  artworkUrl: string;
};

export default function PickItemScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type: 'album' | 'song' }>();
  const { addTopAlbum, addTopSong } = useAlbums();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDark = colorScheme === 'dark';

  const isAlbum = type === 'album';
  const entity = isAlbum ? 'album' : 'song';

  function toItunesQuery(text: string) {
    return text.replace(/\s+by\s+/gi, ' ').trim();
  }

  const search = useCallback(async (text: string) => {
    if (!text.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(toItunesQuery(text))}&entity=${entity}&limit=25`;
      const res = await fetch(url);
      const data = await res.json();
      const items: ResultItem[] = (data.results ?? []).map((r: any) => ({
        id: String(isAlbum ? r.collectionId : r.trackId),
        title: isAlbum ? r.collectionName : r.trackName,
        artist: r.artistName,
        year: r.releaseDate ? new Date(r.releaseDate).getFullYear() : undefined,
        artworkUrl: (r.artworkUrl100 ?? '').replace('100x100', '300x300'),
      }));
      setResults(items);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [entity, isAlbum]);

  function handleChangeText(text: string) {
    setQuery(text);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => search(text), 400);
  }

  function handleSelect(item: ResultItem) {
    if (isAlbum) {
      const album: TopAlbum = {
        id: item.id,
        title: item.title,
        artist: item.artist,
        year: item.year ?? 0,
        artworkUrl: item.artworkUrl,
      };
      addTopAlbum(album);
    } else {
      const song: TopSong = {
        id: item.id,
        title: item.title,
        artist: item.artist,
        artworkUrl: item.artworkUrl,
      };
      addTopSong(song);
    }
    router.back();
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.searchBar, { backgroundColor: isDark ? '#1e1e1e' : '#efefef' }]}>
        <Text style={[styles.searchIcon, { color: colors.subtext }]}>⌕</Text>
        <TextInput
          style={[styles.input, { color: colors.text }]}
          placeholder={isAlbum ? 'Search albums…' : 'Search songs…'}
          placeholderTextColor={colors.subtext}
          value={query}
          onChangeText={handleChangeText}
          returnKeyType="search"
          onSubmitEditing={() => {
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
            search(query);
          }}
          autoFocus
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <Pressable onPress={() => { setQuery(''); setResults([]); setSearched(false); }}>
            <Text style={[styles.clearButton, { color: colors.subtext }]}>✕</Text>
          </Pressable>
        )}
      </View>

      {loading && <ActivityIndicator style={styles.spinner} color={colors.tint} />}

      {!loading && searched && results.length === 0 && (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.subtext }]}>No results found.</Text>
        </View>
      )}

      {!loading && !searched && (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.subtext }]}>
            {isAlbum ? 'Search for an album to add.' : 'Search for a song to add.'}
          </Text>
        </View>
      )}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [
              styles.resultRow,
              { backgroundColor: pressed ? (isDark ? '#222' : '#f0f0f0') : 'transparent' },
            ]}
            onPress={() => handleSelect(item)}>
            <Image source={{ uri: item.artworkUrl }} style={styles.artwork} />
            <View style={styles.resultText}>
              <Text style={[styles.resultTitle, { color: colors.text }]} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={[styles.resultArtist, { color: colors.subtext }]} numberOfLines={1}>
                {item.artist}{item.year ? ` · ${item.year}` : ''}
              </Text>
            </View>
            <Text style={[styles.addIcon, { color: colors.tint }]}>+</Text>
          </Pressable>
        )}
        ItemSeparatorComponent={() => (
          <View style={[styles.separator, { backgroundColor: isDark ? '#222' : '#eee' }]} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: { fontSize: 22, marginRight: 6, marginTop: -2 },
  input: { flex: 1, fontSize: 16, height: '100%' },
  clearButton: { fontSize: 14, paddingLeft: 8 },
  spinner: { marginTop: 40 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: 15 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  artwork: { width: 52, height: 52, borderRadius: 4 },
  resultText: { flex: 1, marginLeft: 12, gap: 3 },
  resultTitle: { fontSize: 15, fontWeight: '600' },
  resultArtist: { fontSize: 13 },
  addIcon: { fontSize: 24, fontWeight: '300', marginLeft: 8 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 80 },
});
