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
import { useAlbums, TopAlbum, TopSong, TopArtist } from '@/context/AlbumsContext';
import {
  spotifyGet,
  albumFromSpotify,
  trackFromSpotify,
  artistFromSpotify,
  SpotifyAlbum,
  SpotifyTrack,
  SpotifyArtist,
} from '@/context/SpotifyService';

type ResultItem = SpotifyAlbum | SpotifyTrack | SpotifyArtist;

export default function PickItemScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type: 'album' | 'song' | 'artist' }>();
  const { addTopAlbum, addTopSong, addTopArtist } = useAlbums();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAlbum = type === 'album';
  const isArtist = type === 'artist';

  const search = useCallback(async (text: string) => {
    if (!text.trim()) { setResults([]); setSearched(false); return; }
    setLoading(true);
    setSearched(true);
    try {
      const q = encodeURIComponent(text.trim());
      const spotifyType = isAlbum ? 'album' : isArtist ? 'artist' : 'track';
      const data = await spotifyGet(`/search?q=${q}&type=${spotifyType}&limit=10`);
      if (isAlbum) {
        setResults((data.albums?.items ?? []).filter(Boolean).map(albumFromSpotify));
      } else if (isArtist) {
        setResults((data.artists?.items ?? []).filter(Boolean).map(artistFromSpotify));
      } else {
        setResults((data.tracks?.items ?? []).filter(Boolean).map(trackFromSpotify));
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [isAlbum, isArtist]);

  function handleChangeText(text: string) {
    setQuery(text);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => search(text), 400);
  }

  function handleSelect(item: ResultItem) {
    if (isAlbum) {
      const a = item as SpotifyAlbum;
      const album: TopAlbum = { id: a.id, title: a.title, artist: a.artist, year: a.year, artworkUrl: a.artworkUrl };
      addTopAlbum(album);
    } else if (isArtist) {
      const a = item as SpotifyArtist;
      const artist: TopArtist = { id: a.id, name: a.name, artworkUrl: a.artworkUrl };
      addTopArtist(artist);
    } else {
      const t = item as SpotifyTrack;
      const song: TopSong = { id: t.id, title: t.title, artist: t.artist, artworkUrl: t.artworkUrl };
      addTopSong(song);
    }
    router.back();
  }

  const placeholder = isAlbum ? 'Search albums…' : isArtist ? 'Search artists…' : 'Search songs…';
  const emptyPrompt = isAlbum ? 'Search for an album to add.' : isArtist ? 'Search for an artist to add.' : 'Search for a song to add.';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.searchBar, { backgroundColor: isDark ? '#1e1e1e' : '#efefef' }]}>
        <Text style={[styles.searchIcon, { color: colors.subtext }]}>⌕</Text>
        <TextInput
          style={[styles.input, { color: colors.text }]}
          placeholder={placeholder}
          placeholderTextColor={colors.subtext}
          value={query}
          onChangeText={handleChangeText}
          returnKeyType="search"
          onSubmitEditing={() => { if (debounceTimer.current) clearTimeout(debounceTimer.current); search(query); }}
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
          <Text style={[styles.emptyText, { color: colors.subtext }]}>{emptyPrompt}</Text>
        </View>
      )}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const isArtistItem = isArtist;
          const title = isArtistItem
            ? (item as SpotifyArtist).name
            : isAlbum
            ? (item as SpotifyAlbum).title
            : (item as SpotifyTrack).title;
          const sub = isArtistItem
            ? (item as SpotifyArtist).genre
            : isAlbum
            ? `${(item as SpotifyAlbum).artist} · ${(item as SpotifyAlbum).year || ''}`
            : (item as SpotifyTrack).artist;
          const artworkRadius = isArtistItem ? 26 : 4;
          return (
            <Pressable
              style={({ pressed }) => [
                styles.resultRow,
                { backgroundColor: pressed ? (isDark ? '#222' : '#f0f0f0') : 'transparent' },
              ]}
              onPress={() => handleSelect(item)}>
              {item.artworkUrl ? (
                <Image source={{ uri: item.artworkUrl }} style={[styles.artwork, { borderRadius: artworkRadius }]} />
              ) : (
                <View style={[styles.artwork, { borderRadius: artworkRadius, backgroundColor: isDark ? '#2a2a2a' : '#e0e0e0' }]} />
              )}
              <View style={styles.resultText}>
                <Text style={[styles.resultTitle, { color: colors.text }]} numberOfLines={1}>{title}</Text>
                {sub ? <Text style={[styles.resultArtist, { color: colors.subtext }]} numberOfLines={1}>{sub}</Text> : null}
              </View>
              <Text style={[styles.addIcon, { color: colors.tint }]}>+</Text>
            </Pressable>
          );
        }}
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
  artwork: { width: 52, height: 52 },
  resultText: { flex: 1, marginLeft: 12, gap: 3 },
  resultTitle: { fontSize: 15, fontWeight: '600' },
  resultArtist: { fontSize: 13 },
  addIcon: { fontSize: 24, fontWeight: '300', marginLeft: 8 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 80 },
});
