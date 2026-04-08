import { StyleSheet, View, ScrollView, useWindowDimensions } from 'react-native';
import { Stack } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { AlbumGridCardPlaceholder, cardWidth, GAP, PADDING } from '@/components/AlbumGridCard';

const PLACEHOLDER_COUNT = 48;

export default function DiscoverMostPopularScreen() {
  const { width } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const cw = cardWidth(width);

  return (
    <>
      <Stack.Screen options={{ title: 'Most Popular Albums' }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={s.gridWrap}
        showsVerticalScrollIndicator={false}>
        <View style={s.grid}>
          {Array.from({ length: PLACEHOLDER_COUNT }).map((_, i) => (
            <AlbumGridCardPlaceholder key={i} width={cw} isDark={isDark} />
          ))}
        </View>
      </ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  gridWrap: { padding: PADDING, paddingBottom: 48 },
  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
});
