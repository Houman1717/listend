import {
  StyleSheet,
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useAlbums, WantToListenAlbum } from '@/context/AlbumsContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

const PADDING = 16;
const GAP     = 12;
const COLS    = 3;

function AlbumCard({
  album,
  cardWidth,
  onPress,
  onLongPress,
  textColor,
  subColor,
}: {
  album: WantToListenAlbum;
  cardWidth: number;
  onPress: () => void;
  onLongPress: () => void;
  textColor: string;
  subColor: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [s.albumCard, { width: cardWidth, opacity: pressed ? 0.7 : 1 }]}>
      {album.artworkUrl ? (
        <Image
          source={{ uri: album.artworkUrl }}
          style={{ width: cardWidth, height: cardWidth, borderRadius: 8 }}
          resizeMode="cover"
        />
      ) : (
        <View style={[s.fallback, { width: cardWidth, height: cardWidth }]}>
          <FontAwesome name="music" size={cardWidth * 0.28} color="#555" />
        </View>
      )}
      <Text style={[s.albumTitle, { color: textColor }]} numberOfLines={1}>{album.title}</Text>
      <Text style={[s.albumArtist, { color: subColor }]} numberOfLines={1}>{album.artist}</Text>
    </Pressable>
  );
}

export default function WantToListenScreen() {
  const { width } = useWindowDimensions();
  const cardWidth = (width - PADDING * 2 - GAP * (COLS - 1)) / COLS;
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { wantToListen, removeFromWantToListen } = useAlbums();
  const { user } = useAuth();
  const { userId: paramUserId } = useLocalSearchParams<{ userId?: string }>();

  const viewingOther = paramUserId || null;
  const [otherList, setOtherList] = useState<WantToListenAlbum[]>([]);

  useEffect(() => {
    if (!viewingOther) return;
    supabase
      .from('want_to_listen')
      .select('id, title, artist, year, artwork_url, created_at')
      .eq('user_id', viewingOther)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        setOtherList(data.map(w => ({
          id:         w.id,
          title:      w.title      ?? '',
          artist:     w.artist     ?? '',
          year:       w.year       ?? 0,
          artworkUrl: w.artwork_url ?? '',
          dateAdded:  w.created_at ?? undefined,
        })));
      });
  }, [viewingOther]);

  const displayList = viewingOther ? otherList : wantToListen;

  function handleTap(album: WantToListenAlbum) {
    router.push({
      pathname: '/album-detail',
      params: {
        id:         album.id,
        title:      album.title,
        artist:     album.artist,
        year:       String(album.year),
        artworkUrl: album.artworkUrl,
      },
    });
  }

  function handleLongPress(album: WantToListenAlbum) {
    Alert.alert('Remove', `Remove "${album.title}" from Want to Listen?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeFromWantToListen(album.id) },
    ]);
  }

  return (
    <ScrollView
      style={[s.container, { backgroundColor: colors.background }]}
      contentContainerStyle={s.gridWrap}
      showsVerticalScrollIndicator={false}>
      {displayList.length === 0 ? (
        <View style={s.empty}>
          <Text style={[s.emptyTitle, { color: colors.text }]}>Nothing here yet</Text>
          <Text style={[s.emptySubtext, { color: colors.subtext }]}>
            {viewingOther
              ? 'This user has nothing saved yet.'
              : 'Tap the bookmark icon on any album in Search to save it here.'}
          </Text>
        </View>
      ) : (
        <View style={s.grid}>
          {displayList.map((album) => (
            <AlbumCard
              key={album.id}
              album={album}
              cardWidth={cardWidth}
              onPress={() => handleTap(album)}
              onLongPress={() => !viewingOther && handleLongPress(album)}
              textColor={colors.text}
              subColor={colors.subtext}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  gridWrap:  { padding: PADDING, paddingBottom: 48 },
  grid:      { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },

  albumCard:   { gap: 4 },
  albumTitle:  { fontSize: 12, fontWeight: '600', marginTop: 2 },
  albumArtist: { fontSize: 11 },

  fallback:     { borderRadius: 8, backgroundColor: '#2a2a2a', justifyContent: 'center', alignItems: 'center' },
  fallbackText: { color: 'rgba(255,255,255,0.5)', fontWeight: '700' },

  empty:        { alignItems: 'center', marginTop: 80, paddingHorizontal: 32 },
  emptyTitle:   { fontSize: 17, fontWeight: '600', marginBottom: 8 },
  emptySubtext: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
