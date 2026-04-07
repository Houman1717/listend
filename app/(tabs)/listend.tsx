import {
  StyleSheet,
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  Alert,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useAlbums, TopAlbum, TopSong, TopArtist } from '@/context/AlbumsContext';

const DARK_BG = '#0d0d0d';
const CARD_BG = '#1a1a1a';
const BORDER = '#2a2a2a';
const TEXT = '#f0f0f0';
const SUBTEXT = '#888';

// ─── Profile header ───────────────────────────────────────────────────────────

function ProfileHeader({
  albumCount,
  thisYearCount,
  avgRating,
}: {
  albumCount: number;
  thisYearCount: number;
  avgRating: string;
}) {
  return (
    <View style={ph.container}>
      {/* Avatar */}
      <View style={ph.avatarWrap}>
        <View style={ph.avatar}>
          <Text style={ph.avatarInitial}>H</Text>
        </View>
      </View>

      {/* Name + username */}
      <Text style={ph.name}>Houman</Text>
      <Text style={ph.username}>@houman</Text>

      {/* Following / Followers */}
      <View style={ph.socialRow}>
        <Text style={ph.socialCount}>0</Text>
        <Text style={ph.socialLabel}> Following</Text>
        <Text style={ph.socialDot}> · </Text>
        <Text style={ph.socialCount}>0</Text>
        <Text style={ph.socialLabel}> Followers</Text>
      </View>

      {/* Stats row */}
      <View style={ph.statsRow}>
        <View style={ph.statBox}>
          <Text style={ph.statValue}>{albumCount}</Text>
          <Text style={ph.statLabel}>Albums</Text>
        </View>
        <View style={ph.statDivider} />
        <View style={ph.statBox}>
          <Text style={ph.statValue}>{thisYearCount}</Text>
          <Text style={ph.statLabel}>This Year</Text>
        </View>
        <View style={ph.statDivider} />
        <View style={ph.statBox}>
          <Text style={ph.statValue}>{avgRating}</Text>
          <Text style={ph.statLabel}>Avg Rating</Text>
        </View>
      </View>
    </View>
  );
}

const ph = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2a2a2a',
  },
  avatarWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF3CAC',
  },
  avatar: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1f1f1f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: '#FF3CAC',
    fontSize: 32,
    fontWeight: '700',
  },
  name: {
    color: TEXT,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  username: {
    color: SUBTEXT,
    fontSize: 14,
    marginTop: 2,
    marginBottom: 10,
  },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  socialCount: {
    color: TEXT,
    fontSize: 13,
    fontWeight: '700',
  },
  socialLabel: {
    color: SUBTEXT,
    fontSize: 13,
  },
  socialDot: {
    color: SUBTEXT,
    fontSize: 13,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    width: '100%',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  statValue: {
    color: TEXT,
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    color: SUBTEXT,
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 32,
    backgroundColor: BORDER,
  },
});

const FAV_GAP = 3;
const FAV_SLOTS = 5;
const FAV_SLOT_SIZE = Math.floor(
  (Dimensions.get('window').width - 40 - FAV_GAP * (FAV_SLOTS - 1)) / FAV_SLOTS
);

// ─── Horizontal favourite slot ────────────────────────────────────────────────

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
  const radius = circular ? FAV_SLOT_SIZE / 2 : 3;
  if (item) {
    return (
      <Pressable onPress={onRemove} style={[s.favSlot, { borderRadius: radius }]}>
        {item.artworkUrl ? (
          <Image
            source={{ uri: item.artworkUrl }}
            style={{ width: FAV_SLOT_SIZE, height: FAV_SLOT_SIZE, borderRadius: radius }}
            resizeMode="cover"
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

// ─── Navigation row ───────────────────────────────────────────────────────────

function NavRow({
  icon,
  label,
  sub,
  onPress,
}: {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  label: string;
  sub: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [s.navRow, { opacity: pressed ? 0.6 : 1 }]}
      onPress={onPress}>
      <View style={s.navIconWrap}>
        <FontAwesome name={icon} size={16} color="#FF3CAC" />
      </View>
      <View style={s.navRowText}>
        <Text style={s.navLabel}>{label}</Text>
        <Text style={s.navSub}>{sub}</Text>
      </View>
      <FontAwesome name="chevron-right" size={13} color={SUBTEXT} />
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ListendScreen() {
  const router = useRouter();
  const { topAlbums, topSongs, topArtists, removeTopAlbum, removeTopSong, removeTopArtist, loggedAlbums, wantToListen } = useAlbums();

  const reviewCount = loggedAlbums.filter((a) => !!a.review).length;

  // ── Profile stats ────────────────────────────────────────────────────────────
  const currentYear = new Date().getFullYear();
  const thisYearCount = loggedAlbums.filter((a) => {
    const y = parseInt(a.dateLogged?.split(', ')[1] ?? '0', 10);
    return y === currentYear;
  }).length;
  const ratedAlbums = loggedAlbums.filter((a) => a.rating > 0);
  const avgRating = ratedAlbums.length > 0
    ? (ratedAlbums.reduce((sum, a) => sum + a.rating, 0) / ratedAlbums.length).toFixed(1)
    : '—';

  function confirmRemoveAlbum(id: string, title: string) {
    Alert.alert('Remove', `Remove "${title}" from Top 5?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeTopAlbum(id) },
    ]);
  }

  function confirmRemoveSong(id: string, title: string) {
    Alert.alert('Remove', `Remove "${title}" from Top 5?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeTopSong(id) },
    ]);
  }

  function confirmRemoveArtist(id: string, name: string) {
    Alert.alert('Remove', `Remove "${name}" from Top 5?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeTopArtist(id) },
    ]);
  }

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}>

      {/* Profile header */}
      <ProfileHeader
        albumCount={loggedAlbums.length}
        thisYearCount={thisYearCount}
        avgRating={avgRating}
      />

      {/* Top 5 Albums */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>MY TOP 5 ALBUMS</Text>
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

      <View style={s.rule} />

      {/* Top 5 Songs */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>MY TOP 5 SONGS</Text>
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

      <View style={s.rule} />

      {/* Top 5 Artists */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>MY TOP 5 ARTISTS</Text>
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
                circular
                item={artist ? { artworkUrl: artist.artworkUrl, title: artist.name } : undefined}
                onAdd={() => router.push({ pathname: '/pick-item', params: { type: 'artist' } })}
                onRemove={() => artist && confirmRemoveArtist(artist.id, artist.name)}
              />
            );
          })}
        </View>
      </View>

      {/* ── Activity rows (above stats) ─────────────────────────────────────── */}
      <View style={[s.navGroup, { marginBottom: 12 }]}>
        <NavRow
          icon="comments"
          label="DMs"
          sub="Messages"
          onPress={() => router.push('/dms')}
        />
        <View style={s.navSeparator} />
        <NavRow
          icon="calendar"
          label="Sessions"
          sub="Your listening diary"
          onPress={() => router.push('/sessions')}
        />
        <View style={s.navSeparator} />
        <NavRow
          icon="clock-o"
          label="Recent Activity"
          sub={`${loggedAlbums.length} logged albums`}
          onPress={() => router.push('/recent-activity')}
        />
      </View>

      <View style={s.navGroup}>
        <NavRow
          icon="music"
          label="My Listend"
          sub={`${loggedAlbums.length} albums`}
          onPress={() => router.push('/my-listend')}
        />
        <View style={s.navSeparator} />
        <NavRow
          icon="bookmark-o"
          label="Want to Listen"
          sub={`${wantToListen.length} saved`}
          onPress={() => router.push('/want-to-listen')}
        />
        <View style={s.navSeparator} />
        <NavRow
          icon="pencil"
          label="My Reviews"
          sub={`${reviewCount} reviews`}
          onPress={() => router.push('/my-reviews')}
        />
        <View style={s.navSeparator} />
        <NavRow
          icon="list"
          label="My Playlists"
          sub="Your album lists"
          onPress={() => router.push('/my-playlists')}
        />
        <View style={s.navSeparator} />
        <NavRow
          icon="bar-chart"
          label="My Stats"
          sub="Your listening insights"
          onPress={() => router.push('/my-stats')}
        />
      </View>

    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_BG },
  content: { paddingBottom: 48 },

  section: { paddingHorizontal: 20, paddingVertical: 18 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: SUBTEXT,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  editLabel: { color: '#FF3CAC', fontSize: 12 },

  favRow: { flexDirection: 'row', gap: FAV_GAP },
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
    borderColor: '#2e2e2e',
  },
  favInitialBg: {
    width: FAV_SLOT_SIZE,
    height: FAV_SLOT_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  favInitial: { color: '#555', fontSize: 16, fontWeight: '700' },
  favPlus: { color: '#505050', fontSize: 20, fontWeight: '300' },

  rule: { height: StyleSheet.hairlineWidth, backgroundColor: BORDER, marginHorizontal: 20 },

  navGroup: {
    marginTop: 24,
    marginHorizontal: 20,
    backgroundColor: '#111',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#222',
    overflow: 'hidden',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  navIconWrap: { width: 28, alignItems: 'center' },
  navRowText: { flex: 1, gap: 2 },
  navLabel: { color: TEXT, fontSize: 16, fontWeight: '600' },
  navSub: { color: SUBTEXT, fontSize: 13 },
  navSeparator: { height: StyleSheet.hairlineWidth, backgroundColor: '#222', marginLeft: 58 },
});
