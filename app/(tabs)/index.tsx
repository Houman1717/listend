import { FlatList, StyleSheet, View, Text, Image, Pressable } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

type Album = {
  id: string;
  title: string;
  artist: string;
  year: number;
  rating: number;
  dateLogged: string;
  coverColor: string;
};

const MOCK_ALBUMS: Album[] = [
  {
    id: '1',
    title: 'To Pimp a Butterfly',
    artist: 'Kendrick Lamar',
    year: 2015,
    rating: 5,
    dateLogged: 'Mar 24, 2026',
    coverColor: '#2d5a27',
  },
  {
    id: '2',
    title: 'Fetch the Bolt Cutters',
    artist: 'Fiona Apple',
    year: 2020,
    rating: 5,
    dateLogged: 'Mar 21, 2026',
    coverColor: '#7a4a2e',
  },
  {
    id: '3',
    title: 'In Rainbows',
    artist: 'Radiohead',
    year: 2007,
    rating: 4,
    dateLogged: 'Mar 18, 2026',
    coverColor: '#1e3a5f',
  },
  {
    id: '4',
    title: 'Blonde',
    artist: 'Frank Ocean',
    year: 2016,
    rating: 5,
    dateLogged: 'Mar 15, 2026',
    coverColor: '#d4a017',
  },
  {
    id: '5',
    title: 'Javelin',
    artist: 'Sufjan Stevens',
    year: 2023,
    rating: 4,
    dateLogged: 'Mar 10, 2026',
    coverColor: '#5c2d82',
  },
  {
    id: '6',
    title: 'Ctrl',
    artist: 'SZA',
    year: 2017,
    rating: 4,
    dateLogged: 'Mar 5, 2026',
    coverColor: '#8b1a1a',
  },
];

function StarRating({ rating, color }: { rating: number; color: string }) {
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Text
          key={star}
          style={[styles.star, { color: star <= rating ? '#E94560' : color }]}>
          ★
        </Text>
      ))}
    </View>
  );
}

function AlbumCard({ album, colors }: { album: Album; colors: typeof Colors.light }) {
  return (
    <Pressable style={[styles.card, { backgroundColor: colors.card }]}>
      <View style={[styles.albumArt, { backgroundColor: album.coverColor }]}>
        <Text style={styles.albumArtInitial}>
          {album.title.charAt(0)}
        </Text>
      </View>
      <View style={styles.cardContent}>
        <Text style={[styles.albumTitle, { color: colors.text }]} numberOfLines={1}>
          {album.title}
        </Text>
        <Text style={[styles.artistName, { color: colors.subtext }]} numberOfLines={1}>
          {album.artist} · {album.year}
        </Text>
        <View style={styles.ratingRow}>
          <StarRating rating={album.rating} color={colors.subtext} />
          <Text style={[styles.dateLogged, { color: colors.subtext }]}>
            {album.dateLogged}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function JournalScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={MOCK_ALBUMS}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <AlbumCard album={item} colors={colors} />}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => (
          <View style={[styles.separator, { backgroundColor: colorScheme === 'dark' ? '#222' : '#eee' }]} />
        )}
        ListHeaderComponent={() => (
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Recent</Text>
            <Text style={[styles.headerCount, { color: colors.subtext }]}>
              {MOCK_ALBUMS.length} albums
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  headerCount: {
    fontSize: 14,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  albumArt: {
    width: 60,
    height: 60,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  albumArtInitial: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 24,
    fontWeight: '700',
  },
  cardContent: {
    flex: 1,
    marginLeft: 14,
    gap: 3,
  },
  albumTitle: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  artistName: {
    fontSize: 14,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  stars: {
    flexDirection: 'row',
    gap: 1,
  },
  star: {
    fontSize: 14,
  },
  dateLogged: {
    fontSize: 12,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 90,
  },
});
