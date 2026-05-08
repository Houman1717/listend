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
import { supabase } from '@/lib/supabase';

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
  const [playlistLikeCount, setPlaylistLikeCount] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('target_type', 'playlist')
      .eq('target_id', `featured:${id}`)
      .then(({ count }) => { if (count !== null) setPlaylistLikeCount(count); });
  }, [id]);

  const handleHeart = useCallback(() => {
    if (!id) return;
    let artworkUrls: string[] = [];
    try { artworkUrls = JSON.parse(artworkUrlsJson ?? '[]'); } catch {}
    toggleLike({ id, name: name ?? '', emoji: emoji ?? '', description: description ?? '', artworkUrls });
    setPlaylistLikeCount(prev => prev === null ? null : liked ? Math.max(0, prev - 1) : prev + 1);
  }, [id, name, emoji, description, artworkUrlsJson, toggleLike]);

  const loggedInPlaylist = albums.filter(a => loggedIds.has(a.id)).length;
  const listenedPct = albums.length > 0 ? Math.round(loggedInPlaylist / albums.length * 100) : 0;

  return (
    <>
      <Stack.Screen options={{ title: name ?? 'Playlist' }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={s.gridWrap}
        showsVerticalScrollIndicator={false}>

        {/* Page header — description + heart button + listened stats */}
        <View style={s.pageHeader}>
          <TouchableOpacity onPress={handleHeart} hitSlop={12} style={s.heartBtn}>
            <FontAwesome
              name={liked ? 'heart' : 'heart-o'}
              size={24}
              color={liked ? '#D4A017' : '#7a5535'}
            />
            {playlistLikeCount !== null && (
              <Text style={[s.heartCount, { color: liked ? '#D4A017' : '#7a5535' }]}>
                {playlistLikeCount}
              </Text>
            )}
          </TouchableOpacity>

          {!!description && (
            <Text style={[s.description, { color: isDark ? '#a07850' : '#7a5535' }]}>{description}</Text>
          )}

          {!loading && albums.length > 0 && (
            <View style={s.listenedWrap}>
              <View style={s.listenedRow}>
                <FontAwesome name="headphones" size={13} color="#D4A017" />
                <Text style={s.listenedPct}>{listenedPct}%</Text>
              </View>
              <Text style={[s.listenedSub, { color: isDark ? '#a07850' : '#7a5535' }]}>
                {loggedInPlaylist} of {albums.length} albums listened
              </Text>
            </View>
          )}
        </View>

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
  gridWrap:    { padding: PADDING, paddingBottom: 48 },
  grid:        { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  pageHeader:  { position: 'relative', alignItems: 'center', paddingTop: 20, paddingBottom: 4 },
  heartBtn:    { position: 'absolute', top: 20, right: 0, zIndex: 10, padding: 4, alignItems: 'center', gap: 2 },
  heartCount:  { fontSize: 11, fontWeight: '700' },
  description: { fontSize: 14, lineHeight: 20, textAlign: 'center', paddingHorizontal: 40, marginBottom: 12, fontStyle: 'italic' },
  listenedWrap:{ alignItems: 'center', marginBottom: 16, gap: 4 },
  listenedRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  listenedPct: { color: '#D4A017', fontSize: 15, fontWeight: '700' },
  listenedSub: { fontSize: 13 },
});
