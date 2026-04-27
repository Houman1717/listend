import {
  StyleSheet,
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
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
      <FontAwesome name="volume-up" size={9} color={rating > 0 ? '#e8963a' : '#3a2818'} />
      <View style={s.badgeBars}>
        {BAR_HEIGHTS.map((h, i) => (
          <View
            key={i}
            style={[s.badgeBar, { height: h, backgroundColor: i + 1 <= rating ? '#e8963a' : '#2a1e14' }]}
          />
        ))}
      </View>
      {rating > 0 && <Text style={s.badgeNum}>{rating}</Text>}
    </View>
  );
}

function AlbumCard({ album, cardWidth, onPress }: { album: LoggedAlbum; cardWidth: number; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.card, { width: cardWidth, opacity: pressed ? 0.7 : 1 }]}>
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
  );
}

export default function RecentListensScreen() {
  const { width } = useWindowDimensions();
  const cardWidth = (width - PADDING * 2 - GAP * (COLS - 1)) / COLS;
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { loggedAlbums } = useAlbums();

  const recent = loggedAlbums.slice(0, 20);

  return (
    <ScrollView
      style={[s.container, { backgroundColor: colors.background }]}
      contentContainerStyle={s.gridWrap}
      showsVerticalScrollIndicator={false}>
      {recent.length === 0 ? (
        <Text style={[s.emptyText, { color: colors.subtext }]}>
          No albums logged yet — head to Search!
        </Text>
      ) : (
        <View style={s.grid}>
          {recent.map((album) => (
            <AlbumCard
              key={album.id}
              album={album}
              cardWidth={cardWidth}
              onPress={() => router.push({ pathname: '/album-detail', params: { id: album.id } })}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  gridWrap:  { padding: PADDING, paddingBottom: 48 },
  grid:      { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },

  card: { gap: 0 },

  fallback: { borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  fallbackText: { color: 'rgba(255,255,255,0.5)', fontWeight: '700' },

  ratingWrap: { marginTop: 6, alignItems: 'center' },

  badge:     { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  badgeBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 1.5 },
  badgeBar:  { width: 2.5, borderRadius: 1 },
  badgeNum:  { color: '#e8963a', fontSize: 9, fontWeight: '700', lineHeight: 14 },

  emptyText: { textAlign: 'center', marginTop: 80, fontSize: 15 },
});
