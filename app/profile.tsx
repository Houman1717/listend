import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  Dimensions,
  Modal,
  SafeAreaView,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import { useAlbums, TopAlbum, TopSong, TopArtist } from '@/context/AlbumsContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useState, useEffect } from 'react';

const GRADIENT: [string, string, string] = ['#D4A017', '#B8880F', '#D4A017'];
const DARK_BG = '#1c1410';
const CARD_BG = '#2e2018';
const BORDER = '#2a1e14';
const TEXT = '#f5e6c8';
const SUBTEXT = '#a07850';

const BADGE_HEIGHTS = [3, 4, 5, 6, 7, 8, 10, 11, 13, 14];

function VolumeBadge({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 5 }}>
      <FontAwesome name="volume-up" size={10} color={rating > 0 ? '#D4A017' : '#4a3020'} />
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
        {BADGE_HEIGHTS.map((h, i) => (
          <View
            key={i}
            style={{ width: 3, height: h, borderRadius: 1, backgroundColor: i + 1 <= rating ? '#D4A017' : '#3a2818' }}
          />
        ))}
      </View>
    </View>
  );
}

const FAV_GAP = 3;
const FAV_SLOTS = 5;
const FAV_SLOT_SIZE = Math.floor(
  (Dimensions.get('window').width - 40 - FAV_GAP * (FAV_SLOTS - 1)) / FAV_SLOTS
);

const GRID_COLS = 4;
const GRID_GAP = 2;
const GRID_ITEM_SIZE = Math.floor(
  (Dimensions.get('window').width - 40 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS
);

// ─── Favourite slot ───────────────────────────────────────────────────────────

function FavSlot({
  item,
  onAdd,
  onRemove,
  circular = false,
}: {
  item?: { artworkUrl?: string; title: string };
  onAdd: () => void;
  onRemove: () => void;
  circular?: boolean;
}) {
  const size = FAV_SLOT_SIZE;
  const radius = circular ? size / 2 : 3;

  if (item) {
    return (
      <Pressable onPress={onRemove} style={[s.favSlot, { borderRadius: radius }]}>
        {item.artworkUrl ? (
          <ExpoImage
            source={{ uri: item.artworkUrl }}
            style={{ width: size, height: size, borderRadius: radius }}
            contentFit="cover" cachePolicy="disk"
          />
        ) : (
          <View style={[s.favInitialBg, { borderRadius: radius }]}>
            <Text style={s.favInitial}>{item.title.charAt(0)}</Text>
          </View>
        )}
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onAdd} style={[s.favSlot, s.favEmpty, { borderRadius: radius }]}>
      <Text style={s.favPlus}>+</Text>
    </Pressable>
  );
}

// ─── Rating distribution modal ────────────────────────────────────────────────

function RatingModal({
  visible,
  onClose,
  avgRating,
  distribution,
}: {
  visible: boolean;
  onClose: () => void;
  avgRating: string;
  distribution: { rating: number; count: number }[];
}) {
  const maxCount = Math.max(...distribution.map(d => d.count), 1);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <Pressable style={rm.backdrop} onPress={onClose} />
      <SafeAreaView style={rm.sheet}>
        {/* Handle */}
        <View style={rm.handle} />

        {/* Header */}
        <View style={rm.header}>
          <Text style={rm.headerTitle}>Rating Breakdown</Text>
          <Pressable onPress={onClose} hitSlop={12} style={rm.closeBtn}>
            <FontAwesome name="times" size={16} color={SUBTEXT} />
          </Pressable>
        </View>

        {/* Average */}
        <View style={rm.avgBlock}>
          <Text style={rm.avgValue}>{avgRating}</Text>
          <Text style={rm.avgLabel}>average rating</Text>
        </View>

        {/* Distribution bars — ratings 10 down to 1 */}
        <View style={rm.distBlock}>
          {[...distribution].reverse().map(({ rating, count }) => {
            const pct = maxCount > 0 ? count / maxCount : 0;
            return (
              <View key={rating} style={rm.distRow}>
                <Text style={rm.distRating}>{rating}</Text>
                <View style={rm.barTrack}>
                  <View
                    style={[
                      rm.barFill,
                      {
                        width: `${Math.max(pct * 100, count > 0 ? 2 : 0)}%`,
                        opacity: 0.4 + pct * 0.6,
                      },
                    ]}
                  />
                </View>
                <Text style={rm.distCount}>{count}</Text>
              </View>
            );
          })}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { loggedAlbums, topAlbums, topSongs, topArtists, removeTopAlbum, removeTopSong, removeTopArtist, wantToListen } = useAlbums();
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Stats derived directly from loggedAlbums (synced from user_albums on load)
  const albumCount = loggedAlbums.length;
  const thisYear = loggedAlbums.filter(a => {
    const d = new Date(a.dateLogged);
    return !isNaN(d.getTime()) && d.getFullYear() === new Date().getFullYear();
  }).length;
  const avgRating  = albumCount
    ? (loggedAlbums.reduce((s, a) => s + a.rating, 0) / albumCount).toFixed(1)
    : '—';

  // Fetch profile row (display_name, username, avatar_url)
  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('username, display_name, avatar_url')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setDisplayName(data.display_name || data.username || '');
          setUsername(data.username || '');
          setAvatarUrl(data.avatar_url ?? null);
        }
      });
  }, [user]);

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          // AuthGate in _layout.tsx redirects to /login
        },
      },
    ]);
  }

  const ratingDistribution = Array.from({ length: 10 }, (_, i) => ({
    rating: i + 1,
    count: loggedAlbums.filter(a => a.rating === i + 1).length,
  }));

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

  function confirmRemoveArtist(id: string, name: string) {
    Alert.alert('Remove', `Remove "${name}" from Favourites?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeTopArtist(id) },
    ]);
  }

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}>

      {/* Header gradient banner — pointerEvents="none" so it never intercepts taps */}
      <LinearGradient
        colors={['#D4A01718', '#B8880F12', '#D4A01708']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.banner}
        pointerEvents="none"
      />

      {/* Avatar + name */}
      <View style={s.profileRow}>
        {avatarUrl ? (
          <ExpoImage source={{ uri: avatarUrl }} style={s.avatar} contentFit="cover" cachePolicy="disk" />
        ) : (
          <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.avatar}>
            <Text style={s.avatarInitial}>
              {(displayName || username || user?.email || '?').charAt(0).toUpperCase()}
            </Text>
          </LinearGradient>
        )}
        <View style={s.nameBlock}>
          <Text style={s.displayName}>{displayName || username || user?.email || ''}</Text>
          {username ? <Text style={s.handle}>@{username}</Text> : null}
        </View>
      </View>

      {/* Stats row */}
      <View style={s.statsRow}>
        <Pressable
          style={({ pressed }) => [s.statItem, { opacity: pressed ? 0.7 : 1 }]}
          onPress={() => {
            console.log('[Profile] Albums tapped');
            router.push('/my-listend');
          }}>
          <Text style={s.statValue}>{albumCount}</Text>
          <Text style={s.statLabel}>Albums</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [s.statItem, { opacity: pressed ? 0.7 : 1 }]}
          onPress={() => {
            console.log('[Profile] This Year tapped');
            router.push('/sessions');
          }}>
          <Text style={s.statValue}>{thisYear}</Text>
          <Text style={s.statLabel}>This Year</Text>

        </Pressable>
        <Pressable
          style={({ pressed }) => [s.statItem, { opacity: pressed ? 0.7 : 1 }]}
          onPress={() => {
            console.log('[Profile] Avg Rating tapped');
            setRatingModalVisible(true);
          }}>
          <Text style={s.statValue}>{avgRating}</Text>
          <Text style={s.statLabel}>Avg Rating</Text>
        </Pressable>
      </View>

      <RatingModal
        visible={ratingModalVisible}
        onClose={() => setRatingModalVisible(false)}
        avgRating={avgRating}
        distribution={ratingDistribution}
      />

      <View style={[s.rule, { backgroundColor: BORDER }]} />

      {/* Want to Listen */}
      <Pressable
        style={({ pressed }) => [s.wantRow, { opacity: pressed ? 0.7 : 1 }]}
        onPress={() => router.push('/want-to-listen')}>
        <FontAwesome name="bookmark-o" size={14} color={SUBTEXT} style={{ marginTop: 1 }} />
        <Text style={s.wantLabel}>Want to Listen</Text>
        <Text style={s.wantCount}>{wantToListen.length}</Text>
        <FontAwesome name="chevron-right" size={12} color={SUBTEXT} />
      </Pressable>

      <View style={[s.rule, { backgroundColor: BORDER }]} />

      {/* My Playlists */}
      <Pressable
        style={({ pressed }) => [s.wantRow, { opacity: pressed ? 0.7 : 1 }]}
        onPress={() => router.push('/my-playlists')}>
        <FontAwesome name="list" size={14} color={SUBTEXT} style={{ marginTop: 1 }} />
        <Text style={s.wantLabel}>My Playlists</Text>
        <FontAwesome name="chevron-right" size={12} color={SUBTEXT} />
      </Pressable>

      <View style={[s.rule, { backgroundColor: BORDER }]} />

      {/* Liked Artists */}
      <Pressable
        style={({ pressed }) => [s.wantRow, { opacity: pressed ? 0.7 : 1 }]}
        onPress={() => router.push('/liked-artists')}>
        <FontAwesome name="heart" size={14} color="#D4A017" style={{ marginTop: 1 }} />
        <Text style={s.wantLabel}>Liked Artists</Text>
        <FontAwesome name="chevron-right" size={12} color={SUBTEXT} />
      </Pressable>

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
                onAdd={() => router.push({ pathname: '/pick-item', params: { type: 'song' } })}
                onRemove={() => song && confirmRemoveSong(song.id, song.title)}
              />
            );
          })}
        </View>
      </View>

      <View style={[s.rule, { backgroundColor: BORDER }]} />

      {/* Favourite Artists */}
      <View style={s.favSection}>
        <View style={s.favHeader}>
          <Text style={s.favTitle}>FAVOURITE ARTISTS</Text>
          <Pressable onPress={() => router.push({ pathname: '/pick-item', params: { type: 'artist' } })}>
            <Text style={s.editLabel}>Edit</Text>
          </Pressable>
        </View>
        <View style={s.favRow}>
          {Array.from({ length: 5 }).map((_, i) => {
            const artist: TopArtist | undefined = topArtists[i];
            return (
              <FavSlot
                key={i}
                item={artist ? { artworkUrl: artist.artworkUrl, title: artist.name } : undefined}
                circular
                onAdd={() => router.push({ pathname: '/pick-item', params: { type: 'artist' } })}
                onRemove={() => artist && confirmRemoveArtist(artist.id, artist.name)}
              />
            );
          })}
        </View>
      </View>

      <View style={[s.rule, { backgroundColor: BORDER }]} />

      {/* Listened grid */}
      <View style={s.gridSection}>
        <View style={s.favHeader}>
          <Text style={s.favTitle}>LISTENED</Text>
          <Text style={s.albumCount}>{albumCount} albums</Text>
        </View>
        {loggedAlbums.length === 0 ? (
          <Text style={s.gridEmpty}>No albums logged yet.</Text>
        ) : (
          <View style={s.grid}>
            {loggedAlbums.map((album) => (
              <Pressable
                key={album.id}
                onPress={() => router.push({ pathname: '/album-detail', params: { id: album.id } })}
                style={({ pressed }) => [s.gridItem, { opacity: pressed ? 0.7 : 1 }]}>
                {album.artworkUrl ? (
                  <ExpoImage source={{ uri: album.artworkUrl }} style={s.gridArt} contentFit="cover" cachePolicy="disk" />
                ) : (
                  <View style={[s.gridArt, { backgroundColor: album.coverColor, justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={s.gridInitial}>{album.title.charAt(0)}</Text>
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <View style={[s.rule, { backgroundColor: BORDER }]} />

      {/* Sign Out */}
      <Pressable
        style={({ pressed }) => [s.signOutRow, { opacity: pressed ? 0.7 : 1 }]}
        onPress={handleSignOut}>
        <FontAwesome name="sign-out" size={14} color="#D4A017" style={{ marginTop: 1 }} />
        <Text style={s.signOutLabel}>Sign Out</Text>
      </Pressable>

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
              <ExpoImage source={{ uri: album.artworkUrl }} style={s.recentArt} 
            contentFit="cover" cachePolicy="disk"
          />
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
            <VolumeBadge rating={album.rating} />
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

  wantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 8,
  },
  wantLabel: { flex: 1, color: TEXT, fontSize: 15, fontWeight: '500' },
  wantCount: { color: SUBTEXT, fontSize: 15, marginRight: 2 },

  signOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 8,
  },
  signOutLabel: { color: '#D4A017', fontSize: 15, fontWeight: '500' },

  favSection: { paddingHorizontal: 20, paddingVertical: 16 },
  favHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  favTitle: { color: SUBTEXT, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },
  editLabel: { color: '#D4A017', fontSize: 12 },
  albumCount: { color: SUBTEXT, fontSize: 12 },

  favRow: {
    flexDirection: 'row',
    gap: FAV_GAP,
  },
  favSlot: {
    width: FAV_SLOT_SIZE,
    height: FAV_SLOT_SIZE,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: CARD_BG,
  },
  favEmpty: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a1e14',
  },
  favInitialBg: {
    width: FAV_SLOT_SIZE,
    height: FAV_SLOT_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  favInitial: { color: '#7a5535', fontSize: 16, fontWeight: '700' },
  favPlus: { color: '#505050', fontSize: 20, fontWeight: '300' },

  gridSection: { paddingHorizontal: 20, paddingVertical: 16 },
  gridEmpty: { color: SUBTEXT, fontSize: 14, marginTop: 8 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  gridItem: {
    width: GRID_ITEM_SIZE,
    height: GRID_ITEM_SIZE,
    borderRadius: 2,
    overflow: 'hidden',
  },
  gridArt: {
    width: GRID_ITEM_SIZE,
    height: GRID_ITEM_SIZE,
  },
  gridInitial: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '700' },

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
});

// ─── Rating modal styles ──────────────────────────────────────────────────────

const rm = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: '#161616',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingBottom: 32,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#4a3020',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  headerTitle: {
    color: TEXT,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  closeBtn: {
    padding: 4,
  },
  avgBlock: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
    marginBottom: 20,
  },
  avgValue: {
    color: '#D4A017',
    fontSize: 56,
    fontWeight: '700',
    letterSpacing: -2,
    lineHeight: 62,
  },
  avgLabel: {
    color: SUBTEXT,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  distBlock: {
    gap: 10,
  },
  distRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  distRating: {
    color: SUBTEXT,
    fontSize: 13,
    fontWeight: '600',
    width: 16,
    textAlign: 'right',
  },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2a1e14',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#D4A017',
  },
  distCount: {
    color: TEXT,
    fontSize: 13,
    fontWeight: '600',
    width: 24,
    textAlign: 'right',
  },
});
