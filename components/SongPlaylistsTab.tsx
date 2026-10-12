import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useEffect, useState } from 'react';
import { usePro } from '@/context/ProContext';
import { useSongPlaylists } from '@/context/SongPlaylistsContext';
import PlaylistFormModal from '@/components/PlaylistFormModal';
import { fetchUserSongPlaylists, type SongPlaylist } from '@/lib/songPlaylists';

// My Playlists → Songs: song playlists (never mixed with album playlists).
// The free-tier limit is shared with album playlists — 3 playlists in total.

export const FREE_PLAYLIST_LIMIT = 3;

/** 2×2 of the first four distinct covers in the playlist. */
export function SongPlaylistMosaic({ playlist, size, fallbackColor }: {
  playlist: SongPlaylist;
  size: number;
  fallbackColor: string;
}) {
  const covers: string[] = [];
  for (const x of playlist.songs) {
    if (x.artworkUrl && !covers.includes(x.artworkUrl)) covers.push(x.artworkUrl);
    if (covers.length === 4) break;
  }
  const half = size / 2;
  if (covers.length === 1) {
    return <ExpoImage source={{ uri: covers[0] }} style={{ width: size, height: size, borderRadius: 8 }} contentFit="cover" cachePolicy="disk" />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: 8, overflow: 'hidden', flexDirection: 'row', flexWrap: 'wrap' }}>
      {[0, 1, 2, 3].map(i => (
        <View key={i} style={{ width: half, height: half }}>
          {covers[i] ? (
            <ExpoImage source={{ uri: covers[i] }} style={{ width: half, height: half }} contentFit="cover" cachePolicy="disk" />
          ) : (
            <View style={{ width: half, height: half, backgroundColor: fallbackColor }} />
          )}
        </View>
      ))}
    </View>
  );
}

export function SongPlaylistsTab({ viewingUserId, albumPlaylistCount, query, colors, isDark, onOpen }: {
  viewingUserId: string | null;
  /** For the shared free-tier limit. */
  albumPlaylistCount: number;
  query: string;
  colors: any;
  isDark: boolean;
  onOpen: (id: string) => void;
}) {
  const { isPro, proLoaded, showPaywall } = usePro();
  const { songPlaylists, songPlaylistsLoaded, createSongPlaylist } = useSongPlaylists();
  const [other, setOther] = useState<SongPlaylist[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    if (!viewingUserId) return;
    let cancelled = false;
    setFailed(false);
    fetchUserSongPlaylists(viewingUserId).then(list => {
      if (cancelled) return;
      if (list) setOther(list); else setFailed(true);
    });
    return () => { cancelled = true; };
  }, [viewingUserId]);

  const source  = viewingUserId ? (other ?? []) : songPlaylists;
  const loaded  = viewingUserId ? other !== null : songPlaylistsLoaded;
  const total   = albumPlaylistCount + songPlaylists.length;
  const atLimit = total >= FREE_PLAYLIST_LIMIT;
  const q = query.trim().toLowerCase();
  const shown = q ? source.filter(p => p.name.toLowerCase().includes(q)) : source;

  async function handleCreate(name: string, description: string) {
    setShowNew(false);
    const id = await createSongPlaylist(name, description);
    if (id) onOpen(id);
    else Alert.alert("Couldn't create playlist", 'Check your connection and try again.');
  }

  return (
    <>
      {!viewingUserId && (
        <View style={s.newRow}>
          <Pressable
            onPress={() => {
              if (!isPro && atLimit) { showPaywall(); return; }
              setShowNew(true);
            }}
            style={({ pressed }) => [s.newBtn, { opacity: pressed ? 0.7 : 1 }]}>
            <FontAwesome name="plus" size={13} color={colors.tint} />
            <Text style={[s.newBtnText, { color: colors.tint }]}>New Song Playlist</Text>
          </Pressable>
          {proLoaded && !isPro && (
            <Pressable
              onPress={showPaywall}
              hitSlop={8}
              style={({ pressed }) => [s.limitChip, {
                borderColor: atLimit ? '#D4A017' : colors.border,
                backgroundColor: atLimit ? 'rgba(212,160,23,0.12)' : 'transparent',
                opacity: pressed ? 0.7 : 1,
              }]}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: atLimit ? '#D4A017' : colors.subtext }}>
                {atLimit ? 'Go unlimited' : `${total}/${FREE_PLAYLIST_LIMIT} free`}
              </Text>
              <FontAwesome name="chevron-right" size={9} color={atLimit ? '#D4A017' : colors.subtext} />
            </Pressable>
          )}
        </View>
      )}

      <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {!loaded ? (
          failed
            ? <Text style={[s.emptySub, { color: colors.subtext, marginTop: 60 }]}>Couldn't load playlists. Try again in a moment.</Text>
            : <ActivityIndicator color={colors.tint} style={{ marginTop: 60 }} />
        ) : shown.length === 0 ? (
          <View style={s.emptyWrap}>
            <FontAwesome name="music" size={36} color={isDark ? '#3a2818' : '#ddd'} />
            <Text style={[s.emptyTitle, { color: colors.text }]}>
              {q ? `No song playlists matching "${query.trim()}"` : 'No song playlists yet'}
            </Text>
            {!q && !viewingUserId && (
              <Text style={[s.emptySub, { color: colors.subtext }]}>Make a mixtape of your favourite tracks.</Text>
            )}
          </View>
        ) : (
          shown.map(pl => (
            <Pressable
              key={pl.id}
              onPress={() => onOpen(pl.id)}
              style={({ pressed }) => [s.card, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}>
              <SongPlaylistMosaic playlist={pl} size={64} fallbackColor={isDark ? '#3a2820' : '#EDE9E3'} />
              <View style={s.info}>
                <Text style={[s.name, { color: colors.text }]} numberOfLines={1}>{pl.name}</Text>
                <Text style={[s.meta, { color: colors.subtext }]}>
                  {pl.songs.length === 1 ? '1 song' : `${pl.songs.length} songs`}
                </Text>
                {pl.description ? (
                  <Text style={[s.meta, { color: colors.subtext }]} numberOfLines={1}>{pl.description}</Text>
                ) : null}
              </View>
              <FontAwesome name="chevron-right" size={13} color={isDark ? '#4a3020' : '#a07850'} />
            </Pressable>
          ))
        )}
      </ScrollView>

      {!viewingUserId && (
        <PlaylistFormModal
          visible={showNew}
          title="New Song Playlist"
          submitLabel="Create Playlist"
          onClose={() => setShowNew(false)}
          onSubmit={handleCreate}
          colors={colors}
        />
      )}
    </>
  );
}

const s = StyleSheet.create({
  newRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, marginTop: 14, marginBottom: 4 },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  newBtnText: { fontSize: 15, fontWeight: '600' },
  limitChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  list: { padding: 16, paddingBottom: 48, gap: 10 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  info: { flex: 1, gap: 3 },
  name: { fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 12 },
  emptyWrap: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '600', marginTop: 8 },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
