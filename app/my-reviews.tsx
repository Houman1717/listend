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

function ReviewRow({ album, colors, onPress }: { album: LoggedAlbum; colors: typeof Colors.light; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [s.row, { opacity: pressed ? 0.7 : 1 }]}
      onPress={onPress}>
      {album.artworkUrl ? (
        <Image source={{ uri: album.artworkUrl }} style={s.art} />
      ) : (
        <View style={[s.art, { backgroundColor: album.coverColor, justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={s.artInitial}>{album.title.charAt(0)}</Text>
        </View>
      )}
      <View style={s.info}>
        <Text style={[s.title, { color: colors.text }]} numberOfLines={1}>{album.title}</Text>
        <Text style={[s.artist, { color: colors.subtext }]} numberOfLines={1}>
          {album.artist} · {album.year}
        </Text>
        <Stars rating={album.rating} color={colors.subtext} />
        <Text style={[s.review, { color: colors.subtext }]} numberOfLines={3}>{album.review}</Text>
      </View>
    </Pressable>
  );
}

export default function MyReviewsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { loggedAlbums } = useAlbums();

  const reviewed = loggedAlbums.filter((a) => !!a.review);

  return (
    <FlatList
      data={reviewed}
      keyExtractor={(item) => item.id}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={s.listContent}
      ItemSeparatorComponent={() => (
        <View style={[s.separator, { backgroundColor: isDark ? '#222' : '#eee' }]} />
      )}
      ListEmptyComponent={() => (
        <View style={s.empty}>
          <Text style={[s.emptyTitle, { color: colors.text }]}>No reviews yet</Text>
          <Text style={[s.emptySubtext, { color: colors.subtext }]}>
            Log an album and write your thoughts on it.
          </Text>
        </View>
      )}
      renderItem={({ item }) => (
        <ReviewRow
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

  row: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 14 },
  art: { width: 64, height: 64, borderRadius: 4, flexShrink: 0 },
  artInitial: { color: 'rgba(255,255,255,0.7)', fontSize: 22, fontWeight: '700' },
  info: { flex: 1, marginLeft: 14, gap: 4 },
  title: { fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
  artist: { fontSize: 13 },
  stars: { flexDirection: 'row', gap: 1 },
  star: { fontSize: 12 },
  review: { fontSize: 13, lineHeight: 19, fontStyle: 'italic', marginTop: 2 },

  empty: { alignItems: 'center', marginTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '600', marginBottom: 8 },
  emptySubtext: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
