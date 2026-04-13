import {
  StyleSheet,
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Modal,
  SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

// ─── Constants ────────────────────────────────────────────────────────────────

const DARK_BG    = '#0d0d0d';
const CARD_BG    = '#1a1a1a';
const BORDER     = '#2a2a2a';
const TEXT       = '#f0f0f0';
const SUBTEXT    = '#888';
const ACCENT     = '#FF3CAC';
const AVATAR_SIZE = 80;

const FAV_GAP    = 3;
const FAV_SLOTS  = 5;
const FAV_SLOT_SIZE = Math.floor(
  (Dimensions.get('window').width - 40 - FAV_GAP * (FAV_SLOTS - 1)) / FAV_SLOTS
);

// ─── Types ────────────────────────────────────────────────────────────────────

type FavAlbum  = { id: string; title: string; artist: string; artworkUrl: string };
type FavSong   = { id: string; title: string; artist: string; artworkUrl: string };
type FavArtist = { id: string; name: string; artworkUrl: string };

type Profile = {
  id: string;
  display_name: string | null;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_photo_url: string | null;
  top_albums:  FavAlbum[]  | null;
  top_songs:   FavSong[]   | null;
  top_artists: FavArtist[] | null;
};

type RatingDist = { rating: number; count: number };

// ─── Rating modal ─────────────────────────────────────────────────────────────

function RatingModal({
  visible,
  onClose,
  avgRating,
  distribution,
}: {
  visible: boolean;
  onClose: () => void;
  avgRating: string;
  distribution: RatingDist[];
}) {
  const maxCount = Math.max(...distribution.map(d => d.count), 1);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={rm.container}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <SafeAreaView style={rm.sheet}>
          <View style={rm.handle} />
          <View style={rm.header}>
            <Text style={rm.headerTitle}>Rating Breakdown</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <FontAwesome name="times" size={16} color={SUBTEXT} />
            </Pressable>
          </View>
          <View style={rm.avgBlock}>
            <Text style={rm.avgValue}>{avgRating}</Text>
            <Text style={rm.avgLabel}>average rating</Text>
          </View>
          <View style={rm.distBlock}>
            {[...distribution].reverse().map(({ rating, count }) => {
              const filled = count > 0 ? Math.max(count / maxCount, 0.02) : 0;
              const empty  = 1 - filled;
              return (
                <View key={rating} style={rm.distRow}>
                  <Text style={rm.distRating}>{rating}</Text>
                  <View style={rm.barTrack}>
                    <View style={[rm.barFilled, {
                      flex: filled,
                      opacity: 0.4 + (count / maxCount) * 0.6,
                    }]} />
                    {empty > 0 && <View style={{ flex: empty }} />}
                  </View>
                  <Text style={rm.distCount}>{count}</Text>
                </View>
              );
            })}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// ─── Read-only fav slot ───────────────────────────────────────────────────────

function FavSlotReadOnly({
  item,
  circular = false,
}: {
  item?: { artworkUrl?: string; title: string };
  circular?: boolean;
}) {
  const radius = circular ? FAV_SLOT_SIZE / 2 : 3;
  if (item?.artworkUrl) {
    return (
      <View style={[s.favSlot, { borderRadius: radius }]}>
        <Image
          source={{ uri: item.artworkUrl }}
          style={{ width: FAV_SLOT_SIZE, height: FAV_SLOT_SIZE, borderRadius: radius }}
          resizeMode="cover"
        />
      </View>
    );
  }
  if (item) {
    return (
      <View style={[s.favSlot, { borderRadius: radius }]}>
        <View style={[s.favInitialBg, { borderRadius: radius }]}>
          <Text style={s.favInitial}>{item.title.charAt(0)}</Text>
        </View>
      </View>
    );
  }
  // Empty slot — read-only, no "+" button
  return <View style={[s.favSlot, s.favEmpty, { borderRadius: radius }]} />;
}

// ─── Nav row ──────────────────────────────────────────────────────────────────

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
        <FontAwesome name={icon} size={16} color={ACCENT} />
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

export default function UserProfileScreen() {
  const { userId }     = useLocalSearchParams<{ userId: string }>();
  const viewedUserId   = userId; // alias — makes nav params and logs unambiguous
  const { user }       = useAuth();
  const navigation     = useNavigation();
  const router         = useRouter();

  const [profile,        setProfile]        = useState<Profile | null>(null);
  const [loading,        setLoading]        = useState(true);

  // Follow state — read from Supabase on load so it persists across sessions
  const [isFollowing,    setIsFollowing]    = useState(false);
  const [isMutual,       setIsMutual]       = useState(false);
  const [followLoading,  setFollowLoading]  = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // Stats
  const [albumCount,    setAlbumCount]    = useState(0);
  const [thisYearCount, setThisYearCount] = useState(0);
  const [avgRating,     setAvgRating]     = useState('—');
  const [ratingDist,    setRatingDist]    = useState<RatingDist[]>([]);
  const [reviewCount,   setReviewCount]   = useState(0);
  const [wantCount,     setWantCount]     = useState(0);
  const [ratingModalVisible, setRatingModalVisible] = useState(false);

  // Top 5 derived from user_albums (not JSONB columns — those are only populated for own user)
  const [derivedTopAlbums,  setDerivedTopAlbums]  = useState<FavAlbum[]>([]);
  const [derivedTopArtists, setDerivedTopArtists] = useState<FavArtist[]>([]);

  // ── Load all data ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    // Capture both IDs up front so every log line is unambiguous
    const currentUserId  = user?.id ?? null;
    const viewedUserId   = userId;
    console.log('[UserProfile] currentUserId :', currentUserId);
    console.log('[UserProfile] viewedUserId  :', viewedUserId);

    async function load() {
      setLoading(true);
      try {
        // 1. Profile row — core columns only (top_albums/top_songs/top_artists
        //    are fetched separately so a missing-column error doesn't block the
        //    whole profile from loading).
        const { data: prof, error: profErr } = await supabase
          .from('profiles')
          .select('id, display_name, username, bio, avatar_url, cover_photo_url')
          .eq('id', viewedUserId)
          .single();

        console.log('[UserProfile] profile data :', JSON.stringify(prof));
        console.log('[UserProfile] profile error:', JSON.stringify(profErr));

        if (profErr) console.error('[UserProfile] profile fetch error:', profErr);
        if (prof) {
          // Try to fetch top-5 favourites separately; ignore errors if columns
          // haven't been added to the DB yet.
          const { data: favData, error: favErr } = await supabase
            .from('profiles')
            .select('top_albums, top_songs, top_artists')
            .eq('id', viewedUserId)
            .single();
          console.log('[UserProfile] top5 result:', JSON.stringify(favData), JSON.stringify(favErr));

          setProfile({
            ...prof,
            top_albums:  favData?.top_albums  ?? null,
            top_songs:   favData?.top_songs   ?? null,
            top_artists: favData?.top_artists ?? null,
          });
          navigation.setOptions({
            title: prof.display_name || prof.username || 'Profile',
          });
        }

        // 2. Followers / Following counts
        const [{ count: followers, error: flwrsErr }, { count: following, error: flwngErr }] =
          await Promise.all([
            supabase
              .from('follows')
              .select('*', { count: 'exact', head: true })
              .eq('following_id', viewedUserId),
            supabase
              .from('follows')
              .select('*', { count: 'exact', head: true })
              .eq('follower_id', viewedUserId),
          ]);
        if (flwrsErr) console.error('[UserProfile] followers count error:', flwrsErr);
        if (flwngErr) console.error('[UserProfile] following count error:', flwngErr);
        setFollowersCount(followers ?? 0);
        setFollowingCount(following ?? 0);

        // 3. Current user's follow state + mutual-follow check
        //    Uses .match() + .single(); PGRST116 = "no row" = not following (not a real error)
        if (currentUserId) {
          // Does current user follow viewed user?
          const { data: outgoing, error: outErr } = await supabase
            .from('follows')
            .select('id')
            .match({ follower_id: currentUserId, following_id: viewedUserId })
            .single();
          console.log('[UserProfile] outgoing follow row:', outgoing, 'error:', outErr?.code);
          const currentFollowsViewed = !!outgoing && !outErr;
          setIsFollowing(currentFollowsViewed);

          // Does viewed user follow current user back?
          const { data: incoming, error: inErr } = await supabase
            .from('follows')
            .select('id')
            .match({ follower_id: viewedUserId, following_id: currentUserId })
            .single();
          console.log('[UserProfile] incoming follow row:', incoming, 'error:', inErr?.code);
          const viewedFollowsCurrent = !!incoming && !inErr;

          setIsMutual(currentFollowsViewed && viewedFollowsCurrent);
        }

        // 4. Album stats + Top 5 Albums/Artists derived from user_albums
        const { data: userAlbums, error: albumsErr } = await supabase
          .from('user_albums')
          .select('spotify_id, title, artist, artwork_url, rating, review, year, listened_at')
          .eq('user_id', viewedUserId)
          .order('listened_at', { ascending: false });
        console.log('[UserProfile] user_albums result:', JSON.stringify(userAlbums), JSON.stringify(albumsErr));
        if (albumsErr) console.error('[UserProfile] user_albums error:', albumsErr);
        if (userAlbums) {
          const thisYear = new Date().getFullYear();
          const withRating = userAlbums.filter((a: any) => a.rating > 0);
          setAlbumCount(userAlbums.length);
          setThisYearCount(userAlbums.filter((a: any) => {
            const y = a.listened_at ? new Date(a.listened_at).getFullYear() : a.year;
            return y === thisYear;
          }).length);
          setReviewCount(userAlbums.filter((a: any) => a.review).length);
          if (withRating.length > 0) {
            const sum = withRating.reduce((acc: number, a: any) => acc + a.rating, 0);
            setAvgRating((sum / withRating.length).toFixed(1));
            const dist: RatingDist[] = Array.from({ length: 10 }, (_, i) => ({
              rating: i + 1,
              count: withRating.filter((a: any) => a.rating === i + 1).length,
            }));
            setRatingDist(dist);
          }

          // Top 5 Albums — highest rated
          const top5Albums: FavAlbum[] = [...userAlbums as any[]]
            .filter((a: any) => a.rating > 0)
            .sort((a: any, b: any) => b.rating - a.rating)
            .slice(0, 5)
            .map((a: any) => ({
              id:         a.spotify_id,
              title:      a.title      ?? '',
              artist:     a.artist     ?? '',
              artworkUrl: a.artwork_url ?? '',
            }));
          setDerivedTopAlbums(top5Albums);

          // Top 5 Artists — most albums logged
          const artistCount = new Map<string, number>();
          for (const a of userAlbums as any[]) {
            if (a.artist) artistCount.set(a.artist, (artistCount.get(a.artist) ?? 0) + 1);
          }
          const top5Artists: FavArtist[] = [...artistCount.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name]) => ({ id: name, name, artworkUrl: '' }));
          setDerivedTopArtists(top5Artists);
        }

        // 5. Want-to-listen count
        const { count: want, error: wantErr } = await supabase
          .from('want_to_listen')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', viewedUserId);
        if (wantErr) console.error('[UserProfile] want_to_listen count error:', wantErr);
        setWantCount(want ?? 0);

      } catch (e) {
        console.error('[UserProfile] unexpected load error:', e);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [userId, user, navigation]);

  // ── Follow / Unfollow ────────────────────────────────────────────────────────
  async function handleFollow() {
    const currentUserId = user?.id ?? null;
    const viewedUserId  = userId;

    console.log('[UserProfile] handleFollow — currentUserId:', currentUserId, 'viewedUserId:', viewedUserId, 'isFollowing:', isFollowing);

    if (!currentUserId || !viewedUserId || followLoading) {
      console.warn('[UserProfile] handleFollow bailed out — missing id or already loading');
      return;
    }
    setFollowLoading(true);

    if (isFollowing) {
      const { error } = await supabase
        .from('follows')
        .delete()
        .match({ follower_id: currentUserId, following_id: viewedUserId });
      if (error) {
        console.error('[UserProfile] unfollow error:', error);
      } else {
        console.log('[UserProfile] unfollowed successfully');
        setIsFollowing(false);
        setIsMutual(false); // can't be mutual if we no longer follow them
        setFollowersCount(n => Math.max(0, n - 1));
      }
    } else {
      const { error } = await supabase
        .from('follows')
        .insert({ follower_id: currentUserId, following_id: viewedUserId });
      if (error) {
        console.error('[UserProfile] follow insert error:', error);
      } else {
        console.log('[UserProfile] followed successfully');
        setIsFollowing(true);
        setFollowersCount(n => n + 1);
        // Check if they already follow us back — if so, it's now mutual
        const { data: incoming } = await supabase
          .from('follows')
          .select('id')
          .match({ follower_id: viewedUserId, following_id: currentUserId })
          .single();
        setIsMutual(!!incoming);
      }
    }

    setFollowLoading(false);
  }

  // ── Loading / not found ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={ACCENT} size="large" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={s.center}>
        <Text style={{ color: SUBTEXT, fontSize: 15 }}>User not found.</Text>
      </View>
    );
  }

  const name    = profile.display_name || profile.username || '';
  const initial = name.charAt(0).toUpperCase() || '?';

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}>

      {/* ── Cover photo ────────────────────────────────────────────────────── */}
      {profile.cover_photo_url ? (
        <View style={s.cover}>
          <Image source={{ uri: profile.cover_photo_url }} style={s.coverImg} resizeMode="cover" />
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 100 }}>
            <LinearGradient colors={['transparent', DARK_BG]} style={{ flex: 1 }} />
          </View>
        </View>
      ) : null}

      {/* ── Profile body ───────────────────────────────────────────────────── */}
      <View style={[s.profileBody, !profile.cover_photo_url && s.profileBodyNoCover]}>

        {/* Avatar */}
        <View style={[s.avatarWrap, !profile.cover_photo_url && s.avatarWrapNoCover]}>
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={s.avatarImg} resizeMode="cover" />
          ) : (
            <View style={s.avatarFallback}>
              <Text style={s.avatarInitial}>{initial}</Text>
            </View>
          )}
        </View>

        {/* Name */}
        <Text style={s.name}>{name}</Text>

        {/* Username */}
        {profile.username ? <Text style={s.username}>@{profile.username}</Text> : null}

        {/* Bio */}
        {profile.bio ? <Text style={s.bio}>{profile.bio}</Text> : null}

        {/* Following / Followers */}
        <View style={s.socialRow}>
          <Pressable
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            onPress={() => router.push({ pathname: '/followers-following', params: { userId: viewedUserId, type: 'following' } })}>
            <Text style={s.socialCount}>{followingCount}</Text>
          </Pressable>
          <Text style={s.socialLabel}> Following</Text>
          <Text style={s.socialDot}> · </Text>
          <Pressable
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            onPress={() => router.push({ pathname: '/followers-following', params: { userId: viewedUserId, type: 'followers' } })}>
            <Text style={s.socialCount}>{followersCount}</Text>
          </Pressable>
          <Text style={s.socialLabel}> Followers</Text>
        </View>

        {/* Follow + Message buttons */}
        <View style={s.actionRow}>
          <Pressable
            style={({ pressed }) => [
              s.followBtn,
              isFollowing && s.followBtnActive,
              isMutual && s.followBtnMutual,
              { opacity: pressed || followLoading ? 0.7 : 1 },
            ]}
            onPress={handleFollow}
            disabled={followLoading}>
            <Text style={[s.followBtnText, isFollowing && s.followBtnTextActive]}>
              {isFollowing ? 'Following' : 'Follow'}
            </Text>
          </Pressable>

          {isMutual && (
            <Pressable
              style={({ pressed }) => [s.messageBtn, { opacity: pressed ? 0.7 : 1 }]}
              onPress={() => router.push({ pathname: '/dm-conversation', params: { userId: viewedUserId } })}>
              <Text style={s.messageBtnText}>Message</Text>
            </Pressable>
          )}
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          <View style={s.statBox}>
            <Text style={s.statValue}>{albumCount}</Text>
            <Text style={s.statLabel}>Albums</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statBox}>
            <Text style={s.statValue}>{thisYearCount}</Text>
            <Text style={s.statLabel}>This Year</Text>
          </View>
          <View style={s.statDivider} />
          <Pressable
            style={({ pressed }) => [s.statBox, { opacity: pressed ? 0.7 : 1 }]}
            onPress={() => setRatingModalVisible(true)}>
            <Text style={s.statValue}>{avgRating}</Text>
            <Text style={s.statLabel}>Avg Rating</Text>
          </Pressable>
        </View>

      </View>

      <RatingModal
        visible={ratingModalVisible}
        onClose={() => setRatingModalVisible(false)}
        avgRating={avgRating}
        distribution={ratingDist}
      />

      {/* ── Top 5 Albums ───────────────────────────────────────────────────── */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>TOP 5 ALBUMS</Text>
        </View>
        <View style={s.favRow}>
          {Array.from({ length: 5 }).map((_, i) => {
            const a = derivedTopAlbums[i];
            return (
              <FavSlotReadOnly
                key={i}
                item={a ? { artworkUrl: a.artworkUrl, title: a.title } : undefined}
              />
            );
          })}
        </View>
      </View>

      <View style={s.rule} />

      {/* ── Top 5 Songs ────────────────────────────────────────────────────── */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>TOP 5 SONGS</Text>
        </View>
        <View style={s.favRow}>
          {Array.from({ length: 5 }).map((_, i) => {
            const sg = (profile.top_songs ?? [])[i];
            return (
              <FavSlotReadOnly
                key={i}
                item={sg ? { artworkUrl: sg.artworkUrl, title: sg.title } : undefined}
              />
            );
          })}
        </View>
      </View>

      <View style={s.rule} />

      {/* ── Top 5 Artists ──────────────────────────────────────────────────── */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>TOP 5 ARTISTS</Text>
        </View>
        <View style={s.favRow}>
          {Array.from({ length: 5 }).map((_, i) => {
            const ar = derivedTopArtists[i];
            return (
              <FavSlotReadOnly
                key={i}
                item={ar ? { artworkUrl: ar.artworkUrl, title: ar.name } : undefined}
                circular
              />
            );
          })}
        </View>
      </View>

      {/* ── Activity rows ──────────────────────────────────────────────────── */}
      <View style={s.navGroup}>
        <NavRow
          icon="calendar"
          label="Sessions"
          sub="Listening diary"
          onPress={() => router.push({ pathname: '/sessions', params: { userId: viewedUserId } })}
        />
        <View style={s.navSeparator} />
        <NavRow
          icon="clock-o"
          label="Recent Activity"
          sub={`${albumCount} logged albums`}
          onPress={() => router.push({ pathname: '/recent-activity', params: { userId: viewedUserId } })}
        />
      </View>

      <View style={[s.navGroup, { marginTop: 2 }]}>
        <NavRow
          icon="music"
          label="Listend"
          sub={`${albumCount} albums`}
          onPress={() => router.push({ pathname: '/my-listend', params: { userId: viewedUserId } })}
        />
        <View style={s.navSeparator} />
        <NavRow
          icon="bookmark-o"
          label="Want to Listen"
          sub={`${wantCount} saved`}
          onPress={() => router.push({ pathname: '/want-to-listen', params: { userId: viewedUserId } })}
        />
        <View style={s.navSeparator} />
        <NavRow
          icon="pencil"
          label="Reviews"
          sub={`${reviewCount} reviews`}
          onPress={() => router.push({ pathname: '/my-reviews', params: { userId: viewedUserId } })}
        />
        <View style={s.navSeparator} />
        <NavRow
          icon="list"
          label="Playlists"
          sub="Album lists"
          onPress={() => router.push({ pathname: '/my-playlists', params: { userId: viewedUserId } })}
        />
        <View style={s.navSeparator} />
        <NavRow
          icon="bar-chart"
          label="Stats"
          sub="Listening insights"
          onPress={() => router.push({ pathname: '/my-stats', params: { userId: viewedUserId } })}
        />
      </View>

    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_BG },
  content:   { paddingBottom: 48 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: DARK_BG },

  // Cover
  cover:    { width: '100%', aspectRatio: 16 / 9, overflow: 'hidden' },
  coverImg: { width: '100%', height: '100%' },

  // Profile body
  profileBody: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  profileBodyNoCover: { paddingTop: 24 },

  // Avatar
  avatarWrap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    overflow: 'hidden',
    marginTop: -(AVATAR_SIZE / 2),
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#333',
    backgroundColor: '#222',
  },
  avatarWrapNoCover: { marginTop: 0 },
  avatarImg: { width: '100%', height: '100%' },
  avatarFallback: {
    flex: 1,
    backgroundColor: '#1f1f1f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: SUBTEXT, fontSize: 28, fontWeight: '700' },

  // Text
  name:     { color: TEXT,    fontSize: 20, fontWeight: '700', textAlign: 'center' },
  username: { color: SUBTEXT, fontSize: 14, marginTop: 2,      textAlign: 'center' },
  bio:      { color: '#aaa',  fontSize: 14, lineHeight: 20,    textAlign: 'center', marginTop: 10, maxWidth: 320 },

  // Social counts
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  socialCount: { color: TEXT,    fontSize: 13, fontWeight: '700' },
  socialLabel: { color: SUBTEXT, fontSize: 13 },
  socialDot:   { color: SUBTEXT, fontSize: 13 },

  // Follow + Message button row
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    marginBottom: 16,
  },

  // Follow button (Follow = filled accent, Following = outlined)
  followBtn: {
    backgroundColor: ACCENT,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 32,
  },
  followBtnActive: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: ACCENT,
  },
  // When mutual, narrow the follow button slightly to make room for Message
  followBtnMutual: {
    paddingHorizontal: 20,
  },
  followBtnText:       { color: '#fff',  fontSize: 14, fontWeight: '700' },
  followBtnTextActive: { color: ACCENT },

  // Message button — pink outline pill, only shown on mutual follows
  messageBtn: {
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderWidth: 1.5,
    borderColor: ACCENT,
    backgroundColor: 'transparent',
  },
  messageBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    width: '100%',
    marginTop: 4,
  },
  statBox:     { flex: 1, alignItems: 'center', gap: 3 },
  statValue:   { color: TEXT,    fontSize: 20, fontWeight: '700' },
  statLabel:   { color: SUBTEXT, fontSize: 11, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.8 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 32, backgroundColor: BORDER },

  // Sections (Top 5)
  section: { paddingHorizontal: 20, paddingVertical: 18 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: SUBTEXT, fontSize: 11, fontWeight: '700',
    letterSpacing: 1.5, textTransform: 'uppercase',
  },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: BORDER, marginHorizontal: 20 },

  // Fav slots
  favRow: { flexDirection: 'row', gap: FAV_GAP },
  favSlot: {
    width: FAV_SLOT_SIZE,
    height: FAV_SLOT_SIZE,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: CARD_BG,
  },
  favEmpty: {
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

  // Nav rows
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
  navRowText:  { flex: 1, gap: 2 },
  navLabel:    { color: TEXT,    fontSize: 16, fontWeight: '600' },
  navSub:      { color: SUBTEXT, fontSize: 13 },
  navSeparator: { height: StyleSheet.hairlineWidth, backgroundColor: '#222', marginLeft: 58 },
});

// ─── Rating modal styles ──────────────────────────────────────────────────────

const rm = StyleSheet.create({
  container: {
    flex: 1, width: '100%',
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
    overflow: 'hidden',
  },
  sheet: {
    width: '100%', alignSelf: 'stretch',
    backgroundColor: '#161616',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16, paddingBottom: 32,
    overflow: 'hidden',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BORDER,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#444',
    alignSelf: 'center',
    marginTop: 10, marginBottom: 4,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: 16,
  },
  headerTitle: {
    position: 'absolute', left: 0, right: 0,
    color: TEXT, fontSize: 17, fontWeight: '700', letterSpacing: -0.2,
    textAlign: 'center',
  },
  avgBlock: {
    alignItems: 'center', paddingVertical: 20,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER,
    marginBottom: 20,
  },
  avgValue: { color: ACCENT, fontSize: 56, fontWeight: '700', letterSpacing: -2, lineHeight: 62 },
  avgLabel: { color: SUBTEXT, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 },
  distBlock: { gap: 10 },
  distRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16,
  },
  distRating: {
    color: SUBTEXT, fontSize: 13, fontWeight: '600',
    width: 24, textAlign: 'right',
  },
  barTrack: {
    flex: 1, flexDirection: 'row',
    height: 6, borderRadius: 3,
    backgroundColor: '#2a2a2a',
    overflow: 'hidden', marginHorizontal: 8,
  },
  barFilled: { height: 6, backgroundColor: ACCENT, borderRadius: 3 },
  distCount: {
    color: TEXT, fontSize: 13, fontWeight: '600',
    width: 28, textAlign: 'right',
  },
});
