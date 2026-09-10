import { useState, useEffect } from 'react';
import { StyleSheet, FlatList, useWindowDimensions } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { AlbumGridCard, AlbumGridCardPlaceholder, cardWidth, COLS, GAP, PADDING } from '@/components/AlbumGridCard';
import { CatalogAlbum } from '@/context/CatalogService';
import { discoverSections } from '@/context/discoverSections';
import { useAlbums } from '@/context/AlbumsContext';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
const PLACEHOLDER_COUNT = 20;

export default function DiscoverMostPopularScreen() {
  const { width } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const cw = cardWidth(width);

  const { loggedAlbums } = useAlbums();
  const loggedIds = new Set(loggedAlbums.map((a) => a.id));

  const [albums, setAlbums] = useState<CatalogAlbum[]>(() => discoverSections.popular);

  useEffect(() => {
    if (albums.length > 0) return;
    fetch(`${API_URL}/api/discover/community-popular`)
      .then(r => r.json())
      .then((data: CatalogAlbum[]) => { discoverSections.popular = data; setAlbums(data); })
      .catch(console.error);
  }, []);

  // The list runs to 201 albums, so it renders through a virtualized FlatList —
  // a plain mapped ScrollView would mount every artwork Image at once.
  const loading = albums.length === 0;
  const data: CatalogAlbum[] = loading
    ? Array.from({ length: PLACEHOLDER_COUNT }, (_, i) => ({ id: `placeholder-${i}` } as CatalogAlbum))
    : albums;

  return (
    <>
      <Stack.Screen options={{ title: 'Popular Albums' }} />
      <FlatList
        data={data}
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
        renderItem={({ item }) => (
          loading ? (
            <AlbumGridCardPlaceholder width={cw} isDark={isDark} />
          ) : (
            <AlbumGridCard
              album={item}
              width={cw}
              isDark={isDark}
              isLogged={loggedIds.has(item.id)}
              textColor={colors.text}
              subColor={isDark ? '#a07850' : '#7a5535'}
              onPress={() => router.push({ pathname: '/album-detail', params: { id: item.id, title: item.title, artist: item.artist, year: String(item.year), artworkUrl: item.artworkUrl } } as any)}
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
