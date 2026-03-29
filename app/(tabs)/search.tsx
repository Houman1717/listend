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
import { useRouter } from 'expo-router';
import { useState, useRef, useCallback } from 'react';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAlbums, PendingAlbum } from '@/context/AlbumsContext';

type ItunesAlbum = {
  collectionId: number;
  collectionName: string;
  artistName: string;
  artworkUrl100: string;
  releaseDate: string;
};

export default function SearchScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { setPendingAlbum } = useAlbums();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ItunesAlbum[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function toItunesQuery(text: string) {
    // Strip natural language connectors like "Blonde by Frank Ocean" → "Blonde Frank Ocean"
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
      const term = encodeURIComponent(toItunesQuery(text));
      const url = `https://itunes.apple.com/search?term=${term}&entity=album&limit=25`;
      const res = await fetch(url);
      const data = await res.json();
      setResults(data.results ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleChangeText(text: string) {
    setQuery(text);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => search(text), 400);
  }

  function handleSelectAlbum(album: ItunesAlbum) {
    const year = new Date(album.releaseDate).getFullYear();
    const hqArtwork = album.artworkUrl100.replace('100x100', '300x300');

    const pending: PendingAlbum = {
      itunesId: album.collectionId,
      title: album.collectionName,
      artist: album.artistName,
      year,
      artworkUrl: hqArtwork,
    };

    setPendingAlbum(pending);
    router.push('/log-album');
  }

  const isDark = colorScheme === 'dark';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.searchBar, { backgroundColor: isDark ? '#1e1e1e' : '#efefef' }]}>
        <Text style={[styles.searchIcon, { color: colors.subtext }]}>⌕</Text>
        <TextInput
          style={[styles.input, { color: colors.text }]}
          placeholder="Artist, album, or keyword…"
          placeholderTextColor={colors.subtext}
          value={query}
          onChangeText={handleChangeText}
          returnKeyType="search"
          onSubmitEditing={() => {
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
            search(query);
          }}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <Pressable onPress={() => { setQuery(''); setResults([]); setSearched(false); }}>
            <Text style={[styles.clearButton, { color: colors.subtext }]}>✕</Text>
          </Pressable>
        )}
      </View>

      {loading && (
        <ActivityIndicator style={styles.spinner} color={colors.tint} />
      )}

      {!loading && searched && results.length === 0 && (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.subtext }]}>No albums found.</Text>
        </View>
      )}

      {!loading && !searched && (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.subtext }]}>Search for an album to log it.</Text>
        </View>
      )}

      <FlatList
        data={results}
        keyExtractor={(item) => String(item.collectionId)}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [
              styles.resultRow,
              { backgroundColor: pressed ? (isDark ? '#222' : '#f0f0f0') : 'transparent' },
            ]}
            onPress={() => handleSelectAlbum(item)}>
            <Image
              source={{ uri: item.artworkUrl100 }}
              style={styles.artwork}
            />
            <View style={styles.resultText}>
              <Text style={[styles.resultTitle, { color: colors.text }]} numberOfLines={1}>
                {item.collectionName}
              </Text>
              <Text style={[styles.resultArtist, { color: colors.subtext }]} numberOfLines={1}>
                {item.artistName} · {new Date(item.releaseDate).getFullYear()}
              </Text>
            </View>
            <Text style={[styles.logChevron, { color: colors.tint }]}>+</Text>
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
  container: {
    flex: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    fontSize: 22,
    marginRight: 6,
    marginTop: -2,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  clearButton: {
    fontSize: 14,
    paddingLeft: 8,
  },
  spinner: {
    marginTop: 40,
  },
  empty: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    fontSize: 15,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  artwork: {
    width: 52,
    height: 52,
    borderRadius: 4,
  },
  resultText: {
    flex: 1,
    marginLeft: 12,
    gap: 3,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  resultArtist: {
    fontSize: 13,
  },
  logChevron: {
    fontSize: 24,
    fontWeight: '300',
    marginLeft: 8,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 80,
  },
});
