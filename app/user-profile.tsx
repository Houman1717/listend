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
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { SongInfoModal, SongInfo } from '@/components/SongInfoModal';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

// ─── Constants ────────────────────────────────────────────────────────────────

const API_URL     = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';
const ACCENT      = '#D4A017';
const AVATAR_SIZE = 80;

const FAV_GAP      = 3;
const FAV_SLOTS    = 5;
const FAV_SLOT_SIZE = Math.floor(
  (Dimensions.get('window').width - 40 - FAV_GAP * (FAV_SLOTS - 1)) / FAV_SLOTS
);

// ─── Types ────────────────────────────────────────────────────────────────────

type ColorsType = typeof Colors.light;

type FavAlbum  = { id: string; title: string; artist: string; artworkUrl: string; year?: number };
type FavSong   = { id: string; title: string; artist: string; artworkUrl: string; releaseDate?: string };
type FavArtist = { id: string; name: string; artworkUrl: string };

type Profile = {
  id: string;
  display_name: string | null;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  top_albums:  FavAlbum[];
  top_songs:   FavSong[];
  top_artists: FavArtist[];
};

// ─── JSONB normalisers ────────────────────────────────────────────────────────

function normaliseTopAlbums(raw: any): FavAlbum[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: any) => ({
    id:         String(item.id         ?? ''),
    title:      String(item.title      ?? ''),
    artist:     String(item.artist     ?? ''),
    artworkUrl: item.artworkUrl || item.artwork_url || '',
  }));
}

function normaliseTopSongs(raw: any): FavSong[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: any) => ({
    id:         String(item.id         ?? ''),
    title:      String(item.title      ?? ''),
    artist:     String(item.artist     ?? ''),
    artworkUrl: item.artworkUrl || item.artwork_url || '',
  }));
}

function normaliseTopArtists(raw: any): FavArtist[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: any) => ({
    id:         String(item.id         ?? ''),
    name:       String(item.name ?? item.title ?? ''),
    artworkUrl: item.artworkUrl || item.artwork_url || '',
  }));
}

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
  const colorScheme = useColorScheme();
  const colors      = Colors[colorScheme ?? 'light'];
  const maxCount    = Math.max(...distribution.map(d => d.count), 1);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={rm.container}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <SafeAreaView style={[rm.sheet, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <View style={[rm.handle, { backgroundColor: colors.border }]} />
          <View style={rm.header}>
            <Text style={[rm.headerTitle, { color: colors.text }]}>Rating Breakdown</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <FontAwesome name="times" size={16} color={colors.subtext} />
            </Pressable>
          </View>
          <View style={[rm.avgBlock, { borderBottomColor: colors.border }]}>
            <Text style={rm.avgValue}>{avgRating}</Text>
            <Text style={[rm.avgLabel, { color: colors.subtext }]}>average rating</Text>
          </View>
          <View style={rm.distBlock}>
            {[...distribution].reverse().map(({ rating, count }) => {
              const filled = count > 0 ? Math.max(count / maxCount, 0.02) : 0;
              const empty  = 1 - filled;
              return (
                <View key={rating} style={rm.distRow}>
                  <Text style={[rm.distRating, { color: colors.subtext }]}>{rating}</Text>
                  <View style={[rm.barTrack, { backgroundColor: colors.border }]}>
                    <View style={[rm.barFilled, {
                      flex: filled,
                      opacity: 0.4 + (count / maxCount) * 0.6,
                    }]} />
                    {empty > 0 && <View style={{ flex: empty }} />}
                  </View>
                  <Text style={[rm.distCount, { color: colors.text }]}>{count}</Text>
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
  onPress,
}: {
  item?: { artworkUrl?: string; title: string };
  circular?: boolean;
  onPress?: () => void;
}) {
  const colorScheme = useColorScheme();
  const colors      = Colors[colorScheme ?? 'light'];
  const radius      = circular ? FAV_SLOT_SIZE / 2 : 3;

  let inner: React.ReactNode;
  if (item?.artworkUrl) {
    inner = (
      <View style={[s.favSlot, { borderRadius: radius, backgroundColor: colors.surface }]}>
        <Image
          source={{ uri: item.artworkUrl }}
          style={{ width: FAV_SLOT_SIZE, height: FAV_SLOT_SIZE, borderRadius: radius }}
          resizeMode="cover"
        />
      </View>
    );
  } else if (item) {
    inner = (
      <View style={[s.favSlot, { borderRadius: radius, backgroundColor: colors.surface }]}>
        <View style={[s.favInitialBg, { borderRadius: radius, backgroundColor: colors.surface }]}>
          <Text style={[s.favInitial, { color: colors.subtext }]}>{item.title.charAt(0)}</Text>
        </View>
      </View>
    );
  } else {
    return <View style={[s.favSlot, { borderRadius: radius, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]} />;
  }

  if (onPress) {
    return (
      <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })} onPress={onPress}>
        {inner}
      </Pressable>
    );
  }
  return <>{inner}</>;
}

// ─── Edit fav slot ────────────────────────────────────────────────────────────

function FavSlotEdit({
  item,
  circular = false,
  onPress,
}: {
  item?: { artworkUrl?: string; title: string };
  circular?: boolean;
  onPress: () => void;
}) {
  const colorScheme = useColorScheme();
  const colors      = Colors[colorScheme ?? 'light'];
  const radius      = circular ? FAV_SLOT_SIZE / 2 : 3;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}>
      {item?.artworkUrl ? (
        <View style={[s.favSlot, { borderRadius: radius, backgroundColor: colors.surface }]}>
          <Image
            source={{ uri: item.artworkUrl }}
            style={{ width: FAV_SLOT_SIZE, height: FAV_SLOT_SIZE, borderRadius: radius }}
            resizeMode="cover"
          />
          <View style={[s.favEditOverlay, { borderRadius: radius }]}>
            <FontAwesome name="pencil" size={10} color="#fff" />
          </View>
        </View>
      ) : item ? (
        <View style={[s.favSlot, { borderRadius: radius, backgroundColor: colors.surface }]}>
          <View style={[s.favInitialBg, { borderRadius: radius, backgroundColor: colors.surface }]}>
            <Text style={[s.favInitial, { color: colors.subtext }]}>{item.title.charAt(0)}</Text>
          </View>
          <View style={[s.favEditOverlay, { borderRadius: radius }]}>
            <FontAwesome name="pencil" size={10} color="#fff" />
          </View>
        </View>
      ) : (
        <View style={[s.favSlot, {
          borderRadius: radius,
          borderWidth: 1.5,
          borderColor: colors.border,
          borderStyle: 'dashed',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'transparent',
        }]}>
          <FontAwesome name="plus" size={14} color={colors.subtext} />
        </View>
      )}
    </Pressable>
  );
}

// ─── Slot picker modal ────────────────────────────────────────────────────────

function SlotPickerModal({
  visible,
  type,
  onSelect,
  onClose,
}: {
  visible: boolean;
  type: 'album' | 'song' | 'artist';
  onSelect: (item: FavAlbum | FavSong | FavArtist) => void;
  onClose: () => void;
}) {
  const colorScheme = useColorScheme();
  const colors      = Colors[colorScheme ?? 'light'];

  const [query,     setQuery]     = useState('');
  const [results,   setResults]   = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!visible) { setQuery(''); setResults([]); }
  }, [visible]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const apiType = type === 'song' ? 'track' : type;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`${API_URL}/search?q=${encodeURIComponent(query.trim())}&type=${apiType}`);
        if (res.ok) setResults(await res.json());
      } catch { } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query, type]);

  function handleSelect(raw: any) {
    let item: FavAlbum | FavSong | FavArtist;
    if (type === 'artist') {
      item = { id: raw.id, name: raw.name ?? raw.title ?? '', artworkUrl: raw.artworkUrl ?? '' };
    } else {
      item = { id: raw.id, title: raw.title ?? '', artist: raw.artist ?? '', artworkUrl: raw.artworkUrl ?? '' };
    }
    onSelect(item);
    onClose();
  }

  const placeholder = type === 'artist' ? 'Search artists…' : type === 'song' ? 'Search songs…' : 'Search albums…';
  const modalTitle  = type === 'artist' ? 'Choose Artist'  : type === 'song' ? 'Choose Song'    : 'Choose Album';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[{ flex: 1 }, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView style={{ flex: 1 }}>

          {/* Header */}
          <View style={[sp.header, { borderBottomColor: colors.border }]}>
            <Pressable onPress={onClose} hitSlop={12}>
              <FontAwesome name="times" size={18} color={colors.subtext} />
            </Pressable>
            <Text style={[sp.title, { color: colors.text }]}>{modalTitle}</Text>
            <View style={{ width: 18 }} />
          </View>

          {/* Search bar */}
          <View style={[sp.searchBar, { backgroundColor: colors.surface }]}>
            <FontAwesome name="search" size={13} color={colors.subtext} />
            <TextInput
              style={[sp.searchInput, { color: colors.text }]}
              value={query}
              onChangeText={setQuery}
              placeholder={placeholder}
              placeholderTextColor={colors.subtext}
              autoFocus
              clearButtonMode="while-editing"
              returnKeyType="search"
            />
          </View>

          {/* Results */}
          {searching ? (
            <ActivityIndicator color={ACCENT} style={{ marginTop: 32 }} />
          ) : (
            <FlatList
              data={results}
              keyExtractor={(_, i) => String(i)}
              contentContainerStyle={{ paddingBottom: 40 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const title    = type === 'artist' ? (item.name ?? '') : (item.title ?? '');
                const sub      = type === 'artist' ? (item.genre ?? '') : (item.artist ?? '');
                const artwork  = item.artworkUrl ?? '';
                const circular = type === 'artist';
                return (
                  <Pressable
                    style={({ pressed }) => [sp.resultRow, { opacity: pressed ? 0.6 : 1 }]}
                    onPress={() => handleSelect(item)}>
                    {artwork ? (
                      <Image
                        source={{ uri: artwork }}
                        style={[sp.resultArt, circular && { borderRadius: 22 }, { backgroundColor: colors.surface }]}
                      />
                    ) : (
                      <View style={[sp.resultArt, { backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' }, circular && { borderRadius: 22 }]}>
                        <Text style={{ color: colors.subtext, fontSize: 14 }}>{title.charAt(0)}</Text>
                      </View>
                    )}
                    <View style={sp.resultText}>
                      <Text style={[sp.resultTitle, { color: colors.text }]} numberOfLines={1}>{title}</Text>
                      {sub ? <Text style={[sp.resultSub, { color: colors.subtext }]} numberOfLines={1}>{sub}</Text> : null}
                    </View>
                  </Pressable>
                );
              }}
            />
          )}

        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Nav row ──────────────────────────────────────────────────────────────────

function NavRow({
  icon,
  label,
  sub,
  onPress,
  colors,
}: {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  label: string;
  sub: string;
  onPress: () => void;
  colors: ColorsType;
}) {
  return (
    <Pressable
      style={({ pressed }) => [s.navRow, { opacity: pressed ? 0.6 : 1 }]}
      onPress={onPress}>
      <View style={s.navIconWrap}>
        <FontAwesome name={icon} size={16} color={ACCENT} />
      </View>
      <View style={s.navRowText}>
        <Text style={[s.navLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[s.navSub, { color: colors.subtext }]}>{sub}</Text>
      </View>
      <FontAwesome name="chevron-right" size={13} color={colors.subtext} />
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function UserProfileScreen() {
  const colorScheme = useColorScheme();
  const colors      = Colors[colorScheme ?? 'light'];

  const { userId }     = useLocalSearchParams<{ userId: string }>();
  const viewedUserId   = userId;
  const { user }       = useAuth();
  const navigation     = useNavigation();
  const router         = useRouter();

  const isOwnProfile = !!user?.id && user.id === viewedUserId;

  const [profile,        setProfile]        = useState<Profile | null>(null);
  const [loading,        setLoading]        = useState(true);

  const [top5EditMode,    setTop5EditMode]    = useState(false);
  const [isSaving,        setIsSaving]        = useState(false);
  const [draftTopAlbums,  setDraftTopAlbums]  = useState<FavAlbum[]>([]);
  const [draftTopSongs,   setDraftTopSongs]   = useState<FavSong[]>([]);
  const [draftTopArtists, setDraftTopArtists] = useState<FavArtist[]>([]);
  const [slotPicker, setSlotPicker] = useState<{ type: 'album' | 'song' | 'artist'; index: number } | null>(null);
  const [activeSong, setActiveSong] = useState<SongInfo | null>(null);

  const [isFollowing,    setIsFollowing]    = useState(false);
  const [isMutual,       setIsMutual]       = useState(false);
  const [followLoading,  setFollowLoading]  = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  const [albumCount,    setAlbumCount]    = useState(0);
  const [thisYearCount, setThisYearCount] = useState(0);
  const [avgRating,     setAvgRating]     = useState('—');
  const [ratingDist,    setRatingDist]    = useState<RatingDist[]>([]);
  const [reviewCount,   setReviewCount]   = useState(0);
  const [wantCount,     setWantCount]     = useState(0);
  const [ratingModalVisible, setRatingModalVisible] = useState(false);

  // ── Load all data ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    const currentUserId = user?.id ?? null;

    async function load() {
      setLoading(true);
      try {
        const { data: prof, error: profErr } = await supabase
          .from('profiles')
          .select('id, display_name, username, bio, avatar_url')
          .eq('id', viewedUserId)
          .single();

        if (profErr) console.error('[UserProfile] profile fetch error:', profErr);
        if (prof) {
          const { data: favData } = await supabase
            .from('profiles')
            .select('top_albums, top_songs, top_artists')
            .eq('id', viewedUserId)
            .single();

          setProfile({
            ...prof,
            top_albums:  normaliseTopAlbums(favData?.top_albums),
            top_songs:   normaliseTopSongs(favData?.top_songs),
            top_artists: normaliseTopArtists(favData?.top_artists),
          });
          navigation.setOptions({
            title: prof.display_name || prof.username || 'Profile',
          });
        }

        const [{ count: followers }, { count: following }] =
          await Promise.all([
            supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', viewedUserId),
            supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', viewedUserId),
          ]);
        setFollowersCount(followers ?? 0);
        setFollowingCount(following ?? 0);

        if (currentUserId) {
          const { data: outgoing, error: outErr } = await supabase
            .from('follows')
            .select('id')
            .match({ follower_id: currentUserId, following_id: viewedUserId })
            .single();
          const currentFollowsViewed = !!outgoing && !outErr;
          setIsFollowing(currentFollowsViewed);

          const { data: incoming, error: inErr } = await supabase
            .from('follows')
            .select('id')
            .match({ follower_id: viewedUserId, following_id: currentUserId })
            .single();
          const viewedFollowsCurrent = !!incoming && !inErr;
          setIsMutual(currentFollowsViewed && viewedFollowsCurrent);
        }

        const { data: userAlbums } = await supabase
          .from('user_albums')
          .select('spotify_id, title, artist, artwork_url, rating, review, year, listened_at')
          .eq('user_id', viewedUserId)
          .order('listened_at', { ascending: false });

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
        }

        const { count: want } = await supabase
          .from('want_to_listen')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', viewedUserId);
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
    if (!currentUserId || !viewedUserId || followLoading) return;
    setFollowLoading(true);

    if (isFollowing) {
      const { error } = await supabase
        .from('follows')
        .delete()
        .match({ follower_id: currentUserId, following_id: viewedUserId });
      if (!error) {
        setIsFollowing(false);
        setIsMutual(false);
        setFollowersCount(n => Math.max(0, n - 1));
      } else {
        console.error('[UserProfile] unfollow error:', error);
      }
    } else {
      const { error } = await supabase
        .from('follows')
        .insert({ follower_id: currentUserId, following_id: viewedUserId });
      if (!error) {
        setIsFollowing(true);
        setFollowersCount(n => n + 1);
        supabase.from('notifications').insert({
          user_id:  viewedUserId,
          type:     'follow',
          actor_id: currentUserId,
        }).then(({ error: notifErr }) => {
          if (notifErr) console.error('[UserProfile] notification insert error:', notifErr.message);
        });
        const { data: incoming } = await supabase
          .from('follows')
          .select('id')
          .match({ follower_id: viewedUserId, following_id: currentUserId })
          .single();
        setIsMutual(!!incoming);
      } else {
        console.error('[UserProfile] follow insert error:', error);
      }
    }

    setFollowLoading(false);
  }

  // ── Top 5 edit ───────────────────────────────────────────────────────────────
  function handleEnterEditMode() {
    if (!profile) return;
    setDraftTopAlbums([...profile.top_albums]);
    setDraftTopSongs([...profile.top_songs]);
    setDraftTopArtists([...profile.top_artists]);
    setTop5EditMode(true);
  }

  async function handleSaveTop5() {
    if (!user?.id || !profile) return;
    setIsSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        top_albums:  draftTopAlbums,
        top_songs:   draftTopSongs,
        top_artists: draftTopArtists,
      })
      .eq('id', user.id);
    if (!error) {
      setProfile({ ...profile, top_albums: draftTopAlbums, top_songs: draftTopSongs, top_artists: draftTopArtists });
    } else {
      console.error('[UserProfile] top5 save error:', error.message);
    }
    setIsSaving(false);
    setTop5EditMode(false);
  }

  function handleSlotSelect(item: FavAlbum | FavSong | FavArtist) {
    if (!slotPicker) return;
    const { type, index } = slotPicker;
    if (type === 'album') {
      setDraftTopAlbums(prev => { const n = [...prev]; n[index] = item as FavAlbum; return n; });
    } else if (type === 'song') {
      setDraftTopSongs(prev => { const n = [...prev]; n[index] = item as FavSong; return n; });
    } else {
      setDraftTopArtists(prev => { const n = [...prev]; n[index] = item as FavArtist; return n; });
    }
  }

  // ── Loading / not found ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={ACCENT} size="large" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[s.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.subtext, fontSize: 15 }}>User not found.</Text>
      </View>
    );
  }

  const name    = profile.display_name || profile.username || '';
  const initial = name.charAt(0).toUpperCase() || '?';

  return (
    <>
    <SongInfoModal
      song={activeSong}
      onClose={() => setActiveSong(null)}
      onArtistPress={(name) => router.push({ pathname: '/artist-detail', params: { name } })}
      onAlbumPress={(p) => router.push({ pathname: '/album-detail', params: p } as any)}
    />
    <ScrollView
      style={[s.container, { backgroundColor: colors.background }]}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}>

      {/* ── Profile body ───────────────────────────────────────────────────── */}
      <View style={[s.profileBody, s.profileBodyNoCover, { borderBottomColor: colors.border }]}>

        {/* Avatar */}
        <View style={[
          s.avatarWrap,
          s.avatarWrapNoCover,
          { borderColor: colors.border, backgroundColor: colors.border },
        ]}>
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={s.avatarImg} resizeMode="cover" />
          ) : (
            <View style={[s.avatarFallback, { backgroundColor: colors.border }]}>
              <Text style={[s.avatarInitial, { color: colors.subtext }]}>{initial}</Text>
            </View>
          )}
        </View>

        {/* Name */}
        <Text style={[s.name, { color: colors.text }]}>{name}</Text>

        {/* Username */}
        {profile.username ? <Text style={[s.username, { color: colors.subtext }]}>@{profile.username}</Text> : null}

        {/* Bio */}
        {profile.bio ? <Text style={[s.bio, { color: colors.subtext }]}>{profile.bio}</Text> : null}

        {/* Following / Followers */}
        <View style={s.socialRow}>
          <Pressable
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            onPress={() => router.push({ pathname: '/followers-following', params: { userId: viewedUserId, type: 'following' } })}>
            <Text style={[s.socialCount, { color: colors.text }]}>{followingCount}</Text>
          </Pressable>
          <Text style={[s.socialLabel, { color: colors.subtext }]}> Following</Text>
          <Text style={[s.socialDot, { color: colors.subtext }]}> · </Text>
          <Pressable
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            onPress={() => router.push({ pathname: '/followers-following', params: { userId: viewedUserId, type: 'followers' } })}>
            <Text style={[s.socialCount, { color: colors.text }]}>{followersCount}</Text>
          </Pressable>
          <Text style={[s.socialLabel, { color: colors.subtext }]}> Followers</Text>
        </View>

        {/* Follow + Message buttons */}
        <View style={s.actionRow}>
          <Pressable
            style={({ pressed }) => [
              s.followBtn,
              isFollowing && { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: ACCENT },
              isMutual && s.followBtnMutual,
              { opacity: pressed || followLoading ? 0.7 : 1 },
            ]}
            onPress={handleFollow}
            disabled={followLoading}>
            <Text style={[s.followBtnText, isFollowing && { color: ACCENT }]}>
              {isFollowing ? 'Following' : 'Follow'}
            </Text>
          </Pressable>

          {isMutual && (
            <Pressable
              style={({ pressed }) => [s.messageBtn, { borderColor: ACCENT, opacity: pressed ? 0.7 : 1 }]}
              onPress={() => router.push({ pathname: '/dm-conversation', params: { userId: viewedUserId } })}>
              <Text style={[s.messageBtnText, { color: ACCENT }]}>Message</Text>
            </Pressable>
          )}
        </View>

        {/* Stats */}
        <View style={[s.statsRow, { backgroundColor: colors.surface }]}>
          <Pressable
            style={({ pressed }) => [s.statBox, { opacity: pressed ? 0.7 : 1 }]}
            onPress={() => router.push({ pathname: '/my-listend', params: { userId: viewedUserId } })}>
            <Text style={[s.statValue, { color: colors.text }]}>{albumCount}</Text>
            <Text style={[s.statLabel, { color: colors.subtext }]}>Albums</Text>
          </Pressable>
          <View style={[s.statDivider, { backgroundColor: colors.border }]} />
          <Pressable
            style={({ pressed }) => [s.statBox, { opacity: pressed ? 0.7 : 1 }]}
            onPress={() => router.push({ pathname: '/sessions', params: { userId: viewedUserId } })}>
            <Text style={[s.statValue, { color: colors.text }]}>{thisYearCount}</Text>
            <Text style={[s.statLabel, { color: colors.subtext }]}>This Year</Text>
          </Pressable>
          <View style={[s.statDivider, { backgroundColor: colors.border }]} />
          <Pressable
            style={({ pressed }) => [s.statBox, { opacity: pressed ? 0.7 : 1 }]}
            onPress={() => setRatingModalVisible(true)}>
            <Text style={[s.statValue, { color: colors.text }]}>{avgRating}</Text>
            <Text style={[s.statLabel, { color: colors.subtext }]}>Avg Rating</Text>
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
          <Text style={[s.sectionTitle, { color: colors.textMuted }]}>TOP 5 ALBUMS</Text>
          {isOwnProfile && (
            top5EditMode ? (
              <Pressable
                onPress={handleSaveTop5}
                disabled={isSaving}
                style={({ pressed }) => ({ opacity: pressed || isSaving ? 0.6 : 1 })}>
                {isSaving
                  ? <ActivityIndicator size="small" color={ACCENT} />
                  : <Text style={[s.editBtn, { color: ACCENT }]}>Done</Text>}
              </Pressable>
            ) : (
              <Pressable onPress={handleEnterEditMode} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
                <Text style={[s.editBtn, { color: ACCENT }]}>Edit</Text>
              </Pressable>
            )
          )}
        </View>
        <View style={s.favRow}>
          {Array.from({ length: 5 }).map((_, i) => {
            const a = top5EditMode ? draftTopAlbums[i] : profile.top_albums[i];
            if (top5EditMode) {
              return (
                <FavSlotEdit
                  key={i}
                  item={a ? { artworkUrl: a.artworkUrl, title: a.title } : undefined}
                  onPress={() => setSlotPicker({ type: 'album', index: i })}
                />
              );
            }
            return (
              <FavSlotReadOnly
                key={i}
                item={a ? { artworkUrl: a.artworkUrl, title: a.title } : undefined}
                onPress={a ? () => router.push({ pathname: '/album-detail', params: { id: a.id, title: a.title, artist: a.artist, year: String(a.year ?? ''), artworkUrl: a.artworkUrl } }) : undefined}
              />
            );
          })}
        </View>
      </View>

      <View style={[s.rule, { backgroundColor: colors.border }]} />

      {/* ── Top 5 Songs ────────────────────────────────────────────────────── */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={[s.sectionTitle, { color: colors.textMuted }]}>TOP 5 SONGS</Text>
        </View>
        <View style={s.favRow}>
          {Array.from({ length: 5 }).map((_, i) => {
            const sg = top5EditMode ? draftTopSongs[i] : profile.top_songs[i];
            if (top5EditMode) {
              return (
                <FavSlotEdit
                  key={i}
                  item={sg ? { artworkUrl: sg.artworkUrl, title: sg.title } : undefined}
                  onPress={() => setSlotPicker({ type: 'song', index: i })}
                />
              );
            }
            return (
              <FavSlotReadOnly
                key={i}
                item={sg ? { artworkUrl: sg.artworkUrl, title: sg.title } : undefined}
                onPress={sg ? () => setActiveSong({ id: sg.id, title: sg.title, artist: sg.artist, artworkUrl: sg.artworkUrl, releaseDate: sg.releaseDate }) : undefined}
              />
            );
          })}
        </View>
      </View>

      <View style={[s.rule, { backgroundColor: colors.border }]} />

      {/* ── Top 5 Artists ──────────────────────────────────────────────────── */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={[s.sectionTitle, { color: colors.textMuted }]}>TOP 5 ARTISTS</Text>
        </View>
        <View style={s.favRow}>
          {Array.from({ length: 5 }).map((_, i) => {
            const ar = top5EditMode ? draftTopArtists[i] : profile.top_artists[i];
            if (top5EditMode) {
              return (
                <FavSlotEdit
                  key={i}
                  item={ar ? { artworkUrl: ar.artworkUrl, title: ar.name } : undefined}
                  circular
                  onPress={() => setSlotPicker({ type: 'artist', index: i })}
                />
              );
            }
            return (
              <FavSlotReadOnly
                key={i}
                item={ar ? { artworkUrl: ar.artworkUrl, title: ar.name } : undefined}
                circular
                onPress={ar ? () => router.push({ pathname: '/artist-detail', params: { id: ar.id, name: ar.name, artworkUrl: ar.artworkUrl } }) : undefined}
              />
            );
          })}
        </View>
      </View>

      {/* ── Nav rows ──────────────────────────────────────────────────────── */}
      <View style={[s.navGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <NavRow icon="music"      label="Listend"        sub={`${albumCount} albums`}        onPress={() => router.push({ pathname: '/my-listend',      params: { userId: viewedUserId } })} colors={colors} />
        <View style={[s.navSeparator, { backgroundColor: colors.border }]} />
        <NavRow icon="calendar"   label="Sessions"       sub="Listening diary"               onPress={() => router.push({ pathname: '/sessions',         params: { userId: viewedUserId } })} colors={colors} />
        <View style={[s.navSeparator, { backgroundColor: colors.border }]} />
        <NavRow icon="bookmark-o" label="Want to Listen" sub={`${wantCount} saved`}          onPress={() => router.push({ pathname: '/want-to-listen',   params: { userId: viewedUserId } })} colors={colors} />
        <View style={[s.navSeparator, { backgroundColor: colors.border }]} />
        <NavRow icon="clock-o"    label="Recent Activity" sub={`${albumCount} logged albums`} onPress={() => router.push({ pathname: '/recent-activity', params: { userId: viewedUserId } })} colors={colors} />
        <View style={[s.navSeparator, { backgroundColor: colors.border }]} />
        <NavRow icon="pencil"     label="Reviews"        sub={`${reviewCount} reviews`}      onPress={() => router.push({ pathname: '/my-reviews',       params: { userId: viewedUserId } })} colors={colors} />
        <View style={[s.navSeparator, { backgroundColor: colors.border }]} />
        <NavRow icon="list"       label="Playlists"      sub="Album lists"                   onPress={() => router.push({ pathname: '/my-playlists',     params: { userId: viewedUserId } })} colors={colors} />
        <View style={[s.navSeparator, { backgroundColor: colors.border }]} />
        <NavRow icon="heart"      label="Liked Artists"  sub="Their favourites"              onPress={() => router.push({ pathname: '/liked-artists',    params: { readOnly: '1', userId: viewedUserId } })} colors={colors} />
        <View style={[s.navSeparator, { backgroundColor: colors.border }]} />
        <NavRow icon="bar-chart"  label="Stats"          sub="Listening insights"            onPress={() => router.push({ pathname: '/my-stats',         params: { userId: viewedUserId } })} colors={colors} />
      </View>

      <SlotPickerModal
        visible={slotPicker !== null}
        type={slotPicker?.type ?? 'album'}
        onSelect={handleSlotSelect}
        onClose={() => setSlotPicker(null)}
      />

    </ScrollView>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1 },
  content:   { paddingBottom: 48 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Cover
  cover:    { width: '100%', aspectRatio: 16 / 9, overflow: 'hidden' },
  coverImg: { width: '100%', height: '100%' },

  // Profile body
  profileBody: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
  },
  avatarWrapNoCover: { marginTop: 0 },
  avatarImg:     { width: '100%', height: '100%' },
  avatarFallback:{ flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 28, fontWeight: '700' },

  // Text
  name:     { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  username: { fontSize: 14, marginTop: 2, textAlign: 'center' },
  bio:      { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 10, maxWidth: 320 },

  // Social counts
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  socialCount: { fontSize: 13, fontWeight: '700' },
  socialLabel: { fontSize: 13 },
  socialDot:   { fontSize: 13 },

  // Follow + Message button row
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    marginBottom: 16,
  },

  // Follow button
  followBtn: {
    backgroundColor: ACCENT,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 32,
  },
  followBtnMutual: { paddingHorizontal: 20 },
  followBtnText:   { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Message button
  messageBtn: {
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  messageBtnText: { fontSize: 14, fontWeight: '700' },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    width: '100%',
    marginTop: 4,
  },
  statBox:     { flex: 1, alignItems: 'center', gap: 3 },
  statValue:   { fontSize: 20, fontWeight: '700' },
  statLabel:   { fontSize: 11, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.8 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 32 },

  // Sections (Top 5)
  section: { paddingHorizontal: 20, paddingVertical: 18 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },
  rule:         { height: StyleSheet.hairlineWidth, marginHorizontal: 20 },

  // Fav slots (layout only — colors applied inline)
  favRow: { flexDirection: 'row', gap: FAV_GAP },
  favSlot: {
    width: FAV_SLOT_SIZE,
    height: FAV_SLOT_SIZE,
    overflow: 'hidden',
  },
  favEditOverlay: {
    position: 'absolute',
    bottom: 0, right: 0,
    width: 20, height: 20,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderTopLeftRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBtn: { fontSize: 13, fontWeight: '600' },
  favInitialBg: {
    width: FAV_SLOT_SIZE,
    height: FAV_SLOT_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  favInitial: { fontSize: 16, fontWeight: '700' },

  // Nav rows
  navGroup: {
    marginTop: 24,
    marginHorizontal: 20,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  navIconWrap:  { width: 28, alignItems: 'center' },
  navRowText:   { flex: 1, gap: 2 },
  navLabel:     { fontSize: 16, fontWeight: '600' },
  navSub:       { fontSize: 13 },
  navSeparator: { height: StyleSheet.hairlineWidth, marginLeft: 58 },
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
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16, paddingBottom: 32,
    overflow: 'hidden',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10, marginBottom: 4,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: 16,
  },
  headerTitle: {
    position: 'absolute', left: 0, right: 0,
    fontSize: 17, fontWeight: '700', letterSpacing: -0.2,
    textAlign: 'center',
  },
  avgBlock: {
    alignItems: 'center', paddingVertical: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 20,
  },
  avgValue: { color: ACCENT, fontSize: 56, fontWeight: '700', letterSpacing: -2, lineHeight: 62 },
  avgLabel: { fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 },
  distBlock: { gap: 10 },
  distRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  distRating:{ fontSize: 13, fontWeight: '600', width: 24, textAlign: 'right' },
  barTrack:  { flex: 1, flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', marginHorizontal: 8 },
  barFilled: { height: 6, backgroundColor: ACCENT, borderRadius: 3 },
  distCount: { fontSize: 13, fontWeight: '600', width: 28, textAlign: 'right' },
});

// ─── Slot picker modal styles ─────────────────────────────────────────────────

const sp = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 17, fontWeight: '700' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    margin: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  searchInput: { flex: 1, fontSize: 15 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  resultArt:   { width: 44, height: 44, borderRadius: 4 },
  resultText:  { flex: 1, gap: 3 },
  resultTitle: { fontSize: 15, fontWeight: '600' },
  resultSub:   { fontSize: 13 },
});
