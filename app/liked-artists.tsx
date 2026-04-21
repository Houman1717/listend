import {
  StyleSheet,
  View,
  Text,
  Image,
  Pressable,
  FlatList,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useLikedArtists, LikedArtist } from '@/context/LikedArtistsContext';

const DARK_BG = '#0d0d0d';
const CARD_BG = '#111';
const BORDER = '#222';
const TEXT = '#f0f0f0';
const SUBTEXT = '#888';
const ACCENT = '#FF3CAC';

export default function LikedArtistsScreen() {
  const params = useLocalSearchParams<{ readOnly?: string }>();
  const readOnly = params.readOnly === '1';
  const { likedArtists, unlike } = useLikedArtists();
  const router = useRouter();

  function renderItem({ item }: { item: LikedArtist }) {
    return (
      <>
        <Pressable
          style={({ pressed }) => [s.row, { opacity: pressed ? 0.7 : 1 }]}
          onPress={() => router.push({ pathname: '/artist-detail', params: { id: item.id, name: item.name, artworkUrl: item.artworkUrl ?? '' } })}>
          {item.artworkUrl ? (
            <Image source={{ uri: item.artworkUrl }} style={s.avatar} />
          ) : (
            <View style={[s.avatar, s.avatarPlaceholder]}>
              <Text style={s.avatarInitial}>{item.name.charAt(0)}</Text>
            </View>
          )}
          <Text style={s.name}>{item.name}</Text>
          {!readOnly && (
            <Pressable
              style={({ pressed }) => [s.heartBtn, { opacity: pressed ? 0.6 : 1 }]}
              onPress={() => unlike(item.id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <FontAwesome name="heart" size={20} color={ACCENT} />
            </Pressable>
          )}
        </Pressable>
        <View style={s.separator} />
      </>
    );
  }

  return (
    <View style={s.container}>
      {likedArtists.length === 0 ? (
        <View style={s.emptyWrap}>
          <Text style={s.emptyText}>
            No liked artists yet. Tap ❤️ on any artist page to save them here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={likedArtists}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_BG },
  list: { paddingVertical: 8 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
    backgroundColor: CARD_BG,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
    marginLeft: 84,
  },

  avatar: { width: 50, height: 50, borderRadius: 25 },
  avatarPlaceholder: {
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: { color: ACCENT, fontSize: 20, fontWeight: '700' },

  name: { flex: 1, color: TEXT, fontSize: 16, fontWeight: '600' },
  heartBtn: { padding: 4 },

  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    color: SUBTEXT,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
