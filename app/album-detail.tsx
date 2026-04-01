import {
  StyleSheet,
  View,
  Text,
  Image,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useRef } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAlbums } from '@/context/AlbumsContext';

const RATING_LABELS: Record<number, string> = {
  1:  'Skip',
  2:  'Dust Collector',
  3:  'Static',
  4:  'Passable',
  5:  'In the Rotation',
  6:  'Keeper',
  7:  'Mainstay',
  8:  'Daily Spin',
  9:  'Total Fixation',
  10: 'Timeless / No Skips',
};

const BAR_HEIGHTS = [6, 9, 12, 15, 18, 22, 26, 30, 34, 38];

function RatingPicker({ rating, onChange, isDark }: { rating: number; onChange: (r: number) => void; isDark: boolean }) {
  const barsWidth = useRef(0);
  const activeColor = '#FF3CAC';
  const inactiveColor = isDark ? '#2e2e2e' : '#e0e0e0';

  function ratingFromX(x: number): number {
    const w = barsWidth.current;
    if (w === 0) return 0;
    return Math.max(1, Math.min(10, Math.ceil((x / w) * 10)));
  }

  return (
    <View style={styles.ratingContainer}>
      <View style={styles.ratingRow}>
        <FontAwesome name="volume-up" size={22} color={rating > 0 ? activeColor : inactiveColor} />
        <View
          style={styles.barsTrack}
          onLayout={(e) => { barsWidth.current = e.nativeEvent.layout.width; }}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={(e) => onChange(ratingFromX(e.nativeEvent.locationX))}
          onResponderMove={(e) => onChange(ratingFromX(e.nativeEvent.locationX))}
        >
          {BAR_HEIGHTS.map((h, i) => (
            <View
              key={i}
              style={[styles.bar, { height: h, backgroundColor: i + 1 <= rating ? activeColor : inactiveColor }]}
            />
          ))}
        </View>
      </View>
      <Text style={[styles.ratingHint, { color: isDark ? '#888' : '#999' }]}>
        {rating > 0 ? RATING_LABELS[rating] : ' '}
      </Text>
    </View>
  );
}

export default function AlbumDetailScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { loggedAlbums, updateReview } = useAlbums();

  const album = loggedAlbums.find((a) => a.id === id);

  const [rating, setRating] = useState(album?.rating ?? 0);
  const [review, setReview] = useState(album?.review ?? '');

  if (!album) {
    router.back();
    return null;
  }

  function handleSave() {
    updateReview(album!.id, rating, review);
    router.back();
  }

  const isDark = colorScheme === 'dark';
  const dirty = rating !== album.rating || review !== (album.review ?? '');

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled">

        {album.artworkUrl ? (
          <Image source={{ uri: album.artworkUrl }} style={styles.artwork} />
        ) : (
          <View style={[styles.artwork, styles.artworkPlaceholder, { backgroundColor: album.coverColor }]}>
            <Text style={styles.artworkInitial}>{album.title.charAt(0)}</Text>
          </View>
        )}

        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {album.title}
        </Text>
        <Text style={[styles.artist, { color: colors.subtext }]}>
          {album.artist} · {album.year}
        </Text>
        <Text style={[styles.dateLogged, { color: colors.subtext }]}>
          Logged {album.dateLogged}
        </Text>

        <Text style={[styles.sectionLabel, { color: colors.subtext }]}>Rating</Text>
        <RatingPicker rating={rating} onChange={setRating} isDark={isDark} />

        <Text style={[styles.sectionLabel, { color: colors.subtext, marginTop: 28 }]}>
          Review <Text style={{ fontWeight: '400' }}>(optional)</Text>
        </Text>
        <TextInput
          style={[
            styles.reviewInput,
            {
              color: colors.text,
              backgroundColor: isDark ? '#1e1e1e' : '#f2f2f2',
              borderColor: isDark ? '#333' : '#e0e0e0',
            },
          ]}
          placeholder="What did you think?"
          placeholderTextColor={colors.subtext}
          value={review}
          onChangeText={setReview}
          multiline
          textAlignVertical="top"
          maxLength={500}
        />
        {review.length > 0 && (
          <Text style={[styles.charCount, { color: colors.subtext }]}>
            {review.length}/500
          </Text>
        )}

        <Pressable
          style={[
            styles.saveButton,
            { backgroundColor: dirty ? '#FF3CAC' : (isDark ? '#2a2a2a' : '#ddd') },
          ]}
          onPress={handleSave}
          disabled={!dirty}>
          <Text style={[styles.saveButtonText, { color: dirty ? '#fff' : colors.subtext }]}>
            Save
          </Text>
        </Pressable>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: 36,
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  artwork: {
    width: 160,
    height: 160,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  artworkPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  artworkInitial: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 56,
    fontWeight: '700',
  },
  title: {
    marginTop: 20,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  artist: {
    marginTop: 4,
    fontSize: 14,
    textAlign: 'center',
  },
  dateLogged: {
    marginTop: 4,
    fontSize: 12,
    textAlign: 'center',
  },
  sectionLabel: {
    marginTop: 28,
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  ratingContainer: {
    width: '100%',
    marginTop: 10,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  barsTrack: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    paddingBottom: 2,
  },
  bar: {
    flex: 1,
    borderRadius: 2,
  },
  ratingHint: {
    marginTop: 10,
    fontSize: 13,
    textAlign: 'center',
    height: 18,
  },
  reviewInput: {
    width: '100%',
    minHeight: 100,
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    fontSize: 15,
    lineHeight: 22,
  },
  charCount: {
    alignSelf: 'flex-end',
    fontSize: 12,
    marginTop: 4,
  },
  saveButton: {
    marginTop: 28,
    width: '100%',
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
});
