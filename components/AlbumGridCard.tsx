import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

const GAP = 12;
const COLS = 3;
const PADDING = 16;

export { GAP, COLS, PADDING };

export function cardWidth(screenWidth: number): number {
  return (screenWidth - PADDING * 2 - GAP * (COLS - 1)) / COLS;
}

type Album = {
  id: string;
  title: string;
  artist: string;
  artworkUrl?: string | null;
};

export function AlbumGridCard({
  album,
  width,
  onPress,
  textColor,
  subColor,
  isDark,
}: {
  album: Album;
  width: number;
  onPress?: () => void;
  textColor: string;
  subColor: string;
  isDark: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.card, { width, opacity: pressed ? 0.7 : 1 }]}>
      {album.artworkUrl ? (
        <Image
          source={{ uri: album.artworkUrl }}
          style={{ width, height: width, borderRadius: 8 }}
          resizeMode="cover"
        />
      ) : (
        <View style={[s.fallback, { width, height: width, backgroundColor: isDark ? '#2a2a2a' : '#e0e0e0' }]}>
          <FontAwesome name="music" size={width * 0.28} color={isDark ? '#555' : '#aaa'} />
        </View>
      )}
      <Text style={[s.title, { color: textColor }]} numberOfLines={1}>{album.title}</Text>
      <Text style={[s.artist, { color: subColor }]} numberOfLines={1}>{album.artist}</Text>
    </Pressable>
  );
}

export function AlbumGridCardPlaceholder({
  width,
  isDark,
}: {
  width: number;
  isDark: boolean;
}) {
  return (
    <View style={[s.card, { width }]}>
      <View style={{ width, height: width, borderRadius: 8, backgroundColor: isDark ? '#1e1e1e' : '#e5e5e5' }} />
      <View style={[s.placeholderText, { width: width * 0.7, backgroundColor: isDark ? '#2a2a2a' : '#ddd' }]} />
      <View style={[s.placeholderText, { width: width * 0.5, backgroundColor: isDark ? '#222' : '#e8e8e8' }]} />
    </View>
  );
}

const s = StyleSheet.create({
  card:          { gap: 4 },
  fallback:      { borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  title:         { fontSize: 12, fontWeight: '600', marginTop: 2 },
  artist:        { fontSize: 11 },
  placeholderText: { height: 10, borderRadius: 4, marginTop: 2 },
});
