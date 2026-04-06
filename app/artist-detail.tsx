import {
  StyleSheet,
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  FlatList,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

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
  similar: { name: string; url: string }[];
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
};

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
  const { width } = useWindowDimensions();

  const params = useLocalSearchParams<{ id?: string; name: string; artworkUrl?: string }>();

  const artistName     = params.name ?? '';
  const paramArtworkUrl = params.artworkUrl ?? '';

  // Resolved Spotify artist ID (may be missing until search resolves)
  const [artistId, setArtistId]         = useState(params.id ?? '');
  const [artworkUrl, setArtworkUrl]     = useState(paramArtworkUrl);

  // Remote data
  const [lastfm, setLastfm]             = useState<LastfmArtist | null>(null);
  const [lastfmLoading, setLastfmLoading] = useState(true);
  const [topTracks, setTopTracks]       = useState<SpotifyTrack[] | null>(null);
  const [tracksLoading, setTracksLoading] = useState(false);
  const [albums, setAlbums]             = useState<SpotifyAlbum[] | null>(null);
  const [albumsLoading, setAlbumsLoading] = useState(false);
  const [bioExpanded, setBioExpanded]   = useState(false);

  const sectionBg   = isDark ? '#111' : '#f5f5f5';
  const borderColor = isDark ? '#222' : '#e8e8e8';
  const mutedText   = isDark ? '#555' : '#bbb';

  // Album grid column math
  const COLS = 2;
  const GRID_PAD = 20;
  const GRID_GAP = 12;
  const albumSize = Math.floor((width - GRID_PAD * 2 - GRID_GAP) / COLS);

  // ── Fetch Last.fm ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!artistName) return;
    let cancelled = false;
    const url = `${API_URL}/lastfm/artist?artist=${encodeURIComponent(artistName)}`;
    console.log('[artist-detail] fetching Last.fm:', url);
    fetch(url)
      .then(r => {
        console.log('[artist-detail] Last.fm status:', r.status);
        return r.ok ? r.json() : r.json().then(body => Promise.reject(`HTTP ${r.status}: ${JSON.stringify(body)}`));
      })
      .then(data => {
        console.log('[artist-detail] Last.fm data:', JSON.stringify(data).slice(0, 200));
        if (cancelled) return;
        setLastfm({
          name: data.name ?? artistName,
          listeners: data.listeners ?? 0,
          bio: stripHtml(data.bio ?? ''),
          tags: data.tags ?? [],
          similar: data.similar ?? [],
        });
      })
      .catch(err => console.warn('[artist-detail] Last.fm error:', err))
      .finally(() => { if (!cancelled) setLastfmLoading(false); });
    return () => { cancelled = true; };
  }, [artistName]);

  // ── Resolve Spotify artist ID if not provided ──────────────────────────────
  useEffect(() => {
    if (artistId) {
      console.log('[artist-detail] artistId already set:', artistId);
      return;
    }
    if (!artistName) {
      console.warn('[artist-detail] no artistName — cannot resolve ID');
      return;
    }
    let cancelled = false;
    const searchUrl = `${API_URL}/search?q=${encodeURIComponent(artistName)}&type=artist`;
    console.log('[artist-detail] resolving artist ID via search:', searchUrl);
    fetch(searchUrl)
      .then(r => {
        console.log('[artist-detail] ID search HTTP', r.status);
        return r.ok ? r.json() : r.json().then(b => Promise.reject(`HTTP ${r.status}: ${JSON.stringify(b)}`));
      })
      .then((results: { id: string; name: string; artworkUrl: string }[]) => {
        if (cancelled) return;
        console.log('[artist-detail] ID search results:', results.length, results[0]?.id, results[0]?.name);
        if (!results.length) { console.warn('[artist-detail] no results for artist name:', artistName); return; }
        const match = results[0];
        setArtistId(match.id);
        if (!artworkUrl && match.artworkUrl) setArtworkUrl(match.artworkUrl);
      })
      .catch(err => console.warn('[artist-detail] ID search error:', err));
    return () => { cancelled = true; };
  }, [artistName, artistId]);

  // ── Fetch Spotify data once artist ID is known ─────────────────────────────
  useEffect(() => {
    if (!artistId) {
      console.log('[artist-detail] Spotify fetch skipped — artistId not yet set');
      return;
    }
    let cancelled = false;

    const tracksUrl = `${API_URL}/spotify/artist/${artistId}/top-tracks`;
    const albumsUrl = `${API_URL}/spotify/artist/${artistId}/albums`;
    console.log('[artist-detail] fetching top-tracks:', tracksUrl);
    console.log('[artist-detail] fetching albums:', albumsUrl);

    setTracksLoading(true);
    fetch(tracksUrl)
      .then(r => {
        console.log('[artist-detail] top-tracks HTTP', r.status);
        return r.ok ? r.json() : r.json().then(b => Promise.reject(`HTTP ${r.status}: ${JSON.stringify(b)}`));
      })
      .then(data => {
        console.log('[artist-detail] top-tracks received:', Array.isArray(data) ? `${data.length} tracks` : data);
        if (!cancelled) setTopTracks(data);
      })
      .catch(err => {
        console.warn('[artist-detail] top-tracks error:', err);
        if (!cancelled) setTopTracks([]);
      })
      .finally(() => { if (!cancelled) setTracksLoading(false); });

    setAlbumsLoading(true);
    fetch(albumsUrl)
      .then(r => {
        console.log('[artist-detail] albums HTTP', r.status);
        return r.ok ? r.json() : r.json().then(b => Promise.reject(`HTTP ${r.status}: ${JSON.stringify(b)}`));
      })
      .then(data => {
        console.log('[artist-detail] albums received:', Array.isArray(data) ? `${data.length} albums` : data);
        if (!cancelled) setAlbums(data);
      })
      .catch(err => {
        console.warn('[artist-detail] albums error:', err);
        if (!cancelled) setAlbums([]);
      })
      .finally(() => { if (!cancelled) setAlbumsLoading(false); });

    return () => { cancelled = true; };
  }, [artistId]);

  function handleAlbumPress(album: SpotifyAlbum) {
    router.push({
      pathname: '/album-detail',
      params: { id: album.id, title: album.title, artist: artistName, year: String(album.year), artworkUrl: album.artworkUrl },
    });
  }

  function handleSimilarArtistPress(name: string) {
    router.push({ pathname: '/artist-detail', params: { name } });
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[sc.container, { paddingHorizontal: GRID_PAD }]}
      showsVerticalScrollIndicator={false}>

      {/* ── 1. Artist header ─────────────────────────────────────────────────── */}
      <View style={sc.header}>
        {artworkUrl ? (
          <Image source={{ uri: artworkUrl }} style={sc.avatar} />
        ) : (
          <View style={[sc.avatar, sc.avatarPlaceholder]}>
            <Text style={sc.avatarInitial}>{artistName.charAt(0)}</Text>
          </View>
        )}
        <Text style={[sc.name, { color: colors.text }]}>{artistName}</Text>
        {lastfm?.listeners ? (
          <Text style={[sc.listeners, { color: colors.subtext }]}>{formatListeners(lastfm.listeners)}</Text>
        ) : lastfmLoading ? (
          <ActivityIndicator size="small" color="#FF3CAC" style={{ marginTop: 8 }} />
        ) : null}
      </View>

      {/* ── 2. Top Tracks ────────────────────────────────────────────────────── */}
      <View style={[sc.section, { backgroundColor: sectionBg, borderColor }]}>
        <SectionHeader label="Top Tracks" color={colors.subtext} />
        {tracksLoading ? (
          <ActivityIndicator size="small" color="#FF3CAC" style={{ marginVertical: 16 }} />
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
        ) : !tracksLoading && artistId ? (
          <Text style={[sc.empty, { color: mutedText }]}>No tracks available</Text>
        ) : !artistId ? (
          <ActivityIndicator size="small" color="#FF3CAC" style={{ marginVertical: 16 }} />
        ) : null}
      </View>

      {/* ── 3. Discography ───────────────────────────────────────────────────── */}
      <View style={[sc.section, { backgroundColor: sectionBg, borderColor }]}>
        <SectionHeader label="Discography" color={colors.subtext} />
        {albumsLoading ? (
          <ActivityIndicator size="small" color="#FF3CAC" style={{ marginVertical: 16 }} />
        ) : albums && albums.length > 0 ? (
          <View style={sc.grid}>
            {albums.map(album => (
              <Pressable
                key={album.id}
                style={({ pressed }) => [sc.albumCard, { width: albumSize, opacity: pressed ? 0.7 : 1 }]}
                onPress={() => handleAlbumPress(album)}>
                {album.artworkUrl ? (
                  <Image source={{ uri: album.artworkUrl }} style={{ width: albumSize, height: albumSize, borderRadius: 8 }} />
                ) : (
                  <View style={[{ width: albumSize, height: albumSize, borderRadius: 8, backgroundColor: '#2a2a2a', justifyContent: 'center', alignItems: 'center' }]}>
                    <FontAwesome name="music" size={28} color="#444" />
                  </View>
                )}
                <Text style={[sc.albumTitle, { color: colors.text }]} numberOfLines={1}>{album.title}</Text>
                <Text style={[sc.albumYear, { color: colors.subtext }]}>{album.year > 0 ? album.year : ''}</Text>
              </Pressable>
            ))}
          </View>
        ) : !albumsLoading && artistId ? (
          <Text style={[sc.empty, { color: mutedText }]}>No albums available</Text>
        ) : !artistId ? (
          <ActivityIndicator size="small" color="#FF3CAC" style={{ marginVertical: 16 }} />
        ) : null}
      </View>

      {/* ── 4. About (collapsible bio) ────────────────────────────────────────── */}
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

      {/* ── 5. Similar Artists ────────────────────────────────────────────────── */}
      {lastfm?.similar && lastfm.similar.length > 0 ? (
        <View style={[sc.section, { backgroundColor: sectionBg, borderColor }]}>
          <SectionHeader label="Similar Artists" color={colors.subtext} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={sc.similarScroll}>
            {lastfm.similar.map(sim => (
              <Pressable
                key={sim.name}
                style={({ pressed }) => [sc.similarChip, { opacity: pressed ? 0.6 : 1, borderColor: isDark ? '#333' : '#ddd' }]}
                onPress={() => handleSimilarArtistPress(sim.name)}>
                <View style={[sc.similarAvatar, { backgroundColor: isDark ? '#2a2a2a' : '#e0e0e0' }]}>
                  <Text style={[sc.similarInitial, { color: colors.subtext }]}>{sim.name.charAt(0)}</Text>
                </View>
                <Text style={[sc.similarName, { color: colors.text }]} numberOfLines={2}>{sim.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

    </ScrollView>
  );
}

const sc = StyleSheet.create({
  container: { paddingTop: 0, paddingBottom: 48 },

  // Header
  header: { alignItems: 'center', paddingTop: 28, paddingBottom: 20 },
  avatar: { width: 120, height: 120, borderRadius: 60, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16 },
  avatarPlaceholder: { backgroundColor: '#2a2a2a', justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { color: '#FF3CAC', fontSize: 44, fontWeight: '700' },
  name: { marginTop: 14, fontSize: 26, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' },
  listeners: { marginTop: 4, fontSize: 13 },

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

  // Discography grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  albumCard: { gap: 5 },
  albumTitle: { fontSize: 13, fontWeight: '500', marginTop: 4 },
  albumYear: { fontSize: 12 },

  // Bio
  bioText: { fontSize: 14, lineHeight: 22 },
  bioToggle: { color: '#FF3CAC', fontSize: 13, fontWeight: '500', marginTop: 8 },

  // Similar artists
  similarScroll: { marginHorizontal: -4 },
  similarChip: { width: 80, alignItems: 'center', marginHorizontal: 4, gap: 6 },
  similarAvatar: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  similarInitial: { fontSize: 20, fontWeight: '700' },
  similarName: { fontSize: 11, textAlign: 'center', lineHeight: 14 },
});
