import {
  StyleSheet,
  View,
  Text,
  Image,
  Pressable,
  TextInput,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useState, useRef, useCallback, useEffect } from 'react';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAlbums } from '@/context/AlbumsContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { SpotifyAlbum } from '@/context/SpotifyService';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

async function searchAlbums(query: string): Promise<SpotifyAlbum[]> {
  const q = encodeURIComponent(query.trim());
  const res = await fetch(`${API_URL}/search?q=${q}&type=album`);
  if (!res.ok) throw new Error(`/search → ${res.status}`);
  return res.json();
}

// ─── Result row ───────────────────────────────────────────────────────────────

function AlbumRow({
  item,
  inPlaylist,
  onAdd,
  isDark,
  colors,
}: {
  item: SpotifyAlbum;
  inPlaylist: boolean;
  onAdd: () => void;
  isDark: boolean;
  colors: typeof Colors.light;
}) {
  return (
    <View style={[s.row, { borderBottomColor: isDark ? '#2e2018' : '#f5e6c8' }]}>
      {item.artworkUrl ? (
        <Image source={{ uri: item.artworkUrl }} style={s.artwork} />
      ) : (
        <View style={[s.artwork, s.artPlaceholder, { backgroundColor: isDark ? '#2a1e14' : '#e0e0e0' }]} />
      )}
      <View style={s.rowText}>
        <Text style={[s.rowTitle, { color: colors.text }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[s.rowSub, { color: colors.subtext }]} numberOfLines={1}>
          {item.artist}{item.year ? ` · ${item.year}` : ''}
        </Text>
      </View>
      <Pressable
        onPress={inPlaylist ? undefined : onAdd}
        hitSlop={12}
        style={[s.addBtn, inPlaylist && s.addBtnDone]}>
        {inPlaylist ? (
          <FontAwesome name="check" size={13} color="#fff" />
        ) : (
          <FontAwesome name="plus" size={13} color="#fff" />
        )}
      </Pressable>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PlaylistAddAlbumsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const { playlistId } = useLocalSearchParams<{ playlistId: string }>();
  const { playlists, addAlbumToPlaylist } = useAlbums();
  const { user } = useAuth();

  const playlist = playlists.find((p) => p.id === playlistId);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SpotifyAlbum[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  // Track albums added this session so the checkmark appears instantly
  const [addedIds, setAddedIds] = useState<Set<string>>(
    () => new Set(playlist?.albumIds ?? [])
  );

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep addedIds in sync if playlist changes externally
  useEffect(() => {
    if (playlist) setAddedIds(new Set(playlist.albumIds));
  }, [playlist?.albumIds.join(',')]);

  const runSearch = useCallback(async (text: string) => {
    if (!text.trim()) { setResults([]); setSearched(false); return; }
    setLoading(true);
    setSearched(true);
    try {
      const items = await searchAlbums(text);
      setResults(items);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleChangeText(text: string) {
    setQuery(text);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => runSearch(text), 400);
  }

  function handleClear() {
    setQuery('');
    setResults([]);
    setSearched(false);
  }

  function handleAdd(album: SpotifyAlbum) {
    if (!playlist) return;
    addAlbumToPlaylist(playlist.id, album.id);
    setAddedIds((prev) => new Set([...prev, album.id]));

    // Store album metadata so it's retrievable in playlist-detail even if never logged.
    // ignoreDuplicates: true ensures we never overwrite an existing logged entry.
    if (user) {
      supabase
        .from('user_albums')
        .upsert(
          {
            user_id:     user.id,
            spotify_id:  album.id,
            title:       album.title,
            artist:      album.artist,
            year:        album.year ?? 0,
            artwork_url: album.artworkUrl ?? null,
            rating:      0,
            listened_at: null,
          },
          { onConflict: 'user_id,spotify_id', ignoreDuplicates: true }
        )
        .then(({ error }) => {
          if (error) console.error('[PlaylistAddAlbums] catalog upsert error:', error.message);
        });
    }
  }

  const isEmpty = !query.trim();

  return (
    <>
      <Stack.Screen options={{ title: playlist ? `Add to "${playlist.name}"` : 'Add Albums' }} />

      <View style={[s.container, { backgroundColor: colors.background }]}>
        {/* Search bar */}
        <View style={[s.searchBar, { backgroundColor: isDark ? '#2e2018' : '#efefef', marginTop: 14 }]}>
          <FontAwesome name="search" size={15} color={colors.subtext} />
          <TextInput
            style={[s.input, { color: colors.text }]}
            placeholder="Search albums…"
            placeholderTextColor={colors.subtext}
            value={query}
            onChangeText={handleChangeText}
            returnKeyType="search"
            onSubmitEditing={() => {
              if (debounceTimer.current) clearTimeout(debounceTimer.current);
              runSearch(query);
            }}
            autoCorrect={false}
            autoCapitalize="none"
            autoFocus
          />
          {query.length > 0 && (
            <Pressable onPress={handleClear} hitSlop={8}>
              <FontAwesome name="times-circle" size={15} color={colors.subtext} />
            </Pressable>
          )}
        </View>

        {/* Body */}
        {loading ? (
          <ActivityIndicator style={s.spinner} color="#D4A017" />
        ) : isEmpty ? (
          <View style={s.emptyState}>
            <FontAwesome name="search" size={36} color={isDark ? '#3a2818' : '#ddd'} />
            <Text style={[s.emptyTitle, { color: colors.text }]}>Search for albums</Text>
            <Text style={[s.emptySub, { color: colors.subtext }]}>
              Type above to find albums and add them to this playlist.
            </Text>
          </View>
        ) : searched && results.length === 0 ? (
          <View style={s.emptyState}>
            <FontAwesome name="frown-o" size={36} color={isDark ? '#3a2818' : '#ddd'} />
            <Text style={[s.emptyTitle, { color: colors.text }]}>No results</Text>
            <Text style={[s.emptySub, { color: colors.subtext }]}>Try a different search term.</Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.listContent}
            renderItem={({ item }) => (
              <AlbumRow
                item={item}
                inPlaylist={addedIds.has(item.id)}
                onAdd={() => handleAdd(item)}
                isDark={isDark}
                colors={colors}
              />
            )}
            ItemSeparatorComponent={() => null}
          />
        )}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  input: { flex: 1, fontSize: 15, height: '100%' },

  spinner: { marginTop: 48 },

  listContent: { paddingBottom: 40 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  artwork: { width: 52, height: 52, borderRadius: 4, flexShrink: 0 },
  artPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  rowText: { flex: 1, gap: 3 },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 13 },

  addBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#D4A017',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  addBtnDone: {
    backgroundColor: '#3a2818',
  },

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
});
