import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Linking,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useNavigation, Stack } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useFlip, FlipStatus, FlippedRecord } from '@/context/FlipContext';
import { useAlbums } from '@/context/AlbumsContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { FLIP_POOL, FlipAlbum } from '@/constants/FlipPool';

const API_URL   = process.env.EXPO_PUBLIC_API_URL ?? '';
const { width: SCREEN_W } = Dimensions.get('window');
const ART_SIZE  = SCREEN_W - 48;

// ─── Shared fetch helper ──────────────────────────────────────────────────────

type AlbumData = { spotifyId: string; artworkUrl: string };

async function fetchAlbumDataOnce(title: string, artist: string): Promise<AlbumData> {
  const q   = encodeURIComponent(`${title} ${artist}`);
  const res = await fetch(`${API_URL}/search?q=${q}&type=album`);
  if (!res.ok) return { spotifyId: '', artworkUrl: '' };
  const data: { id: string; artworkUrl: string }[] = await res.json();
  const hit = data[0];
  return { spotifyId: hit?.id ?? '', artworkUrl: hit?.artworkUrl ?? '' };
}

// A transient network blip here previously meant a permanent fake `flip-XXXX`
// ID + no artwork got written to the log with no way to recover — retry once
// before giving up.
async function fetchAlbumData(title: string, artist: string): Promise<AlbumData> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await fetchAlbumDataOnce(title, artist);
      if (result.spotifyId) return result;
    } catch {
      // fall through to retry
    }
  }
  return { spotifyId: '', artworkUrl: '' };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCountdown(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ─── Streak tier system ───────────────────────────────────────────────────────

type StreakTier = 0 | 1 | 2 | 3 | 4 | 5 | 6;

function getStreakTier(n: number): StreakTier {
  if (n === 0) return 0;
  if (n < 4)   return 1;
  if (n < 7)   return 2;
  if (n < 14)  return 3;
  if (n < 30)  return 4;
  if (n < 100) return 5;
  return 6;
}

const STREAK_META: Record<StreakTier, { label: string; caption: string; color: string; icon: string }> = {
  0: { label: '',                    caption: '',                            color: '#6B4C35', icon: 'fire'     },
  1: { label: 'Ember Run',           caption: 'Just getting started',        color: '#C8601A', icon: 'fire'     },
  2: { label: 'Vinyl Run',           caption: 'The needle is dropping',      color: '#D4A017', icon: 'dot-circle-o' },
  3: { label: 'Discovery Streak',    caption: 'Deep in the crates',          color: '#D4A017', icon: 'compass'  },
  4: { label: 'Collector Run',       caption: 'Serious about the dig',       color: '#E8C547', icon: 'star'     },
  5: { label: 'Digging Streak',      caption: 'Rare finds, daily ritual',    color: '#F0D060', icon: 'diamond'  },
  6: { label: 'Legendary Collector', caption: 'You are the record store',    color: '#FFE57A', icon: 'trophy'   },
};

const CLUSTER = 54;

function StreakCard({ streak, isDark }: { streak: number; isDark: boolean }) {
  const tier = getStreakTier(streak);
  const meta = STREAK_META[tier];

  const pulseAnim  = useRef(new Animated.Value(0)).current;
  const rotAnim    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (tier === 0) return;
    const dur = tier >= 5 ? 900 : tier >= 3 ? 1400 : 2000;
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    pulse.start();

    let rot: Animated.CompositeAnimation | null = null;
    if (tier >= 2) {
      const rotDur = Math.max(3000, 9000 - tier * 1000);
      rot = Animated.loop(Animated.timing(rotAnim, { toValue: 1, duration: rotDur, easing: Easing.linear, useNativeDriver: true }));
      rot.start();
    }
    return () => { pulse.stop(); rot?.stop(); };
  }, [tier]);

  if (tier === 0) return null;

  const glowOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.18, tier >= 5 ? 0.75 : 0.48] });
  const glowScale   = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1.42] });
  const ringOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.65] });
  const ringRot     = rotAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg',  '360deg'] });
  const ringRot2    = rotAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });

  const cardBg     = isDark ? 'rgba(18,10,4,0.92)' : 'rgba(255,252,242,0.96)';
  const cardBorder = meta.color + '32';
  const dimText    = isDark ? '#7a5535' : '#a07850';

  return (
    <View style={[ssc.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
      {/* Icon cluster */}
      <View style={ssc.cluster}>
        <Animated.View style={[ssc.glow, {
          backgroundColor: meta.color,
          opacity: glowOpacity,
          transform: [{ scale: glowScale }],
        }]} />
        {tier >= 2 && (
          <Animated.View style={[ssc.ring, {
            borderColor: meta.color + '55',
            opacity: ringOpacity,
            transform: [{ rotate: ringRot }],
          }]} />
        )}
        {tier >= 4 && (
          <Animated.View style={[ssc.ringOuter, {
            borderColor: meta.color + '28',
            opacity: ringOpacity,
            transform: [{ rotate: ringRot2 }],
          }]} />
        )}
        <FontAwesome name={meta.icon as any} size={20} color={meta.color} style={{ zIndex: 3 }} />
      </View>

      {/* Text */}
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 7 }}>
          <Text style={[ssc.count, { color: meta.color }]}>{streak}</Text>
          <Text style={[ssc.label, { color: meta.color }]}>{meta.label}</Text>
        </View>
        <Text style={[ssc.caption, { color: dimText }]}>{meta.caption}</Text>
      </View>
    </View>
  );
}

const ssc = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 20,
  },
  cluster: {
    width: CLUSTER,
    height: CLUSTER,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glow: {
    position: 'absolute',
    width: CLUSTER,
    height: CLUSTER,
    borderRadius: CLUSTER / 2,
  },
  ring: {
    position: 'absolute',
    width: CLUSTER + 18,
    height: CLUSTER + 18,
    borderRadius: (CLUSTER + 18) / 2,
    borderWidth: 1.5,
    top: -9,
    left: -9,
  },
  ringOuter: {
    position: 'absolute',
    width: CLUSTER + 34,
    height: CLUSTER + 34,
    borderRadius: (CLUSTER + 34) / 2,
    borderWidth: 1,
    top: -17,
    left: -17,
  },
  count:   { fontSize: 22, fontWeight: '800', letterSpacing: -0.6 },
  label:   { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  caption: { fontSize: 12, letterSpacing: -0.1 },
});

// ─── Album art: real image with vinyl fallback ────────────────────────────────

function AlbumArt({
  artworkUrl,
  coverColor,
  letter,
  size,
}: {
  artworkUrl: string;
  coverColor: string;
  letter: string;
  size: number;
}) {
  const [errored, setErrored] = useState(false);

  useEffect(() => { setErrored(false); }, [artworkUrl]);

  return (
    <View style={{ width: size, height: size, backgroundColor: coverColor }}>
      {/* Vinyl placeholder */}
      <View style={StyleSheet.absoluteFill}>
        <View style={[va.ring, { width: size * 0.88, height: size * 0.88, borderRadius: size * 0.44, top: size * 0.06, left: size * 0.06 }]} />
        <View style={[va.ring, { width: size * 0.68, height: size * 0.68, borderRadius: size * 0.34, top: size * 0.16, left: size * 0.16 }]} />
        <View style={[va.ring, { width: size * 0.48, height: size * 0.48, borderRadius: size * 0.24, top: size * 0.26, left: size * 0.26 }]} />
        <View style={[va.center, { width: size * 0.3, height: size * 0.3, borderRadius: size * 0.15, top: (size - size * 0.3) / 2, left: (size - size * 0.3) / 2 }]}>
          <Text style={[va.letter, { fontSize: size * 0.11 }]}>{letter.toUpperCase()}</Text>
        </View>
      </View>

      {!!artworkUrl && !errored && (
        <ExpoImage
          source={{ uri: artworkUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="disk"
          transition={400}
          onError={() => setErrored(true)}
        />
      )}
    </View>
  );
}

const va = StyleSheet.create({
  ring:   { position: 'absolute', borderWidth: 1, borderColor: 'rgba(0,0,0,0.25)' },
  center: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' },
  letter: { color: 'rgba(255,255,255,0.85)', fontWeight: '800', letterSpacing: 1 },
});

// ─── Pool artwork cache + loader ─────────────────────────────────────────────

const POOL_ARTWORK_KEY = '@listend:poolArtworks';
const poolCache: Record<string, string> = {};
const poolInFlight = new Set<string>();
const poolListeners: Record<string, Array<(u: string) => void>> = {};
let poolCacheLoaded = false;
let poolFlushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleStorageFlush() {
  if (poolFlushTimer) return;
  poolFlushTimer = setTimeout(() => {
    poolFlushTimer = null;
    AsyncStorage.setItem(POOL_ARTWORK_KEY, JSON.stringify(poolCache)).catch(() => {});
  }, 1500);
}

async function ensurePoolCacheLoaded() {
  if (poolCacheLoaded) return;
  poolCacheLoaded = true;
  try {
    const raw = await AsyncStorage.getItem(POOL_ARTWORK_KEY);
    if (raw) Object.assign(poolCache, JSON.parse(raw));
  } catch {}
}

function requestPoolArtwork(id: string, title: string, artist: string, onReady: (url: string) => void) {
  if (poolCache[id]) { onReady(poolCache[id]); return; }
  if (poolInFlight.has(id)) { (poolListeners[id] ??= []).push(onReady); return; }
  poolInFlight.add(id);
  (poolListeners[id] ??= []).push(onReady);
  fetchAlbumData(title, artist)
    .then(({ artworkUrl }) => {
      poolInFlight.delete(id);
      if (artworkUrl) { poolCache[id] = artworkUrl; scheduleStorageFlush(); }
      const url = artworkUrl || '';
      (poolListeners[id] ?? []).forEach(fn => fn(url));
      delete poolListeners[id];
    })
    .catch(() => { poolInFlight.delete(id); delete poolListeners[id]; });
}

// ─── Listened row ─────────────────────────────────────────────────────────────

type ListenedStatus = FlipStatus | 'library';

function ListenedRow({
  id, title, artist, year, coverColor, status, borderCol, colors, onClose,
}: {
  id: string;
  title: string;
  artist: string;
  year: number;
  coverColor: string;
  status: ListenedStatus;
  borderCol: string;
  colors: (typeof Colors)['light'] | (typeof Colors)['dark'];
  onClose?: () => void;
}) {
  const [artworkUrl, setArtworkUrl] = useState(poolCache[id] ?? '');
  const router = useRouter();

  useEffect(() => {
    let live = true;
    requestPoolArtwork(id, title, artist, (url) => { if (live && url) setArtworkUrl(url); });
    return () => { live = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function handleAlbumPress() {
    onClose?.();
    router.push({ pathname: '/album-detail', params: { id, title, artist, year: String(year), artworkUrl } } as any);
  }

  function handleArtistPress() {
    onClose?.();
    router.push({ pathname: '/artist-detail', params: { name: artist } } as any);
  }

  return (
    <Pressable
      style={({ pressed }) => [sfl.row, { borderBottomColor: borderCol, opacity: pressed ? 0.7 : 1 }]}
      onPress={handleAlbumPress}>
      <View style={[sfl.thumb, { backgroundColor: coverColor }]}>
        {artworkUrl ? (
          <ExpoImage source={{ uri: artworkUrl }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" />
        ) : (
          <Text style={sfl.thumbLetter}>{title.charAt(0).toUpperCase()}</Text>
        )}
      </View>
      <View style={sfl.info}>
        <Text style={[sfl.itemTitle, { color: colors.text }]} numberOfLines={1}>{title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
          <Pressable onPress={handleArtistPress} hitSlop={8}>
            <Text style={[sfl.itemSub, { color: '#D4A017' }]} numberOfLines={1}>{artist}</Text>
          </Pressable>
          <Text style={[sfl.itemSub, { color: colors.subtext }]}> · {year}</Text>
        </View>
      </View>
      {(status === 'logged' || status === 'library') && (
        <View style={[sfl.statusDot, { backgroundColor: '#0f2e1a' }]}>
          <Ionicons name="checkmark" size={14} color="#4ade80" />
        </View>
      )}
      {status === 'pending' && (
        <View style={[sfl.statusDot, { backgroundColor: '#2e1f00' }]}>
          <Ionicons name="time-outline" size={14} color="#f59e0b" />
        </View>
      )}
      {status === 'didnt_listen' && (
        <View style={[sfl.statusDot, { backgroundColor: colors.surface }]}>
          <Ionicons name="close" size={14} color={colors.subtext} />
        </View>
      )}
    </Pressable>
  );
}

// ─── PoolRow — pool list item on main screen ─────────────────────────────────

type PoolItem = { id: string; title: string; artist: string; year: number; coverColor: string };

function PoolRow({ item, status, libraryLogged, borderCol, colors, onClose }: {
  item: PoolItem;
  status: FlipStatus | null;
  libraryLogged: boolean;
  borderCol: string;
  colors: (typeof Colors)['light'] | (typeof Colors)['dark'];
  onClose?: () => void;
}) {
  const resolvedStatus: ListenedStatus | null = status ?? (libraryLogged ? 'library' : null);
  if (!resolvedStatus) return null;
  return (
    <ListenedRow
      id={item.id}
      title={item.title}
      artist={item.artist}
      year={item.year}
      coverColor={item.coverColor}
      status={resolvedStatus}
      borderCol={borderCol}
      colors={colors}
      onClose={onClose}
    />
  );
}

// ─── HistoryThumb ─────────────────────────────────────────────────────────────

function HistoryThumb({ artworkUrl, coverColor, letter }: { artworkUrl: string; coverColor?: string; letter: string }) {
  return (
    <View style={[sfl.thumb, { backgroundColor: coverColor ?? '#2a1e14' }]}>
      {artworkUrl
        ? <ExpoImage source={{ uri: artworkUrl }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" />
        : <Text style={sfl.thumbLetter}>{letter.toUpperCase()}</Text>
      }
    </View>
  );
}

// ─── ProgressModal — alias for FullPoolModal ──────────────────────────────────

function ProgressModal(props: { visible: boolean; onClose: () => void; history: any[] }) {
  return <FullPoolModal {...props} />;
}

// ─── Full Pool Modal ──────────────────────────────────────────────────────────

function FullPoolModal({
  visible, onClose, history,
}: {
  visible: boolean;
  onClose: () => void;
  history: FlippedRecord[];
}) {
  const colorScheme = useColorScheme();
  const colors      = Colors[colorScheme ?? 'light'];

  const { libraryLoggedIds } = useFlip();

  // Deduplicate history by id, keeping most recent entry per album
  const seenIds = new Set<string>();
  const dedupedHistory: FlippedRecord[] = [];
  for (const r of history) {
    if (!seenIds.has(r.id)) { seenIds.add(r.id); dedupedHistory.push(r); }
  }

  const total        = FLIP_POOL.length;
  const loggedCount = libraryLoggedIds.size;
  const listenedPct  = total > 0 ? Math.round(loggedCount / total * 100) : 0;
  const flippedCount = dedupedHistory.length;

  // Pool albums logged some other way (search, etc.) without ever being
  // flipped — shown below the real flips so you can see the full picture of
  // what's covered, but they don't count toward the flipped %/count above.
  const libraryOnlyEntries: FlippedRecord[] = FLIP_POOL
    .filter(a => libraryLoggedIds.has(a.id) && !seenIds.has(a.id))
    .map(a => ({ id: a.id, title: a.title, artist: a.artist, year: a.year, coverColor: a.coverColor, genre: a.genre, flippedAt: 0, status: 'logged' as FlipStatus }));

  const rows = [...dedupedHistory, ...libraryOnlyEntries];

  const bg        = colors.background;
  const borderCol = colors.border;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[sfl.container, { backgroundColor: bg }]}>
        <View style={[sfl.header, { borderBottomColor: borderCol }]}>
          <Text style={[sfl.title, { color: colors.text }]}>My Flipped Records</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {rows.length > 0 ? (
          <>
            <View style={[sfl.summary, { borderBottomColor: borderCol }]}>
              <View style={sfl.summaryRow}>
                <Text style={[sfl.summaryCount, { color: colors.subtext }]}>
                  <Text style={{ color: '#D4A017', fontWeight: '700' }}>{flippedCount}</Text> flipped
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <FontAwesome name="headphones" size={13} color="#D4A017" />
                  <Text style={[sfl.summaryCount, { color: colors.subtext }]}>
                    <Text style={{ color: '#D4A017', fontWeight: '700' }}>{listenedPct}%</Text> logged
                    {'  ·  '}
                    <Text style={{ color: '#D4A017', fontWeight: '700' }}>{loggedCount}</Text> albums
                  </Text>
                </View>
              </View>
              <View style={[sfl.track, { backgroundColor: colors.border }]}>
                <View style={[sfl.fill, { width: `${Math.max(listenedPct, listenedPct > 0 ? 2 : 0)}%` as any }]} />
              </View>
            </View>

            <FlatList
              data={rows}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <PoolRow
                  item={item}
                  status={item.status}
                  libraryLogged={libraryLoggedIds.has(item.id)}
                  borderCol={borderCol}
                  colors={colors}
                  onClose={onClose}
                />
              )}
            />
          </>
        ) : (
          <View style={sfl.emptyWrap}>
            <FontAwesome name="random" size={36} color="#D4A017" />
            <Text style={[sfl.emptyText, { color: colors.subtext }]}>
              Flip your first record to start building your history.
            </Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const sfl = StyleSheet.create({
  container:   { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  title:       { fontSize: 20, fontWeight: '700', letterSpacing: -0.4 },
  summary:     { paddingHorizontal: 20, paddingVertical: 14, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  summaryRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryCount:{ fontSize: 13 },
  track:       { height: 5, borderRadius: 3, overflow: 'hidden' },
  fill:        { height: 5, borderRadius: 3, backgroundColor: '#D4A017' },
  row:         { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  thumb:       { width: 46, height: 46, borderRadius: 7, overflow: 'hidden', flexShrink: 0, justifyContent: 'center', alignItems: 'center' },
  thumbLetter: { color: 'rgba(255,255,255,0.75)', fontSize: 18, fontWeight: '700' },
  info:        { flex: 1, gap: 3 },
  itemTitle:   { fontSize: 14, fontWeight: '600' },
  itemSub:     { fontSize: 12 },
  statusDot:   { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  emptyWrap:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 40 },
  emptyText:   { fontSize: 14, textAlign: 'center', lineHeight: 22 },
});

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: FlipStatus }) {
  const config: Record<FlipStatus, { label: string; bg: string; text: string }> = {
    logged:       { label: 'Logged',        bg: '#0f2e1a', text: '#4ade80' },
    didnt_listen: { label: "Didn't Listen", bg: '#2e2018', text: '#a07850' },
    pending:      { label: 'Pending',        bg: '#2e1f00', text: '#f59e0b' },
  };
  const { label, bg, text } = config[status];
  return (
    <View style={[st.badge, { backgroundColor: bg }]}>
      <Text style={[st.badgeText, { color: text }]}>{label}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  badge:     { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700' },
});

// ─── Flip History Modal ───────────────────────────────────────────────────────

function FlipHistoryModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colorScheme = useColorScheme();
  const colors      = Colors[colorScheme ?? 'light'];
  const router      = useRouter();
  const { history } = useFlip();

  const [cache, setCache] = useState<Record<string, AlbumData>>({});

  useEffect(() => {
    if (!visible || history.length === 0) return;
    const missing = history.filter(r => !cache[r.id]);
    if (missing.length === 0) return;
    Promise.allSettled(
      missing.map(async r => {
        const data = await fetchAlbumData(r.title, r.artist);
        return { flipId: r.id, ...data };
      }),
    ).then(results => {
      const updates: Record<string, AlbumData> = {};
      for (const result of results) {
        if (result.status === 'fulfilled') {
          updates[result.value.flipId] = { spotifyId: result.value.spotifyId, artworkUrl: result.value.artworkUrl };
        }
      }
      if (Object.keys(updates).length > 0) setCache(prev => ({ ...prev, ...updates }));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, history.length]);

  const borderCol = colors.border;
  const bg        = colors.background;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[sm.container, { backgroundColor: bg }]}>
        <View style={[sm.header, { borderBottomColor: borderCol }]}>
          <Text style={[sm.title, { color: colors.text }]}>Flip History</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {history.map((record, i) => {
            const hit = cache[record.id];
            return (
              <TouchableOpacity
                key={`${record.id}-${record.flippedAt}`}
                style={[sm.row, { borderBottomColor: borderCol }, i === history.length - 1 && sm.rowLast]}
                activeOpacity={0.7}
                onPress={() => {
                  onClose();
                  router.push({
                    pathname: '/album-detail',
                    params: {
                      id:         hit?.spotifyId || record.id,
                      title:      record.title,
                      artist:     record.artist,
                      year:       String(record.year),
                      artworkUrl: hit?.artworkUrl ?? '',
                    },
                  } as any);
                }}>
                <HistoryThumb artworkUrl={hit?.artworkUrl ?? ''} coverColor={record.coverColor} letter={record.title.charAt(0)} />
                <View style={sm.info}>
                  <Text style={[sm.itemTitle, { color: colors.text }]} numberOfLines={1}>{record.title}</Text>
                  <Text style={[sm.itemArtist, { color: colors.subtext }]} numberOfLines={1}>{record.artist} · {record.year}</Text>
                </View>
                <StatusBadge status={record.status} />
                <Ionicons name="chevron-forward" size={16} color={colors.subtext} style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const sm = StyleSheet.create({
  container:  { flex: 1 },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  title:      { fontSize: 20, fontWeight: '700', letterSpacing: -0.4 },
  row:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  rowLast:    { borderBottomWidth: 0 },
  thumb:      { width: 52, height: 52, borderRadius: 8, overflow: 'hidden', flexShrink: 0, justifyContent: 'center', alignItems: 'center' },
  thumbLetter:{ color: 'rgba(255,255,255,0.75)', fontSize: 20, fontWeight: '700' },
  info:       { flex: 1, gap: 3 },
  itemTitle:  { fontSize: 15, fontWeight: '600' },
  itemArtist: { fontSize: 13 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FlipARecordScreen() {
  const colorScheme = useColorScheme();
  const colors      = Colors[colorScheme ?? 'light'];
  const isDark      = colorScheme === 'dark';
  const router      = useRouter();
  const navigation  = useNavigation();

  const { history, cooldownUntil, currentFlip, poolExhausted, libraryLoggedIds, flip, markLogged, markDidntListen } = useFlip();
  const { setPendingAlbum, addToWantToListen, removeFromWantToListen, wantToListen, loggedAlbums } = useAlbums();
  const { user } = useAuth();

  const [now, setNow]                          = useState(Date.now());
  const [fullListVisible, setFullListVisible]  = useState(false);
  const [artworkUrl, setArtworkUrl]            = useState('');
  const [spotifyId,  setSpotifyId]             = useState('');
  const [recentCache, setRecentCache]          = useState<Record<string, AlbumData>>({});
  const [friendFlips, setFriendFlips]          = useState<{ userId: string; username: string; avatarUrl: string | null; albumTitle: string; albumArtist: string; streak: number }[]>([]);

  // Streaming sheet
  const [showStreamSheet, setShowStreamSheet] = useState(false);
  const [amazonMusicUrl, setAmazonMusicUrl]   = useState<string | null>(null);
  const [amazonFetching, setAmazonFetching]   = useState(false);
  const [amazonFetched, setAmazonFetched]     = useState(false);
  const [amazonTapped, setAmazonTapped]       = useState(false);

  // ── Countdown ticker ──────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);



  // ── Fetch data when a new album is revealed ───────────────────────────────
  useEffect(() => {
    if (!currentFlip) { setArtworkUrl(''); setSpotifyId(''); return; }
    setArtworkUrl('');
    setSpotifyId('');
    setAmazonMusicUrl(null);
    setAmazonFetched(false);
    const savedFlip = currentFlip;
    fetchAlbumData(savedFlip.title, savedFlip.artist).then(({ artworkUrl: url, spotifyId: sid }) => {
      setArtworkUrl(url);
      setSpotifyId(sid);
      // Insert into Supabase with artwork in one shot so Recent Activity always has the cover
      if (user) {
        supabase.from('flip_records').upsert({
          user_id:      user.id,
          album_title:  savedFlip.title,
          album_artist: savedFlip.artist,
          album_year:   savedFlip.year,
          flipped_at:   new Date(savedFlip.flippedAt).toISOString(),
          artwork_url:  url || null,
        }, { onConflict: 'user_id,flipped_at' }).then(() => {});
      }
    });
  }, [currentFlip?.id]);

  // ── Fetch data for the last 3 history items ───────────────────────────────
  useEffect(() => {
    const recent  = history.slice(0, 3);
    const missing = recent.filter(r => !recentCache[r.id]);
    if (missing.length === 0) return;
    Promise.allSettled(
      missing.map(async r => {
        const data = await fetchAlbumData(r.title, r.artist);
        return { flipId: r.id, ...data };
      }),
    ).then(results => {
      const updates: Record<string, AlbumData> = {};
      for (const res of results) {
        if (res.status === 'fulfilled') updates[res.value.flipId] = { spotifyId: res.value.spotifyId, artworkUrl: res.value.artworkUrl };
      }
      if (Object.keys(updates).length > 0) setRecentCache(prev => ({ ...prev, ...updates }));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.length]);

  // ── Friend flips today ────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function load() {
      const { data: follows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user!.id);
      if (cancelled || !follows?.length) return;

      const ids = follows.map((f: any) => f.following_id);
      const today = new Date(); today.setHours(0, 0, 0, 0);

      const { data: flips } = await supabase
        .from('flip_records')
        .select('user_id, album_title, album_artist')
        .in('user_id', ids)
        .gte('flipped_at', today.toISOString())
        .order('flipped_at', { ascending: false });
      if (cancelled || !flips?.length) return;

      const uniqueIds = [...new Set((flips as any[]).map(f => f.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', uniqueIds);
      if (cancelled) return;

      // Pull each friend's recent flip history to derive their current streak
      // (consecutive calendar days with at least one flip, counting back from today).
      const since = new Date(today); since.setDate(since.getDate() - 60);
      const { data: historyRows } = await supabase
        .from('flip_records')
        .select('user_id, flipped_at')
        .in('user_id', uniqueIds)
        .gte('flipped_at', since.toISOString());
      if (cancelled) return;

      const datesByUser = new Map<string, Set<string>>();
      for (const row of (historyRows ?? []) as any[]) {
        const dateKey = new Date(row.flipped_at).toDateString();
        if (!datesByUser.has(row.user_id)) datesByUser.set(row.user_id, new Set());
        datesByUser.get(row.user_id)!.add(dateKey);
      }
      function computeStreak(userId: string): number {
        const dates = datesByUser.get(userId);
        if (!dates) return 0;
        let count = 0;
        const cursor = new Date(today);
        while (dates.has(cursor.toDateString())) {
          count++;
          cursor.setDate(cursor.getDate() - 1);
        }
        return count;
      }

      const pm = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      const seen = new Set<string>();
      const result: typeof friendFlips = [];
      for (const flip of flips as any[]) {
        if (seen.has(flip.user_id)) continue;
        seen.add(flip.user_id);
        const p = pm.get(flip.user_id);
        result.push({
          userId:      flip.user_id,
          username:    p?.username ?? 'Someone',
          avatarUrl:   p?.avatar_url ?? null,
          albumTitle:  flip.album_title,
          albumArtist: flip.album_artist ?? '',
          streak:      computeStreak(flip.user_id),
        });
        if (result.length >= 3) break;
      }
      setFriendFlips(result);
    }
    load().catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id]);

  // ── Reveal animation ──────────────────────────────────────────────────────
  const revealAnim = useRef(new Animated.Value(0)).current;
  const prevFlipId = useRef<string | null>(null);

  useEffect(() => {
    const newId = currentFlip?.id ?? null;
    if (newId !== null && newId !== prevFlipId.current) {
      revealAnim.setValue(0);
      Animated.timing(revealAnim, {
        toValue: 1,
        duration: 480,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: true,
      }).start();
    }
    prevFlipId.current = newId;
  }, [currentFlip?.id]);

  const revealOpacity    = revealAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const revealScale      = revealAnim.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] });
  const revealTranslateY = revealAnim.interpolate({ inputRange: [0, 1], outputRange: [48, 0] });

  // ── Vinyl animations ──────────────────────────────────────────────────────
  // Idle: slow continuous rotation
  const vinylIdleSpin = useRef(new Animated.Value(0)).current;
  // On press: fast spin before reveal
  const vinylFlipSpin = useRef(new Animated.Value(0)).current;

  const vinylIdleRotate = vinylIdleSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const vinylFlipRotate = vinylFlipSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '1080deg'] });

  // Start idle loop when flip button is shown
  const cooldownActive = cooldownUntil !== null && now < cooldownUntil;
  const remainingMs    = cooldownActive ? cooldownUntil - now : 0;
  const hasPendingFlip = currentFlip?.status === 'pending';
  const showAlbumCard  = cooldownActive && hasPendingFlip;
  const showHowWas     = !cooldownActive && hasPendingFlip;
  const showFlipButton = !poolExhausted && !showAlbumCard && !showHowWas;
  const hasAlbum       = showAlbumCard || showHowWas;

  useEffect(() => {
    if (!showFlipButton) {
      vinylIdleSpin.stopAnimation();
      return;
    }
    vinylIdleSpin.setValue(0);
    const loop = Animated.loop(
      Animated.timing(vinylIdleSpin, {
        toValue: 1,
        duration: 5000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [showFlipButton]);

  function handleFlipPress() {
    vinylFlipSpin.setValue(0);
    Animated.timing(vinylFlipSpin, {
      toValue: 1,
      duration: 560,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      vinylFlipSpin.setValue(0);
      flip();
    });
  }

  // ── State flags ───────────────────────────────────────────────────────────
  const detailId = spotifyId || currentFlip?.id || '';

  const isWanted = currentFlip
    ? wantToListen.some(a => a.id === detailId || a.id === currentFlip.id)
    : false;

  const isAlreadyLogged = currentFlip
    ? loggedAlbums.some(a => a.id === detailId || a.id === currentFlip.id)
    : false;

  // Tracks which flip we just sent through "Log It", so once the save is
  // confirmed (isAlreadyLogged flips true) we can advance straight to the
  // next-flip/cooldown screen instead of stopping at the "already logged"
  // confirmation panel — that panel is only meant for albums that were
  // logged before this flip even happened.
  const attemptedLogRef = useRef<string | null>(null);
  useEffect(() => {
    if (currentFlip && isAlreadyLogged && attemptedLogRef.current === currentFlip.id) {
      attemptedLogRef.current = null;
      markLogged(currentFlip.id);
    }
  }, [currentFlip, isAlreadyLogged, markLogged]);

  const flipStreamLinks = currentFlip ? {
    appleMusic:   detailId ? `https://music.apple.com/us/album/${detailId}` : null,
    spotify:      `https://open.spotify.com/search/${encodeURIComponent(`${currentFlip.title} ${currentFlip.artist}`)}`,
    youtubeMusic: `https://music.youtube.com/search?q=${encodeURIComponent(`${currentFlip.title} ${currentFlip.artist}`)}`,
    amazonMusic:  amazonMusicUrl,
  } : null;

  function handleStream() {
    setShowStreamSheet(true);
    if (amazonFetched || amazonFetching || !detailId) return;
    setAmazonFetching(true);
    fetch(`${API_URL}/api/albums/streaming-links?appleId=${encodeURIComponent(detailId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.amazonMusic) setAmazonMusicUrl(data.amazonMusic); })
      .catch(err => console.warn('[flip-a-record] amazon music link error:', err))
      .finally(() => { setAmazonFetched(true); setAmazonFetching(false); });
  }

  function handleAmazonPressFlip() {
    if (amazonMusicUrl) { Linking.openURL(amazonMusicUrl); setShowStreamSheet(false); }
    else if (amazonFetching) { setAmazonTapped(true); }
  }

  useEffect(() => {
    if (amazonTapped && !amazonFetching && amazonMusicUrl) {
      Linking.openURL(amazonMusicUrl);
      setShowStreamSheet(false);
      setAmazonTapped(false);
    }
  }, [amazonTapped, amazonFetching, amazonMusicUrl]);

  // Derive streak: consecutive logged flips — skip the pending one at the top
  const streak = (() => {
    let count = 0;
    for (const r of history) {
      if (r.status === 'pending') continue;
      if (r.status === 'logged') count++;
      else break;
    }
    return count;
  })();

  const borderCol = colors.border;
  const cardBg    = colors.background;

  return (
    <>
      <Stack.Screen options={{ title: 'Flip a Record' }} />

      {/* ── Streaming sheet ────────────────────────────────────────────────── */}
      <Modal visible={showStreamSheet} transparent animationType="slide" onRequestClose={() => setShowStreamSheet(false)}>
        <Pressable style={sf.streamOverlay} onPress={() => setShowStreamSheet(false)}>
          <Pressable style={[sf.streamSheet, { backgroundColor: isDark ? '#141414' : '#fff' }]} onPress={() => {}}>
            <View style={sf.streamHandle} />
            <Text style={[sf.streamTitle, { color: colors.text }]}>Listen on…</Text>
            {flipStreamLinks && ([
              { key: 'appleMusic'   as const, label: 'Apple Music',   icon: 'apple'        as const, color: '#FC3C44' },
              { key: 'spotify'      as const, label: 'Spotify',       icon: 'spotify'      as const, color: '#1DB954' },
              { key: 'youtubeMusic' as const, label: 'YouTube Music', icon: 'youtube-play' as const, color: '#FF0000' },
              { key: 'amazonMusic'  as const, label: 'Amazon Music',  icon: 'amazon'       as const, color: '#00A8E1' },
            ]).filter(p => p.key !== 'amazonMusic' || !amazonFetched || amazonMusicUrl).map(platform => {
              const isAmazon = platform.key === 'amazonMusic';
              const loading  = isAmazon && (amazonFetching || amazonTapped);
              return (
                <Pressable
                  key={platform.key}
                  style={({ pressed }) => [sf.streamRow, { borderBottomColor: isDark ? '#2a1e14' : '#f0f0f0', opacity: pressed ? 0.6 : 1 }]}
                  onPress={isAmazon ? handleAmazonPressFlip : () => { Linking.openURL(flipStreamLinks[platform.key]!); setShowStreamSheet(false); }}>
                  <FontAwesome name={platform.icon} size={20} color={platform.color} />
                  <Text style={[sf.streamLabel, { color: colors.text }]}>{platform.label}</Text>
                  {loading
                    ? <ActivityIndicator size="small" color={platform.color} />
                    : <FontAwesome name="chevron-right" size={13} color={colors.subtext} />}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      <ProgressModal
        visible={fullListVisible}
        onClose={() => setFullListVisible(false)}
        history={history}
      />

      {/* Subtle color tint from album cover */}
      {hasAlbum && currentFlip && (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: currentFlip.coverColor, opacity: 0.08 }]}
        />
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={sf.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* ── Pool exhausted ──────────────────────────────────────────── */}
        {poolExhausted && (
          <View style={[sf.emptyCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
            <FontAwesome name="trophy" size={40} color="#D4A017" />
            <Text style={[sf.emptyTitle, { color: colors.text }]}>You've flipped every record!</Text>
            <Text style={[sf.emptySubtext, { color: colors.subtext }]}>
              Albums return to the pool once you dismiss or log them.
            </Text>
          </View>
        )}

        {/* ── Idle: spinning vinyl ────────────────────────────────────── */}
        {showFlipButton && (
          <View style={sf.idleSection}>
            {/* Atmospheric glow */}
            <View style={sf.idleGlow} />

            {/* Vinyl — tap or use button below */}
            <Pressable onPress={handleFlipPress}>
              <Animated.View
                style={[sf.vinyl, { transform: [{ rotate: vinylIdleRotate }, { rotate: vinylFlipRotate }] }]}>
                {/* Groove rings */}
                {[256, 228, 200, 172, 144, 116].map((d) => (
                  <View key={d} style={[sf.groove, { width: d, height: d, borderRadius: d / 2 }]} />
                ))}
                {/* Center label */}
                <LinearGradient
                  colors={['#D4A017', '#B8880F']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={sf.vinylLabel}>
                  <Text style={sf.vinylLabelText}>LISTEND</Text>
                </LinearGradient>
                {/* Center hole */}
                <View style={sf.vinylHole} />
              </Animated.View>
            </Pressable>

            {/* Flip button */}
            <View style={sf.idleTextWrap}>
              <Pressable
                style={({ pressed }) => [sf.flipBtn, { opacity: pressed ? 0.88 : 1 }]}
                onPress={handleFlipPress}>
                <FontAwesome name="random" size={22} color="#fff" />
              </Pressable>
              <Text style={[sf.flipBtnText, { color: colors.text }]}>Flip a Record</Text>
              <Text style={[sf.idleHint, { color: colors.subtext }]}>
                Flip into something legendary
              </Text>
            </View>
          </View>
        )}

        {/* ── Album revealed ──────────────────────────────────────────── */}
        {hasAlbum && currentFlip && (
          <Animated.View style={{
            opacity: revealOpacity,
            transform: [{ scale: revealScale }, { translateY: revealTranslateY }],
          }}>
            <View style={[sf.albumCard, {
              backgroundColor: cardBg,
              borderColor: borderCol,
              shadowColor: currentFlip.coverColor,
              shadowOpacity: 0.55,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: 8 },
            }]}>

              {/* Hero art — full bleed */}
              <View>
                <AlbumArt
                  artworkUrl={artworkUrl}
                  coverColor={currentFlip.coverColor}
                  letter={currentFlip.title.charAt(0)}
                  size={ART_SIZE}
                />
                {isAlreadyLogged && (
                  <View style={sf.loggedBadge}>
                    <Ionicons name="headset" size={13} color="#D4A017" />
                    <Text style={sf.loggedBadgeText}>Listend</Text>
                  </View>
                )}
                {/* Bottom gradient fade */}
                <LinearGradient
                  colors={['transparent', isDark ? 'rgba(15,10,7,0.85)' : 'rgba(255,255,255,0.85)', cardBg]}
                  style={sf.artGradient}
                />
              </View>

              {/* Info */}
              <View style={sf.infoBlock}>
                {currentFlip.genre && (
                  <View style={[sf.genrePill, { backgroundColor: isDark ? colors.surface : colors.elevated }]}>
                    <Text style={[sf.genreText, { color: colors.subtext }]}>{currentFlip.genre}</Text>
                  </View>
                )}
                <Pressable
                  onPress={() => router.push({
                    pathname: '/album-detail',
                    params: { id: detailId || currentFlip.id, title: currentFlip.title, artist: currentFlip.artist, year: String(currentFlip.year), artworkUrl },
                  } as any)}
                  style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}>
                  <Text style={[sf.albumTitle, { color: colors.text }]} numberOfLines={3}>{currentFlip.title}</Text>
                </Pressable>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 0 }}>
                  <Pressable
                    onPress={() => router.push({ pathname: '/artist-detail', params: { name: currentFlip.artist } } as any)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}>
                    <Text style={[sf.albumArtist, sf.tappable, { color: colors.subtext }]}>{currentFlip.artist}</Text>
                  </Pressable>
                  <Text style={[sf.albumArtist, { color: colors.subtext }]}> · {currentFlip.year}</Text>
                </View>
              </View>

              {/* Cooldown actions */}
              {showAlbumCard && (
                <View style={sf.actionsBlock}>
                  <Pressable
                    style={({ pressed }) => [sf.actionSavedOutline, { opacity: pressed ? 0.75 : 1 }]}
                    onPress={() => {
                      if (isWanted) {
                        const savedId = wantToListen.find(a => a.id === detailId || a.id === currentFlip.id)?.id ?? detailId;
                        removeFromWantToListen(savedId);
                      } else {
                        addToWantToListen({ id: detailId || currentFlip.id, title: currentFlip.title, artist: currentFlip.artist, year: currentFlip.year, artworkUrl });
                      }
                    }}>
                    <FontAwesome name={isWanted ? 'bookmark' : 'bookmark-o'} size={14} color="#D4A017" />
                    <Text style={sf.actionSavedText}>
                      {isWanted ? 'Saved' : 'Want to Listen'}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [sf.actionSecondary, { borderColor: '#D4A017', opacity: pressed ? 0.8 : 1 }]}
                    onPress={handleStream}>
                    <FontAwesome name="music" size={14} color="#D4A017" />
                    <Text style={[sf.actionSecondaryText, { color: '#D4A017' }]}>Listen on</Text>
                  </Pressable>
                </View>
              )}

              {/* How was it / Already logged */}
              {showHowWas && (
                <View style={sf.actionsBlock}>
                  {isAlreadyLogged ? (
                    <>
                      <Text style={[sf.howWasHeading, { color: colors.text }]}>You already logged this one</Text>
                      <View style={sf.howWasRow}>
                        <Pressable
                          style={({ pressed }) => [sf.actionPrimary, sf.flex1, { opacity: pressed ? 0.8 : 1 }]}
                          onPress={() => {
                            markLogged(currentFlip.id);
                            router.push({
                              pathname: '/album-detail',
                              params: { id: detailId || currentFlip.id, title: currentFlip.title, artist: currentFlip.artist, year: String(currentFlip.year), artworkUrl },
                            } as any);
                          }}>
                          <FontAwesome name="headphones" size={14} color="#fff" />
                          <Text style={sf.actionPrimaryText}>View Review</Text>
                        </Pressable>
                        <Pressable
                          style={({ pressed }) => [sf.actionSecondary, sf.flex1, { borderColor: '#D4A017', opacity: pressed ? 0.8 : 1 }]}
                          onPress={() => markLogged(currentFlip.id)}>
                          <Text style={[sf.actionSecondaryText, { color: '#D4A017' }]}>Skip</Text>
                        </Pressable>
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={[sf.howWasHeading, { color: colors.text }]}>
                        {streak > 0
                          ? `Keep your ${STREAK_META[getStreakTier(streak)].label} going`
                          : 'How was it?'}
                      </Text>
                      <View style={sf.howWasRow}>
                        <Pressable
                          style={({ pressed }) => [sf.actionPrimary, sf.flex1, { opacity: pressed ? 0.8 : 1 }]}
                          onPress={async () => {
                            let amId = spotifyId;
                            let art  = artworkUrl;
                            if (!amId) {
                              const fetched = await fetchAlbumData(currentFlip.title, currentFlip.artist);
                              amId = fetched.spotifyId;
                              if (fetched.artworkUrl) art = fetched.artworkUrl;
                            }
                            attemptedLogRef.current = currentFlip.id;
                            setPendingAlbum({ spotifyId: amId || currentFlip.id, title: currentFlip.title, artist: currentFlip.artist, year: currentFlip.year, artworkUrl: art, flipId: currentFlip.id });
                            router.push('/log-album');
                          }}>
                          <FontAwesome name="plus" size={14} color="#fff" />
                          <Text style={sf.actionPrimaryText}>Log It</Text>
                        </Pressable>
                        <Pressable
                          style={({ pressed }) => [sf.actionSecondary, sf.flex1, { borderColor: '#D4A017', opacity: pressed ? 0.8 : 1 }]}
                          onPress={() => markDidntListen(currentFlip.id)}>
                          <Text style={[sf.actionSecondaryText, { color: '#D4A017' }]}>Didn't Listen</Text>
                        </Pressable>
                      </View>
                    </>
                  )}
                </View>
              )}

              {/* Countdown */}
              {cooldownActive && (
                <View style={sf.countdownWrap}>
                  <Ionicons name="time-outline" size={14} color={colors.subtext} />
                  <Text style={[sf.countdown, { color: colors.subtext }]}>
                    {`Next flip in ${formatCountdown(remainingMs)}`}
                  </Text>
                </View>
              )}
            </View>
          </Animated.View>
        )}

        {/* ── Progress stats ──────────────────────────────────────────── */}
        {!poolExhausted && (() => {
          const total       = FLIP_POOL.length;
          const flipped     = new Set(history.map(r => r.id)).size;
          const loggedCount = libraryLoggedIds.size;
          const listenedPct = total > 0 ? Math.round(loggedCount / total * 100) : 0;
          const flipPct     = total > 0 ? loggedCount / total : 0;
          return (
            <>
              <StreakCard streak={streak} isDark={isDark} />
              <Pressable
                style={({ pressed }) => [sf.statsBlock, { opacity: pressed ? 0.75 : 1 }]}
                onPress={() => setFullListVisible(true)}>
                <View style={sf.statsRow}>
                  <Text style={[sf.statsLabel, { color: colors.subtext }]}>
                    <Text style={{ color: '#D4A017', fontWeight: '700' }}>{flipped}</Text>{'  flipped'}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <FontAwesome name="headphones" size={13} color="#D4A017" />
                    <Text style={[sf.statsLabel, { color: colors.subtext }]}>
                      {' '}<Text style={{ color: '#D4A017', fontWeight: '700' }}>{listenedPct}%</Text>{' listened'}
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color={colors.subtext} />
                  </View>
                </View>
                <View style={[sf.track, { backgroundColor: colors.border }]}>
                  <View style={[sf.fill, { width: `${Math.max(flipPct * 100, flipPct > 0 ? 2 : 0)}%` as any }]} />
                </View>
              </Pressable>
            </>
          );
        })()}

        {/* ── Recently Flipped ────────────────────────────────────────── */}
        {history.length > 0 && (
          <View style={sf.recentBlock}>
            <Text style={[sf.recentHeading, { color: colors.text }]}>Recently Flipped</Text>
            {history.slice(0, 3).map((record) => {
              const hit = recentCache[record.id];
              return (
                <Pressable
                  key={`${record.id}-${record.flippedAt}`}
                  style={({ pressed }) => [
                    sf.recentRow,
                    { backgroundColor: colors.surface, borderColor: borderCol, opacity: pressed ? 0.7 : 1 },
                  ]}
                  onPress={() => router.push({
                    pathname: '/album-detail',
                    params: { id: hit?.spotifyId || record.id, title: record.title, artist: record.artist, year: String(record.year), artworkUrl: hit?.artworkUrl ?? '' },
                  } as any)}>
                  <View style={[sf.recentThumb, { backgroundColor: record.coverColor }]}>
                    {!!hit?.artworkUrl && (
                      <ExpoImage source={{ uri: hit.artworkUrl }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" />
                    )}
                    {!hit?.artworkUrl && (
                      <Text style={sf.recentThumbLetter}>{record.title.charAt(0).toUpperCase()}</Text>
                    )}
                  </View>
                  <View style={sf.recentInfo}>
                    <Text style={[sf.recentTitle, { color: colors.text }]} numberOfLines={1}>{record.title}</Text>
                    <Text style={[sf.recentArtist, { color: colors.subtext }]} numberOfLines={1}>{record.artist} · {record.year}</Text>
                  </View>
                  <StatusBadge status={record.status} />
                  <Ionicons name="chevron-forward" size={16} color={colors.subtext} style={{ marginLeft: 4 }} />
                </Pressable>
              );
            })}
          </View>
        )}

        {/* ── Friends discovering today ───────────────────────────── */}
        {friendFlips.length > 0 && (
          <View style={sf.friendsBlock}>
            <Text style={[sf.friendsHeading, { color: colors.subtext }]}>
              {friendFlips.length === 1 ? '1 FRIEND DISCOVERED TODAY' : `${friendFlips.length} FRIENDS DISCOVERED TODAY`}
            </Text>
            {friendFlips.map(f => (
              <View key={f.userId} style={[sf.friendRow, { borderBottomColor: borderCol }]}>
                {f.avatarUrl ? (
                  <ExpoImage source={{ uri: f.avatarUrl }} style={sf.friendAvatar} contentFit="cover" cachePolicy="disk" />
                ) : (
                  <View style={[sf.friendAvatar, { backgroundColor: isDark ? '#2a1e14' : '#e8e0d0', justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={{ color: '#D4A017', fontSize: 13, fontWeight: '700' }}>{f.username.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[sf.friendName, { color: colors.text }]} numberOfLines={1}>@{f.username}</Text>
                  <Text style={[sf.friendAlbum, { color: colors.subtext }]} numberOfLines={1}>
                    {f.albumTitle}{f.albumArtist ? ` · ${f.albumArtist}` : ''}
                  </Text>
                </View>
                {f.streak > 0 && (
                  <View style={sf.friendStreak}>
                    <FontAwesome name="fire" size={12} color="#D4A017" />
                    <Text style={sf.friendStreakNum}>{f.streak}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

      </ScrollView>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const sf = StyleSheet.create({
  scrollContent: { padding: 20, paddingBottom: 60 },

  // Idle state
  idleSection:  { alignItems: 'center', gap: 36, paddingTop: 40, paddingBottom: 16 },
  idleGlow:     { position: 'absolute', width: 340, height: 340, borderRadius: 170, backgroundColor: '#D4A017', opacity: 0.07, top: 0 },
  idleTextWrap: { alignItems: 'center', gap: 14 },
  idleHint:     { fontSize: 14, textAlign: 'center', letterSpacing: -0.2 },

  // Vinyl
  vinyl: {
    width: 268,
    height: 268,
    borderRadius: 134,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.65,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 14,
  },
  groove:        { position: 'absolute', borderWidth: 1, borderColor: 'rgba(255,255,255,0.055)' },
  vinylLabel:    { width: 98, height: 98, borderRadius: 49, justifyContent: 'center', alignItems: 'center' },
  vinylLabelText:{ color: 'rgba(255,255,255,0.92)', fontSize: 10, fontWeight: '800', letterSpacing: 2.5 },
  vinylHole:     { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: '#0a0a0a' },

  // Flip button — circle
  flipBtn:     { width: 86, height: 86, borderRadius: 43, backgroundColor: '#D4A017', alignItems: 'center', justifyContent: 'center', shadowColor: '#D4A017', shadowOpacity: 0.4, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  flipBtnText: { fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },

  // Pool exhausted
  emptyCard:    { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 40, alignItems: 'center', gap: 14 },
  emptyTitle:   { fontSize: 18, fontWeight: '700', textAlign: 'center', letterSpacing: -0.3 },
  emptySubtext: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  albumCard:   { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  artWrap:     { position: 'relative' },
  artGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 80 },
  loggedBadge: { position: 'absolute', top: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 5 },
  loggedBadgeText: { color: '#D4A017', fontSize: 12, fontWeight: '700' },

  infoBlock:  { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 4, gap: 6 },
  genrePill:  { alignSelf: 'flex-start', borderRadius: 100, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 2 },
  genreText:  { fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  albumTitle: { fontSize: 26, fontWeight: '800', letterSpacing: -0.6, lineHeight: 31 },
  albumArtist:{ fontSize: 15, lineHeight: 20 },
  tappable:   { textDecorationLine: 'underline' },

  actionsBlock:  { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 4, gap: 10 },
  howWasHeading: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  howWasRow:     { flexDirection: 'row', gap: 10 },

  actionPrimary:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#D4A017', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16 },
  actionSavedOutline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'transparent', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: '#D4A017' },
  actionPrimaryText:  { color: '#fff', fontSize: 15, fontWeight: '600' },
  actionSavedText:    { color: '#D4A017', fontSize: 15, fontWeight: '600' },
  actionSecondary:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 16 },
  actionSecondaryText:{ fontSize: 15, fontWeight: '500' },
  flex1: { flex: 1 },

  countdownWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 20 },
  countdown:     { fontSize: 13, fontWeight: '500', letterSpacing: -0.1 },

  // Stats
  statsBlock:   { marginTop: 12, gap: 8 },
  statsRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statsLabel:   { fontSize: 13 },
  track:        { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill:         { height: 4, borderRadius: 2, backgroundColor: '#D4A017' },

  // Friends section
  friendsBlock:   { marginTop: 28, gap: 0 },
  friendsHeading: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 8 },
  friendRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  friendAvatar:   { width: 34, height: 34, borderRadius: 17, overflow: 'hidden', flexShrink: 0 },
  friendName:     { fontSize: 13, fontWeight: '600' },
  friendAlbum:    { fontSize: 12 },
  friendStreak:   { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 0 },
  friendStreakNum:{ fontSize: 13, fontWeight: '700', color: '#D4A017' },

  // Recently flipped
  recentBlock:       { marginTop: 28, gap: 10 },
  recentHeading:     { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  recentRow:         { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  recentThumb:       { width: 48, height: 48, borderRadius: 8, overflow: 'hidden', flexShrink: 0, justifyContent: 'center', alignItems: 'center' },
  recentThumbLetter: { color: 'rgba(255,255,255,0.75)', fontSize: 18, fontWeight: '700' },
  recentInfo:        { flex: 1, gap: 2 },
  recentTitle:       { fontSize: 14, fontWeight: '600' },
  recentArtist:      { fontSize: 12 },

  // Streaming sheet
  streamOverlay: { flex: 1, justifyContent: 'flex-end' },
  streamSheet:   { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 12, paddingBottom: 40 },
  streamHandle:  { width: 36, height: 4, borderRadius: 2, backgroundColor: '#4a3020', alignSelf: 'center', marginBottom: 16 },
  streamTitle:   { fontSize: 17, fontWeight: '700', paddingHorizontal: 20, marginBottom: 12 },
  streamRow:     { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  streamLabel:   { flex: 1, fontSize: 16, fontWeight: '500' },
});
