import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useNavigation, Stack } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useFlip, FlipStatus } from '@/context/FlipContext';
import { useAlbums } from '@/context/AlbumsContext';
import { FLIP_POOL } from '@/constants/FlipPool';

const API_URL   = process.env.EXPO_PUBLIC_API_URL ?? '';
const { width: SCREEN_W } = Dimensions.get('window');
const ART_SIZE  = SCREEN_W - 48;

// ─── Shared fetch helper ──────────────────────────────────────────────────────
// Returns the real Spotify ID and artwork URL for an album title + artist.
// Used by both the hero card and the history modal.

type AlbumData = { spotifyId: string; artworkUrl: string };

async function fetchAlbumData(title: string, artist: string): Promise<AlbumData> {
  try {
    const q   = encodeURIComponent(`album:${title} artist:${artist}`);
    const res = await fetch(`${API_URL}/search?q=${q}&type=album`);
    if (!res.ok) return { spotifyId: '', artworkUrl: '' };
    const data: { id: string; artworkUrl: string }[] = await res.json();
    const hit = data[0];
    return { spotifyId: hit?.id ?? '', artworkUrl: hit?.artworkUrl ?? '' };
  } catch {
    return { spotifyId: '', artworkUrl: '' };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCountdown(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

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
  const imgFade = useRef(new Animated.Value(0)).current;
  const [errored, setErrored] = useState(false);

  useEffect(() => { setErrored(false); imgFade.setValue(0); }, [artworkUrl]);

  function handleLoad() {
    Animated.timing(imgFade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }

  return (
    <View style={{ width: size, height: size, borderRadius: 12, overflow: 'hidden', backgroundColor: coverColor }}>
      {/* Vinyl placeholder — always rendered as base layer */}
      <View style={StyleSheet.absoluteFill}>
        <View style={[va.ring, { width: size * 0.88, height: size * 0.88, borderRadius: size * 0.44, top: size * 0.06, left: size * 0.06 }]} />
        <View style={[va.ring, { width: size * 0.68, height: size * 0.68, borderRadius: size * 0.34, top: size * 0.16, left: size * 0.16 }]} />
        <View style={[va.ring, { width: size * 0.48, height: size * 0.48, borderRadius: size * 0.24, top: size * 0.26, left: size * 0.26 }]} />
        <View style={[va.center, { width: size * 0.3, height: size * 0.3, borderRadius: size * 0.15, top: (size - size * 0.3) / 2, left: (size - size * 0.3) / 2 }]}>
          <Text style={[va.letter, { fontSize: size * 0.11 }]}>{letter.toUpperCase()}</Text>
        </View>
      </View>

      {/* Real cover fades in once loaded */}
      {!!artworkUrl && !errored && (
        <Animated.Image
          source={{ uri: artworkUrl }}
          style={[StyleSheet.absoluteFill, { opacity: imgFade }]}
          resizeMode="cover"
          onLoad={handleLoad}
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

// ─── History thumbnail: real image with colored-block fallback ────────────────

function HistoryThumb({
  artworkUrl,
  coverColor,
  letter,
}: {
  artworkUrl: string;
  coverColor: string;
  letter: string;
}) {
  const [errored, setErrored] = useState(false);

  useEffect(() => { setErrored(false); }, [artworkUrl]);

  return (
    <View style={[sm.thumb, { backgroundColor: coverColor }]}>
      {!!artworkUrl && !errored ? (
        <Image
          source={{ uri: artworkUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setErrored(true)}
        />
      ) : (
        <Text style={sm.thumbLetter}>{letter.toUpperCase()}</Text>
      )}
    </View>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: FlipStatus }) {
  const config: Record<FlipStatus, { label: string; bg: string; text: string }> = {
    logged:       { label: 'Logged',        bg: '#0f2e1a', text: '#4ade80' },
    didnt_listen: { label: "Didn't Listen", bg: '#1e1e1e', text: '#888'    },
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
  const isDark      = colorScheme === 'dark';
  const router      = useRouter();
  const { history } = useFlip();

  // Per-record cache: flip record id → { spotifyId, artworkUrl }
  const [cache, setCache] = useState<Record<string, AlbumData>>({});

  // Fetch data for any history items not yet cached, whenever modal opens or history grows
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
          updates[result.value.flipId] = {
            spotifyId:  result.value.spotifyId,
            artworkUrl: result.value.artworkUrl,
          };
        }
      }
      if (Object.keys(updates).length > 0) {
        setCache(prev => ({ ...prev, ...updates }));
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, history.length]);

  const borderCol = isDark ? '#222' : '#e0e0e0';
  const bg        = isDark ? '#111' : '#fff';

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
                      // Use the real Spotify ID when available so the detail
                      // screen can load tracks, Last.fm data, etc.
                      id:         hit?.spotifyId || record.id,
                      title:      record.title,
                      artist:     record.artist,
                      year:       String(record.year),
                      artworkUrl: hit?.artworkUrl ?? '',
                    },
                  } as any);
                }}>
                <HistoryThumb
                  artworkUrl={hit?.artworkUrl ?? ''}
                  coverColor={record.coverColor}
                  letter={record.title.charAt(0)}
                />
                <View style={sm.info}>
                  <Text style={[sm.itemTitle, { color: colors.text }]} numberOfLines={1}>
                    {record.title}
                  </Text>
                  <Text style={[sm.itemArtist, { color: colors.subtext }]} numberOfLines={1}>
                    {record.artist} · {record.year}
                  </Text>
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

  const { history, cooldownUntil, currentFlip, poolExhausted, flip, markLogged, markDidntListen } = useFlip();
  const { setPendingAlbum, addToWantToListen, removeFromWantToListen, wantToListen } = useAlbums();

  const [now, setNow]                          = useState(Date.now());
  const [historyModalVisible, setHistoryModal] = useState(false);
  const [artworkUrl, setArtworkUrl]            = useState('');
  const [spotifyId,  setSpotifyId]             = useState('');
  // Cache for the "Recently Flipped" mini-list thumbnails + Spotify IDs
  const [recentCache, setRecentCache]          = useState<Record<string, AlbumData>>({});

  // ── Countdown ticker ──────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Header clock button ───────────────────────────────────────────────────
  useEffect(() => {
    navigation.setOptions({
      headerRight: history.length > 0
        ? () => (
            <Pressable onPress={() => setHistoryModal(true)} style={{ marginRight: 16 }} hitSlop={12}>
              <Ionicons name="time-outline" size={22} color="#FF3CAC" />
            </Pressable>
          )
        : undefined,
    });
  }, [history.length, navigation]);

  // ── Fetch Spotify data when a new album is revealed ───────────────────────
  useEffect(() => {
    if (!currentFlip) { setArtworkUrl(''); setSpotifyId(''); return; }
    setArtworkUrl('');
    setSpotifyId('');
    fetchAlbumData(currentFlip.title, currentFlip.artist).then(({ artworkUrl: url, spotifyId: sid }) => {
      setArtworkUrl(url);
      setSpotifyId(sid);
    });
  }, [currentFlip?.id]);

  // ── Fetch data for the last 3 history items (recently flipped mini-list) ──
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

  // ── Reveal animation ──────────────────────────────────────────────────────
  const revealAnim = useRef(new Animated.Value(0)).current;
  const prevFlipId = useRef<string | null>(null);

  useEffect(() => {
    const newId = currentFlip?.id ?? null;
    if (newId !== null && newId !== prevFlipId.current) {
      revealAnim.setValue(0);
      Animated.spring(revealAnim, { toValue: 1, tension: 55, friction: 9, useNativeDriver: true }).start();
    }
    prevFlipId.current = newId;
  }, [currentFlip?.id]);

  const revealOpacity    = revealAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const revealScale      = revealAnim.interpolate({ inputRange: [0, 1], outputRange: [0.91, 1] });
  const revealTranslateY = revealAnim.interpolate({ inputRange: [0, 1], outputRange: [32, 0] });

  // ── Flip button spin animation ────────────────────────────────────────────
  const btnSpin   = useRef(new Animated.Value(0)).current;
  const btnRotate = btnSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  function handleFlipPress() {
    btnSpin.setValue(0);
    Animated.timing(btnSpin, { toValue: 1, duration: 320, useNativeDriver: true }).start(() => flip());
  }

  // ── State flags ───────────────────────────────────────────────────────────
  const cooldownActive = cooldownUntil !== null && now < cooldownUntil;
  const remainingMs    = cooldownActive ? cooldownUntil - now : 0;
  const hasPendingFlip = currentFlip?.status === 'pending';
  const showAlbumCard  = cooldownActive && hasPendingFlip;
  const showHowWas     = !cooldownActive && hasPendingFlip;
  const showFlipButton = !poolExhausted && !showAlbumCard && !showHowWas;
  const hasAlbum       = showAlbumCard || showHowWas;

  // Real Spotify ID if available, otherwise fall back to the flip-pool id.
  // Must be declared BEFORE isWanted so the closure captures the correct value.
  const detailId = spotifyId || currentFlip?.id || '';

  // True if the current flip has already been added to Want to Listen.
  // Check both the resolved Spotify ID and the flip-pool ID as fallback —
  // the album may have been saved before spotifyId resolved.
  const isWanted = currentFlip
    ? wantToListen.some(a => a.id === detailId || a.id === currentFlip.id)
    : false;

  const borderCol = isDark ? '#222' : '#e0e0e0';
  const cardBg    = isDark ? '#111' : '#fff';

  return (
    <>
      <Stack.Screen options={{ title: 'Flip a Record' }} />

      <FlipHistoryModal visible={historyModalVisible} onClose={() => setHistoryModal(false)} />

      {hasAlbum && currentFlip && (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: currentFlip.coverColor, opacity: 0.10 }]}
        />
      )}

      <ScrollView
        style={{ flex: 1, backgroundColor: 'transparent' }}
        contentContainerStyle={sf.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* ── Pool exhausted ──────────────────────────────────────────── */}
        {poolExhausted && (
          <View style={[sf.emptyCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
            <FontAwesome name="trophy" size={36} color="#FF3CAC" />
            <Text style={[sf.emptyTitle, { color: colors.text }]}>You've flipped every record!</Text>
            <Text style={[sf.emptySubtext, { color: colors.subtext }]}>
              Albums return to the pool once you dismiss or log them.
            </Text>
          </View>
        )}

        {/* ── Idle: flip button ───────────────────────────────────────── */}
        {showFlipButton && (
          <View style={[sf.idleCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
            <View style={sf.idleVinyl}>
              <View style={[sf.idleRing, { width: 200, height: 200, borderRadius: 100 }]} />
              <View style={[sf.idleRing, { width: 140, height: 140, borderRadius: 70  }]} />
              <View style={[sf.idleRing, { width: 80,  height: 80,  borderRadius: 40  }]} />
              <View style={sf.idleCenter} />
            </View>

            <Pressable
              style={({ pressed }) => [sf.flipBtn, { opacity: pressed ? 0.88 : 1 }]}
              onPress={handleFlipPress}>
              <Animated.View style={{ transform: [{ rotate: btnRotate }] }}>
                <FontAwesome name="random" size={18} color="#fff" />
              </Animated.View>
              <Text style={sf.flipBtnText}>Flip a Record</Text>
            </Pressable>

            <Text style={[sf.idleHint, { color: colors.subtext }]}>
              You'll get a random album from the 1001 list
            </Text>
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

              {/* Hero art */}
              <View style={sf.artWrap}>
                <AlbumArt
                  artworkUrl={artworkUrl}
                  coverColor={currentFlip.coverColor}
                  letter={currentFlip.title.charAt(0)}
                  size={ART_SIZE}
                />
                <LinearGradient
                  colors={['transparent', isDark ? 'rgba(17,17,17,0.7)' : 'rgba(255,255,255,0.7)', cardBg]}
                  style={sf.artGradient}
                />
              </View>

              {/* Info */}
              <View style={sf.infoBlock}>
                {currentFlip.genre && (
                  <View style={[sf.genrePill, { backgroundColor: isDark ? '#1e1e2e' : '#f0f0f0' }]}>
                    <Text style={[sf.genreText, { color: isDark ? '#aaa' : '#666' }]}>{currentFlip.genre}</Text>
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
                    style={({ pressed }) => [
                      isWanted ? sf.actionSavedOutline : sf.actionPrimary,
                      { opacity: pressed ? 0.75 : 1 },
                    ]}
                    onPress={() => {
                      if (isWanted) {
                        // Unsave — remove whichever id was used to save it
                        const savedId = wantToListen.find(
                          a => a.id === detailId || a.id === currentFlip.id,
                        )?.id ?? detailId;
                        removeFromWantToListen(savedId);
                      } else {
                        addToWantToListen({
                          id: detailId || currentFlip.id,
                          title: currentFlip.title,
                          artist: currentFlip.artist,
                          year: currentFlip.year,
                          artworkUrl,
                        });
                      }
                    }}>
                    <FontAwesome
                      name={isWanted ? 'bookmark' : 'bookmark-o'}
                      size={14}
                      color={isWanted ? '#FF3CAC' : '#fff'}
                    />
                    <Text style={isWanted ? sf.actionSavedText : sf.actionPrimaryText}>
                      {isWanted ? 'Saved' : 'Want to Listen'}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [sf.actionSecondary, { borderColor: borderCol, opacity: pressed ? 0.8 : 1 }]}>
                    <FontAwesome name="headphones" size={14} color={colors.subtext} />
                    <Text style={[sf.actionSecondaryText, { color: colors.subtext }]}>Open in Streaming</Text>
                  </Pressable>
                </View>
              )}

              {/* How was it */}
              {showHowWas && (
                <View style={sf.actionsBlock}>
                  <Text style={[sf.howWasHeading, { color: colors.text }]}>How was it?</Text>
                  <View style={sf.howWasRow}>
                    <Pressable
                      style={({ pressed }) => [sf.actionPrimary, sf.flex1, { opacity: pressed ? 0.8 : 1 }]}
                      onPress={() => {
                        markLogged(currentFlip.id);
                        setPendingAlbum({ spotifyId: detailId || currentFlip.id, title: currentFlip.title, artist: currentFlip.artist, year: currentFlip.year, artworkUrl });
                        router.push('/log-album');
                      }}>
                      <FontAwesome name="plus" size={14} color="#fff" />
                      <Text style={sf.actionPrimaryText}>Log It</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [sf.actionSecondary, sf.flex1, { borderColor: borderCol, opacity: pressed ? 0.8 : 1 }]}
                      onPress={() => markDidntListen(currentFlip.id)}>
                      <Text style={[sf.actionSecondaryText, { color: colors.subtext }]}>Didn't Listen</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* Countdown */}
              {cooldownActive && (
                <View style={sf.countdownWrap}>
                  <Ionicons name="time-outline" size={14} color={colors.subtext} />
                  <Text style={[sf.countdown, { color: colors.subtext }]}>
                    Come back in {formatCountdown(remainingMs)}
                  </Text>
                </View>
              )}
            </View>
          </Animated.View>
        )}

        {/* ── Progress stats ──────────────────────────────────────────── */}
        {!poolExhausted && (() => {
          const total   = FLIP_POOL.length;
          const flipped = new Set(history.map(r => r.id)).size;
          const pct     = total > 0 ? flipped / total : 0;
          return (
            <View style={sf.statsBlock}>
              <View style={sf.statsRow}>
                <Text style={[sf.statsLabel, { color: colors.subtext }]}>
                  {total} Albums
                </Text>
                <Text style={[sf.statsLabel, { color: colors.subtext }]}>
                  <Text style={{ color: '#FF3CAC', fontWeight: '700' }}>{flipped}</Text> flipped by you
                </Text>
              </View>
              <View style={[sf.track, { backgroundColor: isDark ? '#222' : '#e5e5e5' }]}>
                <View style={[sf.fill, { width: `${Math.max(pct * 100, pct > 0 ? 2 : 0)}%` as any }]} />
              </View>
            </View>
          );
        })()}

        {/* ── Recently Flipped ────────────────────────────────────────── */}
        {history.length > 0 && (
          <View style={sf.recentBlock}>
            <Text style={[sf.recentHeading, { color: colors.text }]}>Recently Flipped</Text>
            {history.slice(0, 3).map((record, i) => {
              const hit = recentCache[record.id];
              return (
                <Pressable
                  key={`${record.id}-${record.flippedAt}`}
                  style={({ pressed }) => [
                    sf.recentRow,
                    { backgroundColor: isDark ? '#111' : '#f9f9f9', borderColor: borderCol, opacity: pressed ? 0.7 : 1 },
                  ]}
                  onPress={() => router.push({
                    pathname: '/album-detail',
                    params: { id: hit?.spotifyId || record.id, title: record.title, artist: record.artist, year: String(record.year), artworkUrl: hit?.artworkUrl ?? '' },
                  } as any)}>
                  <View style={[sf.recentThumb, { backgroundColor: record.coverColor }]}>
                    {!!hit?.artworkUrl && (
                      <Image source={{ uri: hit.artworkUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    )}
                    {!hit?.artworkUrl && (
                      <Text style={sf.recentThumbLetter}>{record.title.charAt(0).toUpperCase()}</Text>
                    )}
                  </View>
                  <View style={sf.recentInfo}>
                    <Text style={[sf.recentTitle, { color: colors.text }]} numberOfLines={1}>{record.title}</Text>
                    <Text style={[sf.recentArtist, { color: colors.subtext }]} numberOfLines={1}>{record.artist}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={isDark ? '#444' : '#ccc'} />
                </Pressable>
              );
            })}
          </View>
        )}

      </ScrollView>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const sf = StyleSheet.create({
  scrollContent: { padding: 20, paddingBottom: 60 },

  idleCard:   { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 40, paddingHorizontal: 24, alignItems: 'center', gap: 24 },
  idleVinyl:  { width: 200, height: 200, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  idleRing:   { position: 'absolute', borderWidth: 1, borderColor: 'rgba(128,128,128,0.18)' },
  idleCenter: { width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(128,128,128,0.2)' },
  idleHint:   { fontSize: 13, textAlign: 'center', lineHeight: 18 },

  flipBtn:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FF3CAC', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 16 },
  flipBtnText: { color: '#fff', fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },

  emptyCard:    { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 32, alignItems: 'center', gap: 14 },
  emptyTitle:   { fontSize: 18, fontWeight: '700', textAlign: 'center', letterSpacing: -0.3 },
  emptySubtext: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  albumCard:   { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  artWrap:     { position: 'relative' },
  artGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 80 },

  infoBlock:  { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 4, gap: 6 },
  genrePill:  { alignSelf: 'flex-start', borderRadius: 100, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 2 },
  genreText:  { fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  albumTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5, lineHeight: 29 },
  albumArtist:{ fontSize: 15, lineHeight: 20 },
  tappable:   { textDecorationLine: 'underline' },

  actionsBlock:  { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 4, gap: 10 },
  howWasHeading: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  howWasRow:     { flexDirection: 'row', gap: 10 },

  actionPrimary:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FF3CAC', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16 },
  actionSavedOutline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'transparent', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: '#FF3CAC' },
  actionPrimaryText:  { color: '#fff', fontSize: 15, fontWeight: '600' },
  actionSavedText:    { color: '#FF3CAC', fontSize: 15, fontWeight: '600' },
  actionSecondary:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 16 },
  actionSecondaryText:{ fontSize: 15, fontWeight: '500' },
  flex1: { flex: 1 },

  countdownWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 18 },
  countdown:     { fontSize: 13, fontWeight: '500', letterSpacing: -0.1 },

  statsBlock: { marginTop: 20, gap: 8 },
  statsRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statsLabel: { fontSize: 13 },
  track:      { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill:       { height: 4, borderRadius: 2, backgroundColor: '#FF3CAC' },

  recentBlock:       { marginTop: 24, gap: 10 },
  recentHeading:     { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  recentRow:         { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  recentThumb:       { width: 44, height: 44, borderRadius: 6, overflow: 'hidden', flexShrink: 0, justifyContent: 'center', alignItems: 'center' },
  recentThumbLetter: { color: 'rgba(255,255,255,0.75)', fontSize: 16, fontWeight: '700' },
  recentInfo:        { flex: 1, gap: 2 },
  recentTitle:       { fontSize: 14, fontWeight: '600' },
  recentArtist:      { fontSize: 12 },
});
