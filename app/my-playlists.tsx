import {
  StyleSheet,
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useState, useEffect } from 'react';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAlbums, LoggedAlbum, Playlist } from '@/context/AlbumsContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

type LikeState = { liked: boolean; count: number };

// ─── Playlist artwork mosaic (2×2 grid of first 4 covers) ────────────────────

function PlaylistMosaic({
  albumIds,
  albumMap,
  size,
  fallbackColor,
}: {
  albumIds: string[];
  albumMap: Map<string, string | undefined>;
  size: number;
  fallbackColor: string;
}) {
  const half  = size / 2;
  const slots = Array.from({ length: 4 }, (_, i) => albumIds[i] ?? null);

  return (
    <View style={{ width: size, height: size, borderRadius: 8, overflow: 'hidden', flexDirection: 'row', flexWrap: 'wrap' }}>
      {slots.map((id, i) => {
        const url = id ? albumMap.get(id) : undefined;
        return (
          <View key={i} style={{ width: half, height: half }}>
            {url ? (
              <Image source={{ uri: url }} style={{ width: half, height: half }} resizeMode="cover" />
            ) : (
              <View style={{ width: half, height: half, backgroundColor: fallbackColor }} />
            )}
          </View>
        );
      })}
    </View>
  );
}

// ─── Playlist card row ────────────────────────────────────────────────────────

function PlaylistCard({
  playlist,
  albumMap,
  onPress,
  isDark,
  colors,
  likeCount,
  isLiked,
  onLike,
}: {
  playlist: Playlist;
  albumMap: Map<string, string | undefined>;
  onPress: () => void;
  isDark: boolean;
  colors: any;
  /** Total like count to display. Pass undefined to hide the like area. */
  likeCount?: number;
  isLiked?: boolean;
  /** Defined when the viewer can toggle the like (i.e. other user's playlist). */
  onLike?: () => void;
}) {
  const count    = playlist.albumIds.length;
  const showLike = onLike !== undefined || (likeCount ?? 0) > 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.playlistCard,
        {
          backgroundColor: colors.surface,
          borderColor:     colors.border,
          opacity:         pressed ? 0.7 : 1,
        },
      ]}>
      <PlaylistMosaic
        albumIds={playlist.albumIds}
        albumMap={albumMap}
        size={64}
        fallbackColor={isDark ? '#3a2820' : '#EDE9E3'}
      />
      <View style={s.playlistInfo}>
        <Text style={[s.playlistName, { color: colors.text }]} numberOfLines={1}>
          {playlist.name}
        </Text>
        <Text style={[s.playlistMeta, { color: colors.subtext }]}>
          {count === 1 ? '1 album' : `${count} albums`}
        </Text>
        {playlist.description ? (
          <Text style={[s.playlistDesc, { color: colors.subtext }]} numberOfLines={1}>
            {playlist.description}
          </Text>
        ) : null}
      </View>
      {/* Like button (other user's playlists) or count display */}
      {showLike && (
        onLike ? (
          <Pressable onPress={onLike} hitSlop={8} style={s.likeBtn}>
            <FontAwesome
              name={isLiked ? 'heart' : 'heart-o'}
              size={16}
              color={isLiked ? '#D4A017' : '#7a5535'}
            />
            {(likeCount ?? 0) > 0 && (
              <Text style={[s.likeCount, { color: isLiked ? '#D4A017' : '#7a5535' }]}>
                {likeCount}
              </Text>
            )}
          </Pressable>
        ) : (
          <View style={s.likeBtn}>
            <FontAwesome name="heart" size={16} color="#D4A017" />
            {(likeCount ?? 0) > 0 && (
              <Text style={[s.likeCount, { color: '#D4A017' }]}>{likeCount}</Text>
            )}
          </View>
        )
      )}
      <FontAwesome name="chevron-right" size={13} color={isDark ? '#4a3020' : '#a07850'} />
    </Pressable>
  );
}

// ─── New Playlist bottom-sheet modal ─────────────────────────────────────────

function NewPlaylistModal({
  visible,
  onClose,
  onCreate,
  isDark,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string, desc: string) => void;
  isDark: boolean;
  colors: any;
}) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  function handleCreate() {
    if (!name.trim()) return;
    onCreate(name.trim(), desc.trim());
    setName('');
    setDesc('');
  }

  function handleClose() {
    setName('');
    setDesc('');
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <View style={[s.modalSheet, { backgroundColor: isDark ? '#141414' : '#fff' }]}>
          <View style={s.modalHandle} />
          <Text style={[s.modalTitle, { color: colors.text }]}>New Playlist</Text>

          <Text style={[s.modalLabel, { color: colors.subtext }]}>Name</Text>
          <TextInput
            style={[s.modalInput, { color: colors.text, backgroundColor: isDark ? '#2e2018' : '#f2f2f2', borderColor: isDark ? '#3a2818' : '#e0e0e0' }]}
            placeholder="e.g. Summer Road Trip"
            placeholderTextColor={colors.subtext}
            value={name}
            onChangeText={setName}
            maxLength={60}
            autoFocus
          />

          <Text style={[s.modalLabel, { color: colors.subtext, marginTop: 16 }]}>
            Description <Text style={{ fontWeight: '400' }}>(optional)</Text>
          </Text>
          <TextInput
            style={[s.modalInput, s.modalInputMulti, { color: colors.text, backgroundColor: isDark ? '#2e2018' : '#f2f2f2', borderColor: isDark ? '#3a2818' : '#e0e0e0' }]}
            placeholder="What's this list about?"
            placeholderTextColor={colors.subtext}
            value={desc}
            onChangeText={setDesc}
            multiline
            textAlignVertical="top"
            maxLength={200}
          />

          <Pressable
            style={[s.createBtn, { backgroundColor: name.trim() ? '#D4A017' : (isDark ? '#2a1e14' : '#ddd') }]}
            onPress={handleCreate}
            disabled={!name.trim()}>
            <Text style={[s.createBtnText, { color: name.trim() ? '#fff' : colors.subtext }]}>
              Create Playlist
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MyPlaylistsScreen() {
  const colorScheme = useColorScheme();
  const colors      = Colors[colorScheme ?? 'light'];
  const isDark      = colorScheme === 'dark';
  const router      = useRouter();
  const { loggedAlbums, playlists, createPlaylist, deletePlaylist } = useAlbums();
  const { user }    = useAuth();
  const { userId: paramUserId } = useLocalSearchParams<{ userId?: string }>();

  const viewingOther = paramUserId || null;

  // ── Own user — tab state ──────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'mine' | 'liked'>('mine');

  // ── Liked playlists (own user, liked tab) ─────────────────────────────────
  const [likedPlaylists,      setLikedPlaylists]      = useState<Playlist[]>([]);
  const [likedAlbumMap,       setLikedAlbumMap]       = useState<Map<string, string | undefined>>(new Map());
  const [likedPlaylistOwners, setLikedPlaylistOwners] = useState<Map<string, string>>(new Map()); // playlist.id → owner user_id
  const [likedLoading,        setLikedLoading]        = useState(false);

  // ── Other user's playlists fetched from Supabase ──────────────────────────
  const [otherPlaylists, setOtherPlaylists] = useState<Playlist[]>([]);
  const [otherAlbumMap,  setOtherAlbumMap]  = useState<Map<string, string | undefined>>(new Map());
  const [loadingOther,   setLoadingOther]   = useState(false);

  // ── Like state for other user's playlists ─────────────────────────────────
  const [playlistLikesMap, setPlaylistLikesMap] = useState<Map<string, LikeState>>(new Map());

  // ── Fetch other user's playlists + like state ─────────────────────────────
  useEffect(() => {
    if (!viewingOther) return;
    setLoadingOther(true);

    (async () => {
      // Playlists
      const { data: pls } = await supabase
        .from('playlists')
        .select('id, name, description, created_at')
        .eq('user_id', viewingOther)
        .order('created_at', { ascending: false });

      if (!pls || pls.length === 0) {
        setOtherPlaylists([]);
        setLoadingOther(false);
        return;
      }

      const playlistIds = pls.map((p: any) => p.id);

      // Album membership
      const { data: pas } = await supabase
        .from('playlist_albums')
        .select('playlist_id, spotify_id, position')
        .in('playlist_id', playlistIds)
        .order('position', { ascending: true });

      // Artwork
      const { data: uas } = await supabase
        .from('user_albums')
        .select('spotify_id, artwork_url')
        .eq('user_id', viewingOther);

      const artMap = new Map<string, string | undefined>();
      for (const a of (uas ?? []) as any[]) {
        artMap.set(a.spotify_id, a.artwork_url ?? undefined);
      }

      const built: Playlist[] = pls.map((p: any) => ({
        id:          p.id,
        name:        p.name,
        description: p.description ?? undefined,
        albumIds:    (pas ?? [])
          .filter((a: any) => a.playlist_id === p.id)
          .map((a: any) => a.spotify_id),
        createdAt:   p.created_at,
      }));

      setOtherPlaylists(built);
      setOtherAlbumMap(artMap);

      // Like state for each playlist
      const { data: allLikes } = await supabase
        .from('likes')
        .select('user_id, target_id')
        .eq('target_type', 'playlist')
        .eq('target_owner_id', viewingOther);

      const likeMap = new Map<string, LikeState>();
      for (const like of (allLikes ?? []) as any[]) {
        const existing = likeMap.get(like.target_id) ?? { liked: false, count: 0 };
        likeMap.set(like.target_id, {
          count: existing.count + 1,
          liked: existing.liked || like.user_id === user?.id,
        });
      }
      setPlaylistLikesMap(likeMap);
      setLoadingOther(false);
    })();
  }, [viewingOther, user?.id]);

  // ── Fetch liked playlists (own user, liked tab) ───────────────────────────
  useEffect(() => {
    if (viewingOther || !user || activeTab !== 'liked') return;
    setLikedLoading(true);

    (async () => {
      // 1. Get liked playlist IDs + their owners from likes table
      const { data: likedRows } = await supabase
        .from('likes')
        .select('target_id, target_owner_id')
        .eq('user_id', user.id)
        .eq('target_type', 'playlist');

      if (!likedRows || likedRows.length === 0) {
        setLikedPlaylists([]);
        setLikedLoading(false);
        return;
      }

      const playlistIds = likedRows.map((r: any) => r.target_id);

      // 2. Fetch the actual playlists
      const { data: pls } = await supabase
        .from('playlists')
        .select('id, name, description, created_at, user_id')
        .in('id', playlistIds);

      if (!pls || pls.length === 0) {
        setLikedPlaylists([]);
        setLikedLoading(false);
        return;
      }

      // 3. Fetch album membership
      const { data: pas } = await supabase
        .from('playlist_albums')
        .select('playlist_id, spotify_id, position')
        .in('playlist_id', playlistIds)
        .order('position', { ascending: true });

      // 4. Collect all spotify IDs and fetch artwork (one cross-owner query,
      //    artwork for the same track is identical regardless of who logged it)
      const allSpotifyIds = [...new Set((pas ?? []).map((a: any) => a.spotify_id))];
      const artMap = new Map<string, string | undefined>();
      if (allSpotifyIds.length > 0) {
        const { data: uas } = await supabase
          .from('user_albums')
          .select('spotify_id, artwork_url')
          .in('spotify_id', allSpotifyIds);
        for (const a of (uas ?? []) as any[]) {
          if (!artMap.has(a.spotify_id)) {
            artMap.set(a.spotify_id, a.artwork_url ?? undefined);
          }
        }
      }

      // Build owner map (playlist.id → owner user_id) for navigation
      const ownersById = new Map<string, string>(pls.map((p: any) => [p.id, p.user_id]));

      const built: Playlist[] = pls.map((p: any) => ({
        id:          p.id,
        name:        p.name,
        description: p.description ?? undefined,
        albumIds:    (pas ?? [])
          .filter((a: any) => a.playlist_id === p.id)
          .map((a: any) => a.spotify_id),
        createdAt:   p.created_at,
      }));

      setLikedPlaylists(built);
      setLikedAlbumMap(artMap);
      setLikedPlaylistOwners(ownersById);
      setLikedLoading(false);
    })();
  }, [viewingOther, user?.id, activeTab]);

  // ── Toggle like on another user's playlist ────────────────────────────────
  async function handleTogglePlaylistLike(playlist: Playlist) {
    if (!user || !viewingOther) return;
    const targetId = playlist.id;
    const current  = playlistLikesMap.get(targetId) ?? { liked: false, count: 0 };

    // Optimistic update
    const updated = new Map(playlistLikesMap);
    updated.set(targetId, {
      liked: !current.liked,
      count: Math.max(0, current.liked ? current.count - 1 : current.count + 1),
    });
    setPlaylistLikesMap(updated);

    if (current.liked) {
      const { error } = await supabase
        .from('likes')
        .delete()
        .eq('user_id',     user.id)
        .eq('target_type', 'playlist')
        .eq('target_id',   targetId);
      if (error) {
        console.error('[Playlists] unlike error:', error.message);
        setPlaylistLikesMap(new Map(playlistLikesMap)); // revert
      }
    } else {
      const { error } = await supabase
        .from('likes')
        .insert({
          user_id:         user.id,
          target_type:     'playlist',
          target_id:       targetId,
          target_owner_id: viewingOther,
        });
      if (error) {
        console.error('[Playlists] like error:', error.message);
        setPlaylistLikesMap(new Map(playlistLikesMap)); // revert
      } else {
        supabase.from('notifications').insert({
          user_id:  viewingOther,   // recipient = playlist owner (user B)
          type:     'like_playlist',
          actor_id: user.id,        // sender   = liker          (user A)
        }).then(({ error: notifErr }) => {
          if (notifErr) {
            console.error('[Playlists] notification insert error:', notifErr.message, notifErr.code, notifErr.details);
          } else {
            console.log('[Playlists] notification inserted — user_id (owner):', viewingOther, 'actor_id (liker):', user.id);
          }
        });
      }
    }
  }

  // ── Unlike a playlist from the liked tab (removes it from the list) ───────
  async function handleUnlikeLikedPlaylist(playlist: Playlist) {
    if (!user) return;
    // Optimistic removal
    setLikedPlaylists(prev => prev.filter(p => p.id !== playlist.id));

    const { error } = await supabase
      .from('likes')
      .delete()
      .eq('user_id',     user.id)
      .eq('target_type', 'playlist')
      .eq('target_id',   playlist.id);

    if (error) {
      console.error('[Playlists] unlike (liked tab) error:', error.message);
      // Revert — put the playlist back
      setLikedPlaylists(prev => [playlist, ...prev]);
    }
  }

  // ── Own user album artwork map ────────────────────────────────────────────
  // Start with logged albums, then fill in any gaps from Supabase (covers albums
  // added to playlists without being formally logged).
  const [extraArtworkMap, setExtraArtworkMap] = useState<Map<string, string | undefined>>(new Map());

  const ownAlbumMap = new Map<string, string | undefined>([
    ...extraArtworkMap,
    ...loggedAlbums.map((a): [string, string | undefined] => [a.id, a.artworkUrl]),
  ]);

  useEffect(() => {
    if (!user || viewingOther || playlists.length === 0) return;
    const loggedIds = new Set(loggedAlbums.map(a => a.id));
    const neededIds = [...new Set(
      playlists.flatMap(p => p.albumIds.slice(0, 4)).filter(id => !loggedIds.has(id))
    )];
    if (neededIds.length === 0) return;

    supabase
      .from('user_albums')
      .select('spotify_id, artwork_url')
      .eq('user_id', user.id)
      .in('spotify_id', neededIds)
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        setExtraArtworkMap(prev => {
          const next = new Map(prev);
          for (const row of data as any[]) next.set(row.spotify_id, row.artwork_url ?? undefined);
          return next;
        });
      });
  }, [playlists, loggedAlbums, user?.id, viewingOther]);

  // ── New playlist modal ────────────────────────────────────────────────────
  const [showNewPlaylist, setShowNewPlaylist] = useState(false);

  function handleCreate(name: string, desc: string) {
    createPlaylist(name, desc || undefined);
    setShowNewPlaylist(false);
  }

  function confirmDelete(playlist: Playlist) {
    Alert.alert(
      'Delete Playlist',
      `Delete "${playlist.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deletePlaylist(playlist.id) },
      ]
    );
  }

  // ── Loading spinner for other user ────────────────────────────────────────
  if (loadingOther) {
    return (
      <View style={[s.root, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color="#D4A017" size="large" />
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>

      {/* Tab bar — own user only */}
      {!viewingOther && (
        <View style={[s.tabRow, { borderBottomColor: isDark ? '#2e2018' : '#e8e8e8' }]}>
          <Pressable
            onPress={() => setActiveTab('mine')}
            style={[s.tab, activeTab === 'mine' && s.tabActive]}>
            <Text style={[s.tabText, { color: activeTab === 'mine' ? '#D4A017' : '#a07850' }]}>
              My Playlists
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab('liked')}
            style={[s.tab, activeTab === 'liked' && s.tabActive]}>
            <Text style={[s.tabText, { color: activeTab === 'liked' ? '#D4A017' : '#a07850' }]}>
              Liked Playlists
            </Text>
          </Pressable>
        </View>
      )}

      {/* New Playlist button — own user, My Playlists tab only */}
      {!viewingOther && activeTab === 'mine' && (
        <Pressable
          onPress={() => setShowNewPlaylist(true)}
          style={({ pressed }) => [s.newBtn, { opacity: pressed ? 0.7 : 1 }]}>
          <FontAwesome name="plus" size={13} color="#D4A017" />
          <Text style={s.newBtnText}>New Playlist</Text>
        </Pressable>
      )}

      {/* ── Other user's playlists ──────────────────────────────────────── */}
      {viewingOther ? (
        <ScrollView contentContainerStyle={s.listWrap} showsVerticalScrollIndicator={false}>
          {otherPlaylists.length === 0 ? (
            <View style={s.emptyWrap}>
              <FontAwesome name="list" size={36} color={isDark ? '#3a2818' : '#ddd'} />
              <Text style={[s.emptyTitle, { color: colors.text }]}>No playlists yet</Text>
              <Text style={[s.emptySub, { color: colors.subtext }]}>
                This user has no playlists.
              </Text>
            </View>
          ) : (
            otherPlaylists.map((playlist) => {
              const likeState = playlistLikesMap.get(playlist.id) ?? { liked: false, count: 0 };
              return (
                <PlaylistCard
                  key={playlist.id}
                  playlist={playlist}
                  albumMap={otherAlbumMap}
                  onPress={() =>
                    router.push({
                      pathname: '/playlist-detail',
                      params: { id: playlist.id, userId: viewingOther },
                    })
                  }
                  isDark={isDark}
                  colors={colors}
                  likeCount={likeState.count}
                  isLiked={likeState.liked}
                  onLike={() => handleTogglePlaylistLike(playlist)}
                />
              );
            })
          )}
        </ScrollView>

      ) : activeTab === 'mine' ? (
        /* ── Own playlists ─────────────────────────────────────────────── */
        <ScrollView contentContainerStyle={s.listWrap} showsVerticalScrollIndicator={false}>
          {playlists.length === 0 ? (
            <View style={s.emptyWrap}>
              <FontAwesome name="list" size={36} color={isDark ? '#3a2818' : '#ddd'} />
              <Text style={[s.emptyTitle, { color: colors.text }]}>No playlists yet</Text>
              <Text style={[s.emptySub, { color: colors.subtext }]}>
                Create one to start organising your albums.
              </Text>
            </View>
          ) : (
            playlists.map((playlist) => (
              <PlaylistCard
                key={playlist.id}
                playlist={playlist}
                albumMap={ownAlbumMap}
                onPress={() =>
                  router.push({
                    pathname: '/playlist-detail',
                    params: { id: playlist.id },
                  })
                }
                isDark={isDark}
                colors={colors}
              />
            ))
          )}
        </ScrollView>

      ) : (
        /* ── Liked playlists ───────────────────────────────────────────── */
        likedLoading ? (
          <View style={s.likedLoadingWrap}>
            <ActivityIndicator color="#D4A017" size="large" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.listWrap} showsVerticalScrollIndicator={false}>
            {likedPlaylists.length === 0 ? (
              <View style={s.emptyWrap}>
                <FontAwesome name="heart-o" size={36} color={isDark ? '#3a2818' : '#ddd'} />
                <Text style={[s.emptyTitle, { color: colors.text }]}>No liked playlists</Text>
                <Text style={[s.emptySub, { color: colors.subtext }]}>
                  Like playlists from other users to find them here.
                </Text>
              </View>
            ) : (
              likedPlaylists.map((playlist) => (
                <PlaylistCard
                  key={playlist.id}
                  playlist={playlist}
                  albumMap={likedAlbumMap}
                  onPress={() =>
                    router.push({
                      pathname: '/playlist-detail',
                      params: {
                        id:     playlist.id,
                        userId: likedPlaylistOwners.get(playlist.id) ?? '',
                      },
                    })
                  }
                  isDark={isDark}
                  colors={colors}
                  isLiked={true}
                  onLike={() => handleUnlikeLikedPlaylist(playlist)}
                />
              ))
            )}
          </ScrollView>
        )
      )}

      {/* New Playlist modal — own user only */}
      {!viewingOther && (
        <NewPlaylistModal
          visible={showNewPlaylist}
          onClose={() => setShowNewPlaylist(false)}
          onCreate={handleCreate}
          isDark={isDark}
          colors={colors}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },

  // ── Tab bar ──────────────────────────────────────────────────────────────────
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#D4A017',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // ── New button ───────────────────────────────────────────────────────────────
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
  },
  newBtnText: { color: '#D4A017', fontSize: 15, fontWeight: '600' },

  // ── List ─────────────────────────────────────────────────────────────────────
  listWrap: { padding: 16, paddingBottom: 48, gap: 10 },

  playlistCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  playlistInfo: { flex: 1, gap: 3 },
  playlistName: { fontSize: 15, fontWeight: '600' },
  playlistMeta: { fontSize: 12 },
  playlistDesc: { fontSize: 12 },

  // Like button inside playlist card
  likeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  likeCount: { fontSize: 13, fontWeight: '600' },

  // ── Liked playlists loading ───────────────────────────────────────────────────
  likedLoadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // ── Empty state ──────────────────────────────────────────────────────────────
  emptyWrap:  { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '600', marginTop: 8 },
  emptySub:   { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  // ── New Playlist modal ────────────────────────────────────────────────────────
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#4a3020',
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 20 },
  modalLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  modalInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  modalInputMulti: { minHeight: 72, textAlignVertical: 'top' },
  createBtn: {
    marginTop: 24,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createBtnText: { fontSize: 16, fontWeight: '600' },
});
