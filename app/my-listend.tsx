import {
  StyleSheet,
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useState, useMemo, useEffect } from 'react';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAlbums, LoggedAlbum } from '@/context/AlbumsContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

const PADDING = 16;
const GAP     = 12;
const COLS    = 3;

const BAR_HEIGHTS = [3, 4, 5, 6, 7, 9, 11, 13, 15, 17];

type FilterKey = 'recent' | 'top_rated' | 'a_z' | 'by_genre' | 'by_decade';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'recent',    label: 'Recently Listened' },
  { key: 'top_rated', label: 'Top Rated'         },
  { key: 'a_z',       label: 'A–Z'               },
  { key: 'by_genre',  label: 'By Genre'           },
  { key: 'by_decade', label: 'By Decade'          },
];

function VolumeBadge({ rating }: { rating: number }) {
  return (
    <View style={s.badge}>
      <FontAwesome name="volume-up" size={9} color={rating > 0 ? '#e8963a' : '#7a5535'} />
      <View style={s.badgeBars}>
        {BAR_HEIGHTS.map((h, i) => (
          <View
            key={i}
            style={[s.badgeBar, { height: h, backgroundColor: i + 1 <= rating ? '#e8963a' : '#2a1e14' }]}
          />
        ))}
      </View>
      {rating > 0 && <Text style={s.badgeNum}>{rating}</Text>}
    </View>
  );
}

function AlbumCard({ album, cardWidth, onPress }: { album: LoggedAlbum; cardWidth: number; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.card, { width: cardWidth, opacity: pressed ? 0.7 : 1 }]}>
      {album.artworkUrl ? (
        <Image
          source={{ uri: album.artworkUrl }}
          style={{ width: cardWidth, height: cardWidth, borderRadius: 8 }}
          resizeMode="cover"
        />
      ) : (
        <View style={[s.fallback, { width: cardWidth, height: cardWidth, backgroundColor: album.coverColor }]}>
          <Text style={[s.fallbackText, { fontSize: cardWidth * 0.32 }]}>{album.title.charAt(0)}</Text>
        </View>
      )}
      <View style={s.ratingWrap}>
        <VolumeBadge rating={album.rating} />
      </View>
    </Pressable>
  );
}

function FilterPills({
  active,
  onSelect,
  isDark,
}: {
  active: FilterKey;
  onSelect: (k: FilterKey) => void;
  isDark: boolean;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.pillsRow}
      style={s.pillsScroll}>
      {FILTERS.map((f) => {
        const isActive = f.key === active;
        return (
          <Pressable
            key={f.key}
            onPress={() => onSelect(f.key)}
            style={[
              s.pill,
              isActive
                ? s.pillActive
                : { backgroundColor: isDark ? '#2e2018' : '#efefef', borderColor: isDark ? '#3a2818' : '#ddd' },
            ]}>
            <Text style={[s.pillText, { color: isActive ? '#fff' : isDark ? '#a07850' : '#7a5535' }]}>
              {f.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const COVER_COLORS = ['#2d5a27','#7a4a2e','#1a3018','#d4a017','#7a3a1a','#8b1a1a','#1a5a5a','#4a2818'];

export default function MyListendScreen() {
  const { width } = useWindowDimensions();
  const cardWidth = (width - PADDING * 2 - GAP * (COLS - 1)) / COLS;
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { loggedAlbums } = useAlbums();
  const { user } = useAuth();
  const { userId: paramUserId } = useLocalSearchParams<{ userId?: string }>();

  const viewingOther = paramUserId || null;
  const [otherAlbums, setOtherAlbums] = useState<LoggedAlbum[]>([]);

  useEffect(() => {
    if (!viewingOther) return;
    supabase
      .from('user_albums')
      .select('spotify_id, title, artist, artwork_url, year, rating, review, listened_at')
      .eq('user_id', viewingOther)
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
        })));
      });
  }, [viewingOther]);

  const sourceAlbums = viewingOther ? otherAlbums : loggedAlbums;

  const [activeFilter, setActiveFilter] = useState<FilterKey>('recent');

  const filteredAlbums = useMemo(() => {
    const arr = [...sourceAlbums];
    switch (activeFilter) {
      case 'top_rated': return arr.sort((a, b) => b.rating - a.rating);
      case 'a_z':       return arr.sort((a, b) => a.title.localeCompare(b.title));
      case 'by_decade': return arr.sort((a, b) => a.year - b.year);
      case 'by_genre':  return arr.sort((a, b) => a.artist.localeCompare(b.artist));
      default:          return arr;
    }
  }, [sourceAlbums, activeFilter]);

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <FilterPills active={activeFilter} onSelect={setActiveFilter} isDark={isDark} />
      <ScrollView contentContainerStyle={s.gridWrap} showsVerticalScrollIndicator={false}>
        {filteredAlbums.length === 0 ? (
          <Text style={[s.emptyText, { color: colors.subtext }]}>
            No albums logged yet — head to Search!
          </Text>
        ) : (
          <View style={s.grid}>
            {filteredAlbums.map((album, index) => (
              <AlbumCard
                key={`${album.id}-${index}`}
                album={album}
                cardWidth={cardWidth}
                onPress={() => router.push({ pathname: '/album-detail', params: { id: album.id } })}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },

  // ── Filter pills ─────────────────────────────────────────────────────────────
  pillsScroll: { flexGrow: 0 },
  pillsRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  pillActive: { backgroundColor: '#e8963a', borderColor: '#e8963a' },
  pillText: { fontSize: 13, fontWeight: '500' },

  // ── Grid ─────────────────────────────────────────────────────────────────────
  gridWrap: { padding: PADDING, paddingBottom: 48 },
  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  card: { gap: 0 },
  fallback: { borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  fallbackText: { color: 'rgba(255,255,255,0.5)', fontWeight: '700' },
  ratingWrap: { marginTop: 6, alignItems: 'center' },
  badge:     { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  badgeBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 1.5 },
  badgeBar:  { width: 2.5, borderRadius: 1 },
  badgeNum:  { color: '#e8963a', fontSize: 9, fontWeight: '700', lineHeight: 14 },
  emptyText: { textAlign: 'center', marginTop: 80, fontSize: 15 },
});
