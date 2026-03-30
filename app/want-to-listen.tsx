import {
  StyleSheet,
  View,
  Text,
  Image,
  Pressable,
  FlatList,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAlbums, WantToListenAlbum } from '@/context/AlbumsContext';

const DARK_BG = '#0d0d0d';
const BORDER = '#2a2a2a';
const TEXT = '#f0f0f0';
const SUBTEXT = '#888';

function WantRow({ album, onRemove, onLog }: {
  album: WantToListenAlbum;
  onRemove: () => void;
  onLog: () => void;
}) {
  return (
    <View style={s.row}>
      {album.artworkUrl ? (
        <Image source={{ uri: album.artworkUrl }} style={s.art} />
      ) : (
        <View style={[s.art, { backgroundColor: '#2a2a2a', justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={{ color: SUBTEXT, fontSize: 18, fontWeight: '700' }}>{album.title.charAt(0)}</Text>
        </View>
      )}
      <View style={s.info}>
        <Text style={s.title} numberOfLines={1}>{album.title}</Text>
        <Text style={s.artist} numberOfLines={1}>{album.artist} · {album.year}</Text>
      </View>
      <Pressable style={s.logBtn} onPress={onLog} hitSlop={8}>
        <Text style={s.logBtnText}>Log</Text>
      </Pressable>
      <Pressable onPress={onRemove} hitSlop={12} style={s.removeBtn}>
        <Text style={s.removeIcon}>✕</Text>
      </Pressable>
    </View>
  );
}

export default function WantToListenScreen() {
  const router = useRouter();
  const { wantToListen, removeFromWantToListen, setPendingAlbum } = useAlbums();

  function confirmRemove(album: WantToListenAlbum) {
    Alert.alert('Remove', `Remove "${album.title}" from Want to Listen?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeFromWantToListen(album.id) },
    ]);
  }

  function handleLog(album: WantToListenAlbum) {
    setPendingAlbum({
      spotifyId: album.id,
      title: album.title,
      artist: album.artist,
      year: album.year,
      artworkUrl: album.artworkUrl,
    });
    router.push('/log-album');
  }

  return (
    <FlatList
      style={s.container}
      data={wantToListen}
      keyExtractor={(item) => item.id}
      contentContainerStyle={s.content}
      ItemSeparatorComponent={() => <View style={s.separator} />}
      ListEmptyComponent={() => (
        <View style={s.empty}>
          <Text style={s.emptyTitle}>Nothing here yet</Text>
          <Text style={s.emptySubtext}>
            Tap the bookmark icon on any album in Search to save it here.
          </Text>
        </View>
      )}
      renderItem={({ item }) => (
        <WantRow
          album={item}
          onRemove={() => confirmRemove(item)}
          onLog={() => handleLog(item)}
        />
      )}
    />
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_BG },
  content: { paddingBottom: 48 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  art: { width: 56, height: 56, borderRadius: 4, flexShrink: 0 },
  info: { flex: 1, marginLeft: 14, gap: 3 },
  title: { color: TEXT, fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
  artist: { color: SUBTEXT, fontSize: 13 },

  logBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FF3CAC',
    marginRight: 10,
  },
  logBtnText: { color: '#FF3CAC', fontSize: 13, fontWeight: '600' },

  removeBtn: { padding: 4 },
  removeIcon: { color: SUBTEXT, fontSize: 13 },

  separator: { height: StyleSheet.hairlineWidth, backgroundColor: BORDER, marginLeft: 86 },

  empty: { alignItems: 'center', marginTop: 80, paddingHorizontal: 32 },
  emptyTitle: { color: TEXT, fontSize: 17, fontWeight: '600', marginBottom: 8 },
  emptySubtext: { color: SUBTEXT, fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
