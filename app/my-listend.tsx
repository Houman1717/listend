import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useMemo, useEffect } from 'react';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAlbums, LoggedAlbum } from '@/context/AlbumsContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { SortBar, SortSheet, applySort, SortKey } from '@/components/SortSheet';

const PADDING = 16;
const GAP     = 12;
const COLS    = 3;

const COVER_COLORS = ['#2d5a27','#7a4a2e','#1a3018','#d4a017','#7a3a1a','#8b1a1a','#1a5a5a','#4a2818'];

// ─── Card ─────────────────────────────────────────────────────────────────────

function AlbumCard({
  album,
  cardWidth,
  colors,
  onPress,
  onLongPress,
}: {
  album: LoggedAlbum;
  cardWidth: number;
  colors: any;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [s.card, { width: cardWidth, opacity: pressed ? 0.7 : 1 }]}>
      {album.artworkUrl ? (
        <ExpoImage
          source={{ uri: album.artworkUrl }}
          style={{ width: cardWidth, height: cardWidth, borderRadius: 8 }}
          contentFit="cover"
          cachePolicy="disk"
          transition={200}
        />
      ) : (
        <View style={[s.fallback, { width: cardWidth, height: cardWidth, backgroundColor: album.coverColor }]}>
          <Text style={[s.fallbackText, { fontSize: cardWidth * 0.32 }]}>{album.title.charAt(0)}</Text>
        </View>
      )}
      <Text style={[s.cardTitle,  { color: colors.text    }]} numberOfLines={1}>{album.title}</Text>
      <Text style={[s.cardArtist, { color: colors.subtext }]} numberOfLines={1}>{album.artist}</Text>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MyListendScreen() {
  const { width } = useWindowDimensions();
  const cardWidth = (width - PADDING * 2 - GAP * (COLS - 1)) / COLS;
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { loggedAlbums, removeLoggedAlbum } = useAlbums();
  const { user } = useAuth();
  const { userId: paramUserId } = useLocalSearchParams<{ userId?: string }>();

  const viewingOther = paramUserId || null;
  const [otherAlbums, setOtherAlbums] = useState<LoggedAlbum[]>([]);
  const [sortKey, setSortKey]       = useState<SortKey>('date_new');
  const [shuffled, setShuffled]     = useState<LoggedAlbum[] | null>(null);
  const [sheetOpen, setSheetOpen]   = useState(false);

  useEffect(() => {
    if (!viewingOther) return;
    supabase
      .from('user_albums')
      .select('spotify_id, title, artist, artwork_url, year, rating, review, listened_at, duration_ms')
      .eq('user_id', viewingOther)
      .not('listened_at', 'is', null)
      .order('listened_at', { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        setOtherAlbums(data.map((a, i) => ({
          id:         a.spotify_id,
          title:      a.title      ?? '',
          artist:     a.artist     ?? '',
          year:       a.year       ?? 0,
          rating:     a.rating     ?? 0,
          review:     a.review     ?? undefined,
          dateLogged: a.listened_at ?? new Date().toISOString(),
          artworkUrl: a.artwork_url ?? undefined,
          coverColor: COVER_COLORS[i % COVER_COLORS.length],
          durationMs: a.duration_ms ?? undefined,
        })));
      });
  }, [viewingOther]);

  const sourceAlbums = viewingOther ? otherAlbums : loggedAlbums;

  const displayAlbums = useMemo(() => {
    if (shuffled) return shuffled;
    return applySort(sourceAlbums, sortKey);
  }, [sourceAlbums, sortKey, shuffled]);

  function handleSelectSort(key: SortKey) {
    if (key === 'shuffle') {
      setShuffled([...sourceAlbums].sort(() => Math.random() - 0.5));
    } else {
      setShuffled(null);
    }
    setSortKey(key);
  }

  function confirmRemove(album: LoggedAlbum) {
    Alert.alert(
      'Remove Album',
      `Remove "${album.title}" from your Listend?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeLoggedAlbum(album.id) },
      ]
    );
  }

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <SortBar
        sortKey={sortKey}
        count={sourceAlbums.length}
        noun="albums"
        isDark={isDark}
        onPress={() => setSheetOpen(true)}
      />
      <ScrollView contentContainerStyle={s.gridWrap} showsVerticalScrollIndicator={false}>
        {displayAlbums.length === 0 ? (
          <Text style={[s.emptyText, { color: colors.subtext }]}>
            No albums logged yet — head to Search!
          </Text>
        ) : (
          <View style={s.grid}>
            {displayAlbums.map((album, index) => (
              <AlbumCard
                key={`${album.id}-${index}`}
                album={album}
                cardWidth={cardWidth}
                colors={colors}
                onPress={() => router.push({ pathname: '/album-detail', params: { id: album.id } })}
                onLongPress={!viewingOther ? () => confirmRemove(album) : undefined}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <SortSheet
        visible={sheetOpen}
        activeKey={sortKey}
        onSelect={handleSelectSort}
        onClose={() => setSheetOpen(false)}
        isDark={isDark}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:    { flex: 1 },
  gridWrap:{ padding: PADDING, paddingBottom: 48 },
  grid:    { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  card:    { gap: 0 },
  fallback:     { borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  fallbackText: { color: 'rgba(255,255,255,0.5)', fontWeight: '700' },
  cardTitle:    { marginTop: 5, fontSize: 11, fontWeight: '600', lineHeight: 14 },
  cardArtist:   { fontSize: 10, lineHeight: 13, marginTop: 1 },
  emptyText:    { textAlign: 'center', marginTop: 80, fontSize: 15 },
});
