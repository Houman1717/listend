import { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, useWindowDimensions } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { AlbumGridCard, AlbumGridCardPlaceholder, cardWidth, GAP, PADDING } from '@/components/AlbumGridCard';
import { SpotifyAlbum } from '@/context/SpotifyService';
import { useAlbums } from '@/context/AlbumsContext';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
const PLACEHOLDER_COUNT = 12;

export default function FeaturedPlaylistScreen() {
  const { width } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const cw = cardWidth(width);

  const { id, name, emoji } = useLocalSearchParams<{ id: string; name: string; emoji: string }>();
  const { loggedAlbums } = useAlbums();
  const loggedIds = new Set(loggedAlbums.map(a => a.id));

  const [albums, setAlbums] = useState<SpotifyAlbum[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`${API_URL}/api/featured-playlists/${id}`)
      .then(r => r.json())
      .then((data: SpotifyAlbum[]) => { setAlbums(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  return (
    <>
      <Stack.Screen options={{ title: emoji ? `${emoji} ${name}` : (name ?? 'Playlist') }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={s.gridWrap}
        showsVerticalScrollIndicator={false}>
        <View style={s.grid}>
          {loading
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
                  onPress={() =>
                    router.push({
                      pathname: '/album-detail',
                      params: { id: album.id, title: album.title, artist: album.artist, year: String(album.year), artworkUrl: album.artworkUrl },
                    } as any)
                  }
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
