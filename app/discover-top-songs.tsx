import { useState, useEffect } from 'react';
import { StyleSheet, FlatList, useWindowDimensions } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { AlbumGridCard, AlbumGridCardPlaceholder, cardWidth, COLS, GAP, PADDING } from '@/components/AlbumGridCard';
import { CatalogTrack } from '@/context/CatalogService';
import { openSongPage } from '@/lib/openSong';
import { discoverSections } from '@/context/discoverSections';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
const PLACEHOLDER_COUNT = 20;

// The two Discover song charts share this screen; `kind` picks which.
const CHARTS = {
  listend: { title: 'Most Listend Songs',  path: '/api/discover/community-most-listend-songs',  section: 'mostListendSongs'  },
  rated:   { title: 'Highest Rated Songs', path: '/api/discover/community-highest-rated-songs', section: 'highestRatedSongs' },
} as const;

export default function DiscoverTopSongsScreen() {
  const { width } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const cw = cardWidth(width);
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  const chart = kind === 'rated' ? CHARTS.rated : CHARTS.listend;

  const [songs, setSongs] = useState<CatalogTrack[]>(() => discoverSections[chart.section]);
  const [loading, setLoading] = useState(discoverSections[chart.section].length === 0);

  useEffect(() => {
    if (songs.length > 0) return;
    fetch(`${API_URL}${chart.path}`)
      .then(r => r.json())
      .then((data: CatalogTrack[]) => {
        discoverSections[chart.section] = data;
        setSongs(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Stack.Screen options={{ title: chart.title, headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text, headerShadowVisible: false }} />
      <FlatList
        data={loading
          ? Array.from({ length: PLACEHOLDER_COUNT }, (_, i) => ({ id: `placeholder-${i}` } as CatalogTrack))
          : songs}
        keyExtractor={(item) => item.id}
        numColumns={COLS}
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={s.gridWrap}
        columnWrapperStyle={s.row}
        showsVerticalScrollIndicator={false}
        initialNumToRender={18}
        maxToRenderPerBatch={12}
        windowSize={7}
        removeClippedSubviews
        renderItem={({ item: song }) => (
          loading ? (
            <AlbumGridCardPlaceholder width={cw} isDark={isDark} />
          ) : (
            <AlbumGridCard
              album={song}
              width={cw}
              isDark={isDark}
              textColor={colors.text}
              subColor={isDark ? '#a07850' : '#7a5535'}
              onPress={() => openSongPage(router, { id: song.id, title: song.title, artist: song.artist, artworkUrl: song.artworkUrl, releaseDate: song.releaseDate, albumId: song.albumId, albumTitle: song.albumTitle, durationMs: song.durationMs })}
            />
          )
        )}
      />
    </>
  );
}

const s = StyleSheet.create({
  gridWrap: { padding: PADDING, paddingBottom: 48, rowGap: GAP },
  row:      { gap: GAP },
});
