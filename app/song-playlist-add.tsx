import {
  StyleSheet,
  View,
  Text,
  Pressable,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { Image as ExpoImage } from 'expo-image';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { usePro } from '@/context/ProContext';
import { getProTheme, themeToColors } from '@/lib/proThemes';
import { useSongPlaylists } from '@/context/SongPlaylistsContext';
import { useSongReviews } from '@/context/SongReviewsContext';
import { useAndroidKeyboardHeight } from '@/hooks/useAndroidKeyboardHeight';
import type { CatalogTrack } from '@/context/CatalogService';
import type { SongMeta } from '@/lib/songReviews';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

// Pick songs for a song playlist — from your logged songs or a catalog search.
// Taps build a selection (in tap order); "Add" appends them all at once.

export default function SongPlaylistAddScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useAndroidKeyboardHeight();
  const headerHeight = useHeaderHeight();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isPro, proTheme } = usePro();
  const colors = useMemo(
    () => (isPro && proTheme !== 'default' ? themeToColors(getProTheme(proTheme)) : Colors[colorScheme ?? 'dark']),
    [isPro, proTheme, colorScheme],
  );
  const isDark = colors.isDark;

  const { getSongPlaylist, addSongsToPlaylist } = useSongPlaylists();
  const { songReviews } = useSongReviews();
  const playlist = getSongPlaylist(id);
  const already = useMemo(() => new Set(playlist?.songs.map(x => x.id) ?? []), [playlist?.songs]);

  const [tab, setTab] = useState<'mine' | 'search'>(songReviews.length > 0 ? 'mine' : 'search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SongMeta[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [selected, setSelected] = useState<SongMeta[]>([]);
  const [saving, setSaving] = useState(false);
  const searchSeq = useRef(0);

  // Debounced catalog search.
  useEffect(() => {
    if (tab !== 'search') return;
    const q = query.trim();
    if (q.length < 2) { setResults(null); setSearching(false); return; }
    const seq = ++searchSeq.current;
    setSearching(true);
    setSearchFailed(false);
    const t = setTimeout(() => {
      fetch(`${API_URL}/search?q=${encodeURIComponent(q)}&type=track`)
        .then(r => r.ok ? r.json() : Promise.reject(r.status))
        .then((data: CatalogTrack[]) => {
          if (seq !== searchSeq.current) return;
          setResults(data.map(t => ({
            id:         t.id,
            title:      t.title,
            artist:     t.artist,
            artworkUrl: t.artworkUrl || undefined,
            albumTitle: t.albumTitle || undefined,
            durationMs: t.durationMs || undefined,
          })));
        })
        .catch(() => { if (seq === searchSeq.current) { setResults(null); setSearchFailed(true); } })
        .finally(() => { if (seq === searchSeq.current) setSearching(false); });
    }, 350);
    return () => clearTimeout(t);
  }, [query, tab]);

  const mine: SongMeta[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    return songReviews
      .filter(x => !q || x.title.toLowerCase().includes(q) || x.artist.toLowerCase().includes(q))
      .map(x => ({
        id: x.songId, title: x.title, artist: x.artist, albumId: x.albumId,
        albumTitle: x.albumTitle, artworkUrl: x.artworkUrl, durationMs: x.durationMs,
      }));
  }, [songReviews, query]);

  const data = tab === 'mine' ? mine : (results ?? []);
  const selectedIds = new Set(selected.map(x => x.id));

  function toggle(song: SongMeta) {
    if (already.has(song.id)) return;
    setSelected(prev => prev.some(x => x.id === song.id) ? prev.filter(x => x.id !== song.id) : [...prev, song]);
  }

  async function handleAdd() {
    if (!playlist || selected.length === 0 || saving) return;
    setSaving(true);
    const ok = await addSongsToPlaylist(playlist.id, selected);
    setSaving(false);
    if (ok) router.back();
    else Alert.alert("Couldn't add songs", 'Check your connection and try again.');
  }

  let empty = '';
  if (tab === 'mine') empty = query.trim() ? `No logged songs matching "${query.trim()}"` : 'You haven\'t logged any songs yet — try Search.';
  else if (searching) empty = '';
  else if (searchFailed) empty = "Search isn't working right now. Try again in a moment.";
  else if (query.trim().length < 2) empty = 'Search for any song.';
  else empty = `No songs found for "${query.trim()}"`;

  return (
    // iOS: KAV lifts the Add button over the keys. Android (edge-to-edge) never
    // resizes for the keyboard, so pad by its measured height instead.
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
      style={[s.root, { backgroundColor: colors.background, paddingBottom: keyboardHeight }]}>
      <Stack.Screen options={{
        title: playlist ? `Add to ${playlist.name}` : 'Add Songs',
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }} />

      <View style={[s.tabs, { borderBottomColor: colors.border }]}>
        {(['mine', 'search'] as const).map(k => (
          <Pressable key={k} onPress={() => setTab(k)} style={[s.tab, tab === k && { borderBottomColor: colors.tint }]}>
            <Text style={[s.tabText, { color: tab === k ? colors.tint : '#a07850' }]}>{k === 'mine' ? 'My Songs' : 'Search'}</Text>
          </Pressable>
        ))}
      </View>

      <View style={[s.searchBar, { borderBottomColor: colors.border }]}>
        <FontAwesome name="search" size={14} color={colors.subtext} />
        <TextInput
          style={[s.searchInput, { color: colors.text }]}
          value={query}
          onChangeText={setQuery}
          placeholder={tab === 'mine' ? 'Filter your songs…' : 'Search songs…'}
          placeholderTextColor={colors.subtext}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoFocus={tab === 'search'}
        />
        {searching && <ActivityIndicator size="small" color={colors.tint} />}
      </View>

      <FlatList
        style={{ flex: 1 }}
        data={data}
        keyExtractor={item => item.id}
        contentContainerStyle={s.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListEmptyComponent={empty ? <Text style={[s.empty, { color: colors.subtext }]}>{empty}</Text> : null}
        renderItem={({ item }) => {
          const inPlaylist = already.has(item.id);
          const picked = selectedIds.has(item.id);
          return (
            <Pressable
              onPress={() => toggle(item)}
              disabled={inPlaylist}
              style={({ pressed }) => [s.row, { borderBottomColor: colors.border, opacity: inPlaylist ? 0.45 : pressed ? 0.7 : 1 }]}>
              {item.artworkUrl ? (
                <ExpoImage source={{ uri: item.artworkUrl }} style={s.art} contentFit="cover" cachePolicy="disk" />
              ) : (
                <View style={[s.art, { backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }]}>
                  <FontAwesome name="music" size={14} color={colors.subtext} />
                </View>
              )}
              <View style={s.text}>
                <Text style={[s.title, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
                <Text style={[s.sub, { color: colors.subtext }]} numberOfLines={1}>
                  {item.artist}{item.albumTitle ? ` · ${item.albumTitle}` : ''}
                </Text>
              </View>
              {inPlaylist ? (
                <Text style={[s.added, { color: colors.subtext }]}>Added</Text>
              ) : (
                <View style={[s.check, { borderColor: picked ? colors.tint : colors.border, backgroundColor: picked ? colors.tint : 'transparent' }]}>
                  {picked && <FontAwesome name="check" size={11} color="#fff" />}
                </View>
              )}
            </Pressable>
          );
        }}
      />

      {selected.length > 0 && (
        <View style={[s.footer, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: 12 + (keyboardHeight > 0 ? 0 : insets.bottom) }]}>
          <Pressable
            onPress={handleAdd}
            disabled={saving}
            style={({ pressed }) => [s.addBtn, { backgroundColor: colors.tint, opacity: saving ? 0.6 : pressed ? 0.85 : 1 }]}>
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.addBtnText}>Add {selected.length} song{selected.length === 1 ? '' : 's'}</Text>}
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: 14, fontWeight: '600' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  searchInput: { flex: 1, fontSize: 15, height: 38 },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  empty: { textAlign: 'center', marginTop: 50, fontSize: 15, paddingHorizontal: 24, lineHeight: 21 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  art: { width: 46, height: 46, borderRadius: 5 },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '600' },
  sub: { fontSize: 12 },
  added: { fontSize: 12 },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  addBtn: { height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
