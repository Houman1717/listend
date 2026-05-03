import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAlbums, TopAlbum, TopSong } from '@/context/AlbumsContext';

const MAX = 5;

function AlbumSlot({
  rank,
  album,
  colors,
  isDark,
  onAdd,
  onRemove,
}: {
  rank: number;
  album: TopAlbum | undefined;
  colors: typeof Colors.light;
  isDark: boolean;
  onAdd: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={styles.slotRow}>
      <Text style={[styles.rank, { color: colors.subtext }]}>{rank}</Text>
      {album ? (
        <Pressable
          style={[styles.filledSlot, { backgroundColor: colors.card }]}
          onLongPress={onRemove}
          onPress={onRemove}>
          <ExpoImage source={{ uri: album.artworkUrl }} style={styles.slotArt} 
            contentFit="cover" cachePolicy="disk"
          />
          <View style={styles.slotText}>
            <Text style={[styles.slotTitle, { color: colors.text }]} numberOfLines={1}>
              {album.title}
            </Text>
            <Text style={[styles.slotArtist, { color: colors.subtext }]} numberOfLines={1}>
              {album.artist} · {album.year}
            </Text>
          </View>
          <Text style={[styles.removeIcon, { color: colors.subtext }]}>✕</Text>
        </Pressable>
      ) : (
        <Pressable
          style={[styles.emptySlot, { backgroundColor: isDark ? '#2e2018' : '#f5e6c8', borderColor: isDark ? '#2a1e14' : '#e0e0e0' }]}
          onPress={onAdd}>
          <Text style={[styles.addText, { color: colors.tint }]}>+ Add album</Text>
        </Pressable>
      )}
    </View>
  );
}

function SongSlot({
  rank,
  song,
  colors,
  isDark,
  onAdd,
  onRemove,
}: {
  rank: number;
  song: TopSong | undefined;
  colors: typeof Colors.light;
  isDark: boolean;
  onAdd: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={styles.slotRow}>
      <Text style={[styles.rank, { color: colors.subtext }]}>{rank}</Text>
      {song ? (
        <Pressable
          style={[styles.filledSlot, { backgroundColor: colors.card }]}
          onPress={onRemove}>
          <ExpoImage source={{ uri: song.artworkUrl }} style={styles.slotArt} 
            contentFit="cover" cachePolicy="disk"
          />
          <View style={styles.slotText}>
            <Text style={[styles.slotTitle, { color: colors.text }]} numberOfLines={1}>
              {song.title}
            </Text>
            <Text style={[styles.slotArtist, { color: colors.subtext }]} numberOfLines={1}>
              {song.artist}
            </Text>
          </View>
          <Text style={[styles.removeIcon, { color: colors.subtext }]}>✕</Text>
        </Pressable>
      ) : (
        <Pressable
          style={[styles.emptySlot, { backgroundColor: isDark ? '#2e2018' : '#f5e6c8', borderColor: isDark ? '#2a1e14' : '#e0e0e0' }]}
          onPress={onAdd}>
          <Text style={[styles.addText, { color: colors.tint }]}>+ Add song</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function ListsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { topAlbums, topSongs, removeTopAlbum, removeTopSong } = useAlbums();

  function confirmRemoveAlbum(id: string, title: string) {
    Alert.alert('Remove album', `Remove "${title}" from your top 5?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeTopAlbum(id) },
    ]);
  }

  function confirmRemoveSong(id: string, title: string) {
    Alert.alert('Remove song', `Remove "${title}" from your top 5?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeTopSong(id) },
    ]);
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Top 5 Albums</Text>
        {Array.from({ length: MAX }).map((_, i) => (
          <AlbumSlot
            key={i}
            rank={i + 1}
            album={topAlbums[i] ?? undefined}
            colors={colors}
            isDark={isDark}
            onAdd={() => router.push({ pathname: '/pick-item', params: { type: 'album', slotIndex: String(i) } })}
            onRemove={() => { const a = topAlbums[i]; if (a) confirmRemoveAlbum(a.id, a.title); }}
          />
        ))}
      </View>

      <View style={[styles.divider, { backgroundColor: isDark ? '#2a1e14' : '#e5e5e5' }]} />

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Top 5 Songs</Text>
        {Array.from({ length: MAX }).map((_, i) => (
          <SongSlot
            key={i}
            rank={i + 1}
            song={topSongs[i] ?? undefined}
            colors={colors}
            isDark={isDark}
            onAdd={() => router.push({ pathname: '/pick-item', params: { type: 'song', slotIndex: String(i) } })}
            onRemove={() => { const s = topSongs[i]; if (s) confirmRemoveSong(s.id, s.title); }}
          />
        ))}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 40,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginBottom: 14,
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
    marginTop: 8,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  rank: {
    width: 24,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    marginRight: 10,
  },
  filledSlot: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  slotArt: {
    width: 46,
    height: 46,
    borderRadius: 4,
  },
  slotText: {
    flex: 1,
    marginLeft: 10,
    gap: 2,
  },
  slotTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  slotArtist: {
    fontSize: 13,
  },
  removeIcon: {
    fontSize: 13,
    marginLeft: 8,
  },
  emptySlot: {
    flex: 1,
    height: 62,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
