import { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, useWindowDimensions } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { AlbumGridCard, AlbumGridCardPlaceholder, cardWidth, GAP, PADDING } from '@/components/AlbumGridCard';
import { CatalogTrack } from '@/context/CatalogService';
import { SongInfoModal, SongInfo } from '@/components/SongInfoModal';
import { discoverSections } from '@/context/discoverSections';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
const PLACEHOLDER_COUNT = 20;

export default function DiscoverTopSongsScreen() {
  const { width } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const cw = cardWidth(width);

  const [songs, setSongs] = useState<CatalogTrack[]>(() => discoverSections.topSongs);
  const [loading, setLoading] = useState(discoverSections.topSongs.length === 0);
  const [activeSong, setActiveSong] = useState<SongInfo | null>(null);

  useEffect(() => {
    if (songs.length > 0) return;
    fetch(`${API_URL}/discover/top-songs`)
      .then(r => r.json())
      .then((data: CatalogTrack[]) => {
        discoverSections.topSongs = data;
        setSongs(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Stack.Screen options={{ title: 'Top Songs' }} />
      <SongInfoModal
        song={activeSong}
        onClose={() => setActiveSong(null)}
        onArtistPress={(name) => router.push({ pathname: '/artist-detail', params: { name } })}
        onAlbumPress={(p) => router.push({ pathname: '/album-detail', params: p } as any)}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={s.gridWrap}
        showsVerticalScrollIndicator={false}>
        <View style={s.grid}>
          {loading
            ? Array.from({ length: PLACEHOLDER_COUNT }).map((_, i) => (
                <AlbumGridCardPlaceholder key={i} width={cw} isDark={isDark} />
              ))
            : songs.map(song => (
                <AlbumGridCard
                  key={song.id}
                  album={song}
                  width={cw}
                  isDark={isDark}
                  textColor={colors.text}
                  subColor={isDark ? '#a07850' : '#7a5535'}
                  onPress={() => setActiveSong({ id: song.id, title: song.title, artist: song.artist, artworkUrl: song.artworkUrl, releaseDate: song.releaseDate })}
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
