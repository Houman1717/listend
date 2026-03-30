import { StyleSheet, View, Text, Pressable, ScrollView, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

type Genre = { label: string; spotifyGenre: string };

const GENRES: Genre[] = [
  { label: 'Rap',         spotifyGenre: 'hip-hop'      },
  { label: 'R&B',         spotifyGenre: 'r-n-b'        },
  { label: 'Pop',         spotifyGenre: 'pop'          },
  { label: 'Rock',        spotifyGenre: 'rock'         },
  { label: 'House',       spotifyGenre: 'house'        },
  { label: 'Afrobeats',   spotifyGenre: 'afrobeats'    },
  { label: 'Reggaeton',   spotifyGenre: 'reggaeton'    },
  { label: 'Country',     spotifyGenre: 'country'      },
  { label: 'Jazz',        spotifyGenre: 'jazz'         },
  { label: 'Soul',        spotifyGenre: 'soul'         },
  { label: 'Electronic',  spotifyGenre: 'electronic'   },
  { label: 'Alternative', spotifyGenre: 'alternative'  },
  { label: 'Indie',       spotifyGenre: 'indie'        },
  { label: 'Metal',       spotifyGenre: 'metal'        },
  { label: 'Classical',   spotifyGenre: 'classical'    },
  { label: 'Folk',        spotifyGenre: 'folk'         },
  { label: 'Latin',       spotifyGenre: 'latin'        },
  { label: 'K-Pop',       spotifyGenre: 'k-pop'        },
];

const GAP = 10;
const COLS = 2;
const TILE_WIDTH = Math.floor((Dimensions.get('window').width - 32 - GAP) / COLS);
const TILE_HEIGHT = Math.round(TILE_WIDTH * 0.56);

export default function DiscoverGenresScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';

  return (
    <ScrollView
      style={[s.container, { backgroundColor: colors.background }]}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}>
      <View style={s.grid}>
        {GENRES.map((genre) => (
          <Pressable
            key={genre.label}
            style={({ pressed }) => [
              s.tile,
              {
                width: TILE_WIDTH,
                height: TILE_HEIGHT,
                backgroundColor: isDark ? '#1a1a1a' : '#fff',
                borderColor: isDark ? '#2a2a2a' : '#e5e5e5',
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            onPress={() =>
              router.push({
                pathname: '/discover-results',
                params: { category: 'genre', value: genre.spotifyGenre, title: genre.label },
              })
            }>
            <Text style={[s.tileLabel, { color: colors.text }]}>{genre.label}</Text>
            <View style={s.accent} />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  tile: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'flex-end',
    padding: 12,
    overflow: 'hidden',
  },
  tileLabel: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  accent: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 3,
    height: '100%',
    backgroundColor: '#FF3CAC',
  },
});
