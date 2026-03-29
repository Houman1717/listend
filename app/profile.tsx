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
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAlbums, TopAlbum, TopSong } from '@/context/AlbumsContext';

const GRADIENT: [string, string, string] = ['#FF3CAC', '#784BA0', '#2B86C5'];
const DARK_BG = '#0d0d0d';
const CARD_BG = '#1a1a1a';
const BORDER = '#2a2a2a';
const TEXT = '#f0f0f0';
const SUBTEXT = '#888';

// ─── Favourite slot ───────────────────────────────────────────────────────────

function FavSlot({
  item,
  size,
  onAdd,
  onRemove,
}: {
  item?: { artworkUrl?: string; title: string };
  size: number;
  onAdd: () => void;
  onRemove: () => void;
}) {
  if (item) {
    return (
      <Pressable onPress={onRemove} style={[s.favFilled, { width: size, height: size }]}>
        {item.artworkUrl ? (
          <Image source={{ uri: item.artworkUrl }} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: CARD_BG, justifyContent: 'center', alignItems: 'center' }]}>
            <Text style={{ color: SUBTEXT, fontSize: 18, fontWeight: '700' }}>{item.title.charAt(0)}</Text>
          </View>
        )}
      </Pressable>
    );
  }
  return (
    <Pressable onPress={onAdd} style={[s.favEmpty, { width: size, height: size, borderColor: BORDER }]}>
      <Text style={s.favPlus}>+</Text>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const router = useRouter();
  const { loggedAlbums, topAlbums, topSongs, removeTopAlbum, removeTopSong } = useAlbums();
  const { width } = useWindowDimensions();

  // 5 items, padding 20 each side, 6px gaps between 5 items
  const slotSize = Math.floor((width - 40 - 24) / 5);

  const avgRating = loggedAlbums.length
    ? (loggedAlbums.reduce((sum, a) => sum + a.rating, 0) / loggedAlbums.length).toFixed(1)
    : '—';

  const thisYear = loggedAlbums.filter((a) =>
    a.dateLogged.includes(new Date().getFullYear().toString())
  ).length;

  function confirmRemoveAlbum(id: string, title: string) {
    Alert.alert('Remove', `Remove "${title}" from Favourites?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeTopAlbum(id) },
    ]);
  }

  function confirmRemoveSong(id: string, title: string) {
    Alert.alert('Remove', `Remove "${title}" from Favourites?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeTopSong(id) },
    ]);
  }

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}>

      {/* Header gradient banner */}
      <LinearGradient
        colors={['#FF3CAC18', '#784BA012', '#2B86C508']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.banner}
      />

      {/* Avatar + name */}
      <View style={s.profileRow}>
        <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.avatar}>
          <Text style={s.avatarInitial}>H</Text>
        </LinearGradient>
        <View style={s.nameBlock}>
          <Text style={s.displayName}>Houman</Text>
          <Text style={s.handle}>@houman</Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={s.statsRow}>
        {[
          { value: String(loggedAlbums.length), label: 'Albums' },
          { value: String(thisYear), label: 'This Year' },
          { value: avgRating, label: 'Avg Rating' },
        ].map((stat, i) => (
          <View key={i} style={s.statItem}>
            <Text style={s.statValue}>{stat.value}</Text>
            <Text style={s.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      <View style={[s.rule, { backgroundColor: BORDER }]} />

      {/* Favourite Albums */}
      <View style={s.favSection}>
        <View style={s.favHeader}>
          <Text style={s.favTitle}>FAVOURITE ALBUMS</Text>
          <Pressable onPress={() => router.push({ pathname: '/pick-item', params: { type: 'album' } })}>
            <Text style={s.editLabel}>Edit</Text>
          </Pressable>
        </View>
        <View style={s.favRow}>
          {Array.from({ length: 5 }).map((_, i) => {
            const a: TopAlbum | undefined = topAlbums[i];
            return (
              <FavSlot
                key={i}
                item={a}
                size={slotSize}
                onAdd={() => router.push({ pathname: '/pick-item', params: { type: 'album' } })}
                onRemove={() => a && confirmRemoveAlbum(a.id, a.title)}
              />
            );
          })}
        </View>
      </View>

      <View style={[s.rule, { backgroundColor: BORDER }]} />

      {/* Favourite Songs */}
      <View style={s.favSection}>
        <View style={s.favHeader}>
          <Text style={s.favTitle}>FAVOURITE SONGS</Text>
          <Pressable onPress={() => router.push({ pathname: '/pick-item', params: { type: 'song' } })}>
            <Text style={s.editLabel}>Edit</Text>
          </Pressable>
        </View>
        <View style={s.favRow}>
          {Array.from({ length: 5 }).map((_, i) => {
            const song: TopSong | undefined = topSongs[i];
            return (
              <FavSlot
                key={i}
                item={song}
                size={slotSize}
                onAdd={() => router.push({ pathname: '/pick-item', params: { type: 'song' } })}
                onRemove={() => song && confirmRemoveSong(song.id, song.title)}
              />
            );
          })}
        </View>
      </View>

      <View style={[s.rule, { backgroundColor: BORDER }]} />

      {/* Recent activity preview */}
      <View style={s.recentSection}>
        <Text style={s.favTitle}>RECENT ACTIVITY</Text>
        {loggedAlbums.slice(0, 3).map((album) => (
          <Pressable
            key={album.id}
            style={s.recentRow}
            onPress={() => router.push({ pathname: '/album-detail', params: { id: album.id } })}>
            {album.artworkUrl ? (
              <Image source={{ uri: album.artworkUrl }} style={s.recentArt} />
            ) : (
              <View style={[s.recentArt, { backgroundColor: album.coverColor, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '700' }}>
                  {album.title.charAt(0)}
                </Text>
              </View>
            )}
            <View style={s.recentInfo}>
              <Text style={s.recentTitle} numberOfLines={1}>{album.title}</Text>
              <Text style={s.recentArtist} numberOfLines={1}>{album.artist}</Text>
            </View>
            <View style={s.recentStars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Text key={n} style={[s.miniStar, { color: n <= album.rating ? '#FF3CAC' : '#333' }]}>★</Text>
              ))}
            </View>
          </Pressable>
        ))}
      </View>

    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_BG },
  content: { paddingBottom: 48 },

  banner: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 200,
  },

  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 32,
    gap: 16,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '700',
  },
  nameBlock: { gap: 2 },
  displayName: { color: TEXT, fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  handle: { color: SUBTEXT, fontSize: 14 },

  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 24,
    gap: 0,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: 12,
    borderColor: BORDER,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  statValue: { color: TEXT, fontSize: 22, fontWeight: '700' },
  statLabel: { color: SUBTEXT, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },

  rule: { height: StyleSheet.hairlineWidth, marginHorizontal: 20, marginVertical: 4 },

  favSection: { paddingHorizontal: 20, paddingVertical: 16 },
  favHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  favTitle: { color: SUBTEXT, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },
  editLabel: { color: '#FF3CAC', fontSize: 12 },
  favRow: { flexDirection: 'row', gap: 6 },
  favFilled: { borderRadius: 6, overflow: 'hidden', backgroundColor: CARD_BG },
  favEmpty: {
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  favPlus: { color: SUBTEXT, fontSize: 20 },

  recentSection: { paddingHorizontal: 20, paddingTop: 16 },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  recentArt: { width: 40, height: 40, borderRadius: 4 },
  recentInfo: { flex: 1 },
  recentTitle: { color: TEXT, fontSize: 14, fontWeight: '600' },
  recentArtist: { color: SUBTEXT, fontSize: 12, marginTop: 2 },
  recentStars: { flexDirection: 'row', gap: 1 },
  miniStar: { fontSize: 11 },
});
