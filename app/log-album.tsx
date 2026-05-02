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
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAlbums } from '@/context/AlbumsContext';

const RATING_LABELS: Record<number, string> = {
  1:  'Skip',
  2:  'Rough',
  3:  'Forgettable',
  4:  'Underwhelming',
  5:  'Basic',
  6:  'Likable',
  7:  'Strong',
  8:  'Standout',
  9:  'Classic',
  10: 'Timeless / No Skips',
};

// Heights in px for bars 1–10 (staircase, bottom-aligned)
const BAR_HEIGHTS = [6, 9, 12, 15, 18, 22, 26, 30, 34, 38];

// ─── Inner bar track — gesture handling only ─────────────────────────────────

function RatingBar({
  rating,
  onRatingChange,
  containerWidth,
  isDark,
}: {
  rating: number;
  onRatingChange: (r: number) => void;
  containerWidth: number;
  isDark: boolean;
}) {
  const activeColor   = '#D4A017';
  const inactiveColor = isDark ? '#2a1e14' : '#e0e0e0';

  const tap = Gesture.Tap()
    .runOnJS(true)
    .onEnd((e) => {
      const val = Math.ceil((e.x / containerWidth) * 10);
      onRatingChange(Math.max(1, Math.min(10, val)));
    });

  const pan = Gesture.Pan()
    .runOnJS(true)
    .onUpdate((e) => {
      const val = Math.ceil((e.x / containerWidth) * 10);
      onRatingChange(Math.max(1, Math.min(10, val)));
    });

  const composed = Gesture.Simultaneous(tap, pan);

  return (
    <GestureDetector gesture={composed}>
      <View style={{
        width: containerWidth,
        height: 44,
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 4,
        paddingBottom: 2,
      }}>
        {BAR_HEIGHTS.map((h, i) => (
          <View
            key={i}
            style={[styles.bar, { height: h, backgroundColor: i + 1 <= rating ? activeColor : inactiveColor }]}
          />
        ))}
      </View>
    </GestureDetector>
  );
}

// ─── Outer wrapper — layout measurement + full row ────────────────────────────

function RatingPicker({ rating, onChange, isDark }: { rating: number; onChange: (r: number) => void; isDark: boolean }) {
  const [barWidth, setBarWidth] = useState(0);
  const activeColor   = '#D4A017';
  const inactiveColor = isDark ? '#2a1e14' : '#e0e0e0';

  return (
    <View style={styles.ratingContainer}>
      <View style={styles.ratingRow}>
        <FontAwesome name="volume-up" size={22} color={rating > 0 ? activeColor : inactiveColor} />
        <View style={{ flex: 1 }} onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}>
          {barWidth > 0 && (
            <RatingBar
              rating={rating}
              onRatingChange={onChange}
              containerWidth={barWidth}
              isDark={isDark}
            />
          )}
        </View>
        <View style={styles.ratingNumBox}>
          <Text style={[styles.ratingNum, { color: rating > 0 ? activeColor : inactiveColor }]}>
            {rating > 0 ? rating : '–'}
          </Text>
        </View>
      </View>
      <Text style={[styles.ratingHint, { color: isDark ? '#a07850' : '#a07850' }]}>
        {rating > 0 ? RATING_LABELS[rating] : ' '}
      </Text>
    </View>
  );
}

export default function LogAlbumScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { pendingAlbum, logAlbum } = useAlbums();
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');

  if (!pendingAlbum) return null;

  function handleLog() {
    logAlbum(rating, review);
    router.dismiss();
  }

  const isDark = colorScheme === 'dark';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled">

        <Image source={{ uri: pendingAlbum.artworkUrl }} style={styles.artwork} />

        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {pendingAlbum.title}
        </Text>
        <Text style={[styles.artist, { color: colors.subtext }]}>
          {pendingAlbum.artist} · {pendingAlbum.year}
        </Text>

        <Text style={[styles.sectionLabel, { color: colors.subtext }]}>
          Your rating <Text style={{ fontWeight: '400' }}>(optional)</Text>
        </Text>
        <RatingPicker rating={rating} onChange={setRating} isDark={isDark} />

        <Text style={[styles.sectionLabel, { color: colors.subtext, marginTop: 28 }]}>
          Review <Text style={{ fontWeight: '400' }}>(optional)</Text>
        </Text>
        <TextInput
          style={[
            styles.reviewInput,
            {
              color: colors.text,
              backgroundColor: isDark ? '#2e2018' : '#f2f2f2',
              borderColor: isDark ? '#3a2818' : '#e0e0e0',
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
          style={[styles.logButton, { backgroundColor: '#D4A017' }]}
          onPress={handleLog}>
          <Text style={[styles.logButtonText, { color: '#fff' }]}>
            Log Album
          </Text>
        </Pressable>

        <Pressable style={styles.cancelButton} onPress={() => router.dismiss()}>
          <Text style={[styles.cancelText, { color: colors.subtext }]}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: 40,
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
  ratingNumBox: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 2,
  },
  ratingNum: {
    fontSize: 20,
    fontWeight: '700',
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
  logButton: {
    marginTop: 28,
    width: '100%',
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  cancelButton: {
    marginTop: 14,
    padding: 8,
  },
  cancelText: {
    fontSize: 15,
  },
});
