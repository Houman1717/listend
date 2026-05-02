import {
  StyleSheet,
  View,
  Text,
  Image,
  Pressable,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useState, useEffect } from 'react';
import { useLikedArtists, LikedArtist } from '@/context/LikedArtistsContext';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { supabase } from '@/lib/supabase';

export default function LikedArtistsScreen() {
  const colorScheme = useColorScheme();
  const colors      = Colors[colorScheme ?? 'dark'];

  const params   = useLocalSearchParams<{ readOnly?: string; userId?: string }>();
  const readOnly = params.readOnly === '1';
  const userId   = params.userId ?? null;

  const { likedArtists: ownLikedArtists, unlike } = useLikedArtists();
  const router = useRouter();

  // When viewing another user's profile, fetch their liked artists from Supabase
  const [otherArtists, setOtherArtists] = useState<LikedArtist[]>([]);
  const [loading,       setLoading]      = useState(false);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    supabase
      .from('liked_artists')
      .select('artist_id, name, artwork_url')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setOtherArtists(
          (data ?? []).map((r: any) => ({
            id:         r.artist_id,
            name:       r.name,
            artworkUrl: r.artwork_url ?? null,
          }))
        );
        setLoading(false);
      });
  }, [userId]);

  const artists = userId ? otherArtists : ownLikedArtists;

  function renderItem({ item }: { item: LikedArtist }) {
    return (
      <>
        <Pressable
          style={({ pressed }) => [s.row, { backgroundColor: colors.background, opacity: pressed ? 0.7 : 1 }]}
          onPress={() => router.push({ pathname: '/artist-detail', params: { id: item.id, name: item.name, artworkUrl: item.artworkUrl ?? '' } })}>
          {item.artworkUrl ? (
            <Image source={{ uri: item.artworkUrl }} style={s.avatar} />
          ) : (
            <View style={[s.avatar, { backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={[s.avatarInitial, { color: '#D4A017' }]}>{item.name.charAt(0)}</Text>
            </View>
          )}
          <Text style={[s.name, { color: colors.text }]}>{item.name}</Text>
          {!readOnly && (
            <Pressable
              style={({ pressed }) => [s.heartBtn, { opacity: pressed ? 0.6 : 1 }]}
              onPress={() => unlike(item.id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <FontAwesome name="heart" size={20} color="#D4A017" />
            </Pressable>
          )}
        </Pressable>
        <View style={[s.separator, { backgroundColor: colors.border }]} />
      </>
    );
  }

  if (loading) {
    return (
      <View style={[s.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color="#D4A017" size="large" />
      </View>
    );
  }

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {artists.length === 0 ? (
        <View style={s.emptyWrap}>
          <Text style={[s.emptyText, { color: colors.subtext }]}>
            {userId ? 'This user has no liked artists yet.' : 'No liked artists yet. Tap ❤️ on any artist page to save them here.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={artists}
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
  container: { flex: 1 },
  list: { paddingVertical: 8 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 84,
  },

  avatar: { width: 50, height: 50, borderRadius: 25 },
  avatarInitial: { fontSize: 20, fontWeight: '700' },

  name: { flex: 1, fontSize: 16, fontWeight: '600' },
  heartBtn: { padding: 4 },

  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
