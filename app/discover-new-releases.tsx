import { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, useWindowDimensions } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { AlbumGridCard, AlbumGridCardPlaceholder, cardWidth, GAP, PADDING } from '@/components/AlbumGridCard';
import { SpotifyAlbum } from '@/context/SpotifyService';
import { discoverSections } from '@/context/discoverSections';
import { useAlbums } from '@/context/AlbumsContext';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
const PLACEHOLDER_COUNT = 20;

export default function DiscoverNewReleasesScreen() {
  const { width } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const cw = cardWidth(width);

  const { loggedAlbums } = useAlbums();
  const loggedIds = new Set(loggedAlbums.map((a) => a.id));

  const [albums, setAlbums] = useState<SpotifyAlbum[]>(() => discoverSections.newReleases);

  useEffect(() => {
    if (albums.length > 0) return;
    fetch(`${API_URL}/discover/new-releases`)
      .then(r => r.json())
      .then((data: SpotifyAlbum[]) => { discoverSections.newReleases = data; setAlbums(data); })
      .catch(console.error);
  }, []);

  return (
    <>
      <Stack.Screen options={{ title: 'New Releases' }} />
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
                  isLogged={loggedIds.has(album.id)}
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
