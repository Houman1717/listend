import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { usePro } from '@/context/ProContext';
import { getProTheme, themeToColors } from '@/lib/proThemes';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useState, useEffect, useRef } from 'react';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAlbums, LoggedAlbum, Playlist } from '@/context/AlbumsContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

type LikeState = { liked: boolean; count: number };

type LikedEntry =
  | { kind: 'featured'; likedAt: string; pl: any }
  | { kind: 'user'; likedAt: string; playlist: Playlist; ownerId: string; username: string };

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
              <ExpoImage source={{ uri: url }} style={{ width: half, height: half }} contentFit="cover" cachePolicy="disk" />
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
  byUsername,
  hideChevron,
}: {
  playlist: Playlist;
  albumMap: Map<string, string | undefined>;
  onPress: () => void;
  isDark: boolean;
  colors: any;
  likeCount?: number;
  isLiked?: boolean;
  onLike?: () => void;
  byUsername?: string;
  hideChevron?: boolean;
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
        {byUsername ? (
          <Text style={[s.playlistMeta, { color: colors.tint }]} numberOfLines={1}>
            by @{byUsername}
          </Text>
        ) : null}
        <Text style={[s.playlistMeta, { color: colors.subtext }]}>
          {count === 1 ? '1 album' : `${count} albums`}
        </Text>
        {playlist.description ? (
          <Text style={[s.playlistDesc, { color: colors.subtext }]} numberOfLines={1}>
            {playlist.description}
          </Text>
        ) : null}
      </View>
      {showLike && (
        onLike ? (
          <Pressable onPress={onLike} hitSlop={12} style={hideChevron ? { padding: 4 } : s.likeBtn}>
            <FontAwesome
              name={isLiked ? 'heart' : 'heart-o'}
              size={hideChevron ? 18 : 16}
              color={isLiked ? colors.tint : '#7a5535'}
            />
            {!hideChevron && (likeCount ?? 0) > 0 && (
              <Text style={[s.likeCount, { color: isLiked ? colors.tint : '#7a5535' }]}>
                {likeCount}
              </Text>
            )}
          </Pressable>
        ) : (
          <View style={hideChevron ? { padding: 4 } : s.likeBtn}>
            <FontAwesome name="heart" size={hideChevron ? 18 : 16} color={colors.tint} />
            {!hideChevron && (likeCount ?? 0) > 0 && (
              <Text style={[s.likeCount, { color: colors.tint }]}>{likeCount}</Text>
            )}
          </View>
        )
      )}
      {!hideChevron && <FontAwesome name="chevron-right" size={13} color={isDark ? '#4a3020' : '#a07850'} />}
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
            style={[s.createBtn, { backgroundColor: name.trim() ? colors.tint : (isDark ? '#2a1e14' : '#ddd') }]}
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

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

// ─── Build a chronologically-sorted liked-playlist list for any user ──────────

async function buildLikedEntries(
  userId: string,
): Promise<{ entries: LikedEntry[]; artMap: Map<string, string | undefined> }> {
  const { data: likedRows } = await supabase
    .from('likes')
    .select('target_id, target_owner_id, created_at')
    .eq('user_id', userId)
    .eq('target_type', 'playlist')
    .order('created_at', { ascending: false });

  const rows: any[] = likedRows ?? [];
  const featuredRows = rows.filter(r => (r.target_id as string).startsWith('featured:'));
  const userRows     = rows.filter(r => !(r.target_id as string).startsWith('featured:'));

  const entries: LikedEntry[] = [];

  if (featuredRows.length > 0) {
    try {
      const resp = await fetch(`${API_URL}/api/featured-playlists`);
      const all: any[] = await resp.json();
      const likedAtByFeaturedId = new Map<string, string>(
        featuredRows.map((r: any) => [r.target_id.replace('featured:', ''), r.created_at as string])
      );
      for (const pl of all) {
        if (likedAtByFeaturedId.has(pl.id)) {
          entries.push({ kind: 'featured', likedAt: likedAtByFeaturedId.get(pl.id)!, pl });
        }
      }
    } catch {}
  }

  const artMap = new Map<string, string | undefined>();

  if (userRows.length > 0) {
    const playlistIds = userRows.map((r: any) => r.target_id as string);
    const likedAtById = new Map<string, string>(
      userRows.map((r: any) => [r.target_id as string, r.created_at as string])
    );

    const { data: pls } = await supabase
      .from('playlists')
      .select('id, name, description, created_at, user_id')
      .in('id', playlistIds);

    if (pls && pls.length > 0) {
      const { data: pas } = await supabase
        .from('playlist_albums')
        .select('playlist_id, spotify_id, position')
        .in('playlist_id', playlistIds)
        .order('position', { ascending: true });

      const allSpotifyIds = [...new Set((pas ?? []).map((a: any) => a.spotify_id as string))];
      if (allSpotifyIds.length > 0) {
        const { data: uas } = await supabase
          .from('user_albums')
          .select('spotify_id, artwork_url')
          .in('spotify_id', allSpotifyIds);
        for (const a of (uas ?? []) as any[]) {
          if (!artMap.has(a.spotify_id)) artMap.set(a.spotify_id, a.artwork_url ?? undefined);
        }
      }

      const ownerIds = [...new Set(pls.map((p: any) => p.user_id as string))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', ownerIds);
      const usernameByUserId = new Map<string, string>(
        (profiles ?? []).map((p: any) => [p.id as string, (p.username ?? '') as string])
      );

      for (const p of pls as any[]) {
        const playlist: Playlist = {
          id:          p.id,
          name:        p.name,
          description: p.description ?? undefined,
          albumIds:    (pas ?? [])
            .filter((a: any) => a.playlist_id === p.id)
            .map((a: any) => a.spotify_id as string),
          createdAt:   p.created_at,
        };
        entries.push({
          kind:     'user',
          likedAt:  likedAtById.get(p.id) ?? '',
          playlist,
          ownerId:  p.user_id,
          username: usernameByUserId.get(p.user_id) ?? '',
        });
      }
    }
  }

  entries.sort((a, b) => b.likedAt.localeCompare(a.likedAt));
  return { entries, artMap };
}


// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MyPlaylistsScreen() {
  const colorScheme = useColorScheme();
  const { isPro, proTheme: ownProTheme, showPaywall } = usePro();
  const { userId: paramUserId, proTheme: paramProTheme } = useLocalSearchParams<{ userId?: string; proTheme?: string }>();
  const _themeKey = !paramUserId ? ownProTheme : (paramProTheme ?? 'default');
  const colors = ((!paramUserId ? isPro : !!paramProTheme) && _themeKey !== 'default')
    ? themeToColors(getProTheme(_themeKey))
    : Colors[colorScheme ?? 'dark'];
  const isDark      = colorScheme === 'dark';
  const router      = useRouter();
  const { loggedAlbums, playlists, createPlaylist, deletePlaylist } = useAlbums();
  const { user }    = useAuth();

  const viewingOther = paramUserId || null;

  // ── Own user — tab state ──────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'mine' | 'liked'>('mine');

  // ── Liked playlists ───────────────────────────────────────────────────────
  const [likedEntries,    setLikedEntries]    = useState<LikedEntry[]>([]);
  const [likedAlbumMap,   setLikedAlbumMap]   = useState<Map<string, string | undefined>>(new Map());
  const [likedLoading,    setLikedLoading]    = useState(false);

  // ── Other user's liked playlists ──────────────────────────────────────────
  const [otherLikedEntries,  setOtherLikedEntries]  = useState<LikedEntry[]>([]);
  const [otherLikedAlbumMap, setOtherLikedAlbumMap] = useState<Map<string, string | undefined>>(new Map());
  const [otherLikedLoading,  setOtherLikedLoading]  = useState(false);

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
    buildLikedEntries(user.id).then(({ entries, artMap }) => {
      setLikedEntries(entries);
      setLikedAlbumMap(artMap);
      setLikedLoading(false);
    });
  }, [viewingOther, user?.id, activeTab]);

  // ── Fetch liked playlists (other user, liked tab) ─────────────────────────
  useEffect(() => {
    if (!viewingOther || activeTab !== 'liked') return;
    setOtherLikedLoading(true);
    buildLikedEntries(viewingOther).then(({ entries, artMap }) => {
      setOtherLikedEntries(entries);
      setOtherLikedAlbumMap(artMap);
      setOtherLikedLoading(false);
    });
  }, [viewingOther, activeTab]);

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

  // ── Unlike a featured playlist from the liked tab ─────────────────────────
  async function handleUnlikeFeaturedPlaylist(id: string) {
    if (!user) return;
    setLikedEntries(prev => prev.filter(e => !(e.kind === 'featured' && e.pl.id === id)));
    await supabase
      .from('likes')
      .delete()
      .eq('user_id', user.id)
      .eq('target_type', 'playlist')
      .eq('target_id', `featured:${id}`);
  }

  // ── Unlike a playlist from the liked tab (removes it from the list) ───────
  async function handleUnlikeLikedPlaylist(playlist: Playlist) {
    if (!user) return;
    setLikedEntries(prev => prev.filter(e => !(e.kind === 'user' && e.playlist.id === playlist.id)));
    const { error } = await supabase
      .from('likes')
      .delete()
      .eq('user_id',     user.id)
      .eq('target_type', 'playlist')
      .eq('target_id',   playlist.id);
    if (error) console.error('[Playlists] unlike error:', error.message);
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
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<import('react-native').TextInput>(null);
  const [queryLiked, setQueryLiked] = useState('');
  const [searchOpenLiked, setSearchOpenLiked] = useState(false);
  const searchInputLikedRef = useRef<import('react-native').TextInput>(null);

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
      <Stack.Screen options={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }} />

      {/* Tab bar — always shown */}
      <View style={[s.tabRow, { borderBottomColor: isDark ? '#2e2018' : '#e8e8e8' }]}>
        <Pressable
          onPress={() => setActiveTab('mine')}
          style={[s.tab, activeTab === 'mine' && [s.tabActive, { borderBottomColor: colors.tint }]]}>
          <Text style={[s.tabText, { color: activeTab === 'mine' ? colors.tint : '#a07850' }]}>
            {viewingOther ? 'Playlists' : 'My Playlists'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('liked')}
          style={[s.tab, activeTab === 'liked' && [s.tabActive, { borderBottomColor: colors.tint }]]}>
          <Text style={[s.tabText, { color: activeTab === 'liked' ? colors.tint : '#a07850' }]}>
            Liked Playlists
          </Text>
        </Pressable>
        {activeTab === 'mine' && (
          <Pressable
            onPress={() => {
              const next = !searchOpen;
              setSearchOpen(next);
              if (!next) setQuery('');
              else setTimeout(() => searchInputRef.current?.focus(), 50);
            }}
            hitSlop={8}
            style={[s.tab, s.searchTab, searchOpen && { backgroundColor: colors.tint, borderRadius: 6 }]}>
            <FontAwesome name="search" size={13} color={searchOpen ? '#fff' : colors.tint} />
          </Pressable>
        )}
        {activeTab === 'liked' && (
          <Pressable
            onPress={() => {
              const next = !searchOpenLiked;
              setSearchOpenLiked(next);
              if (!next) setQueryLiked('');
              else setTimeout(() => searchInputLikedRef.current?.focus(), 50);
            }}
            hitSlop={8}
            style={[s.tab, s.searchTab, searchOpenLiked && { backgroundColor: colors.tint, borderRadius: 6 }]}>
            <FontAwesome name="search" size={13} color={searchOpenLiked ? '#fff' : colors.tint} />
          </Pressable>
        )}
      </View>

      {/* New Playlist button — own user, My Playlists tab only */}
      {!viewingOther && activeTab === 'mine' && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, marginTop: 14, marginBottom: 4 }}>
          <Pressable
            onPress={() => {
              if (!isPro && playlists.length >= 3) { showPaywall(); return; }
              setShowNewPlaylist(true);
            }}
            style={({ pressed }) => [s.newBtn, { marginHorizontal: 0, marginTop: 0, marginBottom: 0, opacity: pressed ? 0.7 : 1 }]}>
            <FontAwesome name="plus" size={13} color={colors.tint} />
            <Text style={[s.newBtnText, { color: colors.tint }]}>New Playlist</Text>
          </Pressable>
          {!isPro && (
            <Text style={{ fontSize: 12, color: colors.subtext }}>
              {playlists.length}/3 free
            </Text>
          )}
        </View>
      )}

      {/* Search bar — toggled by magnifying glass */}
      {activeTab === 'mine' && searchOpen && (
        <View style={[s.searchBar, { borderBottomColor: isDark ? '#2e2018' : '#e8e8e8' }]}>
          <FontAwesome name="search" size={14} color={colors.subtext} />
          <TextInput
            ref={searchInputRef}
            style={[s.searchInput, { color: colors.text }]}
            value={query}
            onChangeText={setQuery}
            placeholder="Search playlists…"
            placeholderTextColor={colors.subtext}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
      )}

      {/* ── Own user's playlists tab ────────────────────────────────────── */}
      {activeTab === 'mine' && !viewingOther && (
        <ScrollView contentContainerStyle={s.listWrap} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {(() => {
            const q = query.trim().toLowerCase();
            const filtered = q ? playlists.filter(p => p.name.toLowerCase().includes(q)) : playlists;
            return filtered.length === 0 ? (
              <View style={s.emptyWrap}>
                <FontAwesome name="list" size={36} color={isDark ? '#3a2818' : '#ddd'} />
                <Text style={[s.emptyTitle, { color: colors.text }]}>
                  {q ? `No playlists matching "${query}"` : 'No playlists yet'}
                </Text>
                {!q && <Text style={[s.emptySub, { color: colors.subtext }]}>Create one to start organising your albums.</Text>}
              </View>
            ) : (
              <>
                {filtered.map((playlist) => (
                  <PlaylistCard
                    key={playlist.id}
                    playlist={playlist}
                    albumMap={ownAlbumMap}
                    onPress={() =>
                      router.push({ pathname: '/playlist-detail', params: { id: playlist.id } })
                    }
                    isDark={isDark}
                    colors={colors}
                  />
                ))}
              </>
            );
          })()}
        </ScrollView>
      )}

      {/* ── Other user's playlists tab ──────────────────────────────────── */}
      {activeTab === 'mine' && !!viewingOther && (
        <ScrollView contentContainerStyle={s.listWrap} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {(() => {
            const q = query.trim().toLowerCase();
            const filtered = q ? otherPlaylists.filter(p => p.name.toLowerCase().includes(q)) : otherPlaylists;
            return filtered.length === 0 ? (
              <View style={s.emptyWrap}>
                <FontAwesome name="list" size={36} color={isDark ? '#3a2818' : '#ddd'} />
                <Text style={[s.emptyTitle, { color: colors.text }]}>
                  {q ? `No playlists matching "${query}"` : 'No playlists yet'}
                </Text>
                {!q && <Text style={[s.emptySub, { color: colors.subtext }]}>This user has no playlists.</Text>}
              </View>
            ) : (
              <>
                {filtered.map((playlist) => {
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
                })}
              </>
            );
          })()}
        </ScrollView>
      )}

      {/* ── Liked playlists tab (own + other user) ──────────────────────── */}
      {activeTab === 'liked' && searchOpenLiked && (
        <View style={[s.searchBar, { borderBottomColor: isDark ? '#2e2018' : '#e8e8e8' }]}>
          <FontAwesome name="search" size={14} color={colors.subtext} />
          <TextInput
            ref={searchInputLikedRef}
            style={[s.searchInput, { color: colors.text }]}
            value={queryLiked}
            onChangeText={setQueryLiked}
            placeholder="Search liked playlists…"
            placeholderTextColor={colors.subtext}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
      )}
      {activeTab === 'liked' && (
        (viewingOther ? otherLikedLoading : likedLoading) ? (
          <View style={s.likedLoadingWrap}>
            <ActivityIndicator color="#D4A017" size="large" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.listWrap} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {(() => {
              const q = queryLiked.trim().toLowerCase();
              const allEntries = viewingOther ? otherLikedEntries : likedEntries;
              const filteredEntries = q
                ? allEntries.filter(e =>
                    e.kind === 'featured'
                      ? e.pl.name.toLowerCase().includes(q)
                      : e.playlist.name.toLowerCase().includes(q)
                  )
                : allEntries;
              return filteredEntries.length === 0 ? (
              <View style={s.emptyWrap}>
                <FontAwesome name="heart-o" size={36} color={isDark ? '#3a2818' : '#ddd'} />
                <Text style={[s.emptyTitle, { color: colors.text }]}>
                  {q ? `No playlists matching "${queryLiked}"` : 'No liked playlists'}
                </Text>
                {!q && <Text style={[s.emptySub, { color: colors.subtext }]}>
                  {viewingOther
                    ? 'This user has no liked playlists.'
                    : 'Like playlists from other users or by Listend playlists to find them here.'}
                </Text>}
              </View>
            ) : (
              filteredEntries.map(entry =>
                entry.kind === 'featured' ? (
                  <Pressable
                    key={`featured-${entry.pl.id}`}
                    onPress={() => router.push({ pathname: '/discover-featured-playlist', params: { id: entry.pl.id, name: entry.pl.name, emoji: entry.pl.emoji, description: entry.pl.description, artworkUrlsJson: JSON.stringify(entry.pl.artworkUrls ?? []) } } as any)}
                    style={({ pressed }) => [s.playlistCard, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}>
                    <View style={{ width: 64, height: 64, borderRadius: 8, overflow: 'hidden', flexDirection: 'row', flexWrap: 'wrap' }}>
                      {[...(entry.pl.artworkUrls ?? []), '', '', '', ''].slice(0, 4).map((url: string, i: number) =>
                        url
                          ? <ExpoImage key={i} source={{ uri: url }} style={{ width: 32, height: 32 }} contentFit="cover" cachePolicy="disk" />
                          : <View key={i} style={{ width: 32, height: 32, backgroundColor: isDark ? '#2e2018' : '#d4c4a8' }} />
                      )}
                    </View>
                    <View style={s.playlistInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[s.playlistName, { color: colors.text }]} numberOfLines={1}>{entry.pl.name}</Text>
                        <View style={{ backgroundColor: colors.tint, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                          <Text style={{ color: '#0F0A07', fontSize: 9, fontWeight: '700' }}>by Listend</Text>
                        </View>
                      </View>
                      {entry.pl.description ? <Text style={[s.playlistDesc, { color: colors.subtext }]} numberOfLines={2}>{entry.pl.description}</Text> : null}
                    </View>
                    {!viewingOther && (
                      <Pressable onPress={() => handleUnlikeFeaturedPlaylist(entry.pl.id)} hitSlop={12} style={{ padding: 4 }}>
                        <FontAwesome name="heart" size={18} color={colors.tint} />
                      </Pressable>
                    )}
                  </Pressable>
                ) : (
                  <PlaylistCard
                    key={entry.playlist.id}
                    playlist={entry.playlist}
                    albumMap={viewingOther ? otherLikedAlbumMap : likedAlbumMap}
                    onPress={() =>
                      router.push({
                        pathname: '/playlist-detail',
                        params: { id: entry.playlist.id, userId: entry.ownerId },
                      })
                    }
                    isDark={isDark}
                    colors={colors}
                    isLiked={!viewingOther}
                    onLike={!viewingOther ? () => handleUnlikeLikedPlaylist(entry.playlist) : undefined}
                    byUsername={entry.username}
                    hideChevron
                  />
                )
              )
            );
            })()}
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
  searchTab: {
    flex: 0,
    paddingHorizontal: 14,
    borderBottomColor: 'transparent',
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

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, fontSize: 15, height: 36 },

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
