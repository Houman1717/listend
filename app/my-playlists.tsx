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

// ─── Playlist artwork mosaic (2×2 grid of first 4 covers) ────────────────────

function PlaylistMosaic({
  albumIds,
  albumMap,
  size,
}: {
  albumIds: string[];
  albumMap: Map<string, string | undefined>; // spotify_id → artwork_url
  size: number;
}) {
  const half = size / 2;
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
              <View style={{ width: half, height: half, backgroundColor: '#1e1e1e' }} />
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
}: {
  playlist: Playlist;
  albumMap: Map<string, string | undefined>;
  onPress: () => void;
  isDark: boolean;
  colors: any;
}) {
  const count = playlist.albumIds.length;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.playlistCard,
        {
          backgroundColor: isDark ? '#111' : '#f7f7f7',
          borderColor: isDark ? '#222' : '#e8e8e8',
          opacity: pressed ? 0.7 : 1,
        },
      ]}>
      <PlaylistMosaic albumIds={playlist.albumIds} albumMap={albumMap} size={64} />
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
      <FontAwesome name="chevron-right" size={13} color={isDark ? '#444' : '#bbb'} />
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
            style={[s.modalInput, { color: colors.text, backgroundColor: isDark ? '#1e1e1e' : '#f2f2f2', borderColor: isDark ? '#333' : '#e0e0e0' }]}
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
            style={[s.modalInput, s.modalInputMulti, { color: colors.text, backgroundColor: isDark ? '#1e1e1e' : '#f2f2f2', borderColor: isDark ? '#333' : '#e0e0e0' }]}
            placeholder="What's this list about?"
            placeholderTextColor={colors.subtext}
            value={desc}
            onChangeText={setDesc}
            multiline
            textAlignVertical="top"
            maxLength={200}
          />

          <Pressable
            style={[s.createBtn, { backgroundColor: name.trim() ? '#FF3CAC' : (isDark ? '#2a2a2a' : '#ddd') }]}
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
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { loggedAlbums, playlists, createPlaylist, deletePlaylist } = useAlbums();
  const { user } = useAuth();
  const { userId: paramUserId } = useLocalSearchParams<{ userId?: string }>();

  const viewingOther = paramUserId || null;

  // ── Other user's playlists fetched from Supabase ──────────────────────────
  const [otherPlaylists, setOtherPlaylists] = useState<Playlist[]>([]);
  const [otherAlbumMap,  setOtherAlbumMap]  = useState<Map<string, string | undefined>>(new Map());
  const [loadingOther,   setLoadingOther]   = useState(false);

  useEffect(() => {
    if (!viewingOther) return;
    setLoadingOther(true);

    (async () => {
      // Fetch playlists
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

      // Fetch playlist→album membership
      const { data: pas } = await supabase
        .from('playlist_albums')
        .select('playlist_id, spotify_id, position')
        .in('playlist_id', playlistIds)
        .order('position', { ascending: true });

      // Fetch viewed user's album artwork
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
      setLoadingOther(false);
    })();
  }, [viewingOther]);

  // ── Own user album artwork map (spotify_id → artwork_url) ─────────────────
  const ownAlbumMap = new Map<string, string | undefined>(
    loggedAlbums.map((a) => [a.id, a.artworkUrl])
  );

  // ── Display data ──────────────────────────────────────────────────────────
  const displayPlaylists = viewingOther ? otherPlaylists : playlists;
  const displayAlbumMap  = viewingOther ? otherAlbumMap  : ownAlbumMap;

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

  if (loadingOther) {
    return (
      <View style={[s.root, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color="#FF3CAC" size="large" />
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* New Playlist button — own user only */}
      {!viewingOther && (
        <Pressable
          onPress={() => setShowNewPlaylist(true)}
          style={({ pressed }) => [s.newBtn, { opacity: pressed ? 0.7 : 1 }]}>
          <FontAwesome name="plus" size={13} color="#FF3CAC" />
          <Text style={s.newBtnText}>New Playlist</Text>
        </Pressable>
      )}

      <ScrollView contentContainerStyle={s.listWrap} showsVerticalScrollIndicator={false}>
        {displayPlaylists.length === 0 ? (
          <View style={s.emptyWrap}>
            <FontAwesome name="list" size={36} color={isDark ? '#333' : '#ddd'} />
            <Text style={[s.emptyTitle, { color: colors.text }]}>No playlists yet</Text>
            <Text style={[s.emptySub, { color: colors.subtext }]}>
              {viewingOther
                ? 'This user has no playlists.'
                : 'Create one to start organising your albums.'}
            </Text>
          </View>
        ) : (
          displayPlaylists.map((playlist) => (
            <PlaylistCard
              key={playlist.id}
              playlist={playlist}
              albumMap={displayAlbumMap}
              onPress={() =>
                router.push({
                  pathname: '/playlist-detail',
                  params: { id: playlist.id, ...(viewingOther ? { userId: viewingOther } : {}) },
                })
              }
              isDark={isDark}
              colors={colors}
            />
          ))
        )}
      </ScrollView>

      {/* Modal — own user only */}
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

const s = StyleSheet.create({
  root: { flex: 1 },

  // ── New button ───────────────────────────────────────────────────────────────
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
  },
  newBtnText: { color: '#FF3CAC', fontSize: 15, fontWeight: '600' },

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
  playlistDesc:  { fontSize: 12 },

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
    backgroundColor: '#444',
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
