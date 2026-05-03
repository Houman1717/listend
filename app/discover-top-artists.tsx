import { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Pressable, ScrollView, useWindowDimensions, ActivityIndicator } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { SpotifyArtist } from '@/context/SpotifyService';
import { discoverSections } from '@/context/discoverSections';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
const GAP = 12;
const COLS = 3;

export default function DiscoverTopArtistsScreen() {
  const { width } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  const cardSize = (width - 32 - GAP * (COLS - 1)) / COLS;

  const [artists, setArtists] = useState<SpotifyArtist[]>(() => discoverSections.topArtists);
  const [loading, setLoading] = useState(discoverSections.topArtists.length === 0);

  useEffect(() => {
    if (artists.length > 0) return;
    fetch(`${API_URL}/discover/top-artists`)
      .then(r => r.json())
      .then((data: SpotifyArtist[]) => {
        discoverSections.topArtists = data;
        setArtists(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Stack.Screen options={{ title: 'Top Artists' }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={s.gridWrap}
        showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color="#D4A017" style={{ marginTop: 48 }} />
        ) : (
          <View style={s.grid}>
            {artists.map(artist => (
              <Pressable
                key={artist.id}
                style={({ pressed }) => [{ width: cardSize, alignItems: 'center', opacity: pressed ? 0.7 : 1 }]}
                onPress={() => router.push({ pathname: '/artist-detail', params: { id: artist.id, name: artist.name, artworkUrl: artist.artworkUrl } } as any)}>
                {artist.artworkUrl ? (
                  <ExpoImage
                    source={{ uri: artist.artworkUrl }}
                    style={{ width: cardSize, height: cardSize, borderRadius: cardSize / 2 }}
                    contentFit="cover"
                    cachePolicy="disk"
                    transition={200}
                  />
                ) : (
                  <View style={[s.fallback, { width: cardSize, height: cardSize, borderRadius: cardSize / 2, backgroundColor: isDark ? '#2e2018' : '#e0e0e0' }]}>
                    <Text style={[s.fallbackText, { fontSize: cardSize * 0.35, color: isDark ? '#a07850' : '#7a5535' }]}>
                      {artist.name[0]?.toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text style={[s.name, { color: colors.text }]} numberOfLines={1}>{artist.name}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  gridWrap:    { padding: 16, paddingBottom: 48 },
  grid:        { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  fallback:    { justifyContent: 'center', alignItems: 'center' },
  fallbackText: { fontWeight: '700' },
  name:        { fontSize: 11, fontWeight: '600', marginTop: 6, textAlign: 'center' },
});
