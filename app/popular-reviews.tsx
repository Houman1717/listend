import { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Pressable,
  Image,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { POPULAR_REVIEWS_DATA, PopularReview } from './(tabs)/index';
import { avatarColor } from '@/components/ReviewComments';

// ─── Full review row ──────────────────────────────────────────────────────────

function ReviewRow({
  item,
  liked,
  onLike,
  isDark,
  colors,
}: {
  item: PopularReview;
  liked: boolean;
  onLike: () => void;
  isDark: boolean;
  colors: any;
}) {
  const displayCount = item.likeCount + (liked ? 1 : 0);
  return (
    <View
      style={[
        s.row,
        {
          backgroundColor: isDark ? '#2e2018' : '#fff',
          borderColor: isDark ? '#2a1e14' : '#e8e8e8',
        },
      ]}>
      {/* Top: art + album meta */}
      <View style={s.topRow}>
        <Image source={{ uri: item.artworkUrl }} style={s.art} />
        <View style={s.albumInfo}>
          <Text style={[s.albumTitle, { color: isDark ? '#f5e6c8' : '#1c1410' }]}>
            {item.albumTitle}
          </Text>
          <Text style={[s.albumArtist, { color: isDark ? '#a07850' : '#7a5535' }]}>
            {item.albumArtist} · {item.albumYear}
          </Text>
          <View style={s.ratingRow}>
            <FontAwesome name="volume-up" size={11} color="#e8963a" />
            <View style={s.ratingBadge}>
              <Text style={s.ratingNum}>{item.rating}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Full review text */}
      <Text style={[s.reviewText, { color: isDark ? '#a07850' : '#3a2818' }]}>
        "{item.review}"
      </Text>

      {/* Footer */}
      <View style={s.footer}>
        <View style={s.userRow}>
          <View style={[s.avatar, { backgroundColor: avatarColor(item.username) }]}>
            <Text style={s.avatarLetter}>{item.username[0].toUpperCase()}</Text>
          </View>
          <Text style={[s.username, { color: '#e8963a' }]}>@{item.username}</Text>
        </View>
        <Pressable onPress={onLike} hitSlop={10} style={s.likeBtn}>
          <FontAwesome
            name={liked ? 'heart' : 'heart-o'}
            size={14}
            color={liked ? '#e8963a' : (isDark ? '#7a5535' : '#a07850')}
          />
          <Text style={[s.likeCount, { color: isDark ? '#7a5535' : '#a07850' }]}>
            {displayCount}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PopularReviewsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';

  const [likedReviews, setLikedReviews] = useState<Set<string>>(new Set());

  function handleLike(id: string) {
    setLikedReviews(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <FlatList
      data={POPULAR_REVIEWS_DATA}
      keyExtractor={item => item.id}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[s.list, { paddingBottom: 40 }]}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => (
        <ReviewRow
          item={item}
          liked={likedReviews.has(item.id)}
          onLike={() => handleLike(item.id)}
          isDark={isDark}
          colors={colors}
        />
      )}
    />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  list: { padding: 16, gap: 14 },

  row: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 12,
  },

  topRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  art: {
    width: 84,
    height: 84,
    borderRadius: 8,
  },
  albumInfo: {
    flex: 1,
    gap: 4,
    paddingTop: 2,
  },
  albumTitle:  { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  albumArtist: { fontSize: 13 },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  ratingBadge: {
    backgroundColor: '#e8963a',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  ratingNum: { color: '#fff', fontSize: 12, fontWeight: '700' },

  reviewText: {
    fontSize: 14,
    lineHeight: 21,
    fontStyle: 'italic',
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: { color: '#fff', fontSize: 11, fontWeight: '700' },
  username:     { fontSize: 13, fontWeight: '600' },
  likeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  likeCount: { fontSize: 13 },
});
