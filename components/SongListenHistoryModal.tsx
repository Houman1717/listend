import { Modal, View, Text, Pressable, ScrollView, StyleSheet, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { useState } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useSongReviews } from '@/context/SongReviewsContext';
import { firstListenView, type SongReview, type SongReListen } from '@/lib/songReviews';

type Entry = {
  key:        string;
  label:      string;
  isOriginal: boolean;
  rating:     number;
  review?:    string;
  listenedAt: string;
  /** Set on re-listens — what delete removes. */
  reListenId?: string;
};

function formatDate(raw: string): string {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function Review({ text, color, toggleColor }: { text: string; color: string; toggleColor: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 160;
  return (
    <Pressable onPress={() => long && setExpanded(v => !v)} disabled={!long}>
      <Text style={[st.entryReview, { color }]} numberOfLines={expanded || !long ? undefined : 3}>"{text}"</Text>
      {long && <Text style={[st.entryReviewToggle, { color: toggleColor }]}>{expanded ? 'Show less' : 'Read more'}</Text>}
    </Pressable>
  );
}

/**
 * Every listen of one song — the first listen plus each re-listen — newest
 * first, like the album Listen History on Re-listend. Pass `reListens` for
 * someone else's song; leave it out for your own, which also lets you delete
 * re-listens.
 */
export function SongListenHistoryModal({
  song,
  reListens: reListensProp,
  isDark,
  colors,
  onClose,
  onSongPress,
}: {
  song:        SongReview;
  reListens?:  SongReListen[];
  isDark:      boolean;
  colors:      any;
  onClose:     () => void;
  onSongPress?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { reListensFor, removeSongReListen } = useSongReviews();
  const isOwn = !reListensProp;
  const reListens = (reListensProp ?? reListensFor(song))
    .slice()
    .sort((a, b) => b.listenedAt.localeCompare(a.listenedAt));
  const first = firstListenView(song);

  const entries: Entry[] = [
    ...reListens.map((r, i): Entry => ({
      key:        r.id,
      label:      `Re-listen #${reListens.length - i}`,
      isOriginal: false,
      rating:     r.rating,
      review:     r.review,
      listenedAt: r.listenedAt,
      reListenId: r.id,
    })),
    {
      key:        'first',
      label:      'First listen',
      isOriginal: true,
      rating:     first.rating,
      review:     first.review,
      listenedAt: first.listenedAt,
    },
  ];

  const border = isDark ? '#2a1e14' : '#e5e5e5';
  const muted  = isDark ? '#A08060' : '#6B4C35';

  function confirmDelete(entry: Entry) {
    if (!entry.reListenId) return;
    Alert.alert('Delete this listen?', `${entry.label} on ${formatDate(entry.listenedAt)} will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const ok = await removeSongReListen(entry.reListenId!);
          if (!ok) Alert.alert("Couldn't delete", 'Check your connection and try again.');
          else if (reListens.length <= 1) onClose();
        },
      },
    ]);
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <View style={[st.header, { borderBottomColor: border }]}>
          <Pressable onPress={onClose} hitSlop={12}>
            <FontAwesome name="chevron-down" size={16} color={muted} />
          </Pressable>
          <Text style={[st.headerTitle, { color: colors.text }]}>Listen History</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={st.body} showsVerticalScrollIndicator={false}>
          <Pressable
            style={({ pressed }) => [st.songRow, { opacity: pressed && onSongPress ? 0.7 : 1 }]}
            onPress={onSongPress}
            disabled={!onSongPress}>
            {song.artworkUrl ? (
              <ExpoImage source={{ uri: song.artworkUrl }} style={st.art} contentFit="cover" cachePolicy="disk" />
            ) : (
              <View style={[st.art, { backgroundColor: '#2E2018', justifyContent: 'center', alignItems: 'center' }]}>
                <FontAwesome name="music" size={24} color="rgba(255,255,255,0.4)" />
              </View>
            )}
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[st.songTitle, { color: colors.text }]} numberOfLines={2}>{song.title}</Text>
              <Text style={[st.songArtist, { color: muted }]} numberOfLines={1}>
                {song.artist}{song.albumTitle ? ` · ${song.albumTitle}` : ''}
              </Text>
              <View style={st.countRow}>
                <FontAwesome name="repeat" size={11} color={colors.tint} />
                <Text style={[st.countText, { color: colors.tint }]}>{entries.length} listen{entries.length !== 1 ? 's' : ''} total</Text>
              </View>
            </View>
          </Pressable>

          <View style={[st.entries, { borderColor: border }]}>
            {entries.map((entry, idx) => (
              <View
                key={entry.key}
                style={[st.entryRow, idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border }]}>
                <View style={[st.entryIcon, { backgroundColor: entry.isOriginal ? colors.tint : (isDark ? '#2E2018' : '#f0ede8') }]}>
                  <FontAwesome name={entry.isOriginal ? 'headphones' : 'repeat'} size={13} color={entry.isOriginal ? '#fff' : colors.tint} />
                </View>
                <View style={st.entryInfo}>
                  <Text style={[st.entryLabel, { color: colors.text }]}>{entry.label}</Text>
                  <Text style={[st.entryDate, { color: muted }]}>{formatDate(entry.listenedAt)}</Text>
                  {entry.review ? (
                    <Review text={entry.review} color={isDark ? '#a07850' : '#7a5535'} toggleColor={colors.tint} />
                  ) : null}
                </View>
                {entry.rating > 0 && (
                  <View style={[st.entryRating, { borderColor: colors.tint }]}>
                    <Text style={[st.entryRatingText, { color: colors.tint }]}>{entry.rating}</Text>
                  </View>
                )}
                {isOwn && entry.reListenId && (
                  <Pressable
                    onPress={() => confirmDelete(entry)}
                    hitSlop={10}
                    accessibilityLabel={`Delete ${entry.label}`}
                    style={({ pressed }) => [st.trashBtn, { opacity: pressed ? 0.5 : 1 }]}>
                    <FontAwesome name="trash" size={13} color="#8B1A1A" />
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  body: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 48, gap: 20 },
  songRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  art: { width: 80, height: 80, borderRadius: 10, flexShrink: 0 },
  songTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  songArtist: { fontSize: 13 },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  countText: { fontSize: 12, fontWeight: '600' },
  entries: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  entryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  entryIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 },
  entryInfo: { flex: 1, gap: 3 },
  entryLabel: { fontSize: 14, fontWeight: '600' },
  entryDate: { fontSize: 12 },
  entryReview: { fontSize: 13, fontStyle: 'italic', marginTop: 4, lineHeight: 18 },
  entryReviewToggle: { fontSize: 13, fontWeight: '500', marginTop: 4 },
  entryRating: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 2 },
  entryRatingText: { fontSize: 12, fontWeight: '700' },
  trashBtn: { padding: 4, alignSelf: 'flex-start', marginTop: 4 },
});
