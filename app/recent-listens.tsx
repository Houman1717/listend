import {
  StyleSheet,
  View,
  Text,
  Image,
  Pressable,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAlbums, LoggedAlbum } from '@/context/AlbumsContext';

function Stars({ rating, color }: { rating: number; color: string }) {
  return (
    <View style={s.stars}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Text key={n} style={[s.star, { color: n <= rating ? '#FF3CAC' : color }]}>★</Text>
      ))}
    </View>
  );
}

function AlbumRow({ album, colors, onPress }: { album: LoggedAlbum; colors: typeof Colors.light; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [s.albumRow, { opacity: pressed ? 0.7 : 1 }]}
      onPress={onPress}>
      {album.artworkUrl ? (
        <Image source={{ uri: album.artworkUrl }} style={s.albumArt} />
      ) : (
        <View style={[s.albumArt, { backgroundColor: album.coverColor, justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={s.albumInitial}>{album.title.charAt(0)}</Text>
        </View>
      )}
      <View style={s.albumInfo}>
        <Text style={[s.albumTitle, { color: colors.text }]} numberOfLines={1}>{album.title}</Text>
        <Text style={[s.albumArtist, { color: colors.subtext }]} numberOfLines={1}>
          {album.artist} · {album.year}
        </Text>
        <View style={s.ratingRow}>
          <Stars rating={album.rating} color={colors.subtext} />
          <Text style={[s.dateLogged, { color: colors.subtext }]}>{album.dateLogged}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function RecentListensScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { loggedAlbums } = useAlbums();

  // Most recent first — already sorted newest-first, take top 20
  const recent = loggedAlbums.slice(0, 20);

  return (
    <FlatList
      data={recent}
      keyExtractor={(item) => item.id}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={s.listContent}
      ItemSeparatorComponent={() => (
        <View style={[s.separator, { backgroundColor: isDark ? '#222' : '#eee' }]} />
      )}
      ListEmptyComponent={() => (
        <Text style={[s.emptyText, { color: colors.subtext }]}>
          No albums logged yet — head to Search!
        </Text>
      )}
      renderItem={({ item }) => (
        <AlbumRow
          album={item}
          colors={colors}
          onPress={() => router.push({ pathname: '/album-detail', params: { id: item.id } })}
        />
      )}
    />
  );
}

const s = StyleSheet.create({
  listContent: { paddingBottom: 40 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 90 },
  emptyText: { textAlign: 'center', marginTop: 48, fontSize: 15 },

  albumRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  albumArt: { width: 60, height: 60, borderRadius: 4, flexShrink: 0 },
  albumInitial: { color: 'rgba(255,255,255,0.7)', fontSize: 22, fontWeight: '700' },
  albumInfo: { flex: 1, marginLeft: 14, gap: 3 },
  albumTitle: { fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
  albumArtist: { fontSize: 13 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  stars: { flexDirection: 'row', gap: 1 },
  star: { fontSize: 13 },
  dateLogged: { fontSize: 12 },
});
