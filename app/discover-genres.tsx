import { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  Pressable,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { spotifyGet, albumFromSpotify, SpotifyAlbum } from '@/context/SpotifyService';
import { useAlbums, PendingAlbum } from '@/context/AlbumsContext';

// ─── Genre list ───────────────────────────────────────────────────────────────
// Each genre has exactly 10 curated Spotify album IDs fetched via /v1/albums?ids=
// IDs verified from open.spotify.com album URLs.

const GENRES = [
  {
    label: 'Rap',
    albumIds: [
      '0NGwRz0semIXUCSxR0uffa', // Drake – Take Care
      '4eLPsYPBmXABThSJ821sqY', // Kendrick Lamar – DAMN.
      '7ycBtnsMtyVbbwTfJwRjSP', // Kendrick Lamar – To Pimp a Butterfly
      '41GuZcammIkupMPKH2OJ6I', // Travis Scott – ASTROWORLD
      '0UMMIkurRUmkruZ3KGBLtG', // J. Cole – 2014 Forest Hills Drive
      '20r762YmB5HeofjMCiPMLv', // Kanye West – My Beautiful Dark Twisted Fantasy
      '2NaYh6NEBGVAV9la4vKJSK', // JAY-Z – The Blueprint
      '07bIdDDe3I3hhWpxU6tuBp', // Pusha T – DAYTONA
      '0cszZwl0JRKHBdcFLfNX3T', // Nas – Illmatic
      '6PBZN8cbwkqm1ERj2BGXJ1', // Kendrick Lamar – good kid, m.A.A.d city
    ],
  },
  {
    label: 'R&B',
    albumIds: [
      '4yP0hdKOZPNshxUOjY0cZj', // The Weeknd – After Hours
      '07w0rG5TETcyihsEIZR3qG', // SZA – SOS
      '7dK54iZuOxXFarGhXwEXfF', // Beyoncé – Lemonade
      '2ODvWsOgouMbaA5xf0RkJe', // The Weeknd – Starboy
      '3xybjP7r2VsWzwvDQipdM0', // Daniel Caesar – Freudian
      '0PHMNbcgHfzSUALlfk7wGg', // Brent Faiyaz – WASTELAND
      '4lPqFAvgmG97pxyxQsyCQx', // Summer Walker – Still Over It
      '6kf46HbnYCZzP6rjvQHYzg', // Khalid – American Teen
      '392p3shh2jkxUxY2VHvlH8', // Frank Ocean – channel ORANGE
      '4IwODpNZKFYkHWXSeWMGmP', // H.E.R. – Back of My Mind
    ],
  },
  {
    label: 'Pop',
    albumIds: [
      '2fenSS68JI1h4Fo296JfGr', // Taylor Swift – folklore
      '151w1FgRZfnKZA9FEcg9Z3', // Taylor Swift – Midnights
      '21jF5jlMtzo94wbxmJ18aa', // Adele – 30
      '7fJJK56U9fHixgO0HQkhtI', // Dua Lipa – Future Nostalgia
      '5r36AJ6VOJtp00oxSkBZ5h', // Harry Styles – Harry's House
      '6s84u2TUpR3wdUv4NgKA2j', // Olivia Rodrigo – SOUR
      '0S0KGZnfBGSIssfF54WSJh', // Billie Eilish – WHEN WE ALL FALL ASLEEP…
      '3T4tUhGYeRNVUGevb0wThu', // Ed Sheeran – ÷ (Deluxe)
      '2fYhqwDWXjbpjaIJPEfKFw', // Ariana Grande – thank u, next
      '4g1ZRSobMefqF6nelkgibi', // Post Malone – Hollywood's Bleeding
    ],
  },
  {
    label: 'Rock',
    albumIds: [
      '78bpIziExqiI9qztvNFlQu', // Arctic Monkeys – AM
      '79dL7FLiJFOO0EoehUHQBv', // Tame Impala – Currents
      '6dVIqQ8qmQ5GBnJ9shOYGE', // Radiohead – OK Computer
      '2k8KgmDp9oHrmu0MIj4XDE', // The Strokes – Is This It
      '5DLhV9yOvZ7IxVmljMXtNm', // The Black Keys – El Camino
      '5lnQLEUiVDkLbFJHXHQu9m', // Foo Fighters – Wasting Light
      '7xl50xr9NDkd3i2kBbzsNZ', // Red Hot Chili Peppers – Stadium Arcadium
      '5T5NM01392dvvd4EhGrCnj', // Queens of the Stone Age – …Like Clockwork
      '1AP6uGYHdakRgwuWQsP5pK', // Muse – Origin of Symmetry
      '50Zz8CkIhATKUlQMbHO3k1', // Arctic Monkeys – Whatever People Say I Am…
    ],
  },
  {
    label: 'House',
    albumIds: [
      '4m2880jivSbbyEGAKfITCa', // Daft Punk – Random Access Memories
      '2noRn2Aes5aoNVsU6iWThc', // Daft Punk – Discovery
      '1ZFGRj11NnZHos8DUbbpF1', // Disclosure – Settle
      '7qzDkshVM3auVXjbZNdJB0', // Disclosure – Caracal
      '04Duapg2mNlVykd895xcfZ', // Jamie xx – In Colour
      '6x2gG7Pw1g54ZjQWjiAVCK', // Four Tet – There Is Love In You
      '3gkW0gOyovtdcscDX6WZ6O', // Caribou – Swim
      '48zisMeiXniWLzOQghbPqS', // Calvin Harris – Motion
      '5q2iMctlDvEMYVIawF6Vop', // Fred again.. – Actual Life 3
      '5m1RkwKeU7MV0Ni6PH2lPy', // Bonobo – Black Sands
    ],
  },
  {
    label: 'Jazz',
    albumIds: [
      '1weenld61qoidwYuZ1GESA', // Miles Davis – Kind of Blue
      '7Eoz7hJvaX1eFkbpQxC5PA', // John Coltrane – A Love Supreme
      '0nTTEAhCZsbbeplyDMIFuA', // Dave Brubeck Quartet – Time Out
      '5fmIolILp5NAtNYiRPjhzA', // Herbie Hancock – Head Hunters
      '5oGct1rifFn4mIPCL2dH0L', // Bill Evans Trio – Waltz for Debby
      '7pojWP7x9uEFSJgw765khA', // Charles Mingus – Mingus Ah Um
      '5JJ779nrbHx0KB2lBrMMa4', // Chet Baker – Chet Baker Sings
      '2dtjLAwt7Cq763h6AupyPZ', // Sonny Rollins – Saxophone Colossus
      '56WqCnM5giX57Jr3aAN2aK', // Miles Davis – Sketches of Spain
      '5VTlqV8lZH3YspQ1cDcjrL', // Thelonious Monk – Monk's Dream
    ],
  },
  {
    label: 'Soul',
    albumIds: [
      '2v6ANhWhZBUKkg6pJJBs3B', // Marvin Gaye – What's Going On
      '097eYvf9NKjFnv4xA9s2oV', // Amy Winehouse – Back to Black
      '1BZoqf8Zje5nGdwZhOjAtD', // Ms. Lauryn Hill – The Miseducation of Lauryn Hill
      '6YUCc2RiXcEKS9ibuZxjt0', // Stevie Wonder – Songs in the Key of Life
      '2lO9yuuIDgBpSJzxTh3ai8', // D'Angelo – Voodoo
      '3Yko2SxDk4hc6fncIBQlcM', // Solange – A Seat at the Table
      '3qr4pTBWEU1SVf01j6RAx3', // Erykah Badu – Baduizm
      '4W6kVnBPgcW8zDYXbRHh2J', // John Legend – Get Lifted
      '5qUlPoDmNxCSzqVx81RDLJ', // Alicia Keys – Songs in A Minor
      '4svLfrPPk2npPVuI4kXPYg', // Leon Bridges – Coming Home
    ],
  },
  {
    label: 'Country',
    albumIds: [
      '6JlCkqkqobGirPsaleJpFr', // Morgan Wallen – Dangerous: The Double Album
      '7f6xPqyaolTiziKf5R5Z0c', // Kacey Musgraves – Golden Hour
      '7lxHnls3yQNl8B9bILmHj7', // Chris Stapleton – Traveller
      '7IouDrXPdAZwT1NzVV3vef', // Zach Bryan – American Heartbreak
      '1lhNch5NkOONvFhRPh8qaj', // Luke Combs – This One's for You
      '35LcGAeeMwVeIJrDpB3Gkz', // Tyler Childers – Purgatory
      '4makbOuLd5SUdyHMaNM1Ag', // Sturgill Simpson – Metamodern Sounds in Country Music
      '2wDKBKgco7u3V1IWEK5V8l', // Brandi Carlile – By the Way, I Forgive You
      '0f9YXFsnwFxaQbhksDKQZ9', // Jason Isbell – Southeastern
      '53Oa5Bu0UTU8o8qCTaHKoz', // Luke Combs – This One's for You Too (Deluxe)
    ],
  },
];

// ─── Module-level cache + sequential fetch queue ──────────────────────────────
// Lives outside the component so results survive navigation and re-renders.

const cache: Record<string, SpotifyAlbum[]> = {};
const queue: string[] = [];
const subs: Record<string, Set<() => void>> = {};
let processing = false;

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function subscribe(label: string, cb: () => void): () => void {
  if (!subs[label]) subs[label] = new Set();
  subs[label].add(cb);
  return () => subs[label]?.delete(cb);
}

async function doFetch(label: string, albumIds: string[]): Promise<SpotifyAlbum[]> {
  // Single batch call — /v1/albums accepts up to 20 IDs comma-separated.
  const ids = albumIds.join(',');
  const data = await spotifyGet(`/albums?ids=${ids}&market=US`);
  return (data.albums ?? [])
    .filter((item: any) => item != null)
    .map(albumFromSpotify);
}

async function fetchWithRetry(label: string, albumIds: string[]): Promise<SpotifyAlbum[]> {
  try {
    return await doFetch(label, albumIds);
  } catch (e: any) {
    if (String(e?.message).includes('429')) {
      await delay(2000);
      return await doFetch(label, albumIds);
    }
    throw e;
  }
}

async function processQueue() {
  if (processing) return;
  processing = true;
  while (queue.length > 0) {
    const label = queue.shift()!;
    if (cache[label] !== undefined) {
      subs[label]?.forEach((cb) => cb());
      continue;
    }
    const genre = GENRES.find((g) => g.label === label);
    try {
      cache[label] = genre ? await fetchWithRetry(label, genre.albumIds) : [];
    } catch {
      cache[label] = [];
    }
    subs[label]?.forEach((cb) => cb());
    if (queue.length > 0) await delay(500);
  }
  processing = false;
}

function enqueue(label: string) {
  if (cache[label] !== undefined || queue.includes(label)) return;
  queue.push(label);
  processQueue();
}

// ─── Album card ───────────────────────────────────────────────────────────────

const CARD_SIZE = 120;

function AlbumCard({
  album,
  onPress,
  isDark,
}: {
  album: SpotifyAlbum;
  onPress: () => void;
  isDark: boolean;
}) {
  return (
    <Pressable style={({ pressed }) => [s.card, { opacity: pressed ? 0.7 : 1 }]} onPress={onPress}>
      {album.artworkUrl ? (
        <Image source={{ uri: album.artworkUrl }} style={s.cardImage} />
      ) : (
        <View style={[s.cardImage, { backgroundColor: isDark ? '#2a2a2a' : '#e0e0e0' }]} />
      )}
      <Text style={[s.cardTitle, { color: isDark ? '#f0f0f0' : '#111' }]} numberOfLines={1}>
        {album.title}
      </Text>
      <Text style={[s.cardArtist, { color: isDark ? '#888' : '#666' }]} numberOfLines={1}>
        {album.artist}
      </Text>
    </Pressable>
  );
}

// ─── Genre section ────────────────────────────────────────────────────────────
// Only mounts when FlatList scrolls it into view.
// On mount, enqueues its batch fetch — the module-level queue keeps them sequential.

function GenreSection({
  label,
  albumIds,
  onAlbumPress,
  colors,
  isDark,
}: {
  label: string;
  albumIds: string[];
  onAlbumPress: (album: SpotifyAlbum) => void;
  colors: any;
  isDark: boolean;
}) {
  const [albums, setAlbums] = useState<SpotifyAlbum[]>(() => cache[label] ?? []);
  const [loading, setLoading] = useState(cache[label] === undefined);

  useEffect(() => {
    if (cache[label] !== undefined) {
      setAlbums(cache[label]);
      setLoading(false);
      return;
    }
    const unsub = subscribe(label, () => {
      setAlbums(cache[label] ?? []);
      setLoading(false);
    });
    enqueue(label);
    return unsub;
  }, [label]);

  return (
    <View style={s.section}>
      <Text style={[s.sectionLabel, { color: colors.text }]}>{label}</Text>
      {loading ? (
        <View style={s.sectionLoader}>
          <ActivityIndicator color="#FF3CAC" />
        </View>
      ) : albums.length === 0 ? (
        <View style={s.sectionLoader}>
          <Text style={[s.emptyText, { color: colors.subtext }]}>No results</Text>
        </View>
      ) : (
        <FlatList
          horizontal
          data={albums}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.albumRow}
          renderItem={({ item }) => (
            <AlbumCard album={item} onPress={() => onAlbumPress(item)} isDark={isDark} />
          )}
        />
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DiscoverGenresScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const { setPendingAlbum } = useAlbums();

  function handleAlbumPress(album: SpotifyAlbum) {
    const pending: PendingAlbum = {
      spotifyId: album.id,
      title: album.title,
      artist: album.artist,
      year: album.year,
      artworkUrl: album.artworkUrl,
    };
    setPendingAlbum(pending);
    router.push('/log-album');
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Genres' }} />
      <FlatList
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={s.content}
        data={GENRES}
        keyExtractor={(item) => item.label}
        // Render only the first section on mount; load more as user scrolls
        initialNumToRender={1}
        windowSize={3}
        renderItem={({ item }) => (
          <GenreSection
            label={item.label}
            albumIds={item.albumIds}
            onAlbumPress={handleAlbumPress}
            colors={colors}
            isDark={isDark}
          />
        )}
      />
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  content: { paddingBottom: 48 },

  section: { paddingTop: 24, paddingBottom: 8 },
  sectionLabel: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionLoader: {
    height: CARD_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: { fontSize: 14 },

  albumRow: { paddingHorizontal: 16, gap: 12 },
  card: { width: CARD_SIZE },
  cardImage: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 6,
    marginBottom: 6,
  },
  cardTitle: { fontSize: 12, fontWeight: '600' },
  cardArtist: { fontSize: 11 },
});
