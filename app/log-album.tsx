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
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAlbums } from '@/context/AlbumsContext';

export default function LogAlbumScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { pendingAlbum, logAlbum } = useAlbums();
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');

  if (!pendingAlbum) {
    router.back();
    return null;
  }

  function handleLog() {
    if (rating === 0) return;
    logAlbum(rating, review);
    router.back();
    router.replace('/(tabs)');
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

        <Text style={[styles.sectionLabel, { color: colors.subtext }]}>Your rating</Text>
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Pressable key={star} onPress={() => setRating(star)} hitSlop={8}>
              <Text style={[styles.star, { color: star <= rating ? '#FF3CAC' : (isDark ? '#444' : '#ccc') }]}>
                ★
              </Text>
            </Pressable>
          ))}
        </View>
        {rating > 0 && (
          <Text style={[styles.ratingHint, { color: colors.subtext }]}>
            {['', 'Awful', 'Bad', 'OK', 'Good', 'Amazing'][rating]}
          </Text>
        )}

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
            styles.logButton,
            { backgroundColor: rating > 0 ? '#FF3CAC' : (isDark ? '#2a2a2a' : '#ddd') },
          ]}
          onPress={handleLog}
          disabled={rating === 0}>
          <Text style={[styles.logButtonText, { color: rating > 0 ? '#fff' : colors.subtext }]}>
            Log Album
          </Text>
        </Pressable>

        <Pressable style={styles.cancelButton} onPress={() => router.back()}>
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
  starsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  star: {
    fontSize: 40,
  },
  ratingHint: {
    marginTop: 6,
    fontSize: 13,
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
