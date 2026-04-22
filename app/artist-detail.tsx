import {
  StyleSheet,
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useLikedArtists } from '@/context/LikedArtistsContext';
import { useAlbums } from '@/context/AlbumsContext';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<a[^>]*>.*?<\/a>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

function formatListeners(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M listeners`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K listeners`;
  return `${n} listeners`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type LastfmArtist = {
  name: string;
  listeners: number;
  bio: string;
  tags: string[];
  similar: { name: string; url: string; imageUrl: string | null }[];
};

type SpotifyTrack = {
  number: number;
  id: string;
  title: string;
  artworkUrl: string;
  albumTitle: string;
  durationMs: number;
};

type SpotifyAlbum = {
  id: string;
  title: string;
  artworkUrl: string;
  year: number;
  type: string;
  isSingle?: boolean | null;
  isCompilation?: boolean | null;
  trackCount?: number | null;
  url?: string;
};

type SpotifyDiscography = {
  albums: SpotifyAlbum[];
  epsAndMixtapes: SpotifyAlbum[];
  collections: SpotifyAlbum[];
  live: SpotifyAlbum[];
};

const DISC_TABS = [
  { key: 'albums',        label: 'Albums' },
  { key: 'epsAndMixtapes', label: 'EPs & Mixtapes' },
  { key: 'collections',   label: 'Collections' },
  { key: 'live',          label: 'Live' },
] as const;
type DiscTab = typeof DISC_TABS[number]['key'];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ label, color }: { label: string; color: string }) {
  return <Text style={[sc.sectionLabel, { color }]}>{label}</Text>;
}

function TrackRow({
  track, index, borderColor, textColor, subColor,
}: {
  track: SpotifyTrack;
  index: number;
  borderColor: string;
  textColor: string;
  subColor: string;
}) {
  return (
    <View style={[sc.trackRow, { borderBottomColor: borderColor }]}>
      <Text style={[sc.trackNum, { color: subColor }]}>{index + 1}</Text>
      {track.artworkUrl ? (
        <Image source={{ uri: track.artworkUrl }} style={sc.trackArt} />
      ) : (
        <View style={[sc.trackArt, { backgroundColor: '#2a2a2a' }]} />
      )}
      <View style={sc.trackInfo}>
        <Text style={[sc.trackTitle, { color: textColor }]} numberOfLines={1}>{track.title}</Text>
        <Text style={[sc.trackSub, { color: subColor }]} numberOfLines={1}>{track.albumTitle}</Text>
      </View>
      <Text style={[sc.trackDuration, { color: subColor }]}>{formatDuration(track.durationMs)}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ArtistDetailScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const router = useRouter();


  const params = useLocalSearchParams<{ id?: string; name?: string; artworkUrl?: string }>();

  const artistName      = (params.name ?? '').trim();
  const paramId         = (params.id   ?? '').trim();
  const paramArtworkUrl = (params.artworkUrl ?? '').trim();

  // UI state
  const [artworkUrl, setArtworkUrl]     = useState(paramArtworkUrl);
  const [resolvedId, setResolvedId]     = useState(paramId);

  // Last.fm state
  const [lastfm, setLastfm]               = useState<LastfmArtist | null>(null);
  const [lastfmLoading, setLastfmLoading] = useState(true);
  const [lastfmError, setLastfmError]     = useState('');

  // Spotify state
  const [topTracks, setTopTracks]         = useState<SpotifyTrack[] | null>(null);
  const [tracksLoading, setTracksLoading] = useState(true);
  const [tracksError, setTracksError]     = useState('');

  const [discography, setDiscography]     = useState<SpotifyDiscography | null>(null);
  const [albumsLoading, setAlbumsLoading] = useState(true);
  const [albumsError, setAlbumsError]     = useState('');

  const [bioExpanded, setBioExpanded]     = useState(false);
  const [activeDiscTab, setActiveDiscTab] = useState<DiscTab>('albums');
  const [toastMsg, setToastMsg]         = useState('');
  const toastOpacity                    = useRef(new Animated.Value(0)).current;
  const { isLiked, toggleLike }         = useLikedArtists();
  const liked                           = isLiked(resolvedId || artistName);
  const { loggedAlbums }               = useAlbums();

  // Prevent double-firing if effect runs twice (Strict Mode / nav back)
  const spotifyFetched = useRef(false);

  // ── Listened % — derived from already-fetched discography + logged albums ────
  const albumsOnly   = discography?.albums ?? [];
  const totalAlbums  = albumsOnly.length;
  const listenedCount = totalAlbums === 0 ? 0 : albumsOnly.filter(spotifyAlbum => {
    const artistLower = artistName.toLowerCase();
    return loggedAlbums.some(logged =>
      logged.id === spotifyAlbum.id ||
      (logged.title.toLowerCase() === spotifyAlbum.title.toLowerCase() &&
       logged.artist.toLowerCase() === artistLower)
    );
  }).length;
  const listenedPct  = totalAlbums === 0 ? null : Math.round((listenedCount / totalAlbums) * 100);

  const sectionBg   = isDark ? '#111' : '#f5f5f5';
  const borderColor = isDark ? '#222' : '#e8e8e8';
  const mutedText   = isDark ? '#555' : '#bbb';

  const GRID_PAD = 20;
  const CARD_SIZE = 120;

  // ── Fetch Last.fm (independent — only needs artistName) ────────────────────
  useEffect(() => {
    if (!artistName) return;
    let cancelled = false;
    setLastfmLoading(true);
    setLastfmError('');
    const url = `${API_URL}/lastfm/artist?artist=${encodeURIComponent(artistName)}`;
    console.log('[artist-detail] Last.fm fetch:', url);
    fetch(url)
      .then(r => {
        console.log('[artist-detail] Last.fm status:', r.status);
        return r.ok ? r.json() : r.json().then(b => Promise.reject(`HTTP ${r.status}: ${JSON.stringify(b)}`));
      })
      .then(data => {
        if (cancelled) return;
        console.log('[artist-detail] first similar artist:', JSON.stringify(data.similar?.[0]));
        setLastfm({
          name:     data.name ?? artistName,
          listeners: data.listeners ?? 0,
          bio:      stripHtml(data.bio ?? ''),
          tags:     data.tags ?? [],
          similar:  data.similar ?? [],
        });
      })
      .catch(err => { if (!cancelled) setLastfmError(String(err)); })
      .finally(() => { if (!cancelled) setLastfmLoading(false); });
    return () => { cancelled = true; };
  }, [artistName]);

  // ── Resolve ID then fetch Spotify data (sequential, single effect) ─────────
  useEffect(() => {
    if (!artistName) return;
    let cancelled = false;
    spotifyFetched.current = false;

    async function loadSpotifyData() {
      // ── Step 1: resolve Spotify artist ID ───────────────────────────────────
      let artistId = paramId;

      if (!artistId) {
        const searchUrl = `${API_URL}/search?q=${encodeURIComponent(artistName)}&type=artist`;
        console.log('[artist-detail] resolving ID via search:', searchUrl);
        try {
          const r = await fetch(searchUrl);
          console.log('[artist-detail] search HTTP', r.status);
          if (!r.ok) throw new Error(`Search HTTP ${r.status}`);
          const results: { id: string; name: string; artworkUrl: string }[] = await r.json();
          console.log('[artist-detail] search results:', results.length, results[0]?.id, results[0]?.name);
          if (!results.length) throw new Error(`No search results for "${artistName}"`);
          artistId = results[0].id;
          if (cancelled) return;
          setResolvedId(artistId);
          if (!paramArtworkUrl && results[0].artworkUrl) setArtworkUrl(results[0].artworkUrl);
        } catch (err) {
          if (!cancelled) {
            const msg = String(err);
            console.warn('[artist-detail] ID resolution failed:', msg);
            setTracksError(`Could not find artist: ${msg}`);
            setAlbumsError(`Could not find artist: ${msg}`);
            setTracksLoading(false);
            setAlbumsLoading(false);
          }
          return;
        }
      } else {
        console.log('[artist-detail] artistId provided directly:', artistId);
      }

      if (cancelled || !artistId) return;
      if (spotifyFetched.current) return;
      spotifyFetched.current = true;

      // ── Step 2: fetch top-tracks and albums in parallel ──────────────────────
      const tracksUrl = `${API_URL}/spotify/artist/${artistId}/top-tracks`;
      const albumsUrl = `${API_URL}/spotify/artist/${artistId}/albums`;
      console.log('[artist-detail] fetching top-tracks:', tracksUrl);
      console.log('[artist-detail] fetching albums:    ', albumsUrl);

      // Top tracks
      fetch(tracksUrl)
        .then(r => {
          console.log('[artist-detail] top-tracks HTTP', r.status);
          return r.ok ? r.json() : r.json().then(b => Promise.reject(`HTTP ${r.status}: ${JSON.stringify(b)}`));
        })
        .then(data => {
          console.log('[artist-detail] top-tracks:', Array.isArray(data) ? `${data.length} tracks` : String(data));
          if (!cancelled) setTopTracks(Array.isArray(data) ? data : []);
        })
        .catch(err => {
          const msg = String(err);
          console.warn('[artist-detail] top-tracks error:', msg);
          if (!cancelled) { setTopTracks([]); setTracksError(msg); }
        })
        .finally(() => { if (!cancelled) setTracksLoading(false); });

      // Albums (grouped discography)
      fetch(albumsUrl)
        .then(r => {
          console.log('[artist-detail] albums HTTP', r.status);
          return r.ok ? r.json() : r.json().then(b => Promise.reject(`HTTP ${r.status}: ${JSON.stringify(b)}`));
        })
        .then(data => {
          const disc: SpotifyDiscography = {
            albums:         Array.isArray(data?.albums)         ? data.albums         : [],
            epsAndMixtapes: Array.isArray(data?.epsAndMixtapes) ? data.epsAndMixtapes : [],
            collections:    Array.isArray(data?.collections)    ? data.collections    : [],
            live:           Array.isArray(data?.live)           ? data.live           : [],
          };
          console.log('[artist-detail] discography — albums:', disc.albums.length, 'eps:', disc.epsAndMixtapes.length, 'collections:', disc.collections.length, 'live:', disc.live.length);
          if (!cancelled) setDiscography(disc);
        })
        .catch(err => {
          const msg = String(err);
          console.warn('[artist-detail] albums error:', msg);
          if (!cancelled) { setDiscography({ albums: [], singles: [], compilations: [] }); setAlbumsError(msg); }
        })
        .finally(() => { if (!cancelled) setAlbumsLoading(false); });
    }

    loadSpotifyData();
    return () => { cancelled = true; };
  }, [artistName, paramId]); // paramId is stable from route; artistName drives re-run when pushing a new artist

  function showToast(msg: string) {
    setToastMsg(msg);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1600),
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }

  function handleToggleLike() {
    const artistId = resolvedId || artistName;
    toggleLike({ id: artistId, name: artistName, artworkUrl: artworkUrl || null });
    showToast(!liked ? 'Artist liked' : 'Artist removed');
  }

  function handleAlbumPress(album: SpotifyAlbum) {
    router.push({
      pathname: '/album-detail',
      params: { id: album.id, title: album.title, artist: artistName, year: String(album.year), artworkUrl: album.artworkUrl },
    });
  }

  function renderAlbumRow(items: SpotifyAlbum[]) {
    if (!items.length) return null;
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={sc.albumRowContent}>
        {items.map(album => (
          <Pressable
            key={album.id}
            style={({ pressed }) => [sc.albumCard, { opacity: pressed ? 0.7 : 1 }]}
            onPress={() => handleAlbumPress(album)}>
            {album.artworkUrl ? (
              <Image source={{ uri: album.artworkUrl }} style={sc.albumArt} />
            ) : (
              <View style={[sc.albumArt, { backgroundColor: '#2a2a2a', justifyContent: 'center', alignItems: 'center' }]}>
                <FontAwesome name="music" size={24} color="#444" />
              </View>
            )}
            <Text style={[sc.albumTitle, { color: colors.text }]} numberOfLines={2}>{album.title}</Text>
            <Text style={[sc.albumYear, { color: colors.subtext }]}>{album.year > 0 ? album.year : ''}</Text>
          </Pressable>
        ))}
      </ScrollView>
    );
  }

  function handleSimilarArtistPress(name: string) {
    router.push({ pathname: '/artist-detail', params: { name } });
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[sc.container, { paddingHorizontal: GRID_PAD }]}
      showsVerticalScrollIndicator={false}>

      {/* ── 1. Artist header ─────────────────────────────────────────────────── */}
      <View style={sc.header}>
        <Pressable
          style={sc.heartBtn}
          onPress={handleToggleLike}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <FontAwesome
            name={liked ? 'heart' : 'heart-o'}
            size={24}
            color={liked ? '#FF3CAC' : '#666'}
          />
        </Pressable>
        {artworkUrl ? (
          <Image source={{ uri: artworkUrl }} style={sc.avatar} />
        ) : (
          <View style={[sc.avatar, sc.avatarPlaceholder]}>
            <Text style={sc.avatarInitial}>{(artistName || '?').charAt(0)}</Text>
          </View>
        )}
        <Text style={[sc.name, { color: colors.text }]}>{artistName}</Text>
        {listenedPct !== null && (
          <View style={sc.listenedWrap}>
            <View style={sc.listenedRow}>
              <FontAwesome name="headphones" size={13} color="#FF3CAC" />
              <Text style={sc.listenedPct}>{listenedPct}%</Text>
            </View>
            <Text style={sc.listenedSub}>{listenedCount} of {totalAlbums} albums listened</Text>
          </View>
        )}
        {lastfmLoading ? (
          <ActivityIndicator size="small" color="#FF3CAC" style={{ marginTop: 8 }} />
        ) : lastfm?.listeners ? (
          <Text style={[sc.listeners, { color: colors.subtext }]}>{formatListeners(lastfm.listeners)}</Text>
        ) : lastfmError ? (
          <Text style={[sc.errorText, { color: '#f87171' }]} numberOfLines={2}>{lastfmError}</Text>
        ) : null}
      </View>

      {/* ── 2. About (collapsible bio) ────────────────────────────────────────── */}
      {lastfm?.bio ? (
        <View style={[sc.section, { backgroundColor: sectionBg, borderColor }]}>
          <SectionHeader label="About" color={colors.subtext} />
          <Text
            style={[sc.bioText, { color: colors.text }]}
            numberOfLines={bioExpanded ? undefined : 3}>
            {lastfm.bio}
          </Text>
          <Pressable onPress={() => setBioExpanded(v => !v)}>
            <Text style={sc.bioToggle}>{bioExpanded ? 'Show less' : 'Read more'}</Text>
          </Pressable>
        </View>
      ) : null}

      {/* ── 3. Top Tracks ────────────────────────────────────────────────────── */}
      <View style={[sc.section, { backgroundColor: sectionBg, borderColor }]}>
        <SectionHeader label="Top Tracks" color={colors.subtext} />
        {tracksLoading ? (
          <ActivityIndicator size="small" color="#FF3CAC" style={{ marginVertical: 16 }} />
        ) : tracksError ? (
          <Text style={[sc.errorText, { color: '#f87171' }]}>{tracksError}</Text>
        ) : topTracks && topTracks.length > 0 ? (
          topTracks.slice(0, 5).map((track, i) => (
            <TrackRow
              key={track.id}
              track={track}
              index={i}
              borderColor={borderColor}
              textColor={colors.text}
              subColor={colors.subtext}
            />
          ))
        ) : (
          <Text style={[sc.empty, { color: mutedText }]}>No tracks available</Text>
        )}
      </View>

      {/* ── 4. Discography ───────────────────────────────────────────────────── */}
      <View style={[sc.section, { backgroundColor: sectionBg, borderColor }]}>
        <SectionHeader label="Discography" color={colors.subtext} />
        {albumsLoading ? (
          <ActivityIndicator size="small" color="#FF3CAC" style={{ marginVertical: 16 }} />
        ) : albumsError ? (
          <Text style={[sc.errorText, { color: '#f87171' }]}>{albumsError}</Text>
        ) : (
          <>
            {/* Tab pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={sc.discTabBar}
              style={{ marginBottom: 12 }}>
              {DISC_TABS.map(tab => {
                const active = activeDiscTab === tab.key;
                return (
                  <Pressable
                    key={tab.key}
                    style={[sc.discTab, active && sc.discTabActive]}
                    onPress={() => setActiveDiscTab(tab.key)}>
                    <Text style={[sc.discTabText, active && sc.discTabTextActive]}>
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {/* Content for active tab */}
            {(() => {
              const items = discography?.[activeDiscTab] ?? [];
              const sorted = [...items].sort((a, b) => b.year - a.year);
              return sorted.length > 0
                ? renderAlbumRow(sorted)
                : <Text style={[sc.empty, { color: mutedText }]}>Nothing here yet</Text>;
            })()}
          </>
        )}
      </View>

      {/* ── 5. Similar Artists ────────────────────────────────────────────────── */}
      {lastfm?.similar && lastfm.similar.length > 0 ? (
        <View style={[sc.section, { backgroundColor: sectionBg, borderColor }]}>
          <SectionHeader label="Similar Artists" color={colors.subtext} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={sc.similarScroll}>
            {lastfm.similar.filter(sim => !/(&|feat\.|ft\.|(?<![a-z])x |( and ))/i.test(sim.name)).map(sim => {
              const appleImageUrl = sim.imageUrl && !sim.imageUrl.includes('scdn.co') ? sim.imageUrl : null;
              return (
                <Pressable
                  key={sim.name}
                  style={({ pressed }) => [sc.similarChip, { opacity: pressed ? 0.6 : 1 }]}
                  onPress={() => handleSimilarArtistPress(sim.name)}>
                  {appleImageUrl ? (
                    <Image source={{ uri: appleImageUrl }} style={sc.similarAvatar} />
                  ) : (
                    <View style={[sc.similarAvatar, { backgroundColor: isDark ? '#2a2a2a' : '#e0e0e0', justifyContent: 'center', alignItems: 'center' }]}>
                      <Text style={[sc.similarInitial, { color: colors.subtext }]}>{sim.name.charAt(0)}</Text>
                    </View>
                  )}
                  <Text style={[sc.similarName, { color: colors.text }]} numberOfLines={2}>{sim.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

    </ScrollView>

    <Animated.View style={[sc.toast, { opacity: toastOpacity }]} pointerEvents="none">
      <Text style={sc.toastText}>{toastMsg}</Text>
    </Animated.View>
    </View>
  );
}

const sc = StyleSheet.create({
  container: { paddingTop: 0, paddingBottom: 48 },

  // Header
  header: { alignItems: 'center', paddingTop: 28, paddingBottom: 20 },
  heartBtn: { position: 'absolute', top: 20, right: 0, zIndex: 10, padding: 4 },

  // Toast
  toast: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: '#1e1e1e',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#333',
  },
  toastText: { color: '#f0f0f0', fontSize: 14, fontWeight: '500' },

  avatar: { width: 120, height: 120, borderRadius: 60, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16 },
  avatarPlaceholder: { backgroundColor: '#2a2a2a', justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { color: '#FF3CAC', fontSize: 44, fontWeight: '700' },
  name: { marginTop: 14, fontSize: 26, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' },
  listenedWrap: { alignItems: 'center', marginTop: 8, gap: 3 },
  listenedRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  listenedPct: { color: '#FF3CAC', fontSize: 15, fontWeight: '700' },
  listenedSub: { color: '#666', fontSize: 12 },
  listeners: { marginTop: 4, fontSize: 13 },

  // Error
  errorText: { fontSize: 12, paddingVertical: 8, lineHeight: 17 },

  // Sections
  section: { width: '100%', borderRadius: 14, padding: 16, borderWidth: StyleSheet.hairlineWidth, marginBottom: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12 },
  empty: { fontSize: 13, paddingVertical: 12 },

  // Tracks
  trackRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  trackNum: { width: 22, fontSize: 13, textAlign: 'right', marginRight: 10 },
  trackArt: { width: 40, height: 40, borderRadius: 4, marginRight: 12 },
  trackInfo: { flex: 1, gap: 2 },
  trackTitle: { fontSize: 14, fontWeight: '500' },
  trackSub: { fontSize: 12 },
  trackDuration: { fontSize: 13, marginLeft: 8 },

  // Discography tabs
  discTabBar:       { flexDirection: 'row', gap: 6, paddingVertical: 2 },
  discTab:          { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: 'transparent', borderWidth: 1, borderColor: '#444' },
  discTabActive:    { backgroundColor: '#FF3CAC', borderColor: '#FF3CAC' },
  discTabText:      { fontSize: 12, fontWeight: '500', color: '#888' },
  discTabTextActive:{ color: '#fff', fontWeight: '700' },

  // Discography carousel
  discGroupLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  albumRowContent: { paddingRight: 4 },
  albumCard: { width: 120, marginRight: 12 },
  albumArt: { width: 120, height: 120, borderRadius: 8 },
  albumTitle: { fontSize: 12, fontWeight: '500', marginTop: 6, lineHeight: 16 },
  albumYear: { fontSize: 11, marginTop: 2 },

  // Bio
  bioText: { fontSize: 14, lineHeight: 22 },
  bioToggle: { color: '#FF3CAC', fontSize: 13, fontWeight: '500', marginTop: 8 },

  // Similar artists
  similarScroll: { marginHorizontal: -4 },
  similarChip: { width: 80, alignItems: 'center', marginHorizontal: 4, gap: 6 },
  similarAvatar: { width: 56, height: 56, borderRadius: 28 },
  similarInitial: { fontSize: 20, fontWeight: '700' },
  similarName: { fontSize: 11, textAlign: 'center', lineHeight: 14 },
});
