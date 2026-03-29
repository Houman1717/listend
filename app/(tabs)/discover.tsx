import {
  StyleSheet,
  View,
  Text,
  Image,
  Pressable,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAlbums, PendingAlbum } from '@/context/AlbumsContext';

type DiscoverAlbum = {
  itunesId: number;
  title: string;
  artist: string;
  year: number;
  artworkUrl: string;
  genre: string;
};

type RssEntry = {
  'im:name': { label: string };
  'im:artist': { label: string };
  'im:image': Array<{ label: string; attributes: { height: string } }>;
  'id': { label: string; attributes: { 'im:id': string } };
  'im:releaseDate': { label: string; attributes: { label: string } };
  'category': { attributes: { label: string } };
};

function entryToAlbum(entry: RssEntry): DiscoverAlbum {
  const images = entry['im:image'];
  const artRaw = images[images.length - 1]?.label ?? '';
  return {
    itunesId: parseInt(entry['id'].attributes['im:id']),
    title: entry['im:name'].label,
    artist: entry['im:artist'].label,
    year: new Date(entry['im:releaseDate'].label).getFullYear(),
    artworkUrl: artRaw.replace(/\d+x\d+bb/, '300x300bb'),
    genre: entry['category']?.attributes?.label ?? '',
  };
}

export default function DiscoverScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { setPendingAlbum } = useAlbums();

  const [albums, setAlbums] = useState<DiscoverAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('https://itunes.apple.com/us/rss/topalbums/limit=25/json')
      .then((r) => r.json())
      .then((data) => {
        const entries: RssEntry[] = data?.feed?.entry ?? [];
        setAlbums(entries.map(entryToAlbum));
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  function handlePress(album: DiscoverAlbum) {
    const pending: PendingAlbum = {
      itunesId: album.itunesId,
      title: album.title,
      artist: album.artist,
      year: album.year,
      artworkUrl: album.artworkUrl,
    };
    setPendingAlbum(pending);
    router.push('/log-album');
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color="#FF3CAC" size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.subtext }]}>Couldn't load charts.</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      data={albums}
      keyExtractor={(item) => String(item.itunesId)}
      contentContainerStyle={styles.list}
      ListHeaderComponent={() => (
        <View style={styles.listHeader}>
          <Text style={[styles.listHeaderTitle, { color: colors.text }]}>Top Albums Right Now</Text>
          <Text style={[styles.listHeaderSub, { color: colors.subtext }]}>iTunes Charts · US</Text>
        </View>
      )}
      ItemSeparatorComponent={() => (
        <View style={[styles.separator, { backgroundColor: isDark ? '#222' : '#eee' }]} />
      )}
      renderItem={({ item, index }) => (
        <Pressable
          style={({ pressed }) => [
            styles.row,
            { backgroundColor: pressed ? (isDark ? '#1a1a1a' : '#f5f5f5') : 'transparent' },
          ]}
          onPress={() => handlePress(item)}>
          <Text style={[styles.rank, { color: colors.subtext }]}>{index + 1}</Text>
          <Image source={{ uri: item.artworkUrl }} style={styles.artwork} />
          <View style={styles.info}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={[styles.artist, { color: colors.subtext }]} numberOfLines={1}>
              {item.artist}
            </Text>
            {item.genre ? (
              <Text style={[styles.genre, { color: colors.subtext }]}>{item.genre}</Text>
            ) : null}
          </View>
          <Text style={[styles.logHint, { color: '#FF3CAC' }]}>+ Log</Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 15,
  },
  list: {
    paddingBottom: 32,
  },
  listHeader: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 14,
    gap: 2,
  },
  listHeaderTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  listHeaderSub: {
    fontSize: 13,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 88,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  rank: {
    width: 22,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  artwork: {
    width: 52,
    height: 52,
    borderRadius: 4,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
  artist: {
    fontSize: 13,
  },
  genre: {
    fontSize: 11,
    marginTop: 1,
  },
  logHint: {
    fontSize: 13,
    fontWeight: '600',
  },
});
