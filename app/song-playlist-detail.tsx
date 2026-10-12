import {
  StyleSheet,
  View,
  Text,
  Pressable,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useEffect, useMemo, useState } from 'react';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { VOLUME_EMPTY_DARK, VOLUME_EMPTY_LIGHT } from '@/constants/Colors';
import VolumeBars from '@/components/VolumeBars';
import { usePro } from '@/context/ProContext';
import { getProTheme, themeToColors } from '@/lib/proThemes';
import { useAuth } from '@/context/AuthContext';
import { useSongPlaylists } from '@/context/SongPlaylistsContext';
import { useSongReviews } from '@/context/SongReviewsContext';
import { SongInfoModal, type SongInfo } from '@/components/SongInfoModal';
import { SongPlaylistMosaic } from '@/components/SongPlaylistsTab';
import PlaylistFormModal from '@/components/PlaylistFormModal';
import { supabase } from '@/lib/supabase';
import { handleOrName } from '@/lib/userHandle';
import { fetchSongPlaylist, totalDurationMs, type SongPlaylist } from '@/lib/songPlaylists';
import type { SongMeta } from '@/lib/songReviews';

function formatDuration(ms?: number): string {
  if (!ms) return '';
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function formatRuntime(ms: number): string {
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} hr ${mins % 60} min`;
}

export default function SongPlaylistDetailScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { id, proTheme: paramProTheme } = useLocalSearchParams<{ id: string; proTheme?: string }>();
  const { user } = useAuth();
  const { isPro, proTheme: ownProTheme } = usePro();
  const {
    getSongPlaylist, songPlaylistsLoaded, updateSongPlaylist, deleteSongPlaylist,
    removeSongFromPlaylist, reorderSongPlaylist,
  } = useSongPlaylists();
  const { getSongReview } = useSongReviews();

  const own = getSongPlaylist(id);
  const [remote, setRemote] = useState<SongPlaylist | null>(null);
  const [remoteFailed, setRemoteFailed] = useState(false);
  const [ownerHandle, setOwnerHandle] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [openSong, setOpenSong] = useState<SongInfo | null>(null);

  // Not one of ours (or ours haven't loaded yet) → fetch it directly.
  useEffect(() => {
    if (own || !id) return;
    let cancelled = false;
    fetchSongPlaylist(id).then(pl => {
      if (cancelled) return;
      if (pl) setRemote(pl); else setRemoteFailed(true);
    });
    return () => { cancelled = true; };
  }, [id, !!own]);

  const playlist = own ?? remote;
  const isOwner = !!playlist && playlist.userId === user?.id;

  useEffect(() => {
    if (!playlist || isOwner) return;
    supabase.from('profiles').select('username, display_name').eq('id', playlist.userId).maybeSingle()
      .then(({ data }) => {
        if (data) setOwnerHandle(handleOrName((data as any).username, (data as any).display_name, playlist.userId));
      });
  }, [playlist?.userId, isOwner]);

  // Own playlist → your theme; someone else's → the owner's theme passed in.
  const themeKey = isOwner ? ownProTheme : (paramProTheme ?? 'default');
  const colors = useMemo(
    () => ((isOwner ? isPro : !!paramProTheme) && themeKey !== 'default'
      ? themeToColors(getProTheme(themeKey))
      : Colors[colorScheme ?? 'dark']),
    [isOwner, paramProTheme, isPro, themeKey, colorScheme],
  );
  const isDark = colors.isDark;
  const inactive = isDark ? VOLUME_EMPTY_DARK : VOLUME_EMPTY_LIGHT;

  if (!playlist) {
    return (
      <View style={[s.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text, headerShadowVisible: false }} />
        {remoteFailed && songPlaylistsLoaded
          ? <Text style={{ color: colors.subtext }}>This playlist isn't available.</Text>
          : <ActivityIndicator color={colors.tint} />}
      </View>
    );
  }

  const songs = playlist.songs;
  const runtime = totalDurationMs(songs);

  function move(index: number, delta: number) {
    const to = index + delta;
    if (to < 0 || to >= songs.length) return;
    const ids = songs.map(x => x.id);
    [ids[index], ids[to]] = [ids[to], ids[index]];
    reorderSongPlaylist(playlist!.id, ids).then(ok => {
      if (!ok) Alert.alert("Couldn't reorder", 'Check your connection and try again.');
    });
  }

  function confirmRemove(song: SongMeta) {
    Alert.alert('Remove song?', `Remove "${song.title}" from this playlist?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          const ok = await removeSongFromPlaylist(playlist!.id, song.id);
          if (!ok) Alert.alert("Couldn't remove", 'Check your connection and try again.');
        },
      },
    ]);
  }

  function confirmDelete() {
    Alert.alert('Delete playlist?', `"${playlist!.name}" will be deleted. The songs stay in My Songs.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const ok = await deleteSongPlaylist(playlist!.id);
          if (ok) router.back();
          else Alert.alert("Couldn't delete", 'Check your connection and try again.');
        },
      },
    ]);
  }

  const header = (
    <View style={s.header}>
      <SongPlaylistMosaic playlist={playlist} size={150} fallbackColor={isDark ? '#3a2820' : '#EDE9E3'} />
      <Text style={[s.name, { color: colors.text }]}>{playlist.name}</Text>
      {!isOwner && ownerHandle ? <Text style={[s.by, { color: colors.tint }]}>by {ownerHandle}</Text> : null}
      {playlist.description ? <Text style={[s.desc, { color: colors.subtext }]}>{playlist.description}</Text> : null}
      <Text style={[s.count, { color: colors.subtext }]}>
        {songs.length === 1 ? '1 song' : `${songs.length} songs`}{runtime > 0 ? ` · ${formatRuntime(runtime)}` : ''}
      </Text>

      {isOwner && (
        <View style={s.actions}>
          <Pressable
            onPress={() => router.push({ pathname: '/song-playlist-add', params: { id: playlist.id } })}
            style={({ pressed }) => [s.primaryBtn, { backgroundColor: colors.tint, opacity: pressed ? 0.8 : 1 }]}>
            <FontAwesome name="plus" size={13} color="#fff" />
            <Text style={s.primaryBtnText}>Add Songs</Text>
          </Pressable>
          {songs.length > 1 && (
            <Pressable
              onPress={() => setEditing(v => !v)}
              style={({ pressed }) => [s.secondaryBtn, { borderColor: colors.border, backgroundColor: editing ? colors.tint : 'transparent', opacity: pressed ? 0.7 : 1 }]}>
              <FontAwesome name="sort" size={13} color={editing ? '#fff' : colors.tint} />
              <Text style={[s.secondaryBtnText, { color: editing ? '#fff' : colors.tint }]}>{editing ? 'Done' : 'Reorder'}</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => setRenameOpen(true)}
            hitSlop={8}
            style={({ pressed }) => [s.iconBtn, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}>
            <FontAwesome name="pencil" size={14} color={colors.tint} />
          </Pressable>
          <Pressable
            onPress={confirmDelete}
            hitSlop={8}
            style={({ pressed }) => [s.iconBtn, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}>
            <FontAwesome name="trash-o" size={14} color="#8B1A1A" />
          </Pressable>
        </View>
      )}
    </View>
  );

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{
        title: 'Playlist',
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }} />
      <FlatList
        data={songs}
        keyExtractor={item => item.id}
        ListHeaderComponent={header}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={[s.empty, { color: colors.subtext }]}>
            {isOwner ? 'No songs yet — tap Add Songs.' : 'This playlist is empty.'}
          </Text>
        }
        renderItem={({ item, index }) => {
          const mine = getSongReview(item.id);
          return (
            <Pressable
              onPress={() => !editing && setOpenSong({
                id: item.id, title: item.title, artist: item.artist, artworkUrl: item.artworkUrl,
                albumId: item.albumId, albumTitle: item.albumTitle,
              })}
              onLongPress={isOwner && !editing ? () => confirmRemove(item) : undefined}
              style={({ pressed }) => [s.row, { borderBottomColor: colors.border, opacity: pressed && !editing ? 0.7 : 1 }]}>
              <Text style={[s.num, { color: colors.subtext }]}>{index + 1}</Text>
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
              {editing ? (
                <View style={s.editBtns}>
                  <Pressable onPress={() => move(index, -1)} hitSlop={6} disabled={index === 0}>
                    <FontAwesome name="chevron-up" size={15} color={index === 0 ? colors.border : colors.tint} />
                  </Pressable>
                  <Pressable onPress={() => move(index, 1)} hitSlop={6} disabled={index === songs.length - 1}>
                    <FontAwesome name="chevron-down" size={15} color={index === songs.length - 1 ? colors.border : colors.tint} />
                  </Pressable>
                  <Pressable onPress={() => confirmRemove(item)} hitSlop={6}>
                    <FontAwesome name="times" size={16} color="#8B1A1A" />
                  </Pressable>
                </View>
              ) : (
                <View style={s.right}>
                  {mine && mine.rating > 0 && (
                    <View style={s.badge}>
                      <FontAwesome name="volume-up" size={9} color={colors.tint} />
                      <VolumeBars rating={mine.rating} activeColor={colors.tint} inactiveColor={inactive} />
                      <Text style={[s.badgeNum, { color: colors.tint }]}>{mine.rating}</Text>
                    </View>
                  )}
                  <Text style={[s.dur, { color: colors.subtext }]}>{formatDuration(item.durationMs)}</Text>
                </View>
              )}
            </Pressable>
          );
        }}
      />

      <SongInfoModal
        song={openSong}
        colors={colors}
        onClose={() => setOpenSong(null)}
        onArtistPress={(name) => router.push({ pathname: '/artist-detail', params: { name } })}
        onAlbumPress={(p) => router.push({ pathname: '/album-detail', params: p } as any)}
        onUserPress={(userId) => router.push({ pathname: '/user-profile', params: { userId } })}
      />

      {isOwner && (
        <PlaylistFormModal
          visible={renameOpen}
          title="Edit Playlist"
          submitLabel="Save"
          initialName={playlist.name}
          initialDescription={playlist.description ?? ''}
          onClose={() => setRenameOpen(false)}
          onSubmit={async (name, description) => {
            setRenameOpen(false);
            const ok = await updateSongPlaylist(playlist.id, name, description);
            if (!ok) Alert.alert("Couldn't save", 'Check your connection and try again.');
          }}
          colors={colors}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 16, paddingBottom: 48 },
  header: { alignItems: 'center', paddingTop: 20, paddingBottom: 16, gap: 6 },
  name: { fontSize: 22, fontWeight: '800', marginTop: 10, textAlign: 'center' },
  by: { fontSize: 14, fontWeight: '600' },
  desc: { fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: 12 },
  count: { fontSize: 13 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, height: 40, borderRadius: 20 },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, height: 40, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth },
  secondaryBtnText: { fontSize: 14, fontWeight: '600' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  empty: { textAlign: 'center', marginTop: 30, fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  num: { width: 22, fontSize: 13, textAlign: 'right' },
  art: { width: 44, height: 44, borderRadius: 5 },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '600' },
  sub: { fontSize: 12 },
  right: { alignItems: 'flex-end', gap: 4 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badgeNum: { fontSize: 11, fontWeight: '700' },
  dur: { fontSize: 12 },
  editBtns: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingLeft: 6 },
});
