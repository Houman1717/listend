import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useState, useEffect } from 'react';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAlbums, LoggedAlbum } from '@/context/AlbumsContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

const PADDING = 16;
const GAP     = 12;
const COLS    = 3;

// ─── Album card — edit controls hidden when readOnly ─────────────────────────

function AlbumCard({
  album,
  cardWidth,
  readOnly,
  colors,
  onPress,
  onRemove,
}: {
  album: LoggedAlbum;
  cardWidth: number;
  readOnly: boolean;
  colors: any;
  onPress: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={{ width: cardWidth }}>
      <Pressable
        onPress={onPress}
        onLongPress={readOnly ? undefined : onRemove}
        style={({ pressed }) => [s.card, { opacity: pressed ? 0.7 : 1 }]}>
        {album.artworkUrl ? (
          <ExpoImage
            source={{ uri: album.artworkUrl }}
            style={{ width: cardWidth, height: cardWidth, borderRadius: 8 }}
            contentFit="cover"
            cachePolicy="disk"
            transition={200}
          />
        ) : (
          <View style={[s.fallback, { width: cardWidth, height: cardWidth, backgroundColor: album.coverColor }]}>
            <Text style={[s.fallbackText, { fontSize: cardWidth * 0.32 }]}>{album.title.charAt(0)}</Text>
          </View>
        )}
        <Text style={[s.cardTitle, { color: colors.text }]} numberOfLines={1}>{album.title}</Text>
        <Text style={[s.cardArtist, { color: colors.subtext }]} numberOfLines={1}>{album.artist}</Text>
      </Pressable>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PlaylistDetailScreen() {
  const { width } = useWindowDimensions();
  const cardWidth = (width - PADDING * 2 - GAP * (COLS - 1)) / COLS;
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { id, userId: paramUserId } = useLocalSearchParams<{ id: string; userId?: string }>();
  const { playlists, loggedAlbums, removeAlbumFromPlaylist, deletePlaylist } = useAlbums();
  const { user } = useAuth();

  const viewingOther = paramUserId || null;

  // ── Other-user state ──────────────────────────────────────────────────────
  const [otherPlaylistName, setOtherPlaylistName] = useState('');
  const [otherPlaylistDesc, setOtherPlaylistDesc] = useState<string | null>(null);
  const [otherAlbums,       setOtherAlbums]       = useState<LoggedAlbum[]>([]);
  const [loading,           setLoading]           = useState(!!viewingOther);

  useEffect(() => {
    if (!viewingOther || !id) return;

    (async () => {
      setLoading(true);

      // Fetch playlist metadata
      const { data: pl } = await supabase
        .from('playlists')
        .select('name, description')
        .eq('id', id)
        .single();

      if (pl) {
        setOtherPlaylistName(pl.name ?? '');
        setOtherPlaylistDesc(pl.description ?? null);
      }

      // Fetch album order from playlist_albums
      const { data: pas } = await supabase
        .from('playlist_albums')
        .select('spotify_id, position')
        .eq('playlist_id', id)
        .order('position', { ascending: true });

      if (!pas || pas.length === 0) {
        setLoading(false);
        return;
      }

      const spotifyIds = pas.map((a: any) => a.spotify_id);

      // Fetch album details from user_albums for this user
      const { data: uas } = await supabase
        .from('user_albums')
        .select('spotify_id, title, artist, artwork_url, year, rating')
        .eq('user_id', viewingOther)
        .in('spotify_id', spotifyIds);

      const uaMap = new Map<string, any>();
      for (const a of (uas ?? []) as any[]) uaMap.set(a.spotify_id, a);

      const albums: LoggedAlbum[] = pas.map((pa: any, i: number) => {
        const ua = uaMap.get(pa.spotify_id);
        return {
          id:         pa.spotify_id,
          title:      ua?.title      ?? pa.spotify_id,
          artist:     ua?.artist     ?? '',
          year:       ua?.year       ?? 0,
          rating:     ua?.rating     ?? 0,
          dateLogged: '',
          artworkUrl: ua?.artwork_url ?? undefined,
          coverColor: ['#2d5a27','#7a4a2e','#1a3018','#d4a017','#7a3a1a','#8b1a1a'][i % 6],
        };
      });

      setOtherAlbums(albums);
      setLoading(false);
    })();
  }, [viewingOther, id]);

  // ── Own-user data from context ────────────────────────────────────────────
  const ownPlaylist = !viewingOther ? playlists.find((p) => p.id === id) : null;

  // Hooks MUST be declared before any conditional return (Rules of Hooks)
  const [ownAlbums, setOwnAlbums] = useState<LoggedAlbum[]>([]);

  useEffect(() => {
    if (!ownPlaylist || viewingOther) return;

    const resolved = ownPlaylist.albumIds
      .map((aid) => loggedAlbums.find((a) => a.id === aid))
      .filter((a): a is LoggedAlbum => a !== undefined);

    const missingIds = ownPlaylist.albumIds.filter(
      (aid) => !loggedAlbums.find((a) => a.id === aid)
    );

    if (missingIds.length === 0) {
      setOwnAlbums(resolved);
      return;
    }

    supabase
      .from('user_albums')
      .select('spotify_id, title, artist, artwork_url, year, rating')
      .in('spotify_id', missingIds)
      .eq('user_id', user!.id)
      .then(({ data }) => {
        const fetched: LoggedAlbum[] = (data ?? []).map((row: any, i: number) => ({
          id:         row.spotify_id,
          title:      row.title       ?? row.spotify_id,
          artist:     row.artist      ?? '',
          year:       row.year        ?? 0,
          rating:     row.rating      ?? 0,
          dateLogged: '',
          artworkUrl: row.artwork_url ?? undefined,
          coverColor: ['#2d5a27','#7a4a2e','#1a3018','#d4a017','#7a3a1a','#8b1a1a'][i % 6],
        }));
        const allById = new Map<string, LoggedAlbum>();
        [...resolved, ...fetched].forEach(a => allById.set(a.id, a));
        setOwnAlbums(
          ownPlaylist.albumIds
            .map(aid => allById.get(aid))
            .filter((a): a is LoggedAlbum => !!a)
        );
      });
  }, [ownPlaylist?.id, ownPlaylist?.albumIds?.join(','), loggedAlbums, user?.id]);

  if (!viewingOther && !ownPlaylist) {
    router.back();
    return null;
  }

  const playlistName = viewingOther ? otherPlaylistName : (ownPlaylist?.name ?? '');
  const playlistDesc = viewingOther ? otherPlaylistDesc : (ownPlaylist?.description ?? null);
  const albums       = viewingOther ? otherAlbums       : ownAlbums;

  function confirmRemoveAlbum(album: LoggedAlbum) {
    Alert.alert(
      'Remove Album',
      `Remove "${album.title}" from this playlist?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeAlbumFromPlaylist(ownPlaylist!.id, album.id) },
      ]
    );
  }

  function confirmDeletePlaylist() {
    Alert.alert(
      'Delete Playlist',
      `Delete "${playlistName}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deletePlaylist(ownPlaylist!.id);
            router.back();
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={[s.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color="#D4A017" size="large" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: !viewingOther
            ? () => (
                <Pressable
                  onPress={() =>
                    router.push({ pathname: '/playlist-add-albums', params: { playlistId: ownPlaylist!.id } })
                  }
                  hitSlop={12}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: '100%', paddingHorizontal: 4 }}>
                  <FontAwesome name="plus" size={20} color="#D4A017" />
                </Pressable>
              )
            : undefined,
        }}
      />
      <ScrollView
        style={[s.container, { backgroundColor: colors.background }]}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <View style={s.headerText}>
            <Text style={[s.playlistName, { color: colors.text }]}>{playlistName}</Text>
            <Text style={[s.albumCount, { color: colors.subtext }]}>
              {albums.length === 1 ? '1 album' : `${albums.length} albums`}
            </Text>
            {playlistDesc ? (
              <Text style={[s.description, { color: colors.subtext }]}>{playlistDesc}</Text>
            ) : null}
          </View>

          {/* Delete button — own user only */}
          {!viewingOther && (
            <Pressable onPress={confirmDeletePlaylist} hitSlop={8} style={s.deleteBtn}>
              <FontAwesome name="trash-o" size={18} color="#D4A017" />
            </Pressable>
          )}
        </View>

        <View style={[s.divider, { backgroundColor: isDark ? '#2a1e14' : '#e8e8e8' }]} />

        {/* Album grid */}
        {albums.length === 0 ? (
          <View style={s.emptyWrap}>
            <FontAwesome name="music" size={36} color={isDark ? '#3a2818' : '#ddd'} />
            <Text style={[s.emptyTitle, { color: colors.text }]}>No albums yet</Text>
            <Text style={[s.emptySub, { color: colors.subtext }]}>
              {viewingOther ? 'This playlist is empty.' : 'Tap the + button above to search and add albums.'}
            </Text>
          </View>
        ) : (
          <View style={s.grid}>
            {albums.map((album) => (
              <AlbumCard
                key={album.id}
                album={album}
                cardWidth={cardWidth}
                readOnly={!!viewingOther}
                colors={colors}
                onPress={() => router.push({ pathname: '/album-detail', params: { id: album.id } })}
                onRemove={() => confirmRemoveAlbum(album)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: PADDING, paddingBottom: 48 },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingBottom: 16,
  },
  headerText: { flex: 1, gap: 4 },
  playlistName: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  albumCount:   { fontSize: 13 },
  description:  { fontSize: 14, lineHeight: 20, marginTop: 2 },
  deleteBtn:    { paddingTop: 4 },

  divider: { height: StyleSheet.hairlineWidth, marginBottom: 16 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },

  card: { gap: 0 },
  fallback: { borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  fallbackText: { color: 'rgba(255,255,255,0.5)', fontWeight: '700' },
  cardTitle:  { marginTop: 5, fontSize: 11, fontWeight: '600', lineHeight: 14 },
  cardArtist: { fontSize: 10, lineHeight: 13, marginTop: 1 },

  emptyWrap:  { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '600', marginTop: 8 },
  emptySub:   { fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },
});
