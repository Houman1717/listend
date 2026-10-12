import { Modal, View, Text, Pressable, ScrollView, StyleSheet, Platform } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useState } from 'react';
import { useSongPlaylists } from '@/context/SongPlaylistsContext';
import { SongPlaylistMosaic } from '@/components/SongPlaylistsTab';
import type { SongMeta } from '@/lib/songReviews';

/**
 * Bottom sheet listing your song playlists; tap one to add (or remove) the
 * song. Rendered inside another Modal (SongInfoModal), so no router here.
 */
export function AddToSongPlaylistSheet({ song, visible, onClose, isDark, colors }: {
  song:    SongMeta;
  visible: boolean;
  onClose: () => void;
  isDark:  boolean;
  colors:  { text: string; subtext: string; border: string; tint: string };
}) {
  const { songPlaylists, songPlaylistsLoaded, addSongsToPlaylist, removeSongFromPlaylist } = useSongPlaylists();
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  async function toggle(playlistId: string, inIt: boolean) {
    if (busy) return;
    setBusy(playlistId);
    setFailed(null);
    const ok = inIt ? await removeSongFromPlaylist(playlistId, song.id) : await addSongsToPlaylist(playlistId, [song]);
    setBusy(null);
    if (!ok) setFailed(playlistId);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={[s.sheet, { backgroundColor: isDark ? '#141414' : '#fff' }]}>
        <View style={[s.handle, { backgroundColor: colors.border }]} />
        <Text style={[s.title, { color: colors.text }]}>Add to Playlist</Text>
        <Text style={[s.subtitle, { color: colors.subtext }]} numberOfLines={1}>{song.title} · {song.artist}</Text>
        <ScrollView style={{ flexGrow: 0 }} showsVerticalScrollIndicator={false}>
          {!songPlaylistsLoaded ? (
            <Text style={[s.empty, { color: colors.subtext }]}>Loading…</Text>
          ) : songPlaylists.length === 0 ? (
            <Text style={[s.empty, { color: colors.subtext }]}>
              No song playlists yet. Create one in My Playlists → Songs.
            </Text>
          ) : (
            songPlaylists.map(pl => {
              const inIt = pl.songs.some(x => x.id === song.id);
              return (
                <Pressable
                  key={pl.id}
                  onPress={() => toggle(pl.id, inIt)}
                  style={({ pressed }) => [s.row, { borderBottomColor: colors.border, opacity: pressed || busy === pl.id ? 0.6 : 1 }]}>
                  <SongPlaylistMosaic playlist={pl} size={40} fallbackColor={isDark ? '#3a2820' : '#EDE9E3'} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.name, { color: colors.text }]} numberOfLines={1}>{pl.name}</Text>
                    <Text style={[s.meta, { color: failed === pl.id ? '#8B1A1A' : colors.subtext }]}>
                      {failed === pl.id ? "Couldn't update — tap to retry" : `${pl.songs.length} song${pl.songs.length === 1 ? '' : 's'}`}
                    </Text>
                  </View>
                  <FontAwesome name={inIt ? 'check-circle' : 'plus-circle'} size={22} color={inIt ? colors.tint : colors.subtext} />
                </Pressable>
              );
            })
          )}
        </ScrollView>
        <Pressable onPress={onClose} style={({ pressed }) => [s.done, { backgroundColor: colors.tint, opacity: pressed ? 0.85 : 1 }]}>
          <Text style={s.doneText}>Done</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { maxHeight: '70%', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 10, paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 34 : 20 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  title: { fontSize: 17, fontWeight: '700' },
  subtitle: { fontSize: 13, marginTop: 2, marginBottom: 8 },
  empty: { fontSize: 14, lineHeight: 20, paddingVertical: 20, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  name: { fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 12, marginTop: 1 },
  done: { height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  doneText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
