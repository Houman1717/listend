import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Keyboard,
  Switch,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { useEffect, useState } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Ionicons from '@expo/vector-icons/Ionicons';
import Colors from '@/constants/Colors';
import { VolumeRatingPicker } from '@/components/VolumeRatingPicker';
import { useSongReviews } from '@/context/SongReviewsContext';
import { useAndroidKeyboardHeight } from '@/hooks/useAndroidKeyboardHeight';
import type { SongMeta } from '@/lib/songReviews';


/**
 * Your own rating / review of a song, plus marking it as the album's
 * favourite. Opening it never logs anything — only Save does. Other people's
 * reviews live on the Song page, not here.
 */
export function SongReviewModal({
  song,
  onClose,
  isDark,
  colors: colorsProp,
}: {
  song:    SongMeta | null;
  onClose: () => void;
  isDark:  boolean;
  colors?: any;
}) {
  const colors = colorsProp ?? Colors[isDark ? 'dark' : 'light'];
  const { getSongReview, saveSongReview, removeSongReview, setFavoriteSong } = useSongReviews();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useAndroidKeyboardHeight();

  const existing = song ? getSongReview(song) : undefined;

  const [rating,     setRating]     = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [saving,     setSaving]     = useState(false);
  const [favBusy,    setFavBusy]    = useState(false);

  // Reset the form whenever a different song opens.
  useEffect(() => {
    if (!song) return;
    const r = getSongReview(song);
    setRating(r?.rating ?? 0);
    setReviewText(r?.review ?? '');
    setSaving(false);
  }, [song?.id]);

  if (!song) return null;

  const accent    = colors.tint;
  const border    = colors.border;
  const muted     = colors.subtext;
  const fieldBg   = colors.surface;
  const dirty     = !existing || rating !== existing.rating || reviewText.trim() !== (existing.review ?? '');
  const canFavorite = !!song.albumId;
  const isFavorite  = !!existing?.isFavorite;

  async function handleSave() {
    if (!song || saving) return;
    Keyboard.dismiss();
    setSaving(true);
    const ok = await saveSongReview({ song, rating, review: reviewText });
    setSaving(false);
    if (ok) onClose();
    else Alert.alert("Couldn't save", 'Check your connection and try again.');
  }

  function handleRemove() {
    if (!song) return;
    Alert.alert('Remove song?', 'This removes your rating and review for this song.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const ok = await removeSongReview(song);
          if (ok) onClose();
          else Alert.alert("Couldn't remove", 'Check your connection and try again.');
        },
      },
    ]);
  }

  // Saves straight away — no rating needed (logs the song as listened if it
  // wasn't already). The rating/review draft is left as it is.
  async function handleFavorite() {
    if (!song || favBusy) return;
    setFavBusy(true);
    const ok = await setFavoriteSong(song, !isFavorite);
    setFavBusy(false);
    if (!ok) Alert.alert("Couldn't update favourite", 'Check your connection and try again.');
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, backgroundColor: colors.background, paddingBottom: keyboardHeight }}>
          <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}>

            {/* Header */}
            <View style={[s.header, { borderBottomColor: border }]}>
              <Pressable onPress={onClose} hitSlop={12}>
                <FontAwesome name="chevron-down" size={16} color={muted} />
              </Pressable>
              <Text style={[s.headerTitle, { color: colors.text }]}>{existing ? 'Your Review' : 'Rate & Review'}</Text>
              <View style={{ width: 16 }} />
            </View>

            <ScrollView
              contentContainerStyle={s.body}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}>

              {/* Song row */}
              <View style={s.songRow}>
                {song.artworkUrl ? (
                  <ExpoImage source={{ uri: song.artworkUrl }} style={s.art} contentFit="cover" cachePolicy="disk" />
                ) : (
                  <View style={[s.art, { backgroundColor: fieldBg, alignItems: 'center', justifyContent: 'center' }]}>
                    <FontAwesome name="music" size={20} color={muted} />
                  </View>
                )}
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[s.songTitle, { color: colors.text }]} numberOfLines={2}>{song.title}</Text>
                  <Text style={[s.songArtist, { color: muted }]} numberOfLines={1}>{song.artist}</Text>
                  {!!song.albumTitle && (
                    <Text style={[s.songAlbum, { color: muted }]} numberOfLines={1}>{song.albumTitle}</Text>
                  )}
                </View>
              </View>

              {/* Favourite — its own labelled row so it's clearly separate from rating */}
              {canFavorite && (
                <Pressable
                  onPress={handleFavorite}
                  disabled={favBusy}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: isFavorite }}
                  style={[s.favRow, {
                    backgroundColor: isFavorite ? `${accent}14` : fieldBg,
                    borderColor:     isFavorite ? `${accent}55` : border,
                  }]}>
                  <Ionicons name={isFavorite ? 'trophy' : 'trophy-outline'} size={18} color={isFavorite ? accent : muted} />
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text style={[s.favTitle, { color: colors.text }]}>Favourite track</Text>
                    {!!song.albumTitle && (
                      <Text style={[s.favSub, { color: muted }]} numberOfLines={1}>on {song.albumTitle}</Text>
                    )}
                  </View>
                  <Switch
                    value={isFavorite}
                    onValueChange={handleFavorite}
                    disabled={favBusy}
                    trackColor={{ true: accent, false: undefined }}
                  />
                </Pressable>
              )}

              {/* Your rating */}
              <Text style={[s.label, { color: muted }]}>YOUR RATING</Text>
              <VolumeRatingPicker rating={rating} onChange={setRating} isDark={isDark} tint={accent} />

              {/* Your review */}
              <Text style={[s.label, { color: muted, marginTop: 18 }]}>YOUR REVIEW</Text>
              <TextInput
                style={[s.input, { backgroundColor: fieldBg, color: colors.text, borderColor: border }]}
                value={reviewText}
                onChangeText={setReviewText}
                placeholder="What did you think of this song? (optional)"
                placeholderTextColor={muted}
                multiline
                maxLength={5000}
                textAlignVertical="top"
              />

              <Pressable
                onPress={handleSave}
                disabled={saving || !dirty}
                style={({ pressed }) => [s.saveBtn, { backgroundColor: accent, opacity: saving || !dirty ? 0.5 : pressed ? 0.8 : 1 }]}>
                {saving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={s.saveText}>{existing ? 'Save' : rating > 0 || reviewText.trim() ? 'Log song' : 'Log as listened'}</Text>}
              </Pressable>

              {existing && (
                <Pressable onPress={handleRemove} hitSlop={8} style={({ pressed }) => [s.removeBtn, { opacity: pressed ? 0.6 : 1 }]}>
                  <Text style={[s.removeText, { color: muted }]}>Remove from My Songs</Text>
                </Pressable>
              )}

            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  body: { padding: 20, paddingBottom: 48 },
  favRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  favTitle: { fontSize: 15, fontWeight: '600' },
  favSub: { fontSize: 12 },
  songRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  art: { width: 72, height: 72, borderRadius: 6 },
  songTitle: { fontSize: 18, fontWeight: '700' },
  songArtist: { fontSize: 14 },
  songAlbum: { fontSize: 12 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginTop: 20 },
  input: { minHeight: 100, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, padding: 12, fontSize: 15, marginTop: 8 },
  saveBtn: { height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  removeBtn: { alignSelf: 'center', marginTop: 14, paddingVertical: 4 },
  removeText: { fontSize: 13 },
});
