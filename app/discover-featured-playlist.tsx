import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, ScrollView, useWindowDimensions, TouchableOpacity, Text } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { AlbumGridCard, AlbumGridCardPlaceholder, cardWidth, GAP, PADDING } from '@/components/AlbumGridCard';
import { SpotifyAlbum } from '@/context/SpotifyService';
import { useAlbums } from '@/context/AlbumsContext';
import { useLikedFeaturedPlaylists } from '@/context/LikedFeaturedPlaylistsContext';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
const PLACEHOLDER_COUNT = 12;

export default function FeaturedPlaylistScreen() {
  const { width } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const cw = cardWidth(width);

  const { id, name, emoji, description, artworkUrlsJson } = useLocalSearchParams<{
    id: string; name: string; emoji: string; description: string; artworkUrlsJson: string;
  }>();
  const { loggedAlbums } = useAlbums();
  const loggedIds = new Set(loggedAlbums.map(a => a.id));
  const { isLiked, toggleLike } = useLikedFeaturedPlaylists();

  const [albums, setAlbums] = useState<SpotifyAlbum[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`${API_URL}/api/featured-playlists/${id}`)
      .then(r => r.json())
      .then((data: SpotifyAlbum[]) => { setAlbums(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  const liked = isLiked(id ?? '');

  const handleHeart = useCallback(() => {
    if (!id) return;
    let artworkUrls: string[] = [];
    try { artworkUrls = JSON.parse(artworkUrlsJson ?? '[]'); } catch {}
    toggleLike({ id, name: name ?? '', emoji: emoji ?? '', description: description ?? '', artworkUrls });
  }, [id, name, emoji, description, artworkUrlsJson, toggleLike]);

  const loggedInPlaylist = albums.filter(a => loggedIds.has(a.id)).length;
  const listenedPct = albums.length > 0 ? Math.round(loggedInPlaylist / albums.length * 100) : 0;

  return (
    <>
      <Stack.Screen
        options={{
          title: name ?? 'Playlist',
          headerRight: () => (
            <TouchableOpacity onPress={handleHeart} hitSlop={12} style={{ marginRight: 4 }}>
              <FontAwesome
                name={liked ? 'heart' : 'heart-o'}
                size={22}
                color={liked ? '#D4A017' : '#f5e6c8'}
              />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={s.gridWrap}
        showsVerticalScrollIndicator={false}>

        {/* Listened progress banner */}
        {!loading && albums.length > 0 && (
          <View style={[s.banner, { backgroundColor: isDark ? '#1a110a' : '#f0e6d3' }]}>
            <View style={s.bannerRow}>
              <FontAwesome name="headphones" size={14} color="#D4A017" />
              <Text style={s.bannerPct}>{listenedPct}%</Text>
              <Text style={[s.bannerSub, { color: isDark ? '#a07850' : '#7a5535' }]}>
                {loggedInPlaylist} of {albums.length} albums listened
              </Text>
            </View>
            <View style={[s.track, { backgroundColor: isDark ? '#2e2018' : '#d4c4a8' }]}>
              <View style={[s.fill, { width: `${Math.max(listenedPct, listenedPct > 0 ? 2 : 0)}%` as any }]} />
            </View>
          </View>
        )}

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
  gridWrap:  { padding: PADDING, paddingBottom: 48 },
  grid:      { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  banner:    { borderRadius: 10, padding: 12, marginBottom: 16 },
  bannerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  bannerPct: { color: '#D4A017', fontWeight: '700', fontSize: 15 },
  bannerSub: { fontSize: 13 },
  track:     { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill:      { height: 4, borderRadius: 2, backgroundColor: '#D4A017' },
});
