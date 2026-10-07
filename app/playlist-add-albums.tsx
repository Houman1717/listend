import {
  StyleSheet,
  View,
  Text,
  Pressable,
  TextInput,
  FlatList,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { ColorsShape } from '@/constants/Colors';
import { useAlbums, LoggedAlbum } from '@/context/AlbumsContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { CatalogAlbum } from '@/context/CatalogService';
import { usePro } from '@/context/ProContext';
import { getProTheme, themeToColors } from '@/lib/proThemes';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

async function searchAlbums(query: string): Promise<CatalogAlbum[]> {
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
  item: CatalogAlbum;
  inPlaylist: boolean;
  onAdd: () => void;
  isDark: boolean;
  colors: ColorsShape;
}) {
  return (
    <View style={[s.row, { borderBottomColor: colors.border }]}>
      {item.artworkUrl ? (
        <ExpoImage source={{ uri: item.artworkUrl }} style={s.artwork} 
            contentFit="cover" cachePolicy="disk"
          />
      ) : (
        <View style={[s.artwork, s.artPlaceholder, { backgroundColor: colors.elevated }]} />
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
        style={[s.addBtn, { backgroundColor: inPlaylist ? colors.subtext : colors.tint }]}>
        {inPlaylist ? (
          <FontAwesome name="check" size={13} color="#fff" />
        ) : (
          <FontAwesome name="plus" size={13} color="#fff" />
        )}
      </Pressable>
    </View>
  );
}

// ─── My Listend grid cell — tap to select, many at once ──────────────────────

const GRID_PAD = 16;
const GRID_GAP = 12;
const GRID_COLS = 3;
const LABEL_H = 34;

function ListendCell({
  album,
  size,
  selected,
  landingRank,
  inPlaylist,
  onPress,
  colors,
}: {
  album: LoggedAlbum;
  size: number;
  selected: boolean;
  /** Position the album will take in the playlist once added. */
  landingRank: number | null;
  inPlaylist: boolean;
  onPress: () => void;
  colors: ColorsShape;
}) {
  return (
    <Pressable
      onPress={inPlaylist ? undefined : onPress}
      style={({ pressed }) => ({ width: size, opacity: inPlaylist ? 0.45 : pressed ? 0.75 : 1 })}>
      <View style={{ width: size, height: size }}>
        {album.artworkUrl ? (
          <ExpoImage
            source={{ uri: album.artworkUrl }}
            style={{ width: size, height: size, borderRadius: 8 }}
            contentFit="cover"
            cachePolicy="disk"
            recyclingKey={album.id}
          />
        ) : (
          <View style={{ width: size, height: size, borderRadius: 8, backgroundColor: album.coverColor, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontWeight: '700', fontSize: size * 0.32 }}>{album.title.charAt(0)}</Text>
          </View>
        )}
        {selected && <View style={[StyleSheet.absoluteFill, s.selectedRing, { borderColor: colors.tint }]} />}
        {selected && landingRank != null ? (
          <View style={[s.checkBadge, { backgroundColor: colors.tint }]}>
            <Text style={s.checkBadgeText}>{landingRank}</Text>
          </View>
        ) : inPlaylist ? (
          <View style={[s.checkBadge, { backgroundColor: colors.subtext }]}>
            <FontAwesome name="check" size={11} color="#fff" />
          </View>
        ) : null}
      </View>
      <View style={{ height: LABEL_H }}>
        <Text style={[s.cellTitle, { color: colors.text }]} numberOfLines={1}>{album.title}</Text>
        <Text style={[s.cellArtist, { color: colors.subtext }]} numberOfLines={1}>
          {inPlaylist ? 'In playlist' : album.artist}
        </Text>
      </View>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PlaylistAddAlbumsScreen() {
  const colorScheme = useColorScheme();
  const { isPro, proTheme } = usePro();
  const colors = (isPro && proTheme && proTheme !== 'default')
    ? themeToColors(getProTheme(proTheme))
    : Colors[colorScheme ?? 'light'];
  const isDark = colors.isDark;
  const { playlistId } = useLocalSearchParams<{ playlistId: string }>();
  const { playlists, loggedAlbums, addAlbumToPlaylist, addAlbumsToPlaylist } = useAlbums();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cellSize = (width - GRID_PAD * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

  const playlist = playlists.find((p) => p.id === playlistId);

  const [tab, setTab] = useState<'listend' | 'search'>(loggedAlbums.length > 0 ? 'listend' : 'search');
  const [filter, setFilter] = useState('');
  // Insertion-ordered, so albums land in the playlist in the order they were tapped.
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const listendAlbums = useMemo(() => {
    const seen = new Set<string>();
    const q = filter.trim().toLowerCase();
    return loggedAlbums.filter((a) => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return !q || a.title.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q);
    });
  }, [loggedAlbums, filter]);

  const listendRows = useMemo(() => {
    const rows: LoggedAlbum[][] = [];
    for (let i = 0; i < listendAlbums.length; i += GRID_COLS) rows.push(listendAlbums.slice(i, i + GRID_COLS));
    return rows;
  }, [listendAlbums]);

  // Selected albums append in tap order, so each one's future playlist number is known.
  const selectedRank = useMemo(() => {
    const m = new Map<string, number>();
    const base = playlist?.albumIds.length ?? 0;
    [...selected].forEach((id, i) => m.set(id, base + i + 1));
    return m;
  }, [selected, playlist?.albumIds.length]);

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleAddSelected() {
    if (!playlist || selected.size === 0) return;
    addAlbumsToPlaylist(playlist.id, [...selected]);
    router.back();
  }

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CatalogAlbum[]>([]);
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

  function handleAdd(album: CatalogAlbum) {
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
      <Stack.Screen
        options={{
          title: playlist ? `Add to "${playlist.name}"` : 'Add Albums',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }}
      />

      <View style={[s.container, { backgroundColor: colors.background }]}>
        {/* Source tabs */}
        <View style={[s.segment, { backgroundColor: isDark ? colors.surface : colors.elevated }]}>
          {(['listend', 'search'] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={[s.segmentBtn, tab === t && { backgroundColor: isDark ? colors.elevated : colors.surface }]}>
              <Text style={[s.segmentText, { color: tab === t ? colors.text : colors.subtext }]}>
                {t === 'listend' ? 'My Listend' : 'Search All'}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'listend' ? (
          <>
            <View style={[s.searchBar, { backgroundColor: isDark ? colors.surface : colors.elevated }]}>
              <FontAwesome name="search" size={15} color={colors.subtext} />
              <TextInput
                style={[s.input, { color: colors.text }]}
                placeholder="Filter your Listend…"
                placeholderTextColor={colors.subtext}
                value={filter}
                onChangeText={setFilter}
                returnKeyType="done"
                autoCorrect={false}
                autoCapitalize="none"
              />
              {filter.length > 0 && (
                <Pressable onPress={() => setFilter('')} hitSlop={8}>
                  <FontAwesome name="times-circle" size={15} color={colors.subtext} />
                </Pressable>
              )}
            </View>

            {listendAlbums.length === 0 ? (
              <View style={s.emptyState}>
                <FontAwesome name="music" size={36} color={colors.border} />
                <Text style={[s.emptyTitle, { color: colors.text }]}>
                  {filter.trim() ? 'No matches' : 'Nothing logged yet'}
                </Text>
                <Text style={[s.emptySub, { color: colors.subtext }]}>
                  {filter.trim() ? 'Try a different title or artist.' : 'Use Search All to find any album.'}
                </Text>
              </View>
            ) : (
              <FlatList
                data={listendRows}
                keyExtractor={(row) => row[0].id}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                contentContainerStyle={{ paddingHorizontal: GRID_PAD, paddingTop: 4, paddingBottom: 90 + insets.bottom }}
                getItemLayout={(_, index) => ({ length: cellSize + LABEL_H + GRID_GAP, offset: (cellSize + LABEL_H + GRID_GAP) * index, index })}
                initialNumToRender={6}
                windowSize={7}
                renderItem={({ item: row }) => (
                  <View style={{ flexDirection: 'row', gap: GRID_GAP, marginBottom: GRID_GAP }}>
                    {row.map((album) => (
                      <ListendCell
                        key={album.id}
                        album={album}
                        size={cellSize}
                        selected={selected.has(album.id)}
                        landingRank={selectedRank.get(album.id) ?? null}
                        inPlaylist={addedIds.has(album.id)}
                        onPress={() => toggleSelected(album.id)}
                        colors={colors}
                      />
                    ))}
                  </View>
                )}
              />
            )}

            {selected.size > 0 && (
              <View style={[s.addBar, { paddingBottom: Math.max(insets.bottom, 12), backgroundColor: colors.background, borderTopColor: colors.border }]}>
                <Pressable onPress={() => setSelected(new Set())} hitSlop={8} style={({ pressed }) => [s.clearBtn, { backgroundColor: isDark ? colors.surface : colors.elevated, opacity: pressed ? 0.7 : 1 }]}>
                  <Text style={[s.clearBtnText, { color: colors.text }]}>Clear</Text>
                </Pressable>
                <Pressable onPress={handleAddSelected} style={({ pressed }) => [s.addSelectedBtn, { backgroundColor: colors.tint, opacity: pressed ? 0.8 : 1 }]}>
                  <FontAwesome name="plus" size={14} color="#fff" />
                  <Text style={s.addSelectedText}>
                    Add {selected.size} {selected.size === 1 ? 'Album' : 'Albums'}
                  </Text>
                </Pressable>
              </View>
            )}
          </>
        ) : (
          <>
        {/* Search bar */}
        <View style={[s.searchBar, { backgroundColor: isDark ? colors.surface : colors.elevated }]}>
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
          <ActivityIndicator style={s.spinner} color={colors.tint} />
        ) : isEmpty ? (
          <View style={s.emptyState}>
            <FontAwesome name="search" size={36} color={colors.border} />
            <Text style={[s.emptyTitle, { color: colors.text }]}>Search for albums</Text>
            <Text style={[s.emptySub, { color: colors.subtext }]}>
              Type above to find albums and add them to this playlist.
            </Text>
          </View>
        ) : searched && results.length === 0 ? (
          <View style={s.emptyState}>
            <FontAwesome name="frown-o" size={36} color={colors.border} />
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
          </>
        )}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },

  segment: {
    flexDirection: 'row',
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 10,
    borderRadius: 10,
    padding: 3,
  },
  segmentBtn:  { flex: 1, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontSize: 14, fontWeight: '600' },

  selectedRing: { borderRadius: 8, borderWidth: 3 },
  checkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 5,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  checkBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800', fontVariant: ['tabular-nums'] },
  cellTitle:  { marginTop: 5, fontSize: 11, fontWeight: '600', lineHeight: 14 },
  cellArtist: { fontSize: 10, lineHeight: 13, marginTop: 1 },

  addBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  clearBtn:       { height: 50, paddingHorizontal: 20, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  clearBtnText:   { fontSize: 15, fontWeight: '600' },
  addSelectedBtn: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  addSelectedText: { fontSize: 16, fontWeight: '700', color: '#fff' },

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
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
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
