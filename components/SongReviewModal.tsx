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
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { useEffect, useState } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Ionicons from '@expo/vector-icons/Ionicons';
import Colors, { VOLUME_EMPTY_DARK, VOLUME_EMPTY_LIGHT } from '@/constants/Colors';
import VolumeBars from '@/components/VolumeBars';
import { VolumeRatingPicker } from '@/components/VolumeRatingPicker';
import { avatarColor } from '@/components/ReviewComments';
import { useAuth } from '@/context/AuthContext';
import { useSongReviews } from '@/context/SongReviewsContext';
import { useAndroidKeyboardHeight } from '@/hooks/useAndroidKeyboardHeight';
import { handleOrName } from '@/lib/userHandle';
import {
  fetchCommunitySongReviews,
  fetchSongCommunityRatings,
  withOwnRating,
  type CommunitySongReview,
  type SongMeta,
  type SongRatingStats,
} from '@/lib/songReviews';

const ACCENT = '#D4A017';

/**
 * Rate / review a single song, mark it as the album's favourite, and read what
 * other users wrote. Opening it never logs anything — only Save does.
 *
 * Lives in a <Modal>, so navigation goes through callbacks (useRouter inside a
 * Modal silently fails).
 */
export function SongReviewModal({
  song,
  onClose,
  isDark,
  colors: colorsProp,
  onUserPress,
}: {
  song:         SongMeta | null;
  onClose:      () => void;
  isDark:       boolean;
  colors?:      any;
  onUserPress?: (userId: string) => void;
}) {
  const colors = colorsProp ?? Colors[isDark ? 'dark' : 'light'];
  const { user } = useAuth();
  const { getSongReview, saveSongReview, removeSongReview, setFavoriteSong } = useSongReviews();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useAndroidKeyboardHeight();

  const existing = song ? getSongReview(song.id) : undefined;

  const [rating,     setRating]     = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [saving,     setSaving]     = useState(false);
  const [stats,      setStats]      = useState<SongRatingStats | undefined>(undefined);
  const [others,     setOthers]     = useState<CommunitySongReview[] | null>(null);
  const [othersFailed, setOthersFailed] = useState(false);

  // Reset the form whenever a different song opens.
  useEffect(() => {
    if (!song) return;
    const r = getSongReview(song.id);
    setRating(r?.rating ?? 0);
    setReviewText(r?.review ?? '');
    setSaving(false);
  }, [song?.id]);

  useEffect(() => {
    if (!song) return;
    let cancelled = false;
    setStats(undefined);
    setOthers(null);
    setOthersFailed(false);
    fetchSongCommunityRatings([song.id]).then(m => {
      if (!cancelled && m) setStats(m.get(song.id));
    });
    fetchCommunitySongReviews(song.id, user?.id).then(list => {
      if (cancelled) return;
      if (list) setOthers(list);
      else setOthersFailed(true);
    });
    return () => { cancelled = true; };
  }, [song?.id, user?.id]);

  if (!song) return null;

  const border    = isDark ? '#2a1e14' : '#e5e5e5';
  const muted     = isDark ? '#A08060' : '#6B4C35';
  const inactive  = isDark ? VOLUME_EMPTY_DARK : VOLUME_EMPTY_LIGHT;
  const fieldBg   = isDark ? '#1c1410' : '#f5f5f5';
  // Community average with the in-progress rating folded in, so it moves as you rate.
  const community = withOwnRating(stats, rating);
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
          const ok = await removeSongReview(song.id);
          if (ok) onClose();
          else Alert.alert("Couldn't remove", 'Check your connection and try again.');
        },
      },
    ]);
  }

  async function handleFavorite() {
    if (!song) return;
    const ok = await setFavoriteSong(song, !isFavorite);
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
              <Text style={[s.headerTitle, { color: colors.text }]}>Song</Text>
              {canFavorite ? (
                <Pressable onPress={handleFavorite} hitSlop={12} accessibilityLabel={isFavorite ? 'Unmark favourite track' : 'Mark as favourite track'}>
                  <Ionicons name={isFavorite ? 'trophy' : 'trophy-outline'} size={19} color={isFavorite ? ACCENT : muted} />
                </Pressable>
              ) : (
                <View style={{ width: 18 }} />
              )}
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

              {/* Community average */}
              <View style={[s.avgRow, { borderColor: border }]}>
                <FontAwesome name="volume-up" size={12} color={community ? ACCENT : inactive} />
                <Text style={[s.avgText, { color: colors.text }]}>
                  {community ? community.avg.toFixed(1) : '–'}
                </Text>
                <Text style={[s.avgSub, { color: muted }]}>
                  {community ? 'Listend average' : 'No ratings yet — be the first'}
                </Text>
              </View>

              {/* Your rating */}
              <Text style={[s.label, { color: muted }]}>YOUR RATING</Text>
              <VolumeRatingPicker rating={rating} onChange={setRating} isDark={isDark} />

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
                style={({ pressed }) => [s.saveBtn, { backgroundColor: ACCENT, opacity: saving || !dirty ? 0.5 : pressed ? 0.8 : 1 }]}>
                {saving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={s.saveText}>{existing ? 'Save' : rating > 0 || reviewText.trim() ? 'Log song' : 'Log as listened'}</Text>}
              </Pressable>

              {existing && (
                <Pressable onPress={handleRemove} hitSlop={8} style={({ pressed }) => [s.removeBtn, { opacity: pressed ? 0.6 : 1 }]}>
                  <Text style={[s.removeText, { color: muted }]}>Remove from My Songs</Text>
                </Pressable>
              )}

              {/* What others said */}
              <Text style={[s.label, { color: muted, marginTop: 28 }]}>WHAT OTHERS SAID</Text>
              {others === null && !othersFailed ? (
                <ActivityIndicator size="small" color={ACCENT} style={{ marginVertical: 16 }} />
              ) : othersFailed ? (
                <Text style={[s.empty, { color: muted }]}>Couldn't load reviews. Try again in a moment.</Text>
              ) : others && others.length === 0 ? (
                <Text style={[s.empty, { color: muted }]}>Nobody else has rated this song yet.</Text>
              ) : (
                others!.map(r => {
                  const handle = handleOrName(r.username, r.displayName, r.userId);
                  return (
                    <View key={r.userId} style={[s.otherRow, { borderBottomColor: border }]}>
                      <Pressable
                        onPress={() => onUserPress?.(r.userId)}
                        disabled={!onUserPress}
                        style={s.otherHead}>
                        {r.avatarUrl ? (
                          <ExpoImage source={{ uri: r.avatarUrl }} style={s.avatar} contentFit="cover" cachePolicy="disk" />
                        ) : (
                          <View style={[s.avatar, { backgroundColor: avatarColor(r.username || r.userId), alignItems: 'center', justifyContent: 'center' }]}>
                            <Text style={s.avatarInitial}>{(r.username || r.displayName || '?').charAt(0).toUpperCase()}</Text>
                          </View>
                        )}
                        <Text style={[s.otherName, { color: colors.text }]} numberOfLines={1}>{handle}</Text>
                        {r.rating > 0 && (
                          <View style={s.otherRating}>
                            <FontAwesome name="volume-up" size={10} color={ACCENT} />
                            <VolumeBars rating={r.rating} activeColor={ACCENT} inactiveColor={inactive} />
                            <Text style={s.otherRatingNum}>{r.rating}</Text>
                          </View>
                        )}
                        {r.isFavorite && <Ionicons name="trophy" size={12} color={ACCENT} />}
                      </Pressable>
                      {!!r.review && (
                        <Text style={[s.otherReview, { color: colors.text }]}>{r.review}</Text>
                      )}
                    </View>
                  );
                })
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
  songRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  art: { width: 72, height: 72, borderRadius: 6 },
  songTitle: { fontSize: 18, fontWeight: '700' },
  songArtist: { fontSize: 14 },
  songAlbum: { fontSize: 12 },
  avgRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  avgText: { fontSize: 15, fontWeight: '700' },
  avgSub: { fontSize: 12, flexShrink: 1 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginTop: 20 },
  input: { minHeight: 100, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, padding: 12, fontSize: 15, marginTop: 8 },
  saveBtn: { height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  removeBtn: { alignSelf: 'center', marginTop: 14, paddingVertical: 4 },
  removeText: { fontSize: 13 },
  empty: { fontSize: 14, marginTop: 10 },
  otherRow: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 6 },
  otherHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 26, height: 26, borderRadius: 13 },
  avatarInitial: { color: '#fff', fontSize: 12, fontWeight: '700' },
  otherName: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
  otherRating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  otherRatingNum: { color: ACCENT, fontSize: 10, fontWeight: '700' },
  otherReview: { fontSize: 14, lineHeight: 20 },
});
