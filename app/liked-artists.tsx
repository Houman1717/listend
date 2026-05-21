import {
  StyleSheet,
  View,
  Text,
  Pressable,
  FlatList,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useState, useEffect, useRef } from 'react';
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

  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<import('react-native').TextInput>(null);

  const artists = userId ? otherArtists : ownLikedArtists;
  const filtered = query.trim()
    ? artists.filter(a => a.name.toLowerCase().includes(query.toLowerCase()))
    : artists;

  function renderItem({ item }: { item: LikedArtist }) {
    return (
      <>
        <Pressable
          style={({ pressed }) => [s.row, { backgroundColor: colors.background, opacity: pressed ? 0.7 : 1 }]}
          onPress={() => router.push({ pathname: '/artist-detail', params: { id: item.id, name: item.name, artworkUrl: item.artworkUrl ?? '' } })}>
          {item.artworkUrl ? (
            <ExpoImage source={{ uri: item.artworkUrl }} style={s.avatar} 
            contentFit="cover" cachePolicy="disk"
          />
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
      {/* Count row with search toggle */}
      {artists.length > 0 && (
        <View style={[s.countRow, { borderBottomColor: colors.border }]}>
          <Text style={[s.countText, { color: colors.subtext }]}>{artists.length} artists</Text>
          <Pressable
            onPress={() => {
              const next = !searchOpen;
              setSearchOpen(next);
              if (!next) setQuery('');
              else setTimeout(() => searchInputRef.current?.focus(), 50);
            }}
            hitSlop={10}
            style={[s.searchToggle, searchOpen && { backgroundColor: '#D4A017' }]}>
            <FontAwesome name="search" size={13} color={searchOpen ? '#fff' : '#D4A017'} />
          </Pressable>
        </View>
      )}
      {artists.length > 0 && searchOpen && (
        <View style={[s.searchBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <FontAwesome name="search" size={14} color={colors.subtext} />
          <TextInput
            ref={searchInputRef}
            style={[s.searchInput, { color: colors.text }]}
            value={query}
            onChangeText={setQuery}
            placeholder="Search artists…"
            placeholderTextColor={colors.subtext}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
      )}

      {filtered.length === 0 ? (
        <View style={s.emptyWrap}>
          <Text style={[s.emptyText, { color: colors.subtext }]}>
            {query.trim()
              ? `No artists matching "${query}"`
              : userId
                ? 'This user has no liked artists yet.'
                : 'No liked artists yet. Tap ❤️ on any artist page to save them here.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingVertical: 8 },

  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  countText: { fontSize: 13, fontWeight: '600' },
  searchToggle: {
    width: 28, height: 28, borderRadius: 6,
    alignItems: 'center', justifyContent: 'center',
  },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, fontSize: 15, height: 36 },

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
