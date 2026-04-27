import { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, useWindowDimensions } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { AlbumGridCard, AlbumGridCardPlaceholder, cardWidth, GAP, PADDING } from '@/components/AlbumGridCard';
import { SpotifyAlbum } from '@/context/SpotifyService';
import { discoverSections } from '@/context/discoverSections';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
const PLACEHOLDER_COUNT = 20;

export default function DiscoverTopRatedScreen() {
  const { width } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const cw = cardWidth(width);

  const [albums, setAlbums] = useState<SpotifyAlbum[]>(() => discoverSections.topRated);

  useEffect(() => {
    if (albums.length > 0) return;
    fetch(`${API_URL}/discover/top-rated`)
      .then(r => r.json())
      .then((data: SpotifyAlbum[]) => { discoverSections.topRated = data; setAlbums(data); })
      .catch(console.error);
  }, []);

  return (
    <>
      <Stack.Screen options={{ title: 'Top Rated Albums' }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={s.gridWrap}
        showsVerticalScrollIndicator={false}>
        <View style={s.grid}>
          {albums.length === 0
            ? Array.from({ length: PLACEHOLDER_COUNT }).map((_, i) => (
                <AlbumGridCardPlaceholder key={i} width={cw} isDark={isDark} />
              ))
            : albums.map(album => (
                <AlbumGridCard
                  key={album.id}
                  album={album}
                  width={cw}
                  isDark={isDark}
                  textColor={colors.text}
                  subColor={isDark ? '#a07850' : '#7a5535'}
                  onPress={() => router.push({ pathname: '/album-detail', params: { id: album.id, title: album.title, artist: album.artist, year: String(album.year), artworkUrl: album.artworkUrl } } as any)}
                />
              ))
          }
        </View>
      </ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  gridWrap: { padding: PADDING, paddingBottom: 48 },
  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
});
