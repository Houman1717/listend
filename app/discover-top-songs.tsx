import { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Image, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { SpotifyTrack } from '@/context/SpotifyService';
import { SongInfoModal, SongInfo } from '@/components/SongInfoModal';
import { discoverSections } from '@/context/discoverSections';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
const CARD_SIZE = 120;

export default function DiscoverTopSongsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  const [songs, setSongs] = useState<SpotifyTrack[]>(() => discoverSections.topSongs);
  const [loading, setLoading] = useState(discoverSections.topSongs.length === 0);
  const [activeSong, setActiveSong] = useState<SongInfo | null>(null);

  useEffect(() => {
    if (songs.length > 0) return;
    fetch(`${API_URL}/discover/top-songs`)
      .then(r => r.json())
      .then((data: SpotifyTrack[]) => {
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
        onAlbumPress={(id) => router.push({ pathname: '/album-detail', params: { id } })}
      />
      {loading ? (
        <ActivityIndicator color="#FF3CAC" style={{ marginTop: 48 }} />
      ) : (
        <FlatList
          style={{ flex: 1, backgroundColor: colors.background }}
          contentContainerStyle={s.content}
          data={songs}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <Pressable
              style={({ pressed }) => [s.row, { opacity: pressed ? 0.7 : 1 }]}
              onPress={() => setActiveSong({ id: item.id, title: item.title, artist: item.artist, artworkUrl: item.artworkUrl, releaseDate: item.releaseDate })}>
              <Text style={[s.rank, { color: isDark ? '#555' : '#aaa' }]}>{index + 1}</Text>
              {item.artworkUrl ? (
                <Image source={{ uri: item.artworkUrl }} style={s.artwork} />
              ) : (
                <View style={[s.artwork, { backgroundColor: isDark ? '#1e1e2e' : '#e0e0e0' }]} />
              )}
              <View style={s.info}>
                <Text style={[s.title, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
                <Text style={[s.artist, { color: isDark ? '#888' : '#666' }]} numberOfLines={1}>{item.artist}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </>
  );
}

const s = StyleSheet.create({
  content:  { paddingVertical: 8, paddingBottom: 48 },
  row:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 12 },
  rank:     { width: 28, fontSize: 13, fontWeight: '600', textAlign: 'right' },
  artwork:  { width: 52, height: 52, borderRadius: 6 },
  info:     { flex: 1 },
  title:    { fontSize: 14, fontWeight: '600' },
  artist:   { fontSize: 12, marginTop: 2 },
});
