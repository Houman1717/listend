import { StyleSheet, View, Text, Pressable, ScrollView, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';

type Genre = { label: string; color: string };

const GENRES: Genre[] = [
  { label: 'Rap',         color: '#8B1A1A' },
  { label: 'R&B',         color: '#7a0060' },
  { label: 'Pop',         color: '#c0392b' },
  { label: 'Rock',        color: '#1e3a6b' },
  { label: 'House',       color: '#4A0080' },
  { label: 'Afrobeats',   color: '#7a3b00' },
  { label: 'Reggaeton',   color: '#1a5a3a' },
  { label: 'Country',     color: '#3d5a27' },
  { label: 'Jazz',        color: '#2c3e50' },
  { label: 'Soul',        color: '#5c0040' },
  { label: 'Electronic',  color: '#0d3a5f' },
  { label: 'Alternative', color: '#002855' },
  { label: 'Indie',       color: '#005c5c' },
  { label: 'Metal',       color: '#1c1c1c' },
  { label: 'Classical',   color: '#4a3000' },
  { label: 'Folk',        color: '#3d2b00' },
  { label: 'Latin',       color: '#7a2000' },
  { label: 'K-Pop',       color: '#6b006b' },
];

const GAP = 10;
const COLS = 2;
const TILE_WIDTH = Math.floor((Dimensions.get('window').width - 32 - GAP) / COLS);
const TILE_HEIGHT = Math.round(TILE_WIDTH * 0.56);

export default function DiscoverGenresScreen() {
  const router = useRouter();

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}>
      <View style={s.grid}>
        {GENRES.map((genre) => (
          <Pressable
            key={genre.label}
            style={({ pressed }) => [
              s.tile,
              { backgroundColor: genre.color, width: TILE_WIDTH, height: TILE_HEIGHT, opacity: pressed ? 0.75 : 1 },
            ]}
            onPress={() =>
              router.push({
                pathname: '/discover-results',
                params: { category: 'genre', value: genre.label, title: genre.label },
              })
            }>
            <Text style={s.tileLabel}>{genre.label}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d' },
  content: { padding: 16, paddingBottom: 48 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  tile: {
    borderRadius: 10,
    justifyContent: 'flex-end',
    padding: 12,
    overflow: 'hidden',
  },
  tileLabel: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
