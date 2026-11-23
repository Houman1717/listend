import {
  StyleSheet,
  View,
  Text,
  Pressable,
  FlatList,
  Modal,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { usePro } from '@/context/ProContext';
import { getProTheme, themeToColors } from '@/lib/proThemes';
import { useState, useCallback, useEffect, useRef } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Stack } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAlbums, LoggedAlbum } from '@/context/AlbumsContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { navigateToAlbum } from '@/lib/navigateToAlbum';
import { useSongReviews } from '@/context/SongReviewsContext';
import { SongListenHistoryModal } from '@/components/SongListenHistoryModal';
import { fetchUserSongReviews, fetchUserSongReListens, songKey, type SongReview, type SongReListen } from '@/lib/songReviews';
import { openSongPage } from '@/lib/openSong';
import {
  AlbumListenHistoryModal, fetchAlbumListenHistory, withoutEntry, type AlbumHistoryData as HistoryModalData,
} from '@/components/AlbumListenHistoryModal';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(raw: string): string {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Album row item ───────────────────────────────────────────────────────────

function ReListenedAlbumRow({
  album,
  isDark,
  colors,
  onPress,
}: {
  album: LoggedAlbum;
  isDark: boolean;
  colors: any;
  onPress: () => void;
}) {
  const totalListens = (album.reListenCount ?? 0) + 1;
  return (
    <Pressable
      style={({ pressed }) => [s.albumRow, { borderBottomColor: isDark ? '#2a1e14' : '#e8e8e8', opacity: pressed ? 0.7 : 1 }]}
      onPress={onPress}>
      {album.artworkUrl ? (
        <ExpoImage
          source={{ uri: album.artworkUrl }}
          style={s.albumArt}
          contentFit="cover"
          cachePolicy="disk"
        />
      ) : (
        <View style={[s.albumArt, { backgroundColor: album.coverColor ?? '#2E2018', justifyContent: 'center', alignItems: 'center' }]}>
          <FontAwesome name="music" size={20} color="rgba(255,255,255,0.4)" />
        </View>
      )}
      <View style={s.albumInfo}>
        <Text style={[s.albumTitle, { color: colors.text }]} numberOfLines={1}>{album.title}</Text>
        <Text style={[s.albumArtist, { color: colors.subtext }]} numberOfLines={1}>{album.artist}{album.year > 0 ? ` · ${album.year}` : ''}</Text>
        <View style={s.listenCountRow}>
          <FontAwesome name="repeat" size={11} color={colors.tint} />
          <Text style={[s.listenCountText, { color: colors.tint }]}>{totalListens} listen{totalListens !== 1 ? 's' : ''}</Text>
        </View>
      </View>
      <FontAwesome name="chevron-right" size={12} color={colors.subtext} />
    </Pressable>
  );
}

// ─── Song row item ────────────────────────────────────────────────────────────

function ReListenedSongRow({
  song,
  isDark,
  colors,
  onPress,
}: {
  song: SongReview;
  isDark: boolean;
  colors: any;
  onPress: () => void;
}) {
  const totalListens = (song.reListenCount ?? 0) + 1;
  return (
    <Pressable
      style={({ pressed }) => [s.albumRow, { borderBottomColor: isDark ? '#2a1e14' : '#e8e8e8', opacity: pressed ? 0.7 : 1 }]}
      onPress={onPress}>
      {song.artworkUrl ? (
        <ExpoImage source={{ uri: song.artworkUrl }} style={s.albumArt} contentFit="cover" cachePolicy="disk" />
      ) : (
        <View style={[s.albumArt, { backgroundColor: '#2E2018', justifyContent: 'center', alignItems: 'center' }]}>
          <FontAwesome name="music" size={20} color="rgba(255,255,255,0.4)" />
        </View>
      )}
      <View style={s.albumInfo}>
        <Text style={[s.albumTitle, { color: colors.text }]} numberOfLines={1}>{song.title}</Text>
        <Text style={[s.albumArtist, { color: colors.subtext }]} numberOfLines={1}>
          {song.artist}{song.albumTitle ? ` · ${song.albumTitle}` : ''}
        </Text>
        <View style={s.listenCountRow}>
          <FontAwesome name="repeat" size={11} color={colors.tint} />
          <Text style={[s.listenCountText, { color: colors.tint }]}>{totalListens} listen{totalListens !== 1 ? 's' : ''}</Text>
        </View>
      </View>
      <FontAwesome name="chevron-right" size={12} color={colors.subtext} />
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

const COVER_COLORS = ['#2d5a27','#7a4a2e','#1a3018','#d4a017','#7a3a1a','#8b1a1a','#1a5a5a','#4a2818'];

export default function ReListenedScreen() {
  const colorScheme = useColorScheme();
  const { isPro, proTheme: ownProTheme } = usePro();
  const params      = useLocalSearchParams<{ userId?: string; proTheme?: string; tab?: string }>();
  const _themeKey = !params.userId ? ownProTheme : (params.proTheme ?? 'default');
  const colors = ((!params.userId ? isPro : !!params.proTheme) && _themeKey !== 'default')
    ? themeToColors(getProTheme(_themeKey))
    : Colors[colorScheme ?? 'dark'];
  const isDark      = colorScheme === 'dark';
  const router      = useRouter();
  const { user }    = useAuth();
  const { loggedAlbums, removeReListenEntry } = useAlbums();
  const { songReviews } = useSongReviews();

  const viewingOther = params.userId && params.userId !== user?.id ? params.userId : null;
  const [tab, setTab] = useState<'albums' | 'songs'>(params.tab === 'songs' ? 'songs' : 'albums');

  // ── Songs tab ──────────────────────────────────────────────────────────────
  const [otherSongs,     setOtherSongs]     = useState<SongReview[] | null>(null);
  const [otherReListens, setOtherReListens] = useState<SongReListen[]>([]);
  const [songsFailed,    setSongsFailed]    = useState(false);
  const [historySong,    setHistorySong]    = useState<SongReview | null>(null);

  useEffect(() => {
    if (!viewingOther) return;
    let cancelled = false;
    Promise.all([fetchUserSongReviews(viewingOther), fetchUserSongReListens(viewingOther)]).then(([list, rls]) => {
      if (cancelled) return;
      if (!list) { setSongsFailed(true); return; }
      setOtherSongs(list);
      setOtherReListens(rls ?? []);
    });
    return () => { cancelled = true; };
  }, [viewingOther]);

  const reListenedSongs = (viewingOther ? (otherSongs ?? []) : songReviews)
    .filter(x => (x.reListenCount ?? 0) > 0)
    .sort((a, b) => (b.lastListenedAt ?? b.listenedAt).localeCompare(a.lastListenedAt ?? a.listenedAt));


  // For own profile: derive from context. For other user: fetch from Supabase.
  const [otherAlbums,    setOtherAlbums]    = useState<LoggedAlbum[]>([]);
  const [otherLoading,   setOtherLoading]   = useState(false);
  const [searchOpen,     setSearchOpen]     = useState(false);
  const [query,          setQuery]          = useState('');
  const searchRef = useRef<TextInput>(null);

  // Re-listen evolution data (growers / faders)
  const [allReLists, setAllReLists] = useState<Map<string, { rating: number; listenedAt: string }[]>>(new Map());

  useEffect(() => {
    if (!viewingOther) return;
    setOtherLoading(true);
    supabase
      .from('user_albums')
      .select('spotify_id, title, artist, artwork_url, year, rating, review, listened_at, re_listen_count')
      .eq('user_id', viewingOther)
      .eq('is_relistened', true)
      .not('listened_at', 'is', null)
      .then(({ data }) => {
        if (!data) { setOtherLoading(false); return; }
        // Fetch latest re-listen date per album
        supabase
          .from('re_listens')
          .select('spotify_id, listened_at')
          .eq('user_id', viewingOther)
          .order('listened_at', { ascending: false })
          .then(({ data: reData }) => {
            const latestReListenDate = new Map<string, string>();
            for (const r of (reData ?? []) as any[]) {
              if (!latestReListenDate.has(r.spotify_id)) {
                latestReListenDate.set(r.spotify_id, r.listened_at);
              }
            }
            const albums: LoggedAlbum[] = data.map((a, i) => ({
              id:             a.spotify_id,
              title:          a.title ?? '',
              artist:         a.artist ?? '',
              year:           a.year ?? 0,
              rating:         a.rating ?? 0,
              review:         a.review ?? undefined,
              dateLogged:     a.listened_at ?? new Date().toISOString(),
              artworkUrl:     a.artwork_url ?? undefined,
              coverColor:     COVER_COLORS[i % COVER_COLORS.length],
              reListenCount:  a.re_listen_count ?? 0,
              isRelistened:   true,
              lastListenedAt: latestReListenDate.get(a.spotify_id),
            }));
            albums.sort((a, b) => {
              const da = new Date(a.lastListenedAt ?? a.dateLogged).getTime();
              const db = new Date(b.lastListenedAt ?? b.dateLogged).getTime();
              return db - da;
            });
            setOtherAlbums(albums);
            setOtherLoading(false);
          });
      });
  }, [viewingOther]);

  const reListenedAlbums = viewingOther
    ? otherAlbums
    : [...loggedAlbums.filter(a => a.isRelistened === true)].sort((a, b) => {
        const da = new Date(a.lastListenedAt ?? a.dateLogged).getTime();
        const db = new Date(b.lastListenedAt ?? b.dateLogged).getTime();
        return db - da;
      });

  const displayAlbums = query.trim()
    ? reListenedAlbums.filter(a =>
        a.title.toLowerCase().includes(query.toLowerCase()) ||
        a.artist.toLowerCase().includes(query.toLowerCase())
      )
    : reListenedAlbums;

  const displaySongs = query.trim()
    ? reListenedSongs.filter(x =>
        x.title.toLowerCase().includes(query.toLowerCase()) ||
        x.artist.toLowerCase().includes(query.toLowerCase()) ||
        (x.albumTitle ?? '').toLowerCase().includes(query.toLowerCase())
      )
    : reListenedSongs;

  const targetUserId     = viewingOther ?? user?.id ?? '';

  const [historyData,    setHistoryData]    = useState<HistoryModalData | null>(null);
  const [loadingAlbumId, setLoadingAlbumId] = useState<string | null>(null);

  const handleAlbumPress = useCallback(async (album: LoggedAlbum) => {
    if (!targetUserId) return;
    setLoadingAlbumId(album.id);
    const entries = await fetchAlbumListenHistory(targetUserId, album.id);
    setLoadingAlbumId(null);
    if (entries) setHistoryData({ album, entries });
  }, [targetUserId]);

  return (
    <>
      <Stack.Screen options={{
        title: 'Re-listend',
        headerBackTitle: 'Back',
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }} />
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Albums | Songs */}
        <View style={[ss.countRow, { borderBottomColor: colors.border }]}>
          <View style={[ss.tabToggle, { borderColor: colors.border }]}>
            {(['albums', 'songs'] as const).map(k => {
              const active = tab === k;
              return (
                <Pressable
                  key={k}
                  onPress={() => setTab(k)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  style={[ss.tabBtn, active && { backgroundColor: colors.tint }]}>
                  <Text style={[ss.tabText, { color: active ? '#fff' : colors.subtext }]}>
                    {k === 'albums' ? 'Albums' : 'Songs'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={ss.countRight}>
            <Text style={[ss.countText, { color: colors.subtext }]}>
              {tab === 'albums'
                ? `${reListenedAlbums.length} album${reListenedAlbums.length !== 1 ? 's' : ''}`
                : `${reListenedSongs.length} song${reListenedSongs.length !== 1 ? 's' : ''}`}
            </Text>
            {(tab === 'albums' ? reListenedAlbums.length : reListenedSongs.length) > 0 && (
              <Pressable
                onPress={() => {
                  const next = !searchOpen;
                  setSearchOpen(next);
                  if (!next) setQuery('');
                  else setTimeout(() => searchRef.current?.focus(), 50);
                }}
                hitSlop={10}
                style={[ss.searchToggle, searchOpen && { backgroundColor: colors.tint }]}>
                <FontAwesome name="search" size={13} color={searchOpen ? '#fff' : colors.tint} />
              </Pressable>
            )}
          </View>
        </View>
        {searchOpen && (
          <View style={[ss.searchBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <FontAwesome name="search" size={14} color={colors.subtext} />
            <TextInput
              ref={searchRef}
              style={[ss.searchInput, { color: colors.text }]}
              value={query}
              onChangeText={setQuery}
              placeholder={tab === 'albums' ? 'Search albums…' : 'Search songs…'}
              placeholderTextColor={colors.subtext}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>
        )}
        {tab === 'albums' ? (
        <FlatList
          data={displayAlbums}
          keyExtractor={item => item.id}
          style={{ flex: 1 }}
          contentContainerStyle={(displayAlbums.length === 0 && !otherLoading) ? s.emptyContainer : { paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={s.emptyInner}>
              <FontAwesome name="repeat" size={40} color={isDark ? '#3a2818' : '#ddd'} />
              <Text style={[s.emptyTitle, { color: colors.text }]}>
                {query.trim() ? 'No albums found' : 'No re-listens yet'}
              </Text>
              {!query.trim() && (
                <Text style={[s.emptySubtext, { color: colors.subtext }]}>
                  Tap "Re-listen" on any album you've already logged to record another listen.
                </Text>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <View>
              <ReListenedAlbumRow
                album={item}
                isDark={isDark}
                colors={colors}
                onPress={() => handleAlbumPress(item)}
              />
              {loadingAlbumId === item.id && (
                <ActivityIndicator
                  size="small"
                  color={colors.tint}
                  style={StyleSheet.absoluteFill}
                />
              )}
            </View>
          )}
        />
        ) : (
          <FlatList
            data={displaySongs}
            keyExtractor={item => songKey(item.title, item.artist)}
            style={{ flex: 1 }}
            contentContainerStyle={displaySongs.length === 0 ? s.emptyContainer : { paddingBottom: 40 }}
            ListEmptyComponent={
              viewingOther && !otherSongs && !songsFailed ? (
                <ActivityIndicator color={colors.tint} style={{ marginTop: 60 }} />
              ) : (
                <View style={s.emptyInner}>
                  <FontAwesome name="repeat" size={40} color={isDark ? '#3a2818' : '#ddd'} />
                  <Text style={[s.emptyTitle, { color: colors.text }]}>
                    {songsFailed ? "Couldn't load songs" : query.trim() ? 'No songs found' : 'No song re-listens yet'}
                  </Text>
                  {!query.trim() && !songsFailed && !viewingOther && (
                    <Text style={[s.emptySubtext, { color: colors.subtext }]}>
                      Tap "Re-listen" on a song you've logged, or re-rate the tracks when you re-listen an album.
                    </Text>
                  )}
                </View>
              )
            }
            renderItem={({ item }) => (
              <ReListenedSongRow
                song={item}
                isDark={isDark}
                colors={colors}
                onPress={() => setHistorySong(item)}
              />
            )}
          />
        )}
      </View>

      {historySong && (
        <SongListenHistoryModal
          song={viewingOther ? historySong : (songReviews.find(x => x.songId === historySong.songId) ?? historySong)}
          reListens={viewingOther
            ? otherReListens.filter(r => r.songKey === songKey(historySong.title, historySong.artist))
            : undefined}
          isDark={isDark}
          colors={colors}
          onClose={() => setHistorySong(null)}
          onSongPress={() => {
            const song = historySong;
            setHistorySong(null);
            openSongPage(router, { id: song.songId, title: song.title, artist: song.artist, artworkUrl: song.artworkUrl, albumId: song.albumId, albumTitle: song.albumTitle, durationMs: song.durationMs });
          }}
        />
      )}

      {historyData && (
        <AlbumListenHistoryModal
          data={historyData}
          isDark={isDark}
          colors={colors}
          onClose={() => setHistoryData(null)}
          onAlbumPress={() => {
            const album = historyData.album;
            setHistoryData(null);
            navigateToAlbum(router, album);
          }}
          onDeleteEntry={!viewingOther ? (entry) => {
            Alert.alert(
              'Delete Re-listen',
              'Remove this re-listen entry? This can\'t be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    await removeReListenEntry(historyData.album.id, entry.listenedAt);
                    setHistoryData(prev => {
                      if (!prev) return null;
                      const entries = withoutEntry(prev.entries, entry);
                      return entries.length === 0 ? null : { ...prev, entries };
                    });
                  },
                },
              ]
            );
          } : undefined}
        />
      )}
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  albumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  albumArt: {
    width: 52,
    height: 52,
    borderRadius: 8,
    flexShrink: 0,
  },
  albumInfo: {
    flex: 1,
    gap: 3,
  },
  albumTitle:  { fontSize: 15, fontWeight: '600' },
  albumArtist: { fontSize: 13 },
  listenCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  listenCountText: {
    color: '#D4A017',
    fontSize: 12,
    fontWeight: '600',
  },

  // Empty state
  emptyContainer: {
    flex: 1,
  },
  emptyInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 100,
    gap: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

const ss = StyleSheet.create({
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  countText: { fontSize: 13, fontWeight: '600' },
  countRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tabToggle: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, padding: 2 },
  tabBtn: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 999 },
  tabText: { fontSize: 12, fontWeight: '700' },
  searchToggle: {
    width: 28, height: 28, borderRadius: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, fontSize: 15, height: 36 },
});
