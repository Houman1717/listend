import {
  StyleSheet,
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAlbums, LoggedAlbum } from '@/context/AlbumsContext';

const PADDING = 16;
const GAP     = 12;
const COLS    = 3;

const BAR_HEIGHTS = [3, 4, 5, 6, 7, 9, 11, 13, 15, 17];

function VolumeBadge({ rating }: { rating: number }) {
  return (
    <View style={s.badge}>
      <FontAwesome name="volume-up" size={9} color={rating > 0 ? '#FF3CAC' : '#555'} />
      <View style={s.badgeBars}>
        {BAR_HEIGHTS.map((h, i) => (
          <View
            key={i}
            style={[s.badgeBar, { height: h, backgroundColor: i + 1 <= rating ? '#FF3CAC' : '#2e2e2e' }]}
          />
        ))}
      </View>
      {rating > 0 && <Text style={s.badgeNum}>{rating}</Text>}
    </View>
  );
}

function AlbumCard({
  album,
  cardWidth,
  onPress,
  onRemove,
}: {
  album: LoggedAlbum;
  cardWidth: number;
  onPress: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={{ width: cardWidth }}>
      <Pressable
        onPress={onPress}
        onLongPress={onRemove}
        style={({ pressed }) => [s.card, { opacity: pressed ? 0.7 : 1 }]}>
        {album.artworkUrl ? (
          <Image
            source={{ uri: album.artworkUrl }}
            style={{ width: cardWidth, height: cardWidth, borderRadius: 8 }}
            resizeMode="cover"
          />
        ) : (
          <View style={[s.fallback, { width: cardWidth, height: cardWidth, backgroundColor: album.coverColor }]}>
            <Text style={[s.fallbackText, { fontSize: cardWidth * 0.32 }]}>{album.title.charAt(0)}</Text>
          </View>
        )}
        <View style={s.ratingWrap}>
          <VolumeBadge rating={album.rating} />
        </View>
      </Pressable>
      {/* Remove button */}
      <Pressable onPress={onRemove} style={s.removeBtn} hitSlop={4}>
        <FontAwesome name="times-circle" size={16} color="#FF3CAC" />
      </Pressable>
    </View>
  );
}

export default function PlaylistDetailScreen() {
  const { width } = useWindowDimensions();
  const cardWidth = (width - PADDING * 2 - GAP * (COLS - 1)) / COLS;
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { playlists, loggedAlbums, removeAlbumFromPlaylist, deletePlaylist } = useAlbums();

  const playlist = playlists.find((p) => p.id === id);

  if (!playlist) {
    router.back();
    return null;
  }

  const albums = playlist.albumIds
    .map((aid) => loggedAlbums.find((a) => a.id === aid))
    .filter((a): a is LoggedAlbum => a !== undefined);

  function confirmRemoveAlbum(album: LoggedAlbum) {
    Alert.alert(
      'Remove Album',
      `Remove "${album.title}" from this playlist?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeAlbumFromPlaylist(playlist!.id, album.id) },
      ]
    );
  }

  function confirmDeletePlaylist() {
    Alert.alert(
      'Delete Playlist',
      `Delete "${playlist!.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deletePlaylist(playlist!.id);
            router.back();
          },
        },
      ]
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => router.push({ pathname: '/playlist-add-albums', params: { playlistId: playlist!.id } })}
              hitSlop={12}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: '100%', paddingHorizontal: 4 }}>
              <FontAwesome name="plus" size={20} color="#FF3CAC" />
            </Pressable>
          ),
        }}
      />
    <ScrollView
      style={[s.container, { backgroundColor: colors.background }]}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}>

      {/* Header */}
      <View style={s.header}>
        <View style={s.headerText}>
          <Text style={[s.playlistName, { color: colors.text }]}>{playlist.name}</Text>
          <Text style={[s.albumCount, { color: colors.subtext }]}>
            {albums.length === 1 ? '1 album' : `${albums.length} albums`}
          </Text>
          {playlist.description ? (
            <Text style={[s.description, { color: colors.subtext }]}>{playlist.description}</Text>
          ) : null}
        </View>

        <Pressable onPress={confirmDeletePlaylist} hitSlop={8} style={s.deleteBtn}>
          <FontAwesome name="trash-o" size={18} color="#FF3CAC" />
        </Pressable>
      </View>

      <View style={[s.divider, { backgroundColor: isDark ? '#222' : '#e8e8e8' }]} />

      {/* Album grid */}
      {albums.length === 0 ? (
        <View style={s.emptyWrap}>
          <FontAwesome name="music" size={36} color={isDark ? '#333' : '#ddd'} />
          <Text style={[s.emptyTitle, { color: colors.text }]}>No albums yet</Text>
          <Text style={[s.emptySub, { color: colors.subtext }]}>
            Tap the + button above to search and add albums.
          </Text>
        </View>
      ) : (
        <View style={s.grid}>
          {albums.map((album) => (
            <AlbumCard
              key={album.id}
              album={album}
              cardWidth={cardWidth}
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
  ratingWrap: { marginTop: 6, alignItems: 'center' },

  badge:     { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  badgeBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 1.5 },
  badgeBar:  { width: 2.5, borderRadius: 1 },
  badgeNum:  { color: '#FF3CAC', fontSize: 9, fontWeight: '700', lineHeight: 14 },

  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 10,
    padding: 1,
  },

  emptyWrap:  { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '600', marginTop: 8 },
  emptySub:   { fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },
});
