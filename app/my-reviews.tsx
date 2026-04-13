import {
  StyleSheet,
  View,
  Text,
  Image,
  Pressable,
  FlatList,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useState, useEffect } from 'react';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAlbums, LoggedAlbum } from '@/context/AlbumsContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

// ─── Volume badge (with number) ───────────────────────────────────────────────

const BAR_HEIGHTS = [3, 4, 5, 6, 7, 9, 11, 13, 15, 17];

function VolumeBadge({ rating }: { rating: number }) {
  return (
    <View style={s.badge}>
      <FontAwesome name="volume-up" size={10} color={rating > 0 ? '#FF3CAC' : '#3a3a3a'} />
      <View style={s.badgeBars}>
        {BAR_HEIGHTS.map((h, i) => (
          <View
            key={i}
            style={[s.badgeBar, { height: h, backgroundColor: i + 1 <= rating ? '#FF3CAC' : '#2a2a2a' }]}
          />
        ))}
      </View>
      {rating > 0 && <Text style={s.badgeNum}>{rating}</Text>}
    </View>
  );
}

// ─── Review row ───────────────────────────────────────────────────────────────

function ReviewRow({
  album,
  colors,
  isDark,
  onPress,
}: {
  album: LoggedAlbum;
  colors: typeof Colors.light;
  isDark: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.row, { opacity: pressed ? 0.7 : 1 }]}>
      {/* Thumbnail */}
      {album.artworkUrl ? (
        <Image source={{ uri: album.artworkUrl }} style={s.thumb} resizeMode="cover" />
      ) : (
        <View style={[s.thumb, s.thumbFallback, { backgroundColor: album.coverColor }]}>
          <Text style={s.thumbInitial}>{album.title.charAt(0)}</Text>
        </View>
      )}

      {/* Text block */}
      <View style={s.info}>
        <Text style={[s.title, { color: colors.text }]} numberOfLines={1}>
          {album.title}
        </Text>
        <Text style={[s.artist, { color: colors.subtext }]} numberOfLines={1}>
          {album.artist} · {album.year}
        </Text>
        <VolumeBadge rating={album.rating} />
        <Text style={[s.review, { color: isDark ? '#aaa' : '#555' }]}>
          {album.review}
        </Text>
      </View>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

const COVER_COLORS = ['#2d5a27','#7a4a2e','#1e3a5f','#d4a017','#5c2d82','#8b1a1a','#1a5a5a','#4a2d7a'];

export default function MyReviewsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { loggedAlbums } = useAlbums();
  const { user } = useAuth();
  const { userId: paramUserId } = useLocalSearchParams<{ userId?: string }>();

  const viewingOther = paramUserId && paramUserId !== user?.id ? paramUserId : null;
  const [otherReviews, setOtherReviews] = useState<LoggedAlbum[]>([]);

  useEffect(() => {
    if (!viewingOther) return;
    supabase
      .from('user_albums')
      .select('spotify_id, title, artist, artwork_url, year, rating, review, listened_at')
      .eq('user_id', viewingOther)
      .not('review', 'is', null)
      .order('listened_at', { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        setOtherReviews(data.map((a, i) => ({
          id:         a.spotify_id,
          title:      a.title      ?? '',
          artist:     a.artist     ?? '',
          year:       a.year       ?? 0,
          rating:     a.rating     ?? 0,
          review:     a.review     ?? undefined,
          dateLogged: a.listened_at ?? new Date().toISOString(),
          artworkUrl: a.artwork_url ?? undefined,
          coverColor: COVER_COLORS[i % COVER_COLORS.length],
        })));
      });
  }, [viewingOther]);

  const reviewed = viewingOther
    ? otherReviews
    : loggedAlbums.filter((a) => !!a.review);

  return (
    <FlatList
      data={reviewed}
      keyExtractor={(item) => item.id}
      style={[s.container, { backgroundColor: colors.background }]}
      contentContainerStyle={s.listContent}
      showsVerticalScrollIndicator={false}
      ItemSeparatorComponent={() => (
        <View style={[s.separator, { backgroundColor: isDark ? '#1e1e1e' : '#ebebeb' }]} />
      )}
      ListEmptyComponent={() => (
        <View style={s.empty}>
          <Text style={[s.emptyTitle, { color: colors.text }]}>No reviews yet</Text>
          <Text style={[s.emptySubtext, { color: colors.subtext }]}>
            Log an album and write your thoughts on it.
          </Text>
        </View>
      )}
      renderItem={({ item }) => (
        <ReviewRow
          album={item}
          colors={colors}
          isDark={isDark}
          onPress={() => router.push({ pathname: '/album-detail', params: { id: item.id } })}
        />
      )}
    />
  );
}

const s = StyleSheet.create({
  container:   { flex: 1 },
  listContent: { paddingVertical: 8, paddingBottom: 48 },

  // Row
  row:  { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 16, gap: 14 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 94 },

  // Thumbnail
  thumb:        { width: 64, height: 64, borderRadius: 6, flexShrink: 0 },
  thumbFallback:{ justifyContent: 'center', alignItems: 'center' },
  thumbInitial: { color: 'rgba(255,255,255,0.5)', fontSize: 22, fontWeight: '700' },

  // Text
  info:   { flex: 1, gap: 4 },
  title:  { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  artist: { fontSize: 13 },
  review: { fontSize: 13, lineHeight: 20, fontStyle: 'italic', marginTop: 2 },

  // Volume badge
  badge:    { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  badgeBars:{ flexDirection: 'row', alignItems: 'flex-end', gap: 1.5 },
  badgeBar: { width: 2.5, borderRadius: 1 },
  badgeNum: { color: '#FF3CAC', fontSize: 10, fontWeight: '700', lineHeight: 15 },

  // Empty state
  empty:       { alignItems: 'center', marginTop: 80, paddingHorizontal: 32 },
  emptyTitle:  { fontSize: 17, fontWeight: '600', marginBottom: 8 },
  emptySubtext:{ fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
