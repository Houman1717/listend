import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useLikedFeaturedPlaylists, LikedFeaturedPlaylist } from '@/context/LikedFeaturedPlaylistsContext';

function Mosaic({ urls, size }: { urls: string[]; size: number }) {
  const half = size / 2 - 1;
  const filled = [...urls, '', '', '', ''].slice(0, 4);
  return (
    <View style={{ width: size, height: size, flexDirection: 'row', flexWrap: 'wrap', gap: 2, borderRadius: 8, overflow: 'hidden' }}>
      {filled.map((url, i) =>
        url
          ? <ExpoImage key={i} source={{ uri: url }} style={{ width: half, height: half }} contentFit="cover" />
          : <View key={i} style={{ width: half, height: half, backgroundColor: '#2e2018' }} />
      )}
    </View>
  );
}

function PlaylistRow({ playlist, colors, isDark, onPress }: {
  playlist: LikedFeaturedPlaylist;
  colors: any;
  isDark: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[s.row, { borderBottomColor: colors.border }]} onPress={onPress} activeOpacity={0.75}>
      <Mosaic urls={playlist.artworkUrls} size={60} />
      <View style={s.info}>
        <Text style={[s.name, { color: colors.text }]} numberOfLines={1}>{playlist.name}</Text>
        <Text style={[s.desc, { color: isDark ? '#a07850' : '#7a5535' }]} numberOfLines={2}>{playlist.description}</Text>
      </View>
      <FontAwesome name="chevron-right" size={14} color={isDark ? '#a07850' : '#7a5535'} />
    </TouchableOpacity>
  );
}

export default function LikedFeaturedPlaylistsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { likedPlaylists } = useLikedFeaturedPlaylists();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={s.wrap}>
      {likedPlaylists.length === 0 ? (
        <View style={s.empty}>
          <FontAwesome name="heart-o" size={40} color={isDark ? '#a07850' : '#7a5535'} />
          <Text style={[s.emptyText, { color: isDark ? '#a07850' : '#7a5535' }]}>
            No liked playlists yet.{'\n'}Heart a playlist to save it here.
          </Text>
        </View>
      ) : (
        <View style={[s.list, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {likedPlaylists.map(pl => (
            <PlaylistRow
              key={pl.id}
              playlist={pl}
              colors={colors}
              isDark={isDark}
              onPress={() =>
                router.push({
                  pathname: '/discover-featured-playlist',
                  params: { id: pl.id, name: pl.name, emoji: pl.emoji, description: pl.description, artworkUrlsJson: JSON.stringify(pl.artworkUrls) },
                } as any)
              }
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap:      { padding: 16, paddingBottom: 48 },
  list:      { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  row:       { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  info:      { flex: 1 },
  name:      { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  desc:      { fontSize: 13 },
  empty:     { alignItems: 'center', marginTop: 80, gap: 16 },
  emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
