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
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS, SharedValue } from 'react-native-reanimated';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useNavigation, useFocusEffect } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { ColorsShape } from '@/constants/Colors';
import { useAlbums, TopAlbum, TopSong, TopArtist } from '@/context/AlbumsContext';
import { useAuth } from '@/context/AuthContext';
import { useTheme, ThemePreference } from '@/context/ThemeContext';
import { useNotifications } from '@/context/NotificationsContext';
import { useLikedArtists } from '@/context/LikedArtistsContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { SongInfoModal, SongInfo } from '@/components/SongInfoModal';
import { usePro } from '@/context/ProContext';
import { ProBadge } from '@/components/ProBadge';
import { getProTheme, themeToColors } from '@/lib/proThemes';

const DARK_BG   = '#0F0A07';
const CARD_BG   = '#2E2018';
const BORDER    = '#2a1e14';
const TEXT      = '#f5e6c8';
const SUBTEXT   = '#A08060';
const ACCENT    = '#D4A017';

// COVER_H removed — cover now uses aspectRatio: 16/9
const AVATAR_SIZE = 80;

// ─── Rating distribution modal ────────────────────────────────────────────────

function RatingModal({
  visible,
  onClose,
  avgRating,
  distribution,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  avgRating: string;
  distribution: { rating: number; count: number }[];
  colors: ReturnType<typeof themeToColors>;
}) {
  const maxCount = Math.max(...distribution.map(d => d.count), 1);
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
            <Text style={[rm.avgValue, { color: colors.tint }]}>{avgRating}</Text>
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
                      backgroundColor: colors.tint,
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

// ─── Profile header ───────────────────────────────────────────────────────────

function ProfileHeader({
  displayName,
  username,
  avatarUrl,
  bio,
  isOwnProfile,
  currentUserId,
  profileUserId,
  albumCount,
  thisYearCount,
  avgRating,
  onPressAlbums,
  onPressThisYear,
  onPressAvgRating,
  isDark,
  colors,
  isPro,
}: {
  displayName: string;
  username: string;
  avatarUrl: string | null;
  bio: string;
  isOwnProfile: boolean;
  currentUserId: string;
  profileUserId: string;
  albumCount: number;
  thisYearCount: number;
  avgRating: string;
  onPressAlbums: () => void;
  onPressThisYear: () => void;
  onPressAvgRating: () => void;
  isDark: boolean;
  colors: ColorsShape;
  isPro?: boolean;
}) {
  const router  = useRouter();
  const initial = (displayName || username || '?').charAt(0).toUpperCase();
  const [isFollowing,    setIsFollowing]    = useState(false);
  const [followLoading,  setFollowLoading]  = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // Fetch follow counts + current follow state on mount / profile change
  useEffect(() => {
    if (!profileUserId) return;

    // Followers: rows where following_id = this profile
    supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', profileUserId)
      .then(({ count }) => setFollowersCount(count ?? 0));

    // Following: rows where follower_id = this profile
    supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', profileUserId)
      .then(({ count }) => setFollowingCount(count ?? 0));

    // Current user's follow state (only relevant on other profiles)
    if (!isOwnProfile && currentUserId) {
      supabase
        .from('follows')
        .select('follower_id')
        .eq('follower_id', currentUserId)
        .eq('following_id', profileUserId)
        .maybeSingle()
        .then(({ data }) => setIsFollowing(!!data));
    }
  }, [isOwnProfile, currentUserId, profileUserId]);

  async function handleFollow() {
    if (!currentUserId || !profileUserId || followLoading) return;
    setFollowLoading(true);
    if (isFollowing) {
      await supabase
        .from('follows')
        .delete()
        .eq('follower_id', currentUserId)
        .eq('following_id', profileUserId);
      setIsFollowing(false);
      setFollowersCount((n) => Math.max(0, n - 1));
    } else {
      await supabase
        .from('follows')
        .insert({ follower_id: currentUserId, following_id: profileUserId });
      setIsFollowing(true);
      setFollowersCount((n) => n + 1);
    }
    setFollowLoading(false);
  }

  return (
    <View style={[ph.outer, { borderBottomColor: colors.border }]}>

      {/* ── Body (avatar + text + buttons) ───────────────────────────────── */}
      <View style={[ph.body, ph.bodyNoCover]}>

        <View style={[ph.avatarWrap, ph.avatarWrapNoCover]}>
          {avatarUrl
            ? <ExpoImage source={{ uri: avatarUrl }} style={ph.avatarImg} contentFit="cover" cachePolicy="disk" />
            : <View style={ph.avatarFallback}>
                <Text style={ph.avatarInitial}>{initial}</Text>
              </View>
          }
        </View>

        {/* Name + Pro badge */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[ph.name, { color: colors.text }]}>{displayName || username || ''}</Text>
          {isPro && <ProBadge />}
        </View>

        {/* Username */}
        {username ? <Text style={[ph.username, { color: colors.subtext }]}>@{username}</Text> : null}

        {/* Bio */}
        {bio ? <Text style={[ph.bio, { color: colors.subtext }]}>{bio}</Text> : null}

        {/* Following / Followers */}
        <View style={ph.socialRow}>
          <Pressable
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, flexDirection: 'row', alignItems: 'center' })}
            onPress={() => router.push({ pathname: '/followers-following', params: { userId: profileUserId, type: 'following' } })}>
            <Text style={[ph.socialCount, { color: colors.text }]}>{followingCount}</Text>
            <Text style={[ph.socialLabel, { color: colors.subtext }]}> Following</Text>
          </Pressable>
          <Text style={[ph.socialDot, { color: colors.subtext }]}> · </Text>
          <Pressable
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, flexDirection: 'row', alignItems: 'center' })}
            onPress={() => router.push({ pathname: '/followers-following', params: { userId: profileUserId, type: 'followers' } })}>
            <Text style={[ph.socialCount, { color: colors.text }]}>{followersCount}</Text>
            <Text style={[ph.socialLabel, { color: colors.subtext }]}> Followers</Text>
          </Pressable>
        </View>

        {/* Follow button — only shown when viewing another user's profile */}
        {!isOwnProfile && (
          <Pressable
            style={({ pressed }) => [
              ph.followBtn,
              isFollowing && ph.followBtnActive,
              { opacity: pressed || followLoading ? 0.7 : 1 },
            ]}
            onPress={handleFollow}
            disabled={followLoading}>
            <Text style={[ph.followBtnText, isFollowing && ph.followBtnTextActive]}>
              {isFollowing ? 'Following' : 'Follow'}
            </Text>
          </Pressable>
        )}

        {/* Stats row */}
        <View style={[
          ph.statsRow,
          { backgroundColor: colors.card },
          !isDark && { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
        ]}>
          <Pressable
            style={({ pressed }) => [ph.statBox, { opacity: pressed ? 0.7 : 1 }]}
            onPress={onPressAlbums}>
            <Text style={[ph.statValue, { color: colors.text }]}>{albumCount}</Text>
            <Text style={[ph.statLabel, { color: colors.textMuted }]}>Albums</Text>
          </Pressable>
          <View style={[ph.statDivider, { backgroundColor: colors.border }]} />
          <Pressable
            style={({ pressed }) => [ph.statBox, { opacity: pressed ? 0.7 : 1 }]}
            onPress={onPressThisYear}>
            <Text style={[ph.statValue, { color: colors.text }]}>{thisYearCount}</Text>
            <Text style={[ph.statLabel, { color: colors.textMuted }]}>This Year</Text>
          </Pressable>
          <View style={[ph.statDivider, { backgroundColor: colors.border }]} />
          <Pressable
            style={({ pressed }) => [ph.statBox, { opacity: pressed ? 0.7 : 1 }]}
            onPress={onPressAvgRating}>
            <Text style={[ph.statValue, { color: colors.text }]}>{avgRating}</Text>
            <Text style={[ph.statLabel, { color: colors.textMuted }]}>Avg Rating</Text>
          </Pressable>
        </View>

      </View>
    </View>
  );
}

const ph = StyleSheet.create({
  outer: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },

  // ── Cover ───────────────────────────────────────────────────────────────────
  cover: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#0F0A07',
    overflow: 'hidden',
  },
  coverImg: { width: '100%', height: '100%' },

  // ── Body ────────────────────────────────────────────────────────────────────
  body: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  bodyNoCover: {
    paddingTop: 24,
  },

  // ── Avatar ──────────────────────────────────────────────────────────────────
  avatarWrap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    overflow: 'hidden',
    marginTop: -(AVATAR_SIZE / 2),  // pulls avatar up so it straddles the cover edge
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#3a2818',
    backgroundColor: '#2a1e14',
  },
  avatarWrapNoCover: {
    marginTop: 0,  // no cover to straddle — sit flush at the top of body
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarFallback: {
    flex: 1,
    backgroundColor: '#2a1e14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: ACCENT, fontSize: 36, fontWeight: '700' },

  // ── Text ────────────────────────────────────────────────────────────────────
  name: {
    color: TEXT,
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  username: {
    color: SUBTEXT,
    fontSize: 14,
    marginTop: 3,
    marginBottom: 6,
  },
  bio: {
    color: SUBTEXT,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 10,
    paddingHorizontal: 12,
  },

  // ── Social row ───────────────────────────────────────────────────────────────
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  socialCount: { color: TEXT,    fontSize: 13, fontWeight: '700' },
  socialLabel: { color: SUBTEXT, fontSize: 13 },
  socialDot:   { color: SUBTEXT, fontSize: 13 },

  // ── Follow button ────────────────────────────────────────────────────────────
  followBtn: {
    backgroundColor: ACCENT,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 32,
    marginBottom: 16,
  },
  followBtnActive: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: ACCENT,
  },
  followBtnText:       { color: '#fff',  fontSize: 14, fontWeight: '700' },
  followBtnTextActive: { color: ACCENT },

  // ── Stats ────────────────────────────────────────────────────────────────────
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
  statBox: { flex: 1, alignItems: 'center', gap: 3 },
  statValue: { color: TEXT,    fontSize: 20, fontWeight: '700' },
  statLabel: { color: SUBTEXT, fontSize: 11, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.8 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 32, backgroundColor: BORDER },
});

const FAV_GAP = 3;
const FAV_SLOTS = 5;
const FAV_SLOT_SIZE = Math.floor(
  (Dimensions.get('window').width - 40 - FAV_GAP * (FAV_SLOTS - 1)) / FAV_SLOTS
);
const SLOT_STEP = FAV_SLOT_SIZE + FAV_GAP;

// ─── Favourite slot ───────────────────────────────────────────────────────────

function FavSlot({
  item,
  editMode = false,
  onPress,
  onRemove,
  circular = false,
}: {
  item?: { artworkUrl?: string; title: string } | null;
  editMode?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
  circular?: boolean;
}) {
  const radius = circular ? FAV_SLOT_SIZE / 2 : 3;

  if (!item) {
    if (editMode) {
      return (
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [s.favSlot, s.favEmptyEdit, { borderRadius: radius, opacity: pressed ? 0.7 : 1 }]}>
          <FontAwesome name="plus" size={16} color={ACCENT} />
        </Pressable>
      );
    }
    return <View style={[s.favSlot, s.favEmpty, { borderRadius: radius }]} />;
  }

  return (
    <View style={[s.favSlot, { borderRadius: radius, overflow: 'hidden' }]}>
      <Pressable
        onPress={editMode ? undefined : onPress}
        disabled={editMode}
        style={({ pressed }) => [{ borderRadius: radius, overflow: 'hidden' }, !editMode && pressed && { opacity: 0.7 }]}>
        {item.artworkUrl ? (
          <ExpoImage
            source={{ uri: item.artworkUrl }}
            style={{ width: FAV_SLOT_SIZE, height: FAV_SLOT_SIZE, borderRadius: radius }}
            contentFit="cover"
            cachePolicy="disk"
          />
        ) : (
          <View style={[s.favInitialBg, { width: FAV_SLOT_SIZE, height: FAV_SLOT_SIZE, borderRadius: radius }]}>
            <Text style={s.favInitial}>{item.title.charAt(0)}</Text>
          </View>
        )}
      </Pressable>
      {editMode && (
        <Pressable
          onPress={onRemove}
          hitSlop={8}
          style={s.favRemoveBtn}>
          <FontAwesome name="times" size={9} color="#fff" />
        </Pressable>
      )}
    </View>
  );
}

// ─── Draggable Top-5 row ─────────────────────────────────────────────────────

type FavItem = { artworkUrl?: string; title: string } | null;

// Per-slot component so useAnimatedStyle is called at the top level of a component (not inside .map())
function DraggableSlot({
  index,
  item,
  editMode,
  circular,
  draggingIdx,
  hoverIdx,
  dragX,
  dragY,
  onDragStart,
  onDragMove,
  onDragEnd,
  onSlotPress,
  onRemove,
}: {
  index: number;
  item: FavItem;
  editMode: boolean;
  circular: boolean;
  draggingIdx: number;   // -1 = none
  hoverIdx: number;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  onDragStart: (idx: number) => void;
  onDragMove:  (x: number)   => void;
  onDragEnd:   (x: number)   => void;
  onSlotPress: () => void;
  onRemove:    () => void;
}) {
  const isDragging = draggingIdx === index;
  const isHover    = hoverIdx === index && draggingIdx !== -1 && !isDragging;

  const animStyle = useAnimatedStyle(() => {
    if (isDragging) {
      return {
        transform: [
          { translateX: dragX.value },
          { translateY: dragY.value },
          { scale: withSpring(1.1) },
        ],
        zIndex: 10,
        elevation: 8,
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
      };
    }
    return { opacity: withSpring(isHover ? 0.35 : 1), zIndex: 0 };
  });

  const canDrag = editMode && !!item;

  const longPress = Gesture.LongPress()
    .minDuration(280)
    .runOnJS(true)
    .onStart(() => { if (canDrag) onDragStart(index); });

  const pan = Gesture.Pan()
    .runOnJS(true)
    .onUpdate(e => {
      if (draggingIdx !== index) return;
      dragX.value = e.translationX;
      dragY.value = e.translationY;
      onDragMove(e.translationX);
    })
    .onEnd(e => {
      if (draggingIdx !== index) return;
      onDragEnd(e.translationX);
    });

  const gesture = Gesture.Simultaneous(longPress, pan);

  const slot = (
    <FavSlot
      item={item}
      editMode={editMode}
      onPress={onSlotPress}
      onRemove={onRemove}
      circular={circular}
    />
  );

  if (!canDrag) return slot;

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={animStyle}>{slot}</Animated.View>
    </GestureDetector>
  );
}

function DraggableFavRow({
  items,
  editMode,
  circular = false,
  onReorder,
  onRemove,
  onSlotPress,
}: {
  items: FavItem[];
  editMode: boolean;
  circular?: boolean;
  onReorder: (from: number, to: number) => void;
  onRemove:    (index: number) => void;
  onSlotPress: (index: number) => void;
}) {
  const [order, setOrder]             = useState<FavItem[]>(items);
  const [draggingIdx, setDraggingIdx] = useState(-1);
  const [hoverIdx,    setHoverIdx]    = useState(-1);
  const dragX     = useSharedValue(0);
  const dragY     = useSharedValue(0);
  const startSlot = useRef(0);

  useEffect(() => { setOrder(items); }, [JSON.stringify(items)]);

  function calcTarget(x: number) {
    return Math.max(0, Math.min(4, Math.round(startSlot.current + x / SLOT_STEP)));
  }

  function handleDragStart(idx: number) {
    startSlot.current = idx;
    setDraggingIdx(idx);
    setHoverIdx(idx);
  }

  function handleDragMove(x: number) {
    setHoverIdx(calcTarget(x));
  }

  function handleDragEnd(x: number) {
    const from = startSlot.current;
    const to   = calcTarget(x);
    dragX.value = 0;
    dragY.value = 0;
    setDraggingIdx(-1);
    setHoverIdx(-1);
    if (from === to) return;
    // Reorder local display immediately
    setOrder(prev => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    onReorder(from, to);
  }

  return (
    <View style={s.favRow}>
      {order.map((item, i) => (
        <DraggableSlot
          key={i}
          index={i}
          item={item}
          editMode={editMode}
          circular={circular}
          draggingIdx={draggingIdx}
          hoverIdx={hoverIdx}
          dragX={dragX}
          dragY={dragY}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          onSlotPress={() => onSlotPress(i)}
          onRemove={() => onRemove(i)}
        />
      ))}
    </View>
  );
}

// ─── Navigation row ───────────────────────────────────────────────────────────

function NavRow({
  icon,
  label,
  sub,
  onPress,
  colors,
  badge,
}: {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  label: string;
  sub: string;
  onPress: () => void;
  colors: ColorsShape;
  badge?: number;
}) {
  return (
    <Pressable
      style={({ pressed }) => [s.navRow, { opacity: pressed ? 0.6 : 1 }]}
      onPress={onPress}>
      <View style={s.navIconWrap}>
        <FontAwesome name={icon} size={16} color={colors.tint} />
      </View>
      <View style={s.navRowText}>
        <Text style={[s.navLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[s.navSub, { color: colors.subtext }]}>{sub}</Text>
      </View>
      {badge != null && badge > 0 ? (
        <View style={{
          backgroundColor: colors.tint,
          borderRadius: 10,
          minWidth: 20,
          height: 20,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 6,
          marginRight: 8,
        }}>
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      ) : null}
      <FontAwesome name="chevron-right" size={13} color={colors.subtext} />
    </Pressable>
  );
}

// ─── Settings sheet ───────────────────────────────────────────────────────────

function SettingsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const { signOut, user } = useAuth();
  const { preference, setPreference } = useTheme();
  const { isPro, showPaywall } = usePro();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const sheetBg   = isDark ? '#161616' : '#ffffff';
  const labelColor = isDark ? '#f5e6c8' : '#1A0F0A';
  const sepColor   = isDark ? '#2a1e14' : '#e8e8e8';
  const segBg      = isDark ? '#2a1e14' : '#e8e8e8';
  const segTextColor = isDark ? '#6B4C35' : '#7a5535';

  const insets = useSafeAreaInsets();
  const THEME_OPTIONS: { label: string; value: ThemePreference }[] = [
    { label: 'On',     value: 'dark'   },
    { label: 'Off',    value: 'light'  },
    { label: 'System', value: 'system' },
  ];

  async function handleSignOut() {
    onClose();
    setTimeout(() => {
      Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
      ]);
    }, 300);
  }

  function handleDeleteAccount() {
    onClose();
    setTimeout(() => {
      Alert.alert(
        'Delete Account',
        'This is permanent and cannot be undone. All your listens, reviews, playlists, and profile data will be deleted immediately.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete My Account',
            style: 'destructive',
            onPress: confirmDeleteAccount,
          },
        ],
      );
    }, 300);
  }

  async function confirmDeleteAccount() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
      const res = await fetch(`${API_URL}/api/user/delete-account`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Server error ${res.status}`);
      }

      await signOut();
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Something went wrong. Please try again.');
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={ss.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <SafeAreaView style={[ss.sheet, { backgroundColor: sheetBg, borderTopColor: sepColor }]}>
          {/* Drag handle */}
          <View style={[ss.handle, { backgroundColor: isDark ? '#4a3020' : '#d0d0d0' }]} />

          {/* Edit Profile */}
          <Pressable
            style={({ pressed }) => [ss.row, { opacity: pressed ? 0.6 : 1 }]}
            onPress={() => { onClose(); router.push('/edit-profile'); }}>
            <View style={ss.iconWrap}>
              <FontAwesome name="user-o" size={16} color="#D4A017" />
            </View>
            <Text style={[ss.rowLabel, { color: labelColor }]}>Edit Profile</Text>
            <FontAwesome name="chevron-right" size={13} color={SUBTEXT} />
          </Pressable>

          <View style={[ss.separator, { backgroundColor: sepColor }]} />

          {/* Privacy */}
          <Pressable
            style={({ pressed }) => [ss.row, { opacity: pressed ? 0.6 : 1 }]}
            onPress={() => { onClose(); router.push('/privacy-settings'); }}>
            <View style={ss.iconWrap}>
              <FontAwesome name="lock" size={16} color="#D4A017" />
            </View>
            <Text style={[ss.rowLabel, { color: labelColor }]}>Privacy</Text>
            <FontAwesome name="chevron-right" size={13} color={SUBTEXT} />
          </Pressable>

          <View style={[ss.separator, { backgroundColor: sepColor }]} />

          {/* Listend Pro / Subscription */}
          <Pressable
            style={({ pressed }) => [ss.row, { opacity: pressed ? 0.6 : 1 }]}
            onPress={() => {
              onClose();
              if (isPro) {
                setTimeout(() => router.push('/pro-settings'), 300);
              } else {
                setTimeout(() => showPaywall(), 300);
              }
            }}>
            <View style={ss.iconWrap}>
              <FontAwesome name={isPro ? 'star' : 'star-o'} size={16} color="#D4A017" />
            </View>
            <Text style={[ss.rowLabel, { color: labelColor }]}>
              {isPro ? 'Listend Pro' : 'Upgrade to Pro'}
            </Text>
            {isPro
              ? <View style={ss.proBadgeInline}><Text style={ss.proBadgeText}>PRO</Text></View>
              : <FontAwesome name="chevron-right" size={13} color={SUBTEXT} />
            }
          </Pressable>

          <View style={[ss.separator, { backgroundColor: sepColor }]} />

          {/* Help & Feedback */}
          <Pressable style={({ pressed }) => [ss.row, { opacity: pressed ? 0.6 : 1 }]}>
            <View style={ss.iconWrap}>
              <FontAwesome name="question-circle-o" size={16} color="#D4A017" />
            </View>
            <Text style={[ss.rowLabel, { color: labelColor }]}>Help &amp; Feedback</Text>
            <FontAwesome name="chevron-right" size={13} color={SUBTEXT} />
          </Pressable>

          <View style={[ss.separator, { backgroundColor: sepColor }]} />

          {/* Dark Mode */}
          <View style={ss.row}>
            <View style={ss.iconWrap}>
              <FontAwesome name="moon-o" size={16} color="#D4A017" />
            </View>
            <Text style={[ss.rowLabel, { color: labelColor }]}>Dark Mode</Text>
            <View style={[ss.segmented, { backgroundColor: segBg }]}>
              {THEME_OPTIONS.map(opt => (
                <Pressable
                  key={opt.value}
                  style={[ss.segment, preference === opt.value && ss.segmentActive]}
                  onPress={() => setPreference(opt.value)}>
                  <Text style={[ss.segmentText, { color: segTextColor }, preference === opt.value && ss.segmentTextActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={[ss.divider, { backgroundColor: sepColor }]} />

          {/* Sign Out */}
          <Pressable
            style={({ pressed }) => [ss.row, { opacity: pressed ? 0.6 : 1 }]}
            onPress={handleSignOut}>
            <View style={ss.iconWrap}>
              <FontAwesome name="sign-out" size={16} color="#FF4444" />
            </View>
            <Text style={[ss.rowLabel, ss.signOutLabel]}>Sign Out</Text>
          </Pressable>

          <View style={[ss.separator, { backgroundColor: sepColor }]} />

          {/* Delete Account */}
          <Pressable
            style={({ pressed }) => [ss.row, { opacity: pressed ? 0.6 : 1 }]}
            onPress={handleDeleteAccount}>
            <View style={ss.iconWrap}>
              <FontAwesome name="trash-o" size={16} color="#FF4444" />
            </View>
            <Text style={[ss.rowLabel, ss.signOutLabel]}>Delete Account</Text>
          </Pressable>

          {/* About */}
          <View style={ss.about}>
            <ExpoImage
              source={require('../../assets/images/apple-music-logo.png')}
              style={ss.amLogo}
              contentFit="contain"
            />
            <Text style={ss.aboutText}>Music data provided by Apple Music</Text>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const ss = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: '#161616',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2a1e14',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#4a3020',
    alignSelf: 'center',
    marginTop: 10, marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    gap: 14,
  },
  iconWrap: { width: 24, alignItems: 'center' },
  rowLabel: { flex: 1, color: TEXT, fontSize: 16, fontWeight: '500' },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: '#2a1e14', marginLeft: 58 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#3a2818', marginVertical: 8, marginHorizontal: 20 },
  signOutLabel: { color: '#FF4444' },
  segmented: {
    flexDirection: 'row',
    backgroundColor: '#2a1e14',
    borderRadius: 8,
    overflow: 'hidden',
  },
  segment: {
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  segmentActive: {
    backgroundColor: '#D4A017',
    borderRadius: 7,
  },
  segmentText: {
    fontSize: 13,
    color: '#6B4C35',
    fontWeight: '500',
  },
  segmentTextActive: {
    color: '#0F0A07',
    fontWeight: '600',
  },
  about: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 18,
    marginBottom: 4,
    paddingHorizontal: 20,
  },
  amLogo: { width: 18, height: 18, borderRadius: 4 },
  aboutText: { color: '#5a4535', fontSize: 12 },
  proBadgeInline: {
    backgroundColor: '#D4A017',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  proBadgeText: {
    color: '#0F0A07',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
});


// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ListendScreen() {
  const colorScheme = useColorScheme();
  const { isPro, proTheme } = usePro();
  const colors = (isPro && proTheme !== 'default')
    ? themeToColors(getProTheme(proTheme))
    : Colors[colorScheme ?? 'dark'];
  const isDark = colors.isDark;
  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { unreadCount, unreadDMCount } = useNotifications();
  const { likedArtists } = useLikedArtists();
  const { topAlbums, topSongs, topArtists, removeTopAlbum, removeTopSong, removeTopArtist, reorderTopAlbums, reorderTopSongs, reorderTopArtists, loggedAlbums, wantToListen } = useAlbums();
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [top5EditMode, setTop5EditMode] = useState(false);
  const [activeSong, setActiveSong] = useState<SongInfo | null>(null);

  // Profile data — re-fetched each time the tab comes into focus
  // so updates from edit-profile are reflected immediately
  const [profileDisplayName, setProfileDisplayName] = useState('');
  const [profileUsername,    setProfileUsername]    = useState('');
  const [profileAvatarUrl,   setProfileAvatarUrl]   = useState<string | null>(null);
  const [profileBio,         setProfileBio]         = useState('');

  // "This Year" count — derived from loggedAlbums so it updates live when new albums are logged
  const thisYearCount = loggedAlbums.filter(a => {
    const d = new Date(a.dateLogged);
    return !isNaN(d.getTime()) && d.getFullYear() === new Date().getFullYear();
  }).length;

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      supabase
        .from('profiles')
        .select('display_name, username, avatar_url, bio')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setProfileDisplayName(data.display_name    ?? '');
            setProfileUsername(   data.username        ?? '');
            setProfileAvatarUrl(  data.avatar_url      ?? null);
            setProfileBio(        data.bio             ?? '');
          }
        });
    }, [user])
  );

  // Inject bell + hamburger into the tab header, and sync header bg to the active pro theme
  const openSettings = useCallback(() => setSettingsVisible(true), []);
  const headerIconColor = colors.text;
  useEffect(() => {
    navigation.setOptions({
      headerStyle: { backgroundColor: colors.background },
      headerTintColor: colors.text,
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, marginRight: 16 }}>
          {/* Bell icon with unread badge */}
          <Pressable
            onPress={() => router.push('/notifications')}
            hitSlop={12}
            style={{ position: 'relative' }}>
            <FontAwesome name="bell-o" size={20} color={headerIconColor} />
            {unreadCount > 0 && (
              <View style={{
                position: 'absolute',
                top: -4, right: -4,
                width: 8, height: 8, borderRadius: 4,
                backgroundColor: '#D4A017',
              }} />
            )}
          </Pressable>
          {/* Hamburger */}
          <Pressable onPress={openSettings} hitSlop={12}>
            <FontAwesome name="bars" size={20} color={headerIconColor} />
          </Pressable>
        </View>
      ),
    });
  }, [navigation, openSettings, unreadCount, router, headerIconColor, colors.background, colors.text]);

  const reviewCount = loggedAlbums.filter((a) => !!a.review).length;

  // ── Profile stats ────────────────────────────────────────────────────────────
  const ratedAlbums = loggedAlbums.filter((a) => a.rating > 0);
  const avgRating = ratedAlbums.length > 0
    ? (ratedAlbums.reduce((sum, a) => sum + a.rating, 0) / ratedAlbums.length).toFixed(1)
    : '—';
  const ratingDistribution = Array.from({ length: 10 }, (_, i) => ({
    rating: i + 1,
    count: loggedAlbums.filter(a => a.rating === i + 1).length,
  }));

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

      {/* Profile header */}
      <ProfileHeader
        displayName={profileDisplayName}
        username={profileUsername}
        avatarUrl={profileAvatarUrl}
        bio={profileBio}
        isOwnProfile={true}
        currentUserId={user?.id ?? ''}
        profileUserId={user?.id ?? ''}
        albumCount={loggedAlbums.length}
        thisYearCount={thisYearCount}
        avgRating={avgRating}
        onPressAlbums={() => router.push('/my-listend')}
        onPressThisYear={() => router.push('/sessions')}
        onPressAvgRating={() => setRatingModalVisible(true)}
        isDark={isDark}
        colors={colors}
        isPro={isPro}
      />

      <RatingModal
        visible={ratingModalVisible}
        onClose={() => setRatingModalVisible(false)}
        avgRating={avgRating}
        distribution={ratingDistribution}
        colors={colors}
      />

      <SettingsSheet
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
      />

      {/* Top 5 Albums */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={[s.sectionTitle, { color: colors.textMuted }]}>MY TOP 5 ALBUMS</Text>
          <Pressable
            onPress={() => setTop5EditMode(v => !v)}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
            <Text style={[s.editLabel, { color: colors.tint }]}>{top5EditMode ? 'Done' : 'Edit'}</Text>
          </Pressable>
        </View>
        <DraggableFavRow
          items={topAlbums.map(a => a ? { artworkUrl: a.artworkUrl, title: a.title } : null)}
          editMode={top5EditMode}
          onReorder={(from, to) => {
            const next = [...topAlbums];
            const [moved] = next.splice(from, 1);
            next.splice(to, 0, moved);
            reorderTopAlbums(next);
          }}
          onRemove={i => { const a = topAlbums[i]; if (a) removeTopAlbum(a.id); }}
          onSlotPress={i => {
            const a = topAlbums[i];
            if (top5EditMode) {
              if (!a) router.push({ pathname: '/pick-item', params: { type: 'album', slotIndex: String(i) } });
            } else {
              if (a) router.push({ pathname: '/album-detail', params: { id: a.id, title: a.title, artist: a.artist, year: String(a.year ?? ''), artworkUrl: a.artworkUrl } });
            }
          }}
        />
      </View>

      <View style={[s.rule, { backgroundColor: colors.border }]} />

      {/* Top 5 Songs */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={[s.sectionTitle, { color: colors.textMuted }]}>MY TOP 5 SONGS</Text>
        </View>
        <DraggableFavRow
          items={topSongs.map(s => s ? { artworkUrl: s.artworkUrl, title: s.title } : null)}
          editMode={top5EditMode}
          onReorder={(from, to) => {
            const next = [...topSongs];
            const [moved] = next.splice(from, 1);
            next.splice(to, 0, moved);
            reorderTopSongs(next);
          }}
          onRemove={i => { const s = topSongs[i]; if (s) removeTopSong(s.id); }}
          onSlotPress={i => {
            const song = topSongs[i];
            if (top5EditMode) {
              if (!song) router.push({ pathname: '/pick-item', params: { type: 'song', slotIndex: String(i) } });
            } else {
              if (song) setActiveSong({ id: song.id, title: song.title, artist: song.artist, artworkUrl: song.artworkUrl, releaseDate: song.releaseDate });
            }
          }}
        />
      </View>

      <View style={[s.rule, { backgroundColor: colors.border }]} />

      {/* Top 5 Artists */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={[s.sectionTitle, { color: colors.textMuted }]}>MY TOP 5 ARTISTS</Text>
        </View>
        <DraggableFavRow
          circular
          items={topArtists.map(a => a ? { artworkUrl: a.artworkUrl, title: a.name } : null)}
          editMode={top5EditMode}
          onReorder={(from, to) => {
            const next = [...topArtists];
            const [moved] = next.splice(from, 1);
            next.splice(to, 0, moved);
            reorderTopArtists(next);
          }}
          onRemove={i => { const a = topArtists[i]; if (a) removeTopArtist(a.id); }}
          onSlotPress={i => {
            const artist = topArtists[i];
            if (top5EditMode) {
              if (!artist) router.push({ pathname: '/pick-item', params: { type: 'artist', slotIndex: String(i) } });
            } else {
              if (artist) router.push({ pathname: '/artist-detail', params: { id: artist.id, name: artist.name, artworkUrl: artist.artworkUrl } });
            }
          }}
        />
      </View>

      {/* ── Nav rows ─────────────────────────────────────────────────────────── */}
      <View style={[s.navGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <NavRow colors={colors} icon="music"      label="My Listend"      sub={`${loggedAlbums.length} albums`}                                            onPress={() => router.push('/my-listend')} />
        <View style={[s.navSeparator, { backgroundColor: colors.border }]} />
        <NavRow colors={colors} icon="calendar"   label="Sessions"        sub="Your listening diary"                                                        onPress={() => router.push('/sessions')} />
        <View style={[s.navSeparator, { backgroundColor: colors.border }]} />
        <NavRow colors={colors} icon="bookmark-o" label="Want to Listen"  sub={`${wantToListen.length} saved`}                                             onPress={() => router.push('/want-to-listen')} />
        <View style={[s.navSeparator, { backgroundColor: colors.border }]} />
        <NavRow colors={colors} icon="quote-left" label="My Reviews"      sub={`${reviewCount} reviews`}                                                    onPress={() => router.push('/my-reviews')} />
        <View style={[s.navSeparator, { backgroundColor: colors.border }]} />
        <NavRow colors={colors} icon="repeat"     label="Re-Listend"      sub={`${loggedAlbums.filter(a => a.isRelistened).length} albums`}                 onPress={() => router.push('/re-listened')} />
        <View style={[s.navSeparator, { backgroundColor: colors.border }]} />
        <NavRow colors={colors} icon="clock-o"    label="Recent Activity" sub="Your recent activity"                                                        onPress={() => router.push('/recent-activity')} />
        <View style={[s.navSeparator, { backgroundColor: colors.border }]} />
        <NavRow colors={colors} icon="list"       label="My Playlists"    sub="Your album lists"                                                            onPress={() => router.push('/my-playlists')} />
        <View style={[s.navSeparator, { backgroundColor: colors.border }]} />
        <NavRow colors={colors} icon="heart"      label="Liked Artists"   sub={`${likedArtists.length} artists`}                                            onPress={() => router.push('/liked-artists')} />
        <View style={[s.navSeparator, { backgroundColor: colors.border }]} />
        <NavRow colors={colors} icon="comments"   label="DMs"             sub="Messages"                                                                    onPress={() => router.push('/dms')} badge={unreadDMCount} />
        <View style={[s.navSeparator, { backgroundColor: colors.border }]} />
        <NavRow colors={colors} icon="bar-chart"  label="My Stats"        sub="Your listening insights"                                                     onPress={() => router.push('/my-stats')} />
      </View>

    </ScrollView>
    </>
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
  editLabel: { color: '#D4A017', fontSize: 12 },

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
    borderColor: '#2a1e14',
  },
  favInitialBg: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: CARD_BG,
  },
  favInitial: { color: '#6B4C35', fontSize: 16, fontWeight: '700' },
  favEmptyEdit: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#3a2818',
    borderStyle: 'dashed',
  },
  favRemoveBtn: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },

  rule: { height: StyleSheet.hairlineWidth, backgroundColor: BORDER, marginHorizontal: 20 },

  navGroup: {
    marginTop: 24,
    marginHorizontal: 20,
    backgroundColor: '#0F0A07',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#2a1e14',
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
  navSeparator: { height: StyleSheet.hairlineWidth, backgroundColor: '#2a1e14', marginLeft: 58 },
});

// ─── Rating modal styles ──────────────────────────────────────────────────────

const rm = StyleSheet.create({
  // Modal root: flex:1 fills the overlay, justifyContent:'flex-end' pins the
  // sheet to the bottom. width:'100%' + overflow:'hidden' hard-clips any bleed.
  container: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
    overflow: 'hidden',
  },
  // Sheet: outermost content container — paddingHorizontal:16 here (not on
  // any inner view) is the single source of horizontal inset for all content.
  sheet: {
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: '#161616',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingBottom: 32,
    overflow: 'hidden',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#4a3020',
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
  avgValue: { color: '#D4A017', fontSize: 56, fontWeight: '700', letterSpacing: -2, lineHeight: 62 },
  avgLabel: { color: SUBTEXT, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 },
  distBlock: { gap: 10 },
  distRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  distRating: {
    color: SUBTEXT, fontSize: 13, fontWeight: '600',
    width: 24, textAlign: 'right',
  },
  barTrack: {
    flex: 1,
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2a1e14',
    overflow: 'hidden',
    marginHorizontal: 8,
  },
  barFilled: {
    height: 6,
    backgroundColor: '#D4A017',
    borderRadius: 3,
  },
  distCount: {
    color: TEXT, fontSize: 13, fontWeight: '600',
    width: 28, textAlign: 'right',
  },
});
