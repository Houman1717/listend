import {
  StyleSheet,
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Platform,
  Alert,
  Keyboard,
  ActivityIndicator,
  LayoutAnimation,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { VOLUME_EMPTY_DARK, VOLUME_EMPTY_LIGHT } from '@/constants/Colors';
import { useAlbums } from '@/context/AlbumsContext';
import { useFlip } from '@/context/FlipContext';
import { capture } from '@/lib/analytics';
import { useAndroidKeyboardHeight } from '@/hooks/useAndroidKeyboardHeight';
import { useSongReviews } from '@/context/SongReviewsContext';
import { CompactVolumePicker } from '@/components/VolumeRatingPicker';
import type { SongMeta } from '@/lib/songReviews';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

type AlbumTrack = { number: number; id: string; title: string; durationMs: number };

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
  const inactiveColor = isDark ? VOLUME_EMPTY_DARK : VOLUME_EMPTY_LIGHT;

  const tap = Gesture.Tap()
    .runOnJS(true)
    .onEnd((e) => {
      const val = Math.max(1, Math.min(10, Math.ceil((e.x / containerWidth) * 10)));
      onRatingChange(val === rating ? 0 : val);
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
  const inactiveColor = isDark ? VOLUME_EMPTY_DARK : VOLUME_EMPTY_LIGHT;

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
  const { pendingAlbum, logAlbum, reListenMode, setReListenMode } = useAlbums();
  const { markLogged } = useFlip();
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [logDate, setLogDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const reviewFocused = useRef(false);
  const { getSongReview, saveSongReview, setFavoriteSong } = useSongReviews();
  const [tracksOpen, setTracksOpen] = useState(false);
  const [tracks, setTracks] = useState<AlbumTrack[] | null>(null);
  const [tracksFailed, setTracksFailed] = useState(false);
  const [trackRatings, setTrackRatings] = useState<Record<string, number>>({});
  const [favoriteId, setFavoriteId] = useState<string | null>(null);
  const androidKeyboardHeight = useAndroidKeyboardHeight();
  const insets = useSafeAreaInsets();

  // Once the keys are up, scroll the whole review box (and the Log button under
  // it) into view — otherwise it opens behind the keyboard, or on iOS with
  // only its first line showing. Android waits for the padding below to render.
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      if (reviewFocused.current) scrollRef.current?.scrollToEnd({ animated: true });
    });
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (androidKeyboardHeight > 0 && reviewFocused.current) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [androidKeyboardHeight]);

  // Clears reListenMode on every dismissal path (Cancel, swipe-down, hardware
  // back) — it was previously only reset after a successful submit, so
  // backing out of a re-listen attempt left it stuck true and silently
  // mis-routed the next log (even for an unrelated, brand-new album).
  useEffect(() => {
    return () => { if (reListenMode) setReListenMode(false); };
  }, [reListenMode]);

  // Tracklist for the optional "Rate the tracks" section — fetched the first
  // time it's opened, seeded with any ratings/favourite already given.
  useEffect(() => {
    if (!tracksOpen || tracks || !pendingAlbum) return;
    let cancelled = false;
    setTracksFailed(false);
    fetch(`${API_URL}/catalog/album/${pendingAlbum.spotifyId}/tracks`)
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then((data: AlbumTrack[]) => {
        if (cancelled) return;
        setTracks(data);
        const seeded: Record<string, number> = {};
        let fav: string | null = null;
        for (const t of data) {
          const r = getSongReview(t.id);
          if (r) seeded[t.id] = r.rating;
          if (r?.isFavorite) fav = t.id;
        }
        setTrackRatings(seeded);
        setFavoriteId(fav);
      })
      .catch(() => { if (!cancelled) setTracksFailed(true); });
    return () => { cancelled = true; };
  }, [tracksOpen, pendingAlbum?.spotifyId]);

  if (!pendingAlbum) return null;

  function trackMeta(t: AlbumTrack): SongMeta {
    return {
      id:         t.id,
      title:      t.title,
      artist:     pendingAlbum!.artist,
      albumId:    pendingAlbum!.spotifyId,
      albumTitle: pendingAlbum!.title,
      artworkUrl: pendingAlbum!.artworkUrl || undefined,
      durationMs: t.durationMs,
    };
  }

  /**
   * Saves only the tracks the user actually touched: a changed rating, or a
   * new favourite. Untouched tracks are never logged as listened.
   */
  async function saveTrackRatings(): Promise<boolean> {
    if (!tracks) return true;
    const writes: Promise<boolean>[] = [];
    for (const t of tracks) {
      const existing = getSongReview(t.id);
      const next = trackRatings[t.id] ?? 0;
      if (existing ? existing.rating !== next : next > 0) {
        writes.push(saveSongReview({ song: trackMeta(t), rating: next, review: existing?.review }));
      }
    }
    const results = await Promise.all(writes);
    const prevFav = tracks.find(t => getSongReview(t.id)?.isFavorite)?.id ?? null;
    if (favoriteId !== prevFav) {
      if (favoriteId) {
        const t = tracks.find(x => x.id === favoriteId)!;
        results.push(await setFavoriteSong(trackMeta(t), true));
      } else if (prevFav) {
        const t = tracks.find(x => x.id === prevFav)!;
        results.push(await setFavoriteSong(trackMeta(t), false));
      }
    }
    return results.every(Boolean);
  }

  async function handleLog() {
    capture('album_logged', {
      rating: rating > 0 ? rating : undefined,
      has_review: review.trim().length > 0,
    });
    const flipId = pendingAlbum?.flipId;
    setSaving(true);
    const ok = await logAlbum(rating, review, logDate);
    if (!ok) {
      setSaving(false);
      Alert.alert('Couldn\'t save', 'Check your connection and try again — your changes are still here.');
      return;
    }
    // Resolve the flip directly by the flip's own id rather than waiting for
    // the logged album's (possibly remapped) canonical id to match back up —
    // otherwise a canonical-id remap leaves Flip a Record stuck on this album.
    if (flipId) markLogged(flipId);
    // The album is logged either way; a failed track save just gets a heads-up.
    const tracksOk = await saveTrackRatings();
    if (!tracksOk) Alert.alert('Some track ratings didn\'t save', 'Your album was logged. You can rate the tracks again from the album page.');
    router.dismiss();
  }

  const isDark = colorScheme === 'dark';

  return (
    <ScrollView
      ref={scrollRef}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.container,
        // The IME height is measured from the top of the nav bar, so add it back.
        androidKeyboardHeight > 0 && { paddingBottom: 40 + androidKeyboardHeight + insets.bottom },
      ]}
      keyboardShouldPersistTaps="handled"
      // iOS: inset the content by the keyboard. A KeyboardAvoidingView here
      // left the review box under the keys until the user scrolled by hand.
      automaticallyAdjustKeyboardInsets>

      <ExpoImage source={{ uri: pendingAlbum.artworkUrl }} style={styles.artwork} 
          contentFit="cover" cachePolicy="disk"
        />

      <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
        {pendingAlbum.title}
      </Text>
      <Text style={[styles.artist, { color: colors.subtext }]}>
        {pendingAlbum.artist} · {pendingAlbum.year}
      </Text>

      <Pressable
        style={[styles.dateRow, { borderColor: isDark ? '#3a2818' : '#e0e0e0' }]}
        onPress={() => {
          // Android's picker is a native dialog, not an inline view. Rendering
          // <DateTimePicker> re-opens that dialog on every re-render, so any tap
          // on this screen (or OK/Cancel itself) popped it straight back up and
          // trapped the user. Open it imperatively instead — it closes itself.
          if (Platform.OS === 'android') {
            DateTimePickerAndroid.open({
              value: logDate,
              mode: 'date',
              maximumDate: new Date(),
              onChange: (event, d) => { if (event.type === 'set' && d) setLogDate(d); },
            });
            return;
          }
          setShowDatePicker(v => !v);
        }}>
        <Text style={[styles.dateRowText, { color: colors.subtext }]}>
          Listend {logDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </Text>
        <View style={styles.dateEditBtn}>
          <FontAwesome name="pencil" size={11} color="#D4A017" />
          <Text style={styles.dateEditBtnText}>Edit Date</Text>
        </View>
      </Pressable>
      {Platform.OS === 'ios' && showDatePicker && (
        <DateTimePicker
          value={logDate}
          mode="date"
          display="inline"
          maximumDate={new Date()}
          onChange={(_, d) => { if (d) setLogDate(d); }}
          themeVariant={isDark ? 'dark' : 'light'}
          accentColor="#D4A017"
          style={{ width: '100%', marginTop: 10 }}
        />
      )}

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
        onFocus={() => { reviewFocused.current = true; }}
        onBlur={() => { reviewFocused.current = false; }}
        multiline
        textAlignVertical="top"
        maxLength={1000}
      />
      {review.length > 0 && (
        <Text style={[styles.charCount, { color: colors.subtext }]}>
          {review.length}/1000
        </Text>
      )}

      {/* Optional per-track ratings */}
      <Pressable
        style={[styles.tracksToggle, { borderColor: isDark ? '#3a2818' : '#e0e0e0' }]}
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setTracksOpen(v => !v);
        }}>
        <FontAwesome name="list-ol" size={13} color="#D4A017" />
        <Text style={[styles.tracksToggleText, { color: colors.text }]}>
          Rate the tracks <Text style={{ color: colors.subtext, fontWeight: '400' }}>(optional)</Text>
        </Text>
        <FontAwesome name={tracksOpen ? 'chevron-up' : 'chevron-down'} size={12} color={colors.subtext} />
      </Pressable>
      {tracksOpen && (
        <View style={styles.tracksList}>
          {tracks === null && !tracksFailed ? (
            <ActivityIndicator color="#D4A017" style={{ marginVertical: 16 }} />
          ) : tracksFailed ? (
            <Text style={[styles.tracksEmpty, { color: colors.subtext }]}>Couldn't load the tracklist.</Text>
          ) : tracks && tracks.length === 0 ? (
            <Text style={[styles.tracksEmpty, { color: colors.subtext }]}>No tracks available.</Text>
          ) : (
            <>
              <Text style={[styles.tracksHint, { color: colors.subtext }]}>
                Tap or drag the bars to rate. ☆ marks your favourite track.
              </Text>
              {tracks!.map(t => {
                const fav = favoriteId === t.id;
                return (
                  <View key={t.id} style={[styles.trackRow, { borderBottomColor: isDark ? '#2a1e14' : '#ececec' }]}>
                    <Text style={[styles.trackNum, { color: colors.subtext }]}>{t.number}</Text>
                    <Text style={[styles.trackTitle, { color: colors.text }]} numberOfLines={1}>{t.title}</Text>
                    <Pressable
                      onPress={() => setFavoriteId(fav ? null : t.id)}
                      hitSlop={8}
                      accessibilityLabel={fav ? 'Unmark favourite track' : 'Mark as favourite track'}>
                      <FontAwesome name={fav ? 'star' : 'star-o'} size={15} color={fav ? '#D4A017' : colors.subtext} />
                    </Pressable>
                    <CompactVolumePicker
                      rating={trackRatings[t.id] ?? 0}
                      onChange={r => setTrackRatings(prev => ({ ...prev, [t.id]: r }))}
                      isDark={isDark}
                      width={90}
                    />
                  </View>
                );
              })}
            </>
          )}
        </View>
      )}

      <Pressable
        style={[styles.logButton, { backgroundColor: '#D4A017', opacity: saving ? 0.6 : 1 }]}
        disabled={saving}
        onPress={handleLog}>
        <Text style={[styles.logButtonText, { color: '#fff' }]}>
          Log Album
        </Text>
      </Pressable>

      <Pressable style={styles.cancelButton} onPress={() => router.dismiss()}>
        <Text style={[styles.cancelText, { color: colors.subtext }]}>Cancel</Text>
      </Pressable>
    </ScrollView>
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
  dateRow: {
    marginTop: 16,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
  },
  dateRowText: {
    fontSize: 13,
    fontWeight: '500',
  },
  dateEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateEditBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#D4A017',
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
  tracksToggle: {
    marginTop: 24,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
  },
  tracksToggleText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  tracksList: {
    width: '100%',
    marginTop: 6,
  },
  tracksHint: {
    fontSize: 12,
    marginVertical: 6,
  },
  tracksEmpty: {
    fontSize: 13,
    marginVertical: 12,
    textAlign: 'center',
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  trackNum: {
    width: 20,
    fontSize: 12,
    textAlign: 'right',
  },
  trackTitle: {
    flex: 1,
    fontSize: 14,
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
