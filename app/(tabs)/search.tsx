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
import { useAlbums, PendingAlbum, WantToListenAlbum, Playlist } from '@/context/AlbumsContext';
import { SpotifyAlbum, SpotifyTrack, SpotifyArtist } from '@/context/SpotifyService';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

// ─── Backend URL ──────────────────────────────────────────────────────────────

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

// ─── Types ────────────────────────────────────────────────────────────────────

type SearchTab = 'albums' | 'songs' | 'artists' | 'users' | 'playlists';

type UserProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

type ResultItem =
  | (SpotifyAlbum  & { kind: 'album'  })
  | (SpotifyTrack  & { kind: 'song'   })
  | (SpotifyArtist & { kind: 'artist' });

// A recent-search entry stores the full item so we can show artwork + subtitle.
type RecentItem = {
  kind: 'album' | 'song' | 'artist';
  id: string;
  title: string;   // album/song title, or artist name
  subtitle: string; // artist · year  /  artist  /  genre
  artworkUrl: string;
  circular: boolean; // true for artists
};

const TABS: { key: SearchTab; label: string }[] = [
  { key: 'albums',    label: 'Albums'          },
  { key: 'songs',     label: 'Songs'           },
  { key: 'artists',   label: 'Artists'         },
  { key: 'users',     label: 'Listend Members' },
  { key: 'playlists', label: 'Playlists'       },
];

const RECENT_KEY = '@listend:recentItems_v2';
const MAX_RECENT = 10;

// ─── Backend search ───────────────────────────────────────────────────────────

async function searchBackend(tab: SearchTab, query: string): Promise<ResultItem[]> {
  if (tab === 'users') return [];

  const type = tab === 'albums' ? 'album' : tab === 'songs' ? 'track' : 'artist';
  const q = encodeURIComponent(query.trim());
  const res = await fetch(`${API_URL}/search?q=${q}&type=${type}`);
  if (!res.ok) throw new Error(`/search → ${res.status}`);
  const data = await res.json();

  if (tab === 'albums')  return (data as SpotifyAlbum[]).map(a => ({ kind: 'album'  as const, ...a }));
  if (tab === 'songs')   return (data as SpotifyTrack[]).map(t => ({ kind: 'song'   as const, ...t }));
  return                        (data as SpotifyArtist[]).map(a => ({ kind: 'artist' as const, ...a }));
}

function resultToRecentItem(item: ResultItem): RecentItem {
  if (item.kind === 'album') {
    return {
      kind: 'album',
      id: item.id,
      title: item.title,
      subtitle: item.artist + (item.year ? ` · ${item.year}` : ''),
      artworkUrl: item.artworkUrl,
      circular: false,
    };
  }
  if (item.kind === 'song') {
    return {
      kind: 'song',
      id: item.id,
      title: item.title,
      subtitle: item.artist,
      artworkUrl: item.artworkUrl,
      circular: false,
    };
  }
  // artist
  return {
    kind: 'artist',
    id: item.id,
    title: item.name,
    subtitle: item.genre ?? '',
    artworkUrl: item.artworkUrl,
    circular: true,
  };
}

// ─── Row components ───────────────────────────────────────────────────────────

function AlbumRow({
  item, isDark, colors, isBookmarked, onView, onLog, onBookmark, onSaveRecent,
}: {
  item: SpotifyAlbum & { kind: 'album' };
  isDark: boolean;
  colors: typeof Colors.light;
  isBookmarked: boolean;
  onView: () => void;
  onLog: () => void;
  onBookmark: () => void;
  onSaveRecent: () => void;
}) {
  return (
    <View style={s.resultRow}>
      <Pressable
        style={({ pressed }) => [
          s.resultMain,
          { backgroundColor: pressed ? (isDark ? '#222' : '#f0f0f0') : 'transparent' },
        ]}
        onPress={() => { onSaveRecent(); onView(); }}>
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
      <Pressable onPress={() => { onSaveRecent(); onLog(); }} hitSlop={8} style={s.actionBtn}>
        <Text style={[s.plusIcon, { color: colors.tint }]}>+</Text>
      </Pressable>
    </View>
  );
}

function SongRow({ item, isDark, colors, onSaveRecent }: {
  item: SpotifyTrack & { kind: 'song' };
  isDark: boolean;
  colors: typeof Colors.light;
  onSaveRecent: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [s.resultRow, { paddingRight: 16, backgroundColor: pressed ? (isDark ? '#222' : '#f0f0f0') : 'transparent' }]}
      onPress={onSaveRecent}>
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
    </Pressable>
  );
}

function ArtistRow({ item, isDark, colors, onPress, onSaveRecent }: {
  item: SpotifyArtist & { kind: 'artist' };
  isDark: boolean;
  colors: typeof Colors.light;
  onPress: () => void;
  onSaveRecent: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [s.resultRow, { paddingRight: 16, backgroundColor: pressed ? (isDark ? '#222' : '#f0f0f0') : 'transparent' }]}
      onPress={() => { onSaveRecent(); onPress(); }}>
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
    </Pressable>
  );
}

// ─── Playlist result row ──────────────────────────────────────────────────────

function PlaylistRow({
  item,
  isDark,
  colors,
  onPress,
}: {
  item: Playlist;
  isDark: boolean;
  colors: typeof Colors.light;
  onPress: () => void;
}) {
  const count = item.albumIds.length;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.resultRow,
        { paddingRight: 16, backgroundColor: pressed ? (isDark ? '#222' : '#f0f0f0') : 'transparent' },
      ]}>
      <View style={s.resultMain}>
        <View style={[s.playlistIcon, { backgroundColor: isDark ? '#2a2a2a' : '#e8e8e8' }]}>
          <FontAwesome name="list" size={18} color="#FF3CAC" />
        </View>
        <View style={s.resultText}>
          <Text style={[s.resultTitle, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
          <Text style={[s.resultSub, { color: colors.subtext }]} numberOfLines={1}>
            {count === 1 ? '1 album' : `${count} albums`}
            {item.description ? `  ·  ${item.description}` : ''}
          </Text>
        </View>
      </View>
      <FontAwesome name="chevron-right" size={13} color={isDark ? '#444' : '#ccc'} />
    </Pressable>
  );
}

// ─── Recent item row ──────────────────────────────────────────────────────────

function RecentRow({
  item,
  isDark,
  colors,
  onPress,
  onRemove,
}: {
  item: RecentItem;
  isDark: boolean;
  colors: typeof Colors.light;
  onPress: () => void;
  onRemove: () => void;
}) {
  const imgRadius = item.circular ? 26 : 4;
  return (
    <View style={[s.recentRow, { borderBottomColor: isDark ? '#222' : '#eee' }]}>
      <Pressable
        style={({ pressed }) => [s.recentMain, { backgroundColor: pressed ? (isDark ? '#1a1a1a' : '#f5f5f5') : 'transparent' }]}
        onPress={onPress}>
        {/* artwork */}
        {item.artworkUrl ? (
          <Image source={{ uri: item.artworkUrl }} style={[s.recentArt, { borderRadius: imgRadius }]} />
        ) : (
          <View style={[s.recentArt, { borderRadius: imgRadius, backgroundColor: isDark ? '#2a2a2a' : '#e0e0e0', justifyContent: 'center', alignItems: 'center' }]}>
            <Text style={[s.recentInitial, { color: colors.subtext }]}>{item.title.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        {/* text */}
        <View style={s.recentText}>
          <Text style={[s.recentTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
          {item.subtitle ? (
            <Text style={[s.recentSub, { color: colors.subtext }]} numberOfLines={1}>{item.subtitle}</Text>
          ) : null}
        </View>
        {/* kind pill */}
        <View style={[s.kindPill, { backgroundColor: isDark ? '#2a2a2a' : '#e8e8e8' }]}>
          <Text style={[s.kindLabel, { color: colors.subtext }]}>
            {item.kind === 'album' ? 'Album' : item.kind === 'song' ? 'Song' : 'Artist'}
          </Text>
        </View>
      </Pressable>
      <Pressable onPress={onRemove} hitSlop={12} style={s.recentRemove}>
        <FontAwesome name="times" size={13} color={colors.subtext} />
      </Pressable>
    </View>
  );
}

// ─── User result row ──────────────────────────────────────────────────────────

function UserRow({
  item,
  isDark,
  colors,
  onPress,
}: {
  item: UserProfile;
  isDark: boolean;
  colors: typeof Colors.light;
  onPress: () => void;
}) {
  const name    = item.display_name || item.username || 'Unknown';
  const initial = name.charAt(0).toUpperCase();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.resultRow,
        { paddingRight: 16, backgroundColor: pressed ? (isDark ? '#222' : '#f0f0f0') : 'transparent' },
      ]}>
      <View style={s.resultMain}>
        {/* Avatar */}
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={s.userAvatar} />
        ) : (
          <View style={[s.userAvatar, s.userAvatarFallback, { backgroundColor: isDark ? '#2a2a2a' : '#e0e0e0' }]}>
            <Text style={[s.userAvatarInitial, { color: colors.subtext }]}>{initial}</Text>
          </View>
        )}
        {/* Text */}
        <View style={s.resultText}>
          <Text style={[s.resultTitle, { color: colors.text }]} numberOfLines={1}>{name}</Text>
          {item.username ? (
            <Text style={[s.resultSub, { color: colors.subtext }]} numberOfLines={1}>@{item.username}</Text>
          ) : null}
        </View>
        <FontAwesome name="chevron-right" size={13} color={isDark ? '#444' : '#ccc'} />
      </View>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SearchScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { user } = useAuth();
  const { setPendingAlbum, wantToListen, addToWantToListen, removeFromWantToListen, playlists } = useAlbums();

  const [activeTab, setActiveTab] = useState<SearchTab>('albums');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ResultItem[]>([]);
  const [playlistResults, setPlaylistResults] = useState<Playlist[]>([]);
  const [userResults, setUserResults] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(RECENT_KEY)
      .then((v) => { if (v) setRecentItems(JSON.parse(v)); })
      .catch(() => {});
  }, []);

  function saveRecentItem(item: ResultItem) {
    const entry = resultToRecentItem(item);
    setRecentItems((prev) => {
      const next = [entry, ...prev.filter((r) => !(r.kind === entry.kind && r.id === entry.id))].slice(0, MAX_RECENT);
      AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }

  function removeRecentItem(kind: string, id: string) {
    setRecentItems((prev) => {
      const next = prev.filter((r) => !(r.kind === kind && r.id === id));
      AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }

  function clearRecentItems() {
    setRecentItems([]);
    AsyncStorage.removeItem(RECENT_KEY).catch(() => {});
  }

  const search = useCallback(async (text: string, tab: SearchTab) => {
    if (!text.trim()) {
      setResults([]);
      setPlaylistResults([]);
      setUserResults([]);
      setSearched(false);
      return;
    }
    setSearched(true);

    if (tab === 'playlists') {
      const q = text.trim().toLowerCase();
      setPlaylistResults(
        playlists.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.description ?? '').toLowerCase().includes(q)
        )
      );
      return;
    }

    if (tab === 'users') {
      // Require at least 2 characters before querying
      if (text.trim().length < 2) {
        setUserResults([]);
        setSearched(false);
        return;
      }
      setLoading(true);
      try {
        const pattern = `%${text.trim()}%`;
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .or(`username.ilike.${pattern},display_name.ilike.${pattern}`)
          .limit(30);

        if (error) throw error;

        // Filter out the current user's own profile
        const filtered = (data ?? []).filter((u) => u.id !== user?.id);
        setUserResults(filtered);
      } catch (e) {
        console.error('[Search] User search error:', e);
        setUserResults([]);
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      const items = await searchBackend(tab, text);
      setResults(items);
    } catch (e) {
      console.error('[Search] Error:', e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [playlists, user?.id]);

  function handleChangeText(text: string) {
    setQuery(text);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => search(text, activeTab), 400);
  }

  function handleSubmit() {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    search(query, activeTab);
  }

  function handleClear() { setQuery(''); setResults([]); setUserResults([]); setSearched(false); }

  function handleTabChange(tab: SearchTab) {
    setActiveTab(tab);
    setResults([]);
    setUserResults([]);
    setSearched(false);
    if (query.trim()) {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      search(query, tab);
    }
  }

  function handleRecentTap(item: RecentItem) {
    setQuery(item.title);
    // Switch tab to match the kind
    const tab: SearchTab = item.kind === 'album' ? 'albums' : item.kind === 'song' ? 'songs' : 'artists';
    setActiveTab(tab);
    search(item.title, tab);
  }

  function handleLogAlbum(item: SpotifyAlbum) {
    router.push({
      pathname: '/album-detail',
      params: { id: item.id, title: item.title, artist: item.artist, year: String(item.year), artworkUrl: item.artworkUrl },
    });
  }

  function handleLogDirect(item: SpotifyAlbum) {
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
      <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: isDark ? '#222' : '#e5e5e5' }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingRight: 8 }}
          style={{ overflow: 'visible' }}>
          {TABS.map(({ key, label }) => {
            const active = activeTab === key;
            return (
              <Pressable
                key={key}
                onPress={() => handleTabChange(key)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 20,
                  backgroundColor: active ? '#FF3CAC' : (isDark ? '#2C2C2E' : '#f0f0f0'),
                }}>
                <Text style={{ color: active ? '#fff' : colors.subtext, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Body */}
      {isEmpty ? (
        recentItems.length > 0 ? (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.recentContainer}>
            <View style={s.recentHeader}>
              <Text style={[s.recentHeading, { color: colors.text }]}>Recent Searches</Text>
              <Pressable onPress={clearRecentItems} hitSlop={8}>
                <Text style={s.clearAll}>Clear All</Text>
              </Pressable>
            </View>
            {recentItems.map((item) => (
              <RecentRow
                key={item.kind + item.id}
                item={item}
                isDark={isDark}
                colors={colors}
                onPress={() => handleRecentTap(item)}
                onRemove={() => removeRecentItem(item.kind, item.id)}
              />
            ))}
          </ScrollView>
        ) : (
          <View style={s.emptyState}>
            <FontAwesome name="search" size={36} color={isDark ? '#2a2a2a' : '#ddd'} />
            <Text style={[s.emptyTitle, { color: colors.text }]}>
              {activeTab === 'users' ? 'Find people'
               : activeTab === 'playlists' ? 'Search playlists'
               : `Search ${activeTab}`}
            </Text>
            <Text style={[s.emptySub, { color: colors.subtext }]}>
              {activeTab === 'albums'    ? 'Find albums to log or save for later.'
               : activeTab === 'songs'   ? 'Discover songs and explore music.'
               : activeTab === 'artists' ? 'Look up artists and their work.'
               : activeTab === 'playlists' ? 'Search your playlists by name or description.'
               : 'Search for Listend members by name or username.'}
            </Text>
          </View>
        )
      ) : loading ? (
        <ActivityIndicator style={s.spinner} color="#FF3CAC" />
      ) : searched && activeTab === 'users' && userResults.length === 0 ? (
        <View style={s.emptyState}>
          <FontAwesome name="user-o" size={36} color={isDark ? '#2a2a2a' : '#ddd'} />
          <Text style={[s.emptyTitle, { color: colors.text }]}>No users found</Text>
          <Text style={[s.emptySub, { color: colors.subtext }]}>
            No one matched "{query}". Try a different name or username.
          </Text>
        </View>
      ) : searched && activeTab === 'users' ? (
        <FlatList
          data={userResults}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 40 }}
          ItemSeparatorComponent={() => (
            <View style={[s.separator, { backgroundColor: isDark ? '#222' : '#eee' }]} />
          )}
          renderItem={({ item }) => (
            <UserRow
              item={item}
              isDark={isDark}
              colors={colors}
              onPress={() => router.push({ pathname: '/user-profile', params: { userId: item.id } })}
            />
          )}
        />
      ) : searched && activeTab === 'playlists' && playlistResults.length === 0 ? (
        <View style={s.emptyState}>
          <Text style={[s.emptyTitle, { color: colors.text }]}>No playlists found</Text>
          <Text style={[s.emptySub, { color: colors.subtext }]}>
            No playlists match "{query}".
          </Text>
        </View>
      ) : searched && activeTab !== 'playlists' && results.length === 0 ? (
        <View style={s.emptyState}>
          <Text style={[s.emptyTitle, { color: colors.text }]}>No results</Text>
          <Text style={[s.emptySub, { color: colors.subtext }]}>
            No {activeTab} found for "{query}".
          </Text>
        </View>
      ) : activeTab === 'playlists' ? (
        <FlatList
          data={playlistResults}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 40 }}
          ItemSeparatorComponent={() => (
            <View style={[s.separator, { backgroundColor: isDark ? '#222' : '#eee' }]} />
          )}
          renderItem={({ item }) => (
            <PlaylistRow
              item={item}
              isDark={isDark}
              colors={colors}
              onPress={() => router.push({ pathname: '/playlist-detail', params: { id: item.id } })}
            />
          )}
        />
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
                  onView={() => handleLogAlbum(item)}
                  onLog={() => handleLogDirect(item)}
                  onBookmark={() => handleToggleBookmark(item)}
                  onSaveRecent={() => saveRecentItem(item)}
                />
              );
            }
            if (item.kind === 'song') {
              return (
                <SongRow
                  item={item}
                  isDark={isDark}
                  colors={colors}
                  onSaveRecent={() => saveRecentItem(item)}
                />
              );
            }
            return (
              <ArtistRow
                item={item}
                isDark={isDark}
                colors={colors}
                onPress={() => router.push({ pathname: '/artist-detail', params: { id: item.id, name: item.name, artworkUrl: item.artworkUrl } })}
                onSaveRecent={() => saveRecentItem(item)}
              />
            );
          }}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, paddingTop: 48 },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginTop: 14,
    marginBottom: 8,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchIcon: { marginTop: 1 },
  input: { flex: 1, fontSize: 15, height: '100%' },


  // ── Recent searches ─────────────────────────────────────────────────────────
  recentContainer: { paddingBottom: 40 },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 10,
  },
  recentHeading: { fontSize: 17, fontWeight: '700' },
  clearAll: { fontSize: 13, color: '#FF3CAC' },

  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  recentMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  recentArt: { width: 48, height: 48, flexShrink: 0 },
  recentInitial: { fontSize: 18, fontWeight: '700' },
  recentText: { flex: 1, gap: 2 },
  recentTitle: { fontSize: 15, fontWeight: '600' },
  recentSub: { fontSize: 13 },
  kindPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  kindLabel: { fontSize: 11, fontWeight: '600' },
  recentRemove: { paddingHorizontal: 16, paddingVertical: 14 },

  // ── Empty state ──────────────────────────────────────────────────────────────
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

  // ── Result rows ──────────────────────────────────────────────────────────────
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

  playlistIcon: {
    width: 52,
    height: 52,
    borderRadius: 4,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── User rows ────────────────────────────────────────────────────────────────
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    flexShrink: 0,
  },
  userAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarInitial: {
    fontSize: 18,
    fontWeight: '700',
  },
});
