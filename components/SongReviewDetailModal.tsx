import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Ionicons from '@expo/vector-icons/Ionicons';
import Colors, { VOLUME_EMPTY_DARK, VOLUME_EMPTY_LIGHT } from '@/constants/Colors';
import VolumeBars from '@/components/VolumeBars';
import { avatarColor } from '@/components/ReviewComments';
import { RATING_LABELS } from '@/components/VolumeRatingPicker';
import { useAuth } from '@/context/AuthContext';
import { handleOrName } from '@/lib/userHandle';
import { reportContent } from '@/lib/reports';
import type { SongMeta } from '@/lib/songReviews';

const ACCENT = '#D4A017';

export type SongReviewAuthor = {
  userId:       string;
  username?:    string | null;
  displayName?: string | null;
  avatarUrl?:   string | null;
};

export type SongReviewEntry = SongReviewAuthor & {
  rating:      number;
  review?:     string;
  isFavorite:  boolean;
  listenedAt:  string;
};

/**
 * One person's review of one song — the song equivalent of AlbumReviewModal.
 * Lives in a Modal, so navigation goes through callbacks.
 */
export function SongReviewDetailModal({ song, entry, onClose, onUserPress, onEdit, isDark, colors: colorsProp }: {
  song:         SongMeta;
  entry:        SongReviewEntry | null;
  onClose:      () => void;
  onUserPress?: (userId: string) => void;
  /** Shown on your own review. */
  onEdit?:      () => void;
  isDark:       boolean;
  colors?:      any;
}) {
  const colors = colorsProp ?? Colors[isDark ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  if (!entry) return null;

  const isOwn    = entry.userId === user?.id;
  const muted    = isDark ? '#A08060' : '#6B4C35';
  const border   = isDark ? '#2a1e14' : '#e5e5e5';
  const inactive = isDark ? VOLUME_EMPTY_DARK : VOLUME_EMPTY_LIGHT;
  const handle   = handleOrName(entry.username, entry.displayName, entry.userId);
  const date     = new Date(entry.listenedAt);
  const dateStr  = isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <View style={[s.header, { borderBottomColor: border }]}>
          <Pressable onPress={onClose} hitSlop={12}>
            <FontAwesome name="chevron-down" size={16} color={muted} />
          </Pressable>
          <Text style={[s.headerTitle, { color: colors.text }]}>Review</Text>
          {isOwn && onEdit ? (
            <Pressable onPress={onEdit} hitSlop={12}>
              <Text style={s.editText}>Edit</Text>
            </Pressable>
          ) : !isOwn ? (
            <Pressable
              hitSlop={12}
              onPress={() => reportContent({
                contentType:  'review',
                contentId:    `song_${entry.userId}_${song.id}`,
                reportedUser: entry.userId,
                label:        'review',
              })}>
              <FontAwesome name="flag-o" size={15} color={muted} />
            </Pressable>
          ) : (
            <View style={{ width: 24 }} />
          )}
        </View>

        <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
          {/* Song */}
          <View style={s.songRow}>
            {song.artworkUrl ? (
              <ExpoImage source={{ uri: song.artworkUrl }} style={s.art} contentFit="cover" cachePolicy="disk" />
            ) : (
              <View style={[s.art, { backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }]}>
                <FontAwesome name="music" size={20} color={muted} />
              </View>
            )}
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={[s.songTitle, { color: colors.text }]} numberOfLines={2}>{song.title}</Text>
              <Text style={[s.songSub, { color: muted }]} numberOfLines={1}>{song.artist}</Text>
              {!!song.albumTitle && <Text style={[s.songSub, { color: muted }]} numberOfLines={1}>{song.albumTitle}</Text>}
            </View>
          </View>

          {/* Author */}
          <Pressable
            style={s.authorRow}
            disabled={!onUserPress || isOwn}
            onPress={() => onUserPress?.(entry.userId)}>
            {entry.avatarUrl ? (
              <ExpoImage source={{ uri: entry.avatarUrl }} style={s.avatar} contentFit="cover" cachePolicy="disk" />
            ) : (
              <View style={[s.avatar, { backgroundColor: avatarColor(entry.username || entry.userId), alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={s.avatarLetter}>{handle.replace(/^@/, '').charAt(0).toUpperCase() || '?'}</Text>
              </View>
            )}
            <View style={{ gap: 1 }}>
              <Text style={[s.handle, { color: ACCENT }]}>{isOwn ? 'Your review' : handle}</Text>
              {dateStr ? <Text style={[s.date, { color: muted }]}>Listend {dateStr}</Text> : null}
            </View>
          </Pressable>

          {/* Rating */}
          {entry.rating > 0 && (
            <View style={s.ratingRow}>
              <FontAwesome name="volume-up" size={14} color={ACCENT} />
              <VolumeBars rating={entry.rating} activeColor={ACCENT} inactiveColor={inactive} heights={[4, 5, 7, 8, 10, 11, 13, 14, 16, 18]} barWidth={3} gap={1.5} />
              <Text style={s.ratingNum}>{entry.rating}</Text>
              <Text style={[s.ratingLabel, { color: muted }]}>{RATING_LABELS[entry.rating]}</Text>
            </View>
          )}
          {entry.isFavorite && (
            <View style={s.favRow}>
              <Ionicons name="trophy" size={13} color={ACCENT} />
              <Text style={[s.favText, { color: muted }]}>
                Favourite track{song.albumTitle ? ` on ${song.albumTitle}` : ''}
              </Text>
            </View>
          )}

          {/* Review */}
          {entry.review ? (
            <Text style={[s.review, { color: colors.text }]}>"{entry.review}"</Text>
          ) : (
            <Text style={[s.review, { color: muted, fontStyle: 'italic' }]}>No written review.</Text>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  editText: { color: ACCENT, fontSize: 15, fontWeight: '600' },
  body: { padding: 20, paddingBottom: 48 },
  songRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  art: { width: 72, height: 72, borderRadius: 8 },
  songTitle: { fontSize: 17, fontWeight: '700' },
  songSub: { fontSize: 13 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarLetter: { color: '#fff', fontSize: 15, fontWeight: '700' },
  handle: { fontSize: 15, fontWeight: '700' },
  date: { fontSize: 12 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  ratingNum: { color: ACCENT, fontSize: 15, fontWeight: '800' },
  ratingLabel: { fontSize: 13, marginLeft: 4 },
  favRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  favText: { fontSize: 13 },
  review: { fontSize: 16, lineHeight: 24, marginTop: 10 },
});
