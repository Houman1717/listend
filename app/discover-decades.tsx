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

// ─── Decade list ──────────────────────────────────────────────────────────────

type CuratedAlbum = { album: string; artist: string };

const DECADES: { label: string; albums: CuratedAlbum[] }[] = [
  {
    label: '1950s',
    albums: [
      { album: 'Songs for Swingin\' Lovers!',          artist: 'Frank Sinatra'             },
      { album: 'Kind of Blue',                          artist: 'Miles Davis'               },
      { album: 'Time Out',                              artist: 'Dave Brubeck Quartet'      },
      { album: 'Elvis Presley',                         artist: 'Elvis Presley'             },
      { album: 'Come Fly with Me',                      artist: 'Frank Sinatra'             },
      { album: 'Moanin\'',                              artist: 'Art Blakey'                },
      { album: 'The Genius of Ray Charles',             artist: 'Ray Charles'               },
      { album: 'Ella and Louis',                        artist: 'Ella Fitzgerald'           },
      { album: 'Johnny Cash with His Hot and Blue Guitar', artist: 'Johnny Cash'           },
      { album: 'Mingus Ah Um',                          artist: 'Charles Mingus'            },
    ],
  },
  {
    label: '1960s',
    albums: [
      { album: 'Revolver',                              artist: 'The Beatles'               },
      { album: 'Pet Sounds',                            artist: 'The Beach Boys'            },
      { album: 'Highway 61 Revisited',                  artist: 'Bob Dylan'                 },
      { album: 'Sgt. Pepper\'s Lonely Hearts Club Band', artist: 'The Beatles'              },
      { album: 'The Velvet Underground & Nico',          artist: 'The Velvet Underground'   },
      { album: 'Blonde on Blonde',                      artist: 'Bob Dylan'                 },
      { album: 'Abbey Road',                            artist: 'The Beatles'               },
      { album: 'Are You Experienced',                   artist: 'Jimi Hendrix'              },
      { album: 'Led Zeppelin',                          artist: 'Led Zeppelin'              },
      { album: 'Aftermath',                             artist: 'The Rolling Stones'        },
    ],
  },
  {
    label: '1970s',
    albums: [
      { album: 'The Dark Side of the Moon',             artist: 'Pink Floyd'                },
      { album: 'Rumours',                               artist: 'Fleetwood Mac'             },
      { album: 'Led Zeppelin IV',                       artist: 'Led Zeppelin'              },
      { album: 'Born to Run',                           artist: 'Bruce Springsteen'         },
      { album: 'Tapestry',                              artist: 'Carole King'               },
      { album: 'Hotel California',                      artist: 'Eagles'                    },
      { album: 'Exile on Main St.',                     artist: 'The Rolling Stones'        },
      { album: 'Innervisions',                          artist: 'Stevie Wonder'             },
      { album: 'London Calling',                        artist: 'The Clash'                 },
      { album: 'Off the Wall',                          artist: 'Michael Jackson'           },
    ],
  },
  {
    label: '1980s',
    albums: [
      { album: 'Thriller',                              artist: 'Michael Jackson'           },
      { album: 'Purple Rain',                           artist: 'Prince'                    },
      { album: 'The Joshua Tree',                       artist: 'U2'                        },
      { album: 'Appetite for Destruction',              artist: 'Guns N\' Roses'            },
      { album: 'Back in Black',                         artist: 'AC/DC'                     },
      { album: 'Born in the U.S.A.',                    artist: 'Bruce Springsteen'         },
      { album: 'Sign \'O\' the Times',                  artist: 'Prince'                    },
      { album: 'Graceland',                             artist: 'Paul Simon'                },
      { album: 'Like a Prayer',                         artist: 'Madonna'                   },
      { album: 'Eliminator',                            artist: 'ZZ Top'                    },
    ],
  },
  {
    label: '1990s',
    albums: [
      { album: 'Nevermind',                             artist: 'Nirvana'                   },
      { album: 'The Chronic',                           artist: 'Dr. Dre'                   },
      { album: 'OK Computer',                           artist: 'Radiohead'                 },
      { album: 'Illmatic',                              artist: 'Nas'                       },
      { album: 'Ten',                                   artist: 'Pearl Jam'                 },
      { album: 'Ready to Die',                          artist: 'The Notorious B.I.G.'      },
      { album: 'Jagged Little Pill',                    artist: 'Alanis Morissette'         },
      { album: 'Achtung Baby',                          artist: 'U2'                        },
      { album: 'The Miseducation of Lauryn Hill',       artist: 'Ms. Lauryn Hill'           },
      { album: 'Reasonable Doubt',                      artist: 'JAY-Z'                     },
    ],
  },
  {
    label: '2000s',
    albums: [
      { album: 'The College Dropout',                   artist: 'Kanye West'                },
      { album: 'Is This It',                            artist: 'The Strokes'               },
      { album: 'Speakerboxxx/The Love Below',           artist: 'Outkast'                   },
      { album: 'Funeral',                               artist: 'Arcade Fire'               },
      { album: 'Elephant',                              artist: 'The White Stripes'         },
      { album: 'American Idiot',                        artist: 'Green Day'                 },
      { album: 'Late Registration',                     artist: 'Kanye West'                },
      { album: 'Stankonia',                             artist: 'Outkast'                   },
      { album: 'Whatever People Say I Am, That\'s What I\'m Not', artist: 'Arctic Monkeys' },
      { album: 'Stadium Arcadium',                      artist: 'Red Hot Chili Peppers'     },
    ],
  },
  {
    label: '2010s',
    albums: [
      { album: 'To Pimp a Butterfly',                   artist: 'Kendrick Lamar'            },
      { album: 'Blonde',                                artist: 'Frank Ocean'               },
      { album: 'My Beautiful Dark Twisted Fantasy',     artist: 'Kanye West'                },
      { album: 'good kid, m.A.A.d city',                artist: 'Kendrick Lamar'            },
      { album: 'Lemonade',                              artist: 'Beyoncé'                   },
      { album: '1989',                                  artist: 'Taylor Swift'              },
      { album: 'AM',                                    artist: 'Arctic Monkeys'            },
      { album: 'Currents',                              artist: 'Tame Impala'               },
      { album: 'Random Access Memories',                artist: 'Daft Punk'                 },
      { album: 'channel ORANGE',                        artist: 'Frank Ocean'               },
    ],
  },
  {
    label: '2020s',
    albums: [
      { album: 'folklore',                              artist: 'Taylor Swift'              },
      { album: 'After Hours',                           artist: 'The Weeknd'                },
      { album: 'Mr. Morale & the Big Steppers',         artist: 'Kendrick Lamar'            },
      { album: 'SOS',                                   artist: 'SZA'                       },
      { album: 'Un Verano Sin Ti',                      artist: 'Bad Bunny'                 },
      { album: 'Future Nostalgia',                      artist: 'Dua Lipa'                  },
      { album: 'SOUR',                                  artist: 'Olivia Rodrigo'            },
      { album: 'Midnights',                             artist: 'Taylor Swift'              },
      { album: 'Harry\'s House',                        artist: 'Harry Styles'              },
      { album: 'Actual Life 3',                         artist: 'Fred again..'              },
    ],
  },
];

// ─── Module-level cache + sequential fetch queue ──────────────────────────────

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

async function searchOne(entry: CuratedAlbum): Promise<SpotifyAlbum | null> {
  const q = encodeURIComponent(`album:${entry.album} artist:${entry.artist}`);
  const data = await spotifyGet(`/search?q=${q}&type=album&limit=1&market=US`);
  const item = data.albums?.items?.[0];
  return item ? albumFromSpotify(item) : null;
}

async function doFetch(albums: CuratedAlbum[]): Promise<SpotifyAlbum[]> {
  const results = await Promise.all(albums.map(entry => searchOne(entry).catch(() => null)));
  return results.filter((a): a is SpotifyAlbum => a !== null);
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
    const decade = DECADES.find((d) => d.label === label);
    try {
      cache[label] = decade ? await doFetch(decade.albums) : [];
    } catch (err: any) {
      console.error(`[Decades] Failed to load "${label}":`, err?.message ?? err);
      cache[label] = [];
    }
    cache[label]?.forEach(album => { if (album.artworkUrl) Image.prefetch(album.artworkUrl); });
    subs[label]?.forEach((cb) => cb());
    if (queue.length > 0) await delay(150);
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

// ─── Decade section ───────────────────────────────────────────────────────────

function DecadeSection({
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

export default function DiscoverDecadesScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const { setPendingAlbum } = useAlbums();

  useEffect(() => {
    DECADES.forEach(d => enqueue(d.label));
  }, []);

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
      <Stack.Screen options={{ title: 'By Decade' }} />
      <FlatList
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={s.content}
        data={DECADES}
        keyExtractor={(item) => item.label}
        initialNumToRender={1}
        windowSize={3}
        renderItem={({ item }) => (
          <DecadeSection
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
