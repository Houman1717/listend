import {
  StyleSheet,
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  Alert,
  Dimensions,
  Modal,
  SafeAreaView,
  PanResponder,
  Animated,
} from 'react-native';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useNavigation, useFocusEffect } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import { useAlbums, TopAlbum, TopSong, TopArtist } from '@/context/AlbumsContext';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationsContext';
import { supabase } from '@/lib/supabase';
import { SongInfoModal, SongInfo } from '@/components/SongInfoModal';

const DARK_BG   = '#0d0d0d';
const CARD_BG   = '#1a1a1a';
const BORDER    = '#2a2a2a';
const TEXT      = '#f0f0f0';
const SUBTEXT   = '#888';
const ACCENT    = '#FF3CAC';

// COVER_H removed — cover now uses aspectRatio: 16/9
const AVATAR_SIZE = 80;

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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/*
        Single flex:1 container fills the whole modal overlay and gives every
        descendant a resolved width to work against — this is what makes
        flex:1 on barTrack (and percentage widths on barFill) work correctly.
        justifyContent:'flex-end' pushes the sheet to the bottom.
        The backdrop sits as absoluteFill behind the sheet.
      */}
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

// ─── Profile header ───────────────────────────────────────────────────────────

function ProfileHeader({
  displayName,
  username,
  avatarUrl,
  bio,
  coverPhotoUrl,
  isOwnProfile,
  currentUserId,
  profileUserId,
  albumCount,
  thisYearCount,
  avgRating,
  onPressAlbums,
  onPressThisYear,
  onPressAvgRating,
}: {
  displayName: string;
  username: string;
  avatarUrl: string | null;
  bio: string;
  coverPhotoUrl: string | null;
  isOwnProfile: boolean;
  currentUserId: string;
  profileUserId: string;
  albumCount: number;
  thisYearCount: number;
  avgRating: string;
  onPressAlbums: () => void;
  onPressThisYear: () => void;
  onPressAvgRating: () => void;
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
    <View style={ph.outer}>

      {/* ── Cover photo — only rendered when a URL exists ────────────────── */}
      {coverPhotoUrl ? (
        <View style={ph.cover}>
          <Image source={{ uri: coverPhotoUrl }} style={ph.coverImg} resizeMode="cover" />
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 100 }}>
            <LinearGradient
              colors={['transparent', '#000000']}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      ) : null}

      {/* ── Body (avatar + text + buttons) ───────────────────────────────── */}
      <View style={[ph.body, !coverPhotoUrl && ph.bodyNoCover]}>

        {/* Avatar — straddles cover edge when cover exists; sits at top otherwise */}
        <View style={[ph.avatarWrap, !coverPhotoUrl && ph.avatarWrapNoCover]}>
          {avatarUrl
            ? <Image source={{ uri: avatarUrl }} style={ph.avatarImg} resizeMode="cover" />
            : <View style={ph.avatarFallback}>
                <Text style={ph.avatarInitial}>{initial}</Text>
              </View>
          }
        </View>

        {/* Name */}
        <Text style={ph.name}>{displayName || username || ''}</Text>

        {/* Username */}
        {username ? <Text style={ph.username}>@{username}</Text> : null}

        {/* Bio */}
        {bio ? <Text style={ph.bio}>{bio}</Text> : null}

        {/* Following / Followers */}
        <View style={ph.socialRow}>
          <Pressable
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            onPress={() => router.push({ pathname: '/followers-following', params: { userId: profileUserId, type: 'following' } })}>
            <Text style={ph.socialCount}>{followingCount}</Text>
          </Pressable>
          <Text style={ph.socialLabel}> Following</Text>
          <Text style={ph.socialDot}> · </Text>
          <Pressable
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            onPress={() => router.push({ pathname: '/followers-following', params: { userId: profileUserId, type: 'followers' } })}>
            <Text style={ph.socialCount}>{followersCount}</Text>
          </Pressable>
          <Text style={ph.socialLabel}> Followers</Text>
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
        <View style={ph.statsRow}>
          <Pressable
            style={({ pressed }) => [ph.statBox, { opacity: pressed ? 0.7 : 1 }]}
            onPress={onPressAlbums}>
            <Text style={ph.statValue}>{albumCount}</Text>
            <Text style={ph.statLabel}>Albums</Text>
          </Pressable>
          <View style={ph.statDivider} />
          <Pressable
            style={({ pressed }) => [ph.statBox, { opacity: pressed ? 0.7 : 1 }]}
            onPress={onPressThisYear}>
            <Text style={ph.statValue}>{thisYearCount}</Text>
            <Text style={ph.statLabel}>This Year</Text>
          </Pressable>
          <View style={ph.statDivider} />
          <Pressable
            style={({ pressed }) => [ph.statBox, { opacity: pressed ? 0.7 : 1 }]}
            onPress={onPressAvgRating}>
            <Text style={ph.statValue}>{avgRating}</Text>
            <Text style={ph.statLabel}>Avg Rating</Text>
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
    backgroundColor: '#111',
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
    borderColor: '#333',
    backgroundColor: '#222',
  },
  avatarWrapNoCover: {
    marginTop: 0,  // no cover to straddle — sit flush at the top of body
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarFallback: {
    flex: 1,
    backgroundColor: '#1f1f1f',
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

// ─── Horizontal favourite slot ────────────────────────────────────────────────

function FavSlot({
  item,
  editMode = false,
  onPress,
  circular = false,
}: {
  item?: { artworkUrl?: string; title: string };
  editMode?: boolean;
  onPress?: () => void;
  circular?: boolean;
}) {
  const radius = circular ? FAV_SLOT_SIZE / 2 : 3;

  if (item) {
    return (
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        style={({ pressed }) => [s.favSlot, { borderRadius: radius, opacity: pressed ? 0.7 : 1 }]}>
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
        {editMode && (
          <View style={[s.favEditOverlay, { borderRadius: radius }]}>
            <FontAwesome name="pencil" size={10} color="#fff" />
          </View>
        )}
      </Pressable>
    );
  }

  if (editMode) {
    return (
      <Pressable onPress={onPress} style={[s.favSlot, s.favEmptyEdit, { borderRadius: radius }]}>
        <FontAwesome name="plus" size={14} color="#555" />
      </Pressable>
    );
  }

  return <View style={[s.favSlot, s.favEmpty, { borderRadius: radius }]} />;
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

// ─── Settings sheet ───────────────────────────────────────────────────────────

function SettingsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const { signOut } = useAuth();

  async function handleSignOut() {
    onClose();
    // Small delay so sheet has time to close before alert appears
    setTimeout(() => {
      Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
      ]);
    }, 300);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={ss.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <SafeAreaView style={ss.sheet}>
          {/* Drag handle */}
          <View style={ss.handle} />

          {/* Edit Profile */}
          <Pressable
            style={({ pressed }) => [ss.row, { opacity: pressed ? 0.6 : 1 }]}
            onPress={() => { onClose(); router.push('/edit-profile'); }}>
            <View style={ss.iconWrap}>
              <FontAwesome name="user-o" size={16} color="#FF3CAC" />
            </View>
            <Text style={ss.rowLabel}>Edit Profile</Text>
            <FontAwesome name="chevron-right" size={13} color={SUBTEXT} />
          </Pressable>

          <View style={ss.separator} />

          {/* Subscription */}
          <Pressable style={({ pressed }) => [ss.row, { opacity: pressed ? 0.6 : 1 }]}>
            <View style={ss.iconWrap}>
              <FontAwesome name="star-o" size={16} color="#FF3CAC" />
            </View>
            <Text style={ss.rowLabel}>Subscription</Text>
            <FontAwesome name="chevron-right" size={13} color={SUBTEXT} />
          </Pressable>

          <View style={ss.separator} />

          {/* Help & Feedback */}
          <Pressable style={({ pressed }) => [ss.row, { opacity: pressed ? 0.6 : 1 }]}>
            <View style={ss.iconWrap}>
              <FontAwesome name="question-circle-o" size={16} color="#FF3CAC" />
            </View>
            <Text style={ss.rowLabel}>Help &amp; Feedback</Text>
            <FontAwesome name="chevron-right" size={13} color={SUBTEXT} />
          </Pressable>

          <View style={ss.divider} />

          {/* Sign Out */}
          <Pressable
            style={({ pressed }) => [ss.row, { opacity: pressed ? 0.6 : 1 }]}
            onPress={handleSignOut}>
            <View style={ss.iconWrap}>
              <FontAwesome name="sign-out" size={16} color="#FF4444" />
            </View>
            <Text style={[ss.rowLabel, ss.signOutLabel]}>Sign Out</Text>
          </Pressable>
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
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2a2a2a',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#444',
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
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: '#222', marginLeft: 58 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#333', marginVertical: 8, marginHorizontal: 20 },
  signOutLabel: { color: '#FF4444' },
});

// ─── Draggable Top-5 row (edit mode only) ────────────────────────────────────

function DraggableFavRow({
  slots,
  circular = false,
  onSlotPress,
  onReorder,
}: {
  slots: (any | undefined)[];
  circular?: boolean;
  onSlotPress: (index: number, item: any) => void;
  onReorder: (newOrder: (any | undefined)[]) => void;
}) {
  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  const onSlotPressRef = useRef(onSlotPress);
  onSlotPressRef.current = onSlotPress;
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;

  const isDraggingRef  = useRef(false);
  const dragIdxRef     = useRef(-1);
  const hoverIdxRef    = useRef(-1);
  const timerRef       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPageXRef  = useRef(0);   // pageX at touch start — used as dx anchor
  const floatX         = useRef(new Animated.Value(0)).current;

  // Row's absolute x on screen — converts pageX → local slot index
  const rowRef      = useRef<View>(null);
  const rowPageXRef = useRef(0);

  const [dragState, setDragState] = useState<{
    dragIdx: number;
    hoverIdx: number;
    draggingItem: any;
  } | null>(null);

  function clearTimer() {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }

  function slotIdxAt(px: number) {
    return Math.min(4, Math.max(0, Math.floor((px - rowPageXRef.current) / SLOT_STEP)));
  }

  const panResponder = useRef(
    PanResponder.create({
      // Capture phase: claim touch before any child Pressable
      onStartShouldSetPanResponderCapture: () => true,
      // Reclaim responder if we're mid-drag and somehow lost it
      onMoveShouldSetPanResponder: () => isDraggingRef.current,
      // Never yield to the ScrollView parent — this is the key fix for the
      // "only one hop" bug where the ScrollView stole the responder each move
      onPanResponderTerminateRequest: () => false,

      onPanResponderGrant: (evt) => {
        const idx = slotIdxAt(evt.nativeEvent.pageX);
        dragIdxRef.current   = idx;
        hoverIdxRef.current  = idx;
        startPageXRef.current = evt.nativeEvent.pageX;
        floatX.setValue(idx * SLOT_STEP);

        timerRef.current = setTimeout(() => {
          const item = slotsRef.current[idx];
          if (!item) return;
          isDraggingRef.current = true;
          setDragState({ dragIdx: idx, hoverIdx: idx, draggingItem: item });
        }, 300);
      },

      onPanResponderMove: (evt, gs) => {
        if (!isDraggingRef.current) {
          if (Math.abs(gs.dx) > 8 || Math.abs(gs.dy) > 10) clearTimer();
          return;
        }
        // Use live pageX instead of gestureState.dx to avoid drift across re-renders
        const dx = evt.nativeEvent.pageX - startPageXRef.current;
        const clamped = Math.max(0, Math.min(4 * SLOT_STEP, dragIdxRef.current * SLOT_STEP + dx));
        floatX.setValue(clamped);
        const newHover = Math.min(4, Math.max(0, Math.round((clamped + FAV_SLOT_SIZE / 2) / SLOT_STEP)));
        if (newHover !== hoverIdxRef.current) {
          hoverIdxRef.current = newHover;
          setDragState(prev => prev ? { ...prev, hoverIdx: newHover } : null);
        }
      },

      onPanResponderRelease: (evt) => {
        clearTimer();
        if (!isDraggingRef.current) {
          const tapped = slotIdxAt(evt.nativeEvent.pageX);
          onSlotPressRef.current(tapped, slotsRef.current[tapped]);
          return;
        }
        const from = dragIdxRef.current;
        const to   = hoverIdxRef.current;
        isDraggingRef.current = false;
        dragIdxRef.current    = -1;
        hoverIdxRef.current   = -1;
        setDragState(null);
        if (from !== to) {
          const next = [...slotsRef.current];
          const [moved] = next.splice(from, 1);
          next.splice(to, 0, moved);
          onReorderRef.current(next);
        }
      },

      onPanResponderTerminate: () => {
        clearTimer();
        isDraggingRef.current = false;
        dragIdxRef.current    = -1;
        hoverIdxRef.current   = -1;
        setDragState(null);
      },
    })
  ).current;

  // Build display order during drag
  let displaySlots: (any | undefined)[];
  let placeholderIdx = -1;
  if (dragState) {
    const { dragIdx, hoverIdx } = dragState;
    if (dragIdx === hoverIdx) {
      displaySlots   = slots.map((item, i) => (i === dragIdx ? undefined : item));
      placeholderIdx = dragIdx;
    } else {
      const rest = slots.filter((_, i) => i !== dragIdx);
      rest.splice(hoverIdx, 0, undefined);
      displaySlots   = rest;
      placeholderIdx = hoverIdx;
    }
  } else {
    displaySlots = [...slots];
  }

  const radius       = circular ? FAV_SLOT_SIZE / 2 : 3;
  const draggingItem = dragState?.draggingItem;

  return (
    <View
      ref={rowRef}
      style={[s.favRow, { position: 'relative' }]}
      onLayout={() => rowRef.current?.measure((_x, _y, _w, _h, px) => { rowPageXRef.current = px; })}
      {...panResponder.panHandlers}
    >
      {displaySlots.map((item, i) => {
        const isPlaceholder = i === placeholderIdx && !!dragState;
        const displayItem   = isPlaceholder || !item
          ? undefined
          : { artworkUrl: item.artworkUrl, title: item.title || item.name || '' };
        // pointerEvents="none" prevents child Pressables from consuming touches
        return (
          <View key={i} pointerEvents="none">
            <FavSlot item={displayItem} editMode circular={circular} />
          </View>
        );
      })}

      {draggingItem && (
        <Animated.View
          pointerEvents="none"
          style={{
            width: FAV_SLOT_SIZE,
            height: FAV_SLOT_SIZE,
            borderRadius: radius,
            overflow: 'hidden',
            backgroundColor: CARD_BG,
            position: 'absolute',
            left: floatX,
            top: -4,
            zIndex: 20,
            elevation: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.5,
            shadowRadius: 10,
            transform: [{ scale: 1.08 }],
          }}
        >
          {draggingItem.artworkUrl ? (
            <Image
              source={{ uri: draggingItem.artworkUrl }}
              style={{ width: FAV_SLOT_SIZE, height: FAV_SLOT_SIZE }}
              resizeMode="cover"
            />
          ) : (
            <View style={[s.favInitialBg]}>
              <Text style={s.favInitial}>
                {(draggingItem.title || draggingItem.name || '?').charAt(0)}
              </Text>
            </View>
          )}
        </Animated.View>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ListendScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const { topAlbums, topSongs, topArtists, reorderTopAlbums, reorderTopSongs, reorderTopArtists, loggedAlbums, wantToListen } = useAlbums();
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
  const [profileCoverUrl,    setProfileCoverUrl]    = useState<string | null>(null);

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
        .select('display_name, username, avatar_url, bio, cover_photo_url')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setProfileDisplayName(data.display_name    ?? '');
            setProfileUsername(   data.username        ?? '');
            setProfileAvatarUrl(  data.avatar_url      ?? null);
            setProfileBio(        data.bio             ?? '');
            setProfileCoverUrl(   data.cover_photo_url ?? null);
          }
        });
    }, [user])
  );

  // Inject bell + hamburger into the tab header
  const openSettings = useCallback(() => setSettingsVisible(true), []);
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, marginRight: 16 }}>
          {/* Bell icon with unread badge */}
          <Pressable
            onPress={() => router.push('/notifications')}
            hitSlop={12}
            style={{ position: 'relative' }}>
            <FontAwesome name="bell-o" size={20} color="#f0f0f0" />
            {unreadCount > 0 && (
              <View style={{
                position: 'absolute',
                top: -4, right: -4,
                width: 8, height: 8, borderRadius: 4,
                backgroundColor: '#FF3CAC',
              }} />
            )}
          </Pressable>
          {/* Hamburger */}
          <Pressable onPress={openSettings} hitSlop={12}>
            <FontAwesome name="bars" size={20} color="#f0f0f0" />
          </Pressable>
        </View>
      ),
    });
  }, [navigation, openSettings, unreadCount, router]);

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
      style={s.container}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}>

      {/* Profile header */}
      <ProfileHeader
        displayName={profileDisplayName}
        username={profileUsername}
        avatarUrl={profileAvatarUrl}
        bio={profileBio}
        coverPhotoUrl={profileCoverUrl}
        isOwnProfile={true}
        currentUserId={user?.id ?? ''}
        profileUserId={user?.id ?? ''}
        albumCount={loggedAlbums.length}
        thisYearCount={thisYearCount}
        avgRating={avgRating}
        onPressAlbums={() => router.push('/my-listend')}
        onPressThisYear={() => router.push('/sessions')}
        onPressAvgRating={() => setRatingModalVisible(true)}
      />

      <RatingModal
        visible={ratingModalVisible}
        onClose={() => setRatingModalVisible(false)}
        avgRating={avgRating}
        distribution={ratingDistribution}
      />

      <SettingsSheet
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
      />

      {/* Top 5 Albums */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>MY TOP 5 ALBUMS</Text>
          <Pressable
            onPress={() => setTop5EditMode(v => !v)}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
            <Text style={s.editLabel}>{top5EditMode ? 'Done' : 'Edit'}</Text>
          </Pressable>
        </View>
        {top5EditMode ? (
          <DraggableFavRow
            slots={Array.from({ length: 5 }, (_, i) => topAlbums[i])}
            circular={false}
            onSlotPress={(_, item) => {
              const a = item as TopAlbum | undefined;
              router.push({ pathname: '/pick-item', params: { type: 'album', ...(a ? { replaceId: a.id } : {}) } });
            }}
            onReorder={(next) => reorderTopAlbums(next.filter(Boolean) as TopAlbum[])}
          />
        ) : (
          <View style={s.favRow}>
            {Array.from({ length: 5 }).map((_, i) => {
              const a: TopAlbum | undefined = topAlbums[i];
              return (
                <FavSlot
                  key={i}
                  item={a}
                  editMode={false}
                  onPress={a ? () => router.push({ pathname: '/album-detail', params: { id: a.id, title: a.title, artist: a.artist, year: String(a.year ?? ''), artworkUrl: a.artworkUrl } }) : undefined}
                />
              );
            })}
          </View>
        )}
      </View>

      <View style={s.rule} />

      {/* Top 5 Songs */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>MY TOP 5 SONGS</Text>
        </View>
        {top5EditMode ? (
          <DraggableFavRow
            slots={Array.from({ length: 5 }, (_, i) => topSongs[i])}
            circular={false}
            onSlotPress={(_, item) => {
              const song = item as TopSong | undefined;
              router.push({ pathname: '/pick-item', params: { type: 'song', ...(song ? { replaceId: song.id } : {}) } });
            }}
            onReorder={(next) => reorderTopSongs(next.filter(Boolean) as TopSong[])}
          />
        ) : (
          <View style={s.favRow}>
            {Array.from({ length: 5 }).map((_, i) => {
              const song: TopSong | undefined = topSongs[i];
              return (
                <FavSlot
                  key={i}
                  item={song}
                  editMode={false}
                  onPress={song ? () => setActiveSong({ id: song.id, title: song.title, artist: song.artist, artworkUrl: song.artworkUrl, releaseDate: song.releaseDate }) : undefined}
                />
              );
            })}
          </View>
        )}
      </View>

      <View style={s.rule} />

      {/* Top 5 Artists */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>MY TOP 5 ARTISTS</Text>
        </View>
        {top5EditMode ? (
          <DraggableFavRow
            slots={Array.from({ length: 5 }, (_, i) => topArtists[i])}
            circular={true}
            onSlotPress={(_, item) => {
              const artist = item as TopArtist | undefined;
              router.push({ pathname: '/pick-item', params: { type: 'artist', ...(artist ? { replaceId: artist.id } : {}) } });
            }}
            onReorder={(next) => reorderTopArtists(next.filter(Boolean) as TopArtist[])}
          />
        ) : (
          <View style={s.favRow}>
            {Array.from({ length: 5 }).map((_, i) => {
              const artist: TopArtist | undefined = topArtists[i];
              return (
                <FavSlot
                  key={i}
                  circular
                  item={artist ? { artworkUrl: artist.artworkUrl, title: artist.name } : undefined}
                  editMode={false}
                  onPress={artist ? () => router.push({ pathname: '/artist-detail', params: { id: artist.id, name: artist.name, artworkUrl: artist.artworkUrl } }) : undefined}
                />
              );
            })}
          </View>
        )}
      </View>

      {/* ── Nav rows ─────────────────────────────────────────────────────────── */}
      <View style={s.navGroup}>
        <NavRow
          icon="music"
          label="My Listend"
          sub={`${loggedAlbums.length} albums`}
          onPress={() => router.push('/my-listend')}
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
          icon="bookmark-o"
          label="Want to Listen"
          sub={`${wantToListen.length} saved`}
          onPress={() => router.push('/want-to-listen')}
        />
        <View style={s.navSeparator} />
        <NavRow
          icon="clock-o"
          label="Recent Activity"
          sub={`${loggedAlbums.length} logged albums`}
          onPress={() => router.push('/recent-activity')}
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
          icon="heart"
          label="Liked Artists"
          sub="Your favourites"
          onPress={() => router.push('/liked-artists')}
        />
        <View style={s.navSeparator} />
        <NavRow
          icon="comments"
          label="DMs"
          sub="Messages"
          onPress={() => router.push('/dms')}
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
  favEmptyEdit: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#3a3a3a',
    borderStyle: 'dashed',
  },
  favEditOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },

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
  avgValue: { color: '#FF3CAC', fontSize: 56, fontWeight: '700', letterSpacing: -2, lineHeight: 62 },
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
    backgroundColor: '#2a2a2a',
    overflow: 'hidden',
    marginHorizontal: 8,
  },
  barFilled: {
    height: 6,
    backgroundColor: '#FF3CAC',
    borderRadius: 3,
  },
  distCount: {
    color: TEXT, fontSize: 13, fontWeight: '600',
    width: 28, textAlign: 'right',
  },
});
