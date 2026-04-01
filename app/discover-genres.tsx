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
// Curated top-10 albums per genre by name + artist.
// At runtime each is resolved via a single Spotify search call.

type CuratedAlbum = { album: string; artist: string };

const GENRES: { label: string; albums: CuratedAlbum[] }[] = [
  {
    label: 'Rap',
    albums: [
      { album: 'DAMN.',                              artist: 'Kendrick Lamar'  },
      { album: 'Take Care',                          artist: 'Drake'           },
      { album: 'To Pimp a Butterfly',                artist: 'Kendrick Lamar'  },
      { album: 'ASTROWORLD',                         artist: 'Travis Scott'    },
      { album: '2014 Forest Hills Drive',            artist: 'J. Cole'         },
      { album: 'My Beautiful Dark Twisted Fantasy',  artist: 'Kanye West'      },
      { album: 'The Blueprint',                      artist: 'JAY-Z'           },
      { album: 'Illmatic',                           artist: 'Nas'             },
      { album: 'good kid, m.A.A.d city',             artist: 'Kendrick Lamar'  },
      { album: 'The Marshall Mathers LP',            artist: 'Eminem'          },
    ],
  },
  {
    label: 'R&B',
    albums: [
      { album: 'After Hours',                        artist: 'The Weeknd'      },
      { album: 'SOS',                                artist: 'SZA'             },
      { album: 'Lemonade',                           artist: 'Beyoncé'         },
      { album: 'channel ORANGE',                     artist: 'Frank Ocean'     },
      { album: 'Freudian',                           artist: 'Daniel Caesar'   },
      { album: 'WASTELAND',                          artist: 'Brent Faiyaz'    },
      { album: 'Still Over It',                      artist: 'Summer Walker'   },
      { album: 'Starboy',                            artist: 'The Weeknd'      },
      { album: 'American Teen',                      artist: 'Khalid'          },
      { album: 'Back of My Mind',                    artist: 'H.E.R.'          },
    ],
  },
  {
    label: 'Pop',
    albums: [
      { album: 'folklore',                           artist: 'Taylor Swift'    },
      { album: 'Midnights',                          artist: 'Taylor Swift'    },
      { album: '30',                                 artist: 'Adele'           },
      { album: 'Future Nostalgia',                   artist: 'Dua Lipa'        },
      { album: "Harry's House",                      artist: 'Harry Styles'    },
      { album: 'SOUR',                               artist: 'Olivia Rodrigo'  },
      { album: 'When We All Fall Asleep Where Do We Go', artist: 'Billie Eilish' },
      { album: 'Divide',                             artist: 'Ed Sheeran'      },
      { album: 'thank u, next',                      artist: 'Ariana Grande'   },
      { album: "Hollywood's Bleeding",               artist: 'Post Malone'     },
    ],
  },
  {
    label: 'Rock',
    albums: [
      { album: 'AM',                                 artist: 'Arctic Monkeys'            },
      { album: 'OK Computer',                        artist: 'Radiohead'                 },
      { album: 'Is This It',                         artist: 'The Strokes'               },
      { album: 'Currents',                           artist: 'Tame Impala'               },
      { album: 'El Camino',                          artist: 'The Black Keys'            },
      { album: 'Wasting Light',                      artist: 'Foo Fighters'              },
      { album: 'Stadium Arcadium',                   artist: 'Red Hot Chili Peppers'     },
      { album: '...Like Clockwork',                  artist: 'Queens of the Stone Age'   },
      { album: 'Origin of Symmetry',                 artist: 'Muse'                      },
      { album: "Whatever People Say I Am, That's What I'm Not", artist: 'Arctic Monkeys' },
    ],
  },
  {
    label: 'House',
    albums: [
      { album: 'Random Access Memories',             artist: 'Daft Punk'       },
      { album: 'Discovery',                          artist: 'Daft Punk'       },
      { album: 'Settle',                             artist: 'Disclosure'      },
      { album: 'Caracal',                            artist: 'Disclosure'      },
      { album: 'In Colour',                          artist: 'Jamie xx'        },
      { album: 'There Is Love In You',               artist: 'Four Tet'        },
      { album: 'Swim',                               artist: 'Caribou'         },
      { album: 'Motion',                             artist: 'Calvin Harris'   },
      { album: 'Actual Life 3',                      artist: 'Fred again..'    },
      { album: 'Black Sands',                        artist: 'Bonobo'          },
    ],
  },
  {
    label: 'Jazz',
    albums: [
      { album: 'Kind of Blue',                       artist: 'Miles Davis'              },
      { album: 'A Love Supreme',                     artist: 'John Coltrane'            },
      { album: 'Time Out',                           artist: 'Dave Brubeck Quartet'     },
      { album: 'Head Hunters',                       artist: 'Herbie Hancock'           },
      { album: 'Waltz for Debby',                    artist: 'Bill Evans'               },
      { album: 'Mingus Ah Um',                       artist: 'Charles Mingus'           },
      { album: 'Chet Baker Sings',                   artist: 'Chet Baker'               },
      { album: 'Saxophone Colossus',                 artist: 'Sonny Rollins'            },
      { album: 'Sketches of Spain',                  artist: 'Miles Davis'              },
      { album: "Monk's Dream",                       artist: 'Thelonious Monk'          },
    ],
  },
  {
    label: 'Soul',
    albums: [
      { album: "What's Going On",                    artist: 'Marvin Gaye'              },
      { album: 'Back to Black',                      artist: 'Amy Winehouse'            },
      { album: 'The Miseducation of Lauryn Hill',    artist: 'Ms. Lauryn Hill'          },
      { album: 'Songs in the Key of Life',           artist: 'Stevie Wonder'            },
      { album: 'Voodoo',                             artist: "D'Angelo"                 },
      { album: 'A Seat at the Table',                artist: 'Solange'                  },
      { album: 'Baduizm',                            artist: 'Erykah Badu'              },
      { album: 'Get Lifted',                         artist: 'John Legend'              },
      { album: 'Songs in A Minor',                   artist: 'Alicia Keys'              },
      { album: 'Coming Home',                        artist: 'Leon Bridges'             },
    ],
  },
  {
    label: 'Country',
    albums: [
      { album: 'Dangerous: The Double Album',        artist: 'Morgan Wallen'            },
      { album: 'Golden Hour',                        artist: 'Kacey Musgraves'          },
      { album: 'Traveller',                          artist: 'Chris Stapleton'          },
      { album: 'American Heartbreak',                artist: 'Zach Bryan'               },
      { album: "This One's for You",                 artist: 'Luke Combs'               },
      { album: 'Purgatory',                          artist: 'Tyler Childers'           },
      { album: 'Metamodern Sounds in Country Music', artist: 'Sturgill Simpson'         },
      { album: 'By the Way, I Forgive You',          artist: 'Brandi Carlile'           },
      { album: 'Southeastern',                       artist: 'Jason Isbell'             },
      { album: 'Stoned Side of the Mtn',             artist: 'Tyler Childers'           },
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

// Search Spotify for a single album by name + artist, return the best match.
async function searchOne(entry: CuratedAlbum): Promise<SpotifyAlbum | null> {
  const q = encodeURIComponent(`album:${entry.album} artist:${entry.artist}`);
  const data = await spotifyGet(`/search?q=${q}&type=album&limit=1&market=US`);
  const item = data.albums?.items?.[0];
  return item ? albumFromSpotify(item) : null;
}

async function doFetch(albums: CuratedAlbum[]): Promise<SpotifyAlbum[]> {
  const results: SpotifyAlbum[] = [];
  for (const entry of albums) {
    const album = await searchOne(entry).catch(() => null);
    if (album) results.push(album);
    if (albums.indexOf(entry) < albums.length - 1) await delay(100);
  }
  return results;
}

async function fetchWithRetry(label: string, albums: CuratedAlbum[]): Promise<SpotifyAlbum[]> {
  try {
    return await doFetch(albums);
  } catch (e: any) {
    if (String(e?.message).includes('429')) {
      await delay(2000);
      return await doFetch(albums);
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
      cache[label] = genre ? await fetchWithRetry(label, genre.albums) : [];
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
// Enqueues its fetch on mount — the module-level queue keeps genres sequential.

function GenreSection({
  label,
  onAlbumPress,
  colors,
  isDark,
}: {
  label: string;
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
