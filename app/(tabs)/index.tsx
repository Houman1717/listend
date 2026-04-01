import { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  FlatList,
  Pressable,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import {
  spotifyGet,
  albumFromSpotify,
  trackFromSpotify,
  artistFromSpotify,
  SpotifyAlbum,
  SpotifyTrack,
  SpotifyArtist,
} from '@/context/SpotifyService';

// ─── Placeholder definitions (text/metadata only — images fetched at runtime) ─

const PLACEHOLDER_ARTISTS = [
  { id: '1', name: 'Kendrick Lamar',     genre: 'Rap'       },
  { id: '2', name: 'Taylor Swift',       genre: 'Pop'       },
  { id: '3', name: 'SZA',                genre: 'R&B'       },
  { id: '4', name: 'Tyler the Creator',  genre: 'Rap'       },
  { id: '5', name: 'Billie Eilish',      genre: 'Pop'       },
  { id: '6', name: 'Bad Bunny',          genre: 'Reggaeton' },
  { id: '7', name: 'The Weeknd',         genre: 'R&B'       },
  { id: '8', name: 'Chappell Roan',      genre: 'Pop'       },
];

const PLACEHOLDER_FRIENDS = [
  { id: '1', user: 'alex_m',  album: 'After Hours',            artist: 'The Weeknd'     },
  { id: '2', user: 'sara_k',  album: 'folklore',               artist: 'Taylor Swift'   },
  { id: '3', user: 'jvines',  album: 'DAMN.',                  artist: 'Kendrick Lamar' },
  { id: '4', user: 'priya_r', album: 'SOS',                    artist: 'SZA'            },
  { id: '5', user: 'tomfitz', album: 'Random Access Memories', artist: 'Daft Punk'      },
  { id: '6', user: 'nadia_w', album: 'Currents',               artist: 'Tame Impala'    },
];

const AGO = ['2m ago', '14m ago', '1h ago', '2h ago', '3h ago', '5h ago'];

// ─── Module-level cache — persists across navigations ─────────────────────────

const cache: {
  albums?:      SpotifyAlbum[];
  songs?:       SpotifyTrack[];
  artists?:     SpotifyArtist[];
  friendsArt?:  Record<string, string>; // friend id → artworkUrl
} = {};

// ─── Fetchers ─────────────────────────────────────────────────────────────────
// Each fetcher uses the cheapest available endpoint for its content type:
//   • Albums  → /browse/new-releases  (dedicated browse endpoint, not search)
//   • Songs   → /browse/featured-playlists → /playlists/{id}/tracks
//               (two browse/playlist calls instead of a search)
//   • Artists → /search (no browse alternative for arbitrary artist lookup)
//   • Friends → /search (no browse alternative for arbitrary album lookup)

async function fetchAlbums(): Promise<SpotifyAlbum[]> {
  // /browse/new-releases was deprecated by Spotify in Nov 2024 and returns 403
  // for apps without Extended Quota Mode. Search with tag:new is the correct
  // alternative for standard apps.
  const data = await spotifyGet('/search?q=tag:new&type=album&limit=10&market=US');
  return (data.albums?.items ?? []).map(albumFromSpotify);
}

async function fetchSongs(): Promise<SpotifyTrack[]> {
  // /browse/featured-playlists was deprecated alongside /browse/new-releases.
  // Search is the available alternative for standard apps.
  const data = await spotifyGet('/search?q=year:2025&type=track&limit=10&market=US');
  return (data.tracks?.items ?? []).map(trackFromSpotify);
}

async function fetchArtists(): Promise<SpotifyArtist[]> {
  const results: SpotifyArtist[] = [];
  for (const p of PLACEHOLDER_ARTISTS) {
    const q = encodeURIComponent(p.name);
    const data = await spotifyGet(`/search?q=${q}&type=artist&limit=1&market=US`).catch(() => null);
    const item = data?.artists?.items?.[0];
    results.push(item ? artistFromSpotify(item) : { id: p.id, name: p.name, genre: p.genre, artworkUrl: '' });
    // No per-request delay — the global queue in SpotifyService paces all calls.
  }
  return results;
}

async function fetchFriendsArt(): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  for (const f of PLACEHOLDER_FRIENDS) {
    const q = encodeURIComponent(`album:${f.album} artist:${f.artist}`);
    const data = await spotifyGet(`/search?q=${q}&type=album&limit=1&market=US`).catch(() => null);
    const item = data?.albums?.items?.[0];
    map[f.id] = item ? albumFromSpotify(item).artworkUrl : '';
    // No per-request delay — the global queue in SpotifyService paces all calls.
  }
  return map;
}

// ─── Card sizes ───────────────────────────────────────────────────────────────

const ALBUM_CARD  = 120;
const ARTIST_CARD = 90;
const SONG_CARD   = 120;
const FRIEND_CARD = 140;
const FALLBACK_BG = '#1e1e2e';

// ─── Shared components ────────────────────────────────────────────────────────

function Section({ title, loading, children }: { title: string; loading: boolean; children: React.ReactNode }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  return (
    <View style={s.section}>
      <Text style={[s.sectionLabel, { color: colors.text }]}>{title}</Text>
      {loading ? (
        <View style={s.sectionLoader}>
          <ActivityIndicator color="#FF3CAC" />
        </View>
      ) : children}
    </View>
  );
}

function ArtFallback({ size, radius, label }: { size: number; radius: number; label: string }) {
  return (
    <View style={[s.fallback, { width: size, height: size, borderRadius: radius }]}>
      <Text style={[s.fallbackText, { fontSize: size * 0.32 }]}>{label[0]?.toUpperCase()}</Text>
    </View>
  );
}

// ─── Album card ───────────────────────────────────────────────────────────────

function AlbumCard({ item, isDark }: { item: SpotifyAlbum; isDark: boolean }) {
  return (
    <Pressable style={({ pressed }) => [s.card, { width: ALBUM_CARD, opacity: pressed ? 0.7 : 1 }]}>
      {item.artworkUrl ? (
        <Image source={{ uri: item.artworkUrl }} style={{ width: ALBUM_CARD, height: ALBUM_CARD, borderRadius: 6 }} />
      ) : (
        <ArtFallback size={ALBUM_CARD} radius={6} label={item.title} />
      )}
      <Text style={[s.cardTitle, { color: isDark ? '#f0f0f0' : '#111' }]} numberOfLines={1}>{item.title}</Text>
      <Text style={[s.cardSub,   { color: isDark ? '#888'   : '#666' }]} numberOfLines={1}>{item.artist}</Text>
    </Pressable>
  );
}

// ─── Song card ────────────────────────────────────────────────────────────────

function SongCard({ item, index, isDark }: { item: SpotifyTrack; index: number; isDark: boolean }) {
  return (
    <Pressable style={({ pressed }) => [s.card, { width: SONG_CARD, opacity: pressed ? 0.7 : 1 }]}>
      <View>
        {item.artworkUrl ? (
          <Image source={{ uri: item.artworkUrl }} style={{ width: SONG_CARD, height: SONG_CARD, borderRadius: 6 }} />
        ) : (
          <ArtFallback size={SONG_CARD} radius={6} label={item.title} />
        )}
        <View style={s.rankBadge}>
          <Text style={s.rankText}>#{index + 1}</Text>
        </View>
      </View>
      <Text style={[s.cardTitle, { color: isDark ? '#f0f0f0' : '#111' }]} numberOfLines={1}>{item.title}</Text>
      <Text style={[s.cardSub,   { color: isDark ? '#888'   : '#666' }]} numberOfLines={1}>{item.artist}</Text>
    </Pressable>
  );
}

// ─── Artist card (circular) ───────────────────────────────────────────────────

function ArtistCard({ item, isDark }: { item: SpotifyArtist & { genre: string }; isDark: boolean }) {
  return (
    <Pressable style={({ pressed }) => [s.card, { width: ARTIST_CARD, alignItems: 'center', opacity: pressed ? 0.7 : 1 }]}>
      {item.artworkUrl ? (
        <Image source={{ uri: item.artworkUrl }} style={{ width: ARTIST_CARD, height: ARTIST_CARD, borderRadius: ARTIST_CARD / 2 }} />
      ) : (
        <ArtFallback size={ARTIST_CARD} radius={ARTIST_CARD / 2} label={item.name} />
      )}
      <Text style={[s.cardTitle, { color: isDark ? '#f0f0f0' : '#111', textAlign: 'center' }]} numberOfLines={1}>{item.name}</Text>
      <Text style={[s.cardSub,   { color: isDark ? '#888'   : '#666', textAlign: 'center' }]} numberOfLines={1}>{item.genre}</Text>
    </Pressable>
  );
}

// ─── Friend card ──────────────────────────────────────────────────────────────

function FriendCard({
  friend,
  artworkUrl,
  ago,
  isDark,
  colors,
}: {
  friend: typeof PLACEHOLDER_FRIENDS[number];
  artworkUrl: string;
  ago: string;
  isDark: boolean;
  colors: any;
}) {
  const artSize = FRIEND_CARD - 24;
  return (
    <Pressable
      style={({ pressed }) => [
        s.friendCard,
        {
          width: FRIEND_CARD,
          backgroundColor: isDark ? '#1a1a1a' : '#fff',
          borderColor: isDark ? '#2a2a2a' : '#e5e5e5',
          opacity: pressed ? 0.7 : 1,
        },
      ]}>
      {artworkUrl ? (
        <Image source={{ uri: artworkUrl }} style={{ width: artSize, height: artSize, borderRadius: 6 }} />
      ) : (
        <ArtFallback size={artSize} radius={6} label={friend.album} />
      )}
      <Text style={[s.friendUser, { color: '#FF3CAC' }]} numberOfLines={1}>@{friend.user}</Text>
      <Text style={[s.cardTitle,  { color: isDark ? '#f0f0f0' : '#111' }]} numberOfLines={1}>{friend.album}</Text>
      <Text style={[s.cardSub,    { color: isDark ? '#888' : '#666' }]} numberOfLines={1}>{friend.artist}</Text>
      <Text style={[s.friendAgo,  { color: colors.subtext }]}>{ago}</Text>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';

  const [albums,     setAlbums]     = useState<SpotifyAlbum[]>(cache.albums     ?? []);
  const [songs,      setSongs]      = useState<SpotifyTrack[]>(cache.songs       ?? []);
  const [artists,    setArtists]    = useState<SpotifyArtist[]>(cache.artists    ?? []);
  const [friendsArt, setFriendsArt] = useState<Record<string, string>>(cache.friendsArt ?? {});

  const [loadingAlbums,  setLoadingAlbums]  = useState(!cache.albums);
  const [loadingSongs,   setLoadingSongs]   = useState(!cache.songs);
  const [loadingArtists, setLoadingArtists] = useState(!cache.artists);
  const [loadingFriends, setLoadingFriends] = useState(!cache.friendsArt);

  // ── Ref that gates below-fold loading to after the user first scrolls ──────
  // Initialised to true when all secondary caches are already warm (returning
  // visitor) so we never re-fire fetches that are already done.
  const belowFoldTriggered = useRef(
    cache.songs !== undefined &&
    cache.artists !== undefined &&
    cache.friendsArt !== undefined
  );

  // ── Phase 1: load only the first (above-fold) section on mount ──────────────
  // One request to /browse/new-releases. Nothing else fires at startup.
  useEffect(() => {
    if (cache.albums) return; // already cached — nothing to do
    (async () => {
      try {
        const data = await fetchAlbums();
        cache.albums = data;
        setAlbums(data);
      } catch (err: any) {
        console.error('[Home] fetchAlbums failed:', err?.message ?? err);
        cache.albums = [];
      } finally {
        setLoadingAlbums(false);
      }
    })();
  }, []);

  // ── Phase 2: load below-fold sections once the user starts scrolling ────────
  // Songs uses 2 browse/playlist calls; artists and friends use /search.
  // They fire sequentially (songs first, then artists+friends together) so the
  // global queue is not flooded all at once.
  function triggerBelowFold() {
    if (belowFoldTriggered.current) return;
    belowFoldTriggered.current = true;

    (async () => {
      if (!cache.songs) {
        try {
          const data = await fetchSongs();
          cache.songs = data;
          setSongs(data);
        } catch (err: any) {
          console.error('[Home] fetchSongs failed:', err?.message ?? err);
          cache.songs = [];
        } finally {
          setLoadingSongs(false);
        }
      }

      // Artists and friends fire together; the global queue serialises them.
      const tasks: Promise<void>[] = [];

      if (!cache.artists) {
        tasks.push(
          fetchArtists()
            .then((data) => { cache.artists = data; setArtists(data); })
            .catch((err) => {
              console.error('[Home] fetchArtists failed:', err?.message ?? err);
              cache.artists = [];
            })
            .finally(() => setLoadingArtists(false)),
        );
      }

      if (!cache.friendsArt) {
        tasks.push(
          fetchFriendsArt()
            .then((data) => { cache.friendsArt = data; setFriendsArt(data); })
            .catch((err) => {
              console.error('[Home] fetchFriendsArt failed:', err?.message ?? err);
              cache.friendsArt = {};
            })
            .finally(() => setLoadingFriends(false)),
        );
      }

      await Promise.all(tasks);
    })();
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={200}
      onScroll={(e: any) => {
        // Any scroll beyond 50px means the user is moving toward below-fold content
        if (e.nativeEvent.contentOffset.y > 50) triggerBelowFold();
      }}>

      {/* 1 — Top Listend Albums This Week */}
      <Section title="Top Listend Albums This Week" loading={loadingAlbums}>
        <FlatList
          horizontal
          data={albums}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.row}
          renderItem={({ item }) => <AlbumCard item={item} isDark={isDark} />}
        />
      </Section>

      {/* 2 — Friends Activity: Recently Listend */}
      <Section title="Friends Activity: Recently Listend" loading={loadingFriends}>
        <FlatList
          horizontal
          data={PLACEHOLDER_FRIENDS}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.row}
          renderItem={({ item, index }) => (
            <FriendCard
              friend={item}
              artworkUrl={friendsArt[item.id] ?? ''}
              ago={AGO[index] ?? ''}
              isDark={isDark}
              colors={colors}
            />
          )}
        />
      </Section>

      {/* 3 — Top Listend Songs This Week */}
      <Section title="Top Listend Songs This Week" loading={loadingSongs}>
        <FlatList
          horizontal
          data={songs}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.row}
          renderItem={({ item, index }) => <SongCard item={item} index={index} isDark={isDark} />}
        />
      </Section>

      {/* 4 — Top Listend Artists This Week */}
      <Section title="Top Listend Artists This Week" loading={loadingArtists}>
        <FlatList
          horizontal
          data={artists}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.row}
          renderItem={({ item }) => (
            <ArtistCard
              item={{ ...item, genre: PLACEHOLDER_ARTISTS.find((p) => p.name === item.name)?.genre ?? item.genre }}
              isDark={isDark}
            />
          )}
        />
      </Section>

    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  content: { paddingTop: 20, paddingBottom: 48, gap: 32 },

  section:      { gap: 12 },
  sectionLabel: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3, paddingHorizontal: 16 },
  sectionLoader:{ height: ALBUM_CARD, justifyContent: 'center', alignItems: 'center' },
  row:          { paddingHorizontal: 16, gap: 12 },

  card: { gap: 5 },

  fallback: {
    backgroundColor: FALLBACK_BG,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackText: {
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '700',
  },

  cardTitle: { fontSize: 12, fontWeight: '600' },
  cardSub:   { fontSize: 11 },

  rankBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  rankText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  friendCard: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 5,
  },
  friendUser: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  friendAgo:  { fontSize: 10, marginTop: 2 },
});
