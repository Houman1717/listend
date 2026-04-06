import { useEffect, useState } from 'react';
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
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { SpotifyAlbum, SpotifyTrack, SpotifyArtist } from '@/context/SpotifyService';

// ─── Backend URL ──────────────────────────────────────────────────────────────

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

// ─── Placeholder friends ──────────────────────────────────────────────────────

const PLACEHOLDER_FRIENDS = [
  { id: '1', user: 'alex_m',  album: 'After Hours',            artist: 'The Weeknd',     artworkUrl: 'https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36' },
  { id: '2', user: 'sara_k',  album: 'folklore',               artist: 'Taylor Swift',   artworkUrl: 'https://i.scdn.co/image/ab67616d0000b27395f754318336a07e85ec59bc' },
  { id: '3', user: 'jvines',  album: 'DAMN.',                  artist: 'Kendrick Lamar', artworkUrl: 'https://i.scdn.co/image/ab67616d0000b2738b52c6b9bc4e43d873869699' },
  { id: '4', user: 'priya_r', album: 'SOS',                    artist: 'SZA',            artworkUrl: 'https://i.scdn.co/image/ab67616d0000b273bc18bdade69ec5ef0bb25b17' },
  { id: '5', user: 'tomfitz', album: 'Random Access Memories', artist: 'Daft Punk',      artworkUrl: 'https://i.scdn.co/image/ab67616d0000b2739b9b36b0e22870b9f542d937' },
  { id: '6', user: 'nadia_w', album: 'Currents',               artist: 'Tame Impala',    artworkUrl: 'https://i.scdn.co/image/ab67616d0000b2739e1cfc756886ac782e363d79' },
];

const AGO = ['2m ago', '14m ago', '1h ago', '2h ago', '3h ago', '5h ago'];

// ─── Module-level cache — persists across navigations ─────────────────────────

const cache: {
  albums?:  SpotifyAlbum[];
  songs?:   SpotifyTrack[];
  artists?: SpotifyArtist[];
} = {};

// ─── Fetcher ──────────────────────────────────────────────────────────────────

async function fetchHome(): Promise<{ albums: SpotifyAlbum[]; songs: SpotifyTrack[]; artists: SpotifyArtist[] }> {
  const res = await fetch(`${API_URL}/home`);
  if (!res.ok) throw new Error(`/home → ${res.status}`);
  return res.json();
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

function AlbumCard({ item, isDark, onPress }: { item: SpotifyAlbum; isDark: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.card, { width: ALBUM_CARD, opacity: pressed ? 0.7 : 1 }]}>
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

function SongCard({ item, index, isDark, onPress }: { item: SpotifyTrack; index: number; isDark: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.card, { width: SONG_CARD, opacity: pressed ? 0.7 : 1 }]}>
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

function ArtistCard({ item, isDark, onPress }: { item: SpotifyArtist; isDark: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.card, { width: ARTIST_CARD, alignItems: 'center', opacity: pressed ? 0.7 : 1 }]}>
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
  ago,
  isDark,
  colors,
  onPress,
}: {
  friend: typeof PLACEHOLDER_FRIENDS[number];
  ago: string;
  isDark: boolean;
  colors: any;
  onPress: () => void;
}) {
  const artSize = FRIEND_CARD - 24;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.friendCard,
        {
          width: FRIEND_CARD,
          backgroundColor: isDark ? '#1a1a1a' : '#fff',
          borderColor: isDark ? '#2a2a2a' : '#e5e5e5',
          opacity: pressed ? 0.7 : 1,
        },
      ]}>
      {friend.artworkUrl ? (
        <Image source={{ uri: friend.artworkUrl }} style={{ width: artSize, height: artSize, borderRadius: 6 }} />
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
  const router = useRouter();

  const [albums,  setAlbums]  = useState<SpotifyAlbum[]>(cache.albums   ?? []);
  const [songs,   setSongs]   = useState<SpotifyTrack[]>(cache.songs    ?? []);
  const [artists, setArtists] = useState<SpotifyArtist[]>(cache.artists ?? []);
  const [loading, setLoading] = useState(!cache.albums);

  useEffect(() => {
    if (cache.albums) return; // already warm

    fetchHome()
      .then((data) => {
        cache.albums  = data.albums;
        cache.songs   = data.songs;
        cache.artists = data.artists;
        setAlbums(data.albums);
        setSongs(data.songs);
        setArtists(data.artists);
        data.albums.forEach(a => { if (a.artworkUrl) Image.prefetch(a.artworkUrl); });
      })
      .catch((err) => console.error('[Home] fetchHome failed:', err?.message ?? err))
      .finally(() => setLoading(false));
  }, []);

  function handleAlbumPress(item: SpotifyAlbum) {
    router.push({
      pathname: '/album-detail',
      params: { id: item.id, title: item.title, artist: item.artist, artworkUrl: item.artworkUrl },
    });
  }

  function handleArtistPress(item: SpotifyArtist) {
    router.push({
      pathname: '/artist-detail',
      params: { id: item.id, name: item.name, artworkUrl: item.artworkUrl },
    });
  }

  function handleSongPress(item: SpotifyTrack) {
    // Navigate to the artist page since we have the artist name but not the album ID
    router.push({
      pathname: '/artist-detail',
      params: { name: item.artist },
    });
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}>

      {/* 1 — Top Listend Albums This Week */}
      <Section title="Top Listend Albums This Week" loading={loading}>
        <FlatList
          horizontal
          data={albums}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.row}
          renderItem={({ item }) => (
            <AlbumCard item={item} isDark={isDark} onPress={() => handleAlbumPress(item)} />
          )}
        />
      </Section>

      {/* 2 — Friends Recent Listend */}
      <Section title="Friends Recent Listend" loading={false}>
        <FlatList
          horizontal
          data={PLACEHOLDER_FRIENDS}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.row}
          renderItem={({ item, index }) => (
            <FriendCard
              friend={item}
              ago={AGO[index] ?? ''}
              isDark={isDark}
              colors={colors}
              onPress={() => router.push({
                pathname: '/album-detail',
                params: { title: item.album, artist: item.artist, artworkUrl: item.artworkUrl },
              })}
            />
          )}
        />
      </Section>

      {/* 3 — Top Listend Songs This Week */}
      <Section title="Top Listend Songs This Week" loading={loading}>
        <FlatList
          horizontal
          data={songs}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.row}
          renderItem={({ item, index }) => (
            <SongCard item={item} index={index} isDark={isDark} onPress={() => handleSongPress(item)} />
          )}
        />
      </Section>

      {/* 4 — Top Listend Artists This Week */}
      <Section title="Top Listend Artists This Week" loading={loading}>
        <FlatList
          horizontal
          data={artists}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.row}
          renderItem={({ item }) => (
            <ArtistCard item={item} isDark={isDark} onPress={() => handleArtistPress(item)} />
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
