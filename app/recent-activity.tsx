import {
  StyleSheet,
  View,
  Text,
  Image,
  Pressable,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useAlbums, LoggedAlbum } from '@/context/AlbumsContext';

const DARK_BG = '#0d0d0d';
const CARD_BG  = '#111';
const BORDER   = '#1e1e1e';
const TEXT     = '#f0f0f0';
const SUBTEXT  = '#888';
const ACCENT   = '#FF3CAC';

const BAR_HEIGHTS = [3, 4, 5, 6, 7, 9, 11, 13, 15, 17];

function RatingBadge({ rating }: { rating: number }) {
  return (
    <View style={rb.wrap}>
      <FontAwesome name="volume-up" size={9} color={rating > 0 ? ACCENT : '#555'} />
      <View style={rb.bars}>
        {BAR_HEIGHTS.map((h, i) => (
          <View
            key={i}
            style={[rb.bar, { height: h, backgroundColor: i + 1 <= rating ? ACCENT : '#2e2e2e' }]}
          />
        ))}
      </View>
      {rating > 0 && <Text style={rb.num}>{rating}</Text>}
    </View>
  );
}

const rb = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 1.5 },
  bar:  { width: 2.5, borderRadius: 1 },
  num:  { color: ACCENT, fontSize: 9, fontWeight: '700', lineHeight: 14 },
});

function ActivityItem({ album, onPress }: { album: LoggedAlbum; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [s.row, { opacity: pressed ? 0.7 : 1 }]}
      onPress={onPress}>
      {/* Artwork */}
      {album.artworkUrl ? (
        <Image source={{ uri: album.artworkUrl }} style={s.art} />
      ) : (
        <View style={[s.art, { backgroundColor: album.coverColor, justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={s.artInitial}>{album.title.charAt(0)}</Text>
        </View>
      )}

      {/* Info */}
      <View style={s.info}>
        <Text style={s.title} numberOfLines={1}>{album.title}</Text>
        <Text style={s.artist} numberOfLines={1}>{album.artist}{album.year ? ` · ${album.year}` : ''}</Text>
        <View style={s.metaRow}>
          <FontAwesome name="headphones" size={10} color={SUBTEXT} />
          <Text style={s.date}>Listened {album.dateLogged}</Text>
        </View>
      </View>

      {/* Rating */}
      <RatingBadge rating={album.rating} />
    </Pressable>
  );
}

export default function RecentActivityScreen() {
  const router = useRouter();
  const { loggedAlbums } = useAlbums();

  // Sort newest first — parse "Mar 24, 2026" style dates
  const sorted = useMemo(() => {
    return [...loggedAlbums].sort((a, b) => {
      const da = new Date(a.dateLogged).getTime();
      const db = new Date(b.dateLogged).getTime();
      return (isNaN(db) ? 0 : db) - (isNaN(da) ? 0 : da);
    });
  }, [loggedAlbums]);

  if (sorted.length === 0) {
    return (
      <View style={s.emptyWrap}>
        <View style={s.emptyIconRing}>
          <FontAwesome name="clock-o" size={36} color={ACCENT} />
        </View>
        <Text style={s.emptyTitle}>No activity yet</Text>
        <Text style={s.emptySub}>
          Albums you log will appear{'\n'}here in order.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={sorted}
      keyExtractor={a => a.id}
      style={s.container}
      contentContainerStyle={s.list}
      showsVerticalScrollIndicator={false}
      ItemSeparatorComponent={() => <View style={s.separator} />}
      renderItem={({ item }) => (
        <ActivityItem
          album={item}
          onPress={() => router.push({ pathname: '/album-detail', params: { id: item.id } })}
        />
      )}
    />
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_BG },
  list: { paddingVertical: 8, paddingBottom: 48 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
  },
  art:        { width: 52, height: 52, borderRadius: 8 },
  artInitial: { color: 'rgba(255,255,255,0.5)', fontSize: 18, fontWeight: '700' },
  info:       { flex: 1, gap: 3 },
  title:      { color: TEXT, fontSize: 15, fontWeight: '600' },
  artist:     { color: SUBTEXT, fontSize: 13 },
  metaRow:    { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  date:       { color: SUBTEXT, fontSize: 11 },

  separator: { height: StyleSheet.hairlineWidth, backgroundColor: BORDER, marginLeft: 86 },

  emptyWrap: {
    flex: 1,
    backgroundColor: DARK_BG,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIconRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#1a0d14',
    borderWidth: 1,
    borderColor: '#3a1a2a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: { color: TEXT, fontSize: 18, fontWeight: '700', marginBottom: 10 },
  emptySub:   { color: SUBTEXT, fontSize: 14, lineHeight: 21, textAlign: 'center' },
});
