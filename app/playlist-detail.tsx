import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useState, useEffect, useMemo } from 'react';
import { Gesture, GestureDetector, ScrollView as GHScrollView } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS, SharedValue } from 'react-native-reanimated';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAlbums, LoggedAlbum } from '@/context/AlbumsContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { countOrNull } from '@/lib/supabaseQuery';
import { usePro } from '@/context/ProContext';
import { getProTheme, themeToColors } from '@/lib/proThemes';
import PlaylistFormModal from '@/components/PlaylistFormModal';

const PADDING = 16;
const GAP     = 12;
const COLS    = 3;
const ROW_H   = 64;

// ─── Album card — edit controls hidden when readOnly ─────────────────────────

function AlbumCard({
  album,
  rank,
  cardWidth,
  readOnly,
  colors,
  onPress,
  onRemove,
}: {
  album: LoggedAlbum;
  rank: number;
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
        <Text style={[s.cardTitle, { color: colors.text }]} numberOfLines={1}>
          <Text style={[s.cardRank, { color: colors.tint }]}>{rank}  </Text>
          {album.title}
        </Text>
        <Text style={[s.cardArtist, { color: colors.subtext }]} numberOfLines={1}>{album.artist}</Text>
      </Pressable>
    </View>
  );
}

// ─── Reorder row — drag the handle to move, × to remove ──────────────────────

function ReorderRow({
  album,
  index,
  count,
  draggingIdx,
  hoverIdx,
  dragY,
  colors,
  onDragStart,
  onDrop,
  onRemove,
}: {
  album: LoggedAlbum;
  index: number;
  count: number;
  draggingIdx: SharedValue<number>;
  hoverIdx: SharedValue<number>;
  dragY: SharedValue<number>;
  colors: any;
  onDragStart: () => void;
  onDrop: (from: number, to: number) => void;
  onRemove: () => void;
}) {
  const animStyle = useAnimatedStyle(() => {
    const d = draggingIdx.value;
    if (d === index) {
      return {
        transform: [{ translateY: dragY.value }, { scale: 1.02 }],
        zIndex: 10,
        shadowOpacity: 0.3,
      };
    }
    if (d === -1) return { transform: [{ translateY: 0 }, { scale: 1 }], zIndex: 0, shadowOpacity: 0 };
    // Rows between the dragged row's origin and its hover slot slide over to make room.
    const h = hoverIdx.value;
    let shift = 0;
    if (d < index && index <= h) shift = -ROW_H;
    else if (h <= index && index < d) shift = ROW_H;
    return { transform: [{ translateY: withTiming(shift, { duration: 140 }) }, { scale: 1 }], zIndex: 0, shadowOpacity: 0 };
  });

  const pan = Gesture.Pan()
    .minDistance(0)
    .onStart(() => {
      draggingIdx.value = index;
      hoverIdx.value = index;
      dragY.value = 0;
      runOnJS(onDragStart)();
    })
    .onUpdate((e) => {
      if (draggingIdx.value !== index) return;
      // Keep the row inside the list's bounds.
      const minY = -index * ROW_H;
      const maxY = (count - 1 - index) * ROW_H;
      const y = Math.max(minY, Math.min(maxY, e.translationY));
      dragY.value = y;
      hoverIdx.value = Math.max(0, Math.min(count - 1, Math.round(index + y / ROW_H)));
    })
    .onFinalize(() => {
      if (draggingIdx.value !== index) return;
      runOnJS(onDrop)(index, hoverIdx.value);
    });

  return (
    <Animated.View
      style={[
        s.reorderRow,
        { backgroundColor: colors.background, borderBottomColor: colors.border },
        { shadowColor: '#000', shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
        animStyle,
      ]}>
      <Text style={[s.reorderRank, { color: colors.subtext }]}>{index + 1}</Text>
      {album.artworkUrl ? (
        <ExpoImage source={{ uri: album.artworkUrl }} style={s.reorderArt} contentFit="cover" cachePolicy="disk" />
      ) : (
        <View style={[s.reorderArt, s.fallback, { backgroundColor: album.coverColor }]}>
          <Text style={[s.fallbackText, { fontSize: 16 }]}>{album.title.charAt(0)}</Text>
        </View>
      )}
      <View style={s.reorderText}>
        <Text style={[s.reorderTitle, { color: colors.text }]} numberOfLines={1}>{album.title}</Text>
        <Text style={[s.reorderArtist, { color: colors.subtext }]} numberOfLines={1}>{album.artist}</Text>
      </View>
      <Pressable onPress={onRemove} hitSlop={8} style={s.reorderRemove}>
        <FontAwesome name="minus-circle" size={20} color="#c0392b" />
      </Pressable>
      <GestureDetector gesture={pan}>
        <View style={s.dragHandle} hitSlop={8}>
          <FontAwesome name="bars" size={18} color={colors.subtext} />
        </View>
      </GestureDetector>
    </Animated.View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PlaylistDetailScreen() {
  const { width } = useWindowDimensions();
  const cardWidth = (width - PADDING * 2 - GAP * (COLS - 1)) / COLS;
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { id, userId: paramUserId } = useLocalSearchParams<{ id: string; userId?: string }>();
  const { playlists, loggedAlbums, removeAlbumFromPlaylist, reorderPlaylistAlbums, updatePlaylist, deletePlaylist } = useAlbums();
  const { user } = useAuth();
  const { isPro, proTheme: ownProTheme } = usePro();

  const viewingOther = paramUserId || null;

  // Someone else's playlist wears its owner's theme, like their profile does.
  const [ownerTheme, setOwnerTheme] = useState<string | null>(null);
  useEffect(() => {
    if (!viewingOther || viewingOther === user?.id) return;
    supabase
      .from('profiles')
      .select('is_pro, pro_theme')
      .eq('id', viewingOther)
      .maybeSingle()
      .then(({ data }) => setOwnerTheme(data?.is_pro ? (data.pro_theme ?? null) : null));
  }, [viewingOther, user?.id]);

  const themeKey = (!viewingOther || viewingOther === user?.id)
    ? (isPro ? ownProTheme : null)
    : ownerTheme;
  const colors = themeKey && themeKey !== 'default'
    ? themeToColors(getProTheme(themeKey as any))
    : Colors[colorScheme ?? 'light'];
  // Liking your own playlist means nothing — the heart is for other people's.
  const canLike = !!viewingOther && viewingOther !== user?.id;

  // ── Reorder (edit) mode ───────────────────────────────────────────────────
  const [editing,    setEditing]    = useState(false);
  const [showDetailsSheet, setShowDetailsSheet] = useState(false);
  const [scrollLock, setScrollLock] = useState(false);
  const draggingIdx = useSharedValue(-1);
  const hoverIdx    = useSharedValue(-1);
  const dragY       = useSharedValue(0);

  // ── Like state ────────────────────────────────────────────────────────────
  const [liked,     setLiked]     = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  useEffect(() => {
    if (!id || !canLike) return;
    Promise.all([
      supabase.from('likes').select('*', { count: 'exact', head: true })
        .eq('target_type', 'playlist').eq('target_id', id),
      user ? supabase.from('likes').select('id')
        .eq('target_type', 'playlist').eq('target_id', id).eq('user_id', user.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]).then(([countRes, myRes]) => {
      // Keep the last known count if the query failed, rather than showing 0.
      const c = countOrNull(countRes);
      if (c != null) setLikeCount(c);
      setLiked(!!myRes.data);
    });
  }, [id, user?.id, canLike]);

  async function handleHeart() {
    if (!user) return;
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount(c => wasLiked ? Math.max(0, c - 1) : c + 1);
    if (wasLiked) {
      await supabase.from('likes').delete().match({ user_id: user.id, target_type: 'playlist', target_id: id });
    } else {
      await supabase.from('likes').upsert({
        user_id: user.id, target_type: 'playlist', target_id: id,
        target_owner_id: viewingOther ?? undefined,
      });
      if (viewingOther && viewingOther !== user.id) {
        const { error: notifErr } = await supabase.from('notifications').insert({
          user_id: viewingOther, type: 'like_playlist', actor_id: user.id, target_id: id,
        });
        if (notifErr) console.error('[PlaylistDetail] notification insert error:', notifErr.message);
      }
    }
  }

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
  // Albums in the playlist that aren't in loggedAlbums (added via search, never
  // logged) are fetched once; the order itself is resolved at render time from
  // ownPlaylist.albumIds so a reorder shows up in the same frame.
  const [extraAlbums, setExtraAlbums] = useState<Map<string, LoggedAlbum>>(new Map());

  const loggedById = useMemo(() => {
    const m = new Map<string, LoggedAlbum>();
    for (const a of loggedAlbums) if (!m.has(a.id)) m.set(a.id, a);
    return m;
  }, [loggedAlbums]);

  useEffect(() => {
    if (!ownPlaylist || viewingOther || !user) return;

    const missingIds = ownPlaylist.albumIds.filter(
      (aid) => !loggedById.has(aid) && !extraAlbums.has(aid)
    );
    if (missingIds.length === 0) return;

    supabase
      .from('user_albums')
      .select('spotify_id, title, artist, artwork_url, year, rating')
      .in('spotify_id', missingIds)
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        setExtraAlbums((prev) => {
          const next = new Map(prev);
          data.forEach((row: any, i: number) => {
            next.set(row.spotify_id, {
              id:         row.spotify_id,
              title:      row.title       ?? row.spotify_id,
              artist:     row.artist      ?? '',
              year:       row.year        ?? 0,
              rating:     row.rating      ?? 0,
              dateLogged: '',
              artworkUrl: row.artwork_url ?? undefined,
              coverColor: ['#2d5a27','#7a4a2e','#1a3018','#d4a017','#7a3a1a','#8b1a1a'][i % 6],
            });
          });
          return next;
        });
      });
  }, [ownPlaylist?.id, ownPlaylist?.albumIds?.join(','), loggedById, user?.id]);

  const ownAlbums = useMemo(
    () => (ownPlaylist?.albumIds ?? [])
      .map((aid) => loggedById.get(aid) ?? extraAlbums.get(aid))
      .filter((a): a is LoggedAlbum => !!a),
    [ownPlaylist?.albumIds, loggedById, extraAlbums]
  );

  useEffect(() => {
    if (!viewingOther && !ownPlaylist) {
      router.back();
    }
  }, [viewingOther, ownPlaylist, router]);

  if (!viewingOther && !ownPlaylist) {
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

  function handleDragStart() {
    setScrollLock(true);
  }

  function handleDrop(from: number, to: number) {
    setScrollLock(false);
    if (from !== to && ownPlaylist) {
      const next = albums.map((a) => a.id);
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      // Keep any ids that couldn't be resolved at the end rather than dropping them.
      const rest = ownPlaylist.albumIds.filter((aid) => !next.includes(aid));
      reorderPlaylistAlbums(ownPlaylist.id, [...next, ...rest]);
    }
    draggingIdx.value = -1;
    hoverIdx.value = -1;
    dragY.value = 0;
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
        <ActivityIndicator color={colors.tint} size="large" />
      </View>
    );
  }

  const openAddAlbums = () =>
    router.push({ pathname: '/playlist-add-albums', params: { playlistId: ownPlaylist!.id } });

  return (
    <>
      <Stack.Screen
        options={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          headerRight: !viewingOther && editing
            ? () => (
                <Pressable
                  onPress={() => setEditing(false)}
                  hitSlop={12}
                  style={{ height: 36, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: colors.tint, fontSize: 16, fontWeight: '700' }}>
                    Done
                  </Text>
                </Pressable>
              )
            : undefined,
        }}
      />
      <GHScrollView
        style={[s.container, { backgroundColor: colors.background }]}
        contentContainerStyle={s.content}
        scrollEnabled={!scrollLock}
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

          {canLike && (
            <Pressable onPress={handleHeart} hitSlop={12} style={s.heartBtn}>
              <FontAwesome
                name={liked ? 'heart' : 'heart-o'}
                size={24}
                color={liked ? colors.tint : colors.subtext}
              />
              {likeCount > 0 && (
                <Text style={[s.heartCount, { color: liked ? colors.tint : colors.subtext }]}>{likeCount}</Text>
              )}
            </Pressable>
          )}
        </View>

        {/* Own-playlist actions */}
        {!viewingOther && (
          editing ? (
            <Text style={[s.editHint, { color: colors.subtext }]}>
              Drag <FontAwesome name="bars" size={12} color={colors.subtext} /> to change the order. Changes save as you go.
            </Text>
          ) : (
            <View style={s.actionRow}>
              <Pressable
                onPress={openAddAlbums}
                style={({ pressed }) => [s.actionBtn, { backgroundColor: colors.tint, opacity: pressed ? 0.75 : 1 }]}>
                <FontAwesome name="plus" size={13} color="#fff" />
                <Text style={[s.actionBtnText, { color: '#fff' }]}>Add Albums</Text>
              </Pressable>
              {albums.length > 1 && (
                <Pressable
                  onPress={() => setEditing(true)}
                  style={({ pressed }) => [s.actionBtn, { borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}>
                  <FontAwesome name="sort" size={13} color={colors.text} />
                  <Text style={[s.actionBtnText, { color: colors.text }]}>Reorder</Text>
                </Pressable>
              )}
              <View style={{ flex: 1 }} />
              <Pressable
                onPress={() => setShowDetailsSheet(true)}
                hitSlop={10}
                accessibilityLabel="Edit name and description"
                style={s.deleteBtn}>
                <FontAwesome name="pencil" size={18} color={colors.subtext} />
              </Pressable>
              <Pressable onPress={confirmDeletePlaylist} hitSlop={10} style={s.deleteBtn}>
                <FontAwesome name="trash-o" size={18} color={colors.subtext} />
              </Pressable>
            </View>
          )
        )}

        <View style={[s.divider, { backgroundColor: colors.border }]} />

        {/* Album grid / reorder list */}
        {albums.length === 0 ? (
          <View style={s.emptyWrap}>
            <FontAwesome name="music" size={36} color={colors.border} />
            <Text style={[s.emptyTitle, { color: colors.text }]}>No albums yet</Text>
            <Text style={[s.emptySub, { color: colors.subtext }]}>
              {viewingOther ? 'This playlist is empty.' : 'Tap Add Albums to pick from your Listend or search.'}
            </Text>
          </View>
        ) : editing && !viewingOther ? (
          <View style={{ height: albums.length * ROW_H }}>
            {albums.map((album, i) => (
              <ReorderRow
                key={album.id}
                album={album}
                index={i}
                count={albums.length}
                draggingIdx={draggingIdx}
                hoverIdx={hoverIdx}
                dragY={dragY}
                colors={colors}
                onDragStart={handleDragStart}
                onDrop={handleDrop}
                onRemove={() => removeAlbumFromPlaylist(ownPlaylist!.id, album.id)}
              />
            ))}
          </View>
        ) : (
          <View style={s.grid}>
            {albums.map((album, i) => (
              <AlbumCard
                key={album.id}
                album={album}
                rank={i + 1}
                cardWidth={cardWidth}
                readOnly={!!viewingOther}
                colors={colors}
                onPress={() => router.push({ pathname: '/album-detail', params: { id: album.id, title: album.title, artist: album.artist, year: String(album.year ?? ''), artworkUrl: album.artworkUrl ?? '' } })}
                onRemove={() => confirmRemoveAlbum(album)}
              />
            ))}
          </View>
        )}
      </GHScrollView>
      {!viewingOther && ownPlaylist && (
        <PlaylistFormModal
          visible={showDetailsSheet}
          title="Edit Playlist"
          submitLabel="Save"
          initialName={ownPlaylist.name}
          initialDescription={ownPlaylist.description ?? ''}
          onClose={() => setShowDetailsSheet(false)}
          onSubmit={(name, description) => {
            updatePlaylist(ownPlaylist.id, name, description);
            setShowDetailsSheet(false);
          }}
          colors={colors}
        />
      )}
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
  headerText:    { flex: 1, gap: 4 },
  heartBtn:      { alignItems: 'center', gap: 2, paddingTop: 4 },
  heartCount:    { fontSize: 11, fontWeight: '700' },
  playlistName: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  albumCount:   { fontSize: 13 },
  description:  { fontSize: 14, lineHeight: 20, marginTop: 2 },
  deleteBtn:    { padding: 6 },

  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 16 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  actionBtnText:    { fontSize: 14, fontWeight: '600' },
  editHint:         { fontSize: 13, paddingBottom: 14 },

  reorderRow: {
    height: ROW_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  reorderRank:   { width: 26, fontSize: 15, fontWeight: '700', textAlign: 'center', fontVariant: ['tabular-nums'] },
  reorderArt:    { width: 48, height: 48, borderRadius: 6 },
  reorderText:   { flex: 1, gap: 2 },
  reorderTitle:  { fontSize: 15, fontWeight: '600' },
  reorderArtist: { fontSize: 13 },
  reorderRemove: { padding: 6 },
  dragHandle:    { width: 40, height: ROW_H, alignItems: 'center', justifyContent: 'center' },

  divider: { height: StyleSheet.hairlineWidth, marginBottom: 16 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },

  card: { gap: 0 },
  cardRank: { fontWeight: '800', fontVariant: ['tabular-nums'] },
  fallback: { borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  fallbackText: { color: 'rgba(255,255,255,0.5)', fontWeight: '700' },
  cardTitle:  { marginTop: 5, fontSize: 11, fontWeight: '600', lineHeight: 14 },
  cardArtist: { fontSize: 10, lineHeight: 13, marginTop: 1 },

  emptyWrap:  { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '600', marginTop: 8 },
  emptySub:   { fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },
});
