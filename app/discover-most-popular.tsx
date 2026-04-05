import { StyleSheet, View, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { Stack } from 'expo-router';

const GAP = 12;
const COLS = 3;
const PLACEHOLDER_COUNT = 48;

export default function DiscoverMostPopularScreen() {
  const { width } = useWindowDimensions();
  const cardSize = (width - 32 - GAP * (COLS - 1)) / COLS;

  return (
    <>
      <Stack.Screen options={{ title: 'Most Popular Albums' }} />
      <ScrollView
        style={s.container}
        contentContainerStyle={s.gridWrap}
        showsVerticalScrollIndicator={false}>
        <View style={s.grid}>
          {Array.from({ length: PLACEHOLDER_COUNT }).map((_, i) => (
            <Pressable
              key={i}
              style={({ pressed }) => [s.card, { width: cardSize, height: cardSize, opacity: pressed ? 0.7 : 1 }]}
            />
          ))}
        </View>
      </ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d' },
  gridWrap:  { padding: 16, paddingBottom: 48 },
  grid:      { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  card:      { backgroundColor: '#1e1e1e', borderRadius: 8 },
});
