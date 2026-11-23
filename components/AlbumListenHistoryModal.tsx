import { StyleSheet, View, Text, Pressable, Modal, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { useState } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { supabase } from '@/lib/supabase';

// Every listen of one album — the first log plus each re-listen — newest
// first. Shared by the Re-listend screen and the album page.

// ─── Types ────────────────────────────────────────────────────────────────────

export type SessionEntry = {
  listenedAt: string;
  rating: number;
  review?: string;
  isOriginal: boolean;
  reListenIndex?: number;
};

export type AlbumHistoryData = {
  album: HistoryAlbum;
  entries: SessionEntry[];
};

/** What the sheet shows about the album. LoggedAlbum fits. */
export type HistoryAlbum = {
  id:          string;
  title:       string;
  artist:      string;
  year:        number;
  artworkUrl?: string;
  coverColor?: string;
};

function formatDate(raw: string): string {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** One user's listens of an album, newest first. Null on failure. */
export async function fetchAlbumListenHistory(userId: string, albumId: string): Promise<SessionEntry[] | null> {
  try {
    const [{ data: userAlbumData }, { data: reListenData }] = await Promise.all([
      supabase
        .from('user_albums')
        .select('rating, review, listened_at')
        .eq('user_id', userId)
        .eq('spotify_id', albumId)
        .single(),
      supabase
        .from('re_listens')
        .select('rating, review, listened_at')
        .eq('user_id', userId)
        .eq('spotify_id', albumId)
        .order('listened_at', { ascending: true }),
    ]);

    const entries: SessionEntry[] = [];

    // Find the earliest date to mark as "First listen"
    // The original first listen is stored in user_albums with the earliest listened_at
    // Re-listens are in re_listens table, sorted ascending
    const allDates: { listenedAt: string; rating: number; review?: string; isReListen: boolean }[] = [];

    if (userAlbumData) {
      allDates.push({
        listenedAt: userAlbumData.listened_at ?? new Date().toISOString(),
        rating:     userAlbumData.rating ?? 0,
        review:     userAlbumData.review ?? undefined,
        isReListen: false,
      });
    }

    if (reListenData) {
      const seenDates = new Set<string>();
      for (const r of reListenData) {
        const key = r.listened_at ?? '';
        if (seenDates.has(key)) continue;
        seenDates.add(key);
        allDates.push({
          listenedAt: r.listened_at ?? new Date().toISOString(),
          rating:     r.rating ?? 0,
          review:     r.review ?? undefined,
          isReListen: true,
        });
      }
    }

    // Sort all by date ascending to determine first listen
    allDates.sort((a, b) => new Date(a.listenedAt).getTime() - new Date(b.listenedAt).getTime());

    let reListenIndex = 0;
    const firstDate = allDates[0]?.listenedAt;

    for (const entry of allDates) {
      const isOriginal = entry.listenedAt === firstDate && !entry.isReListen;
      if (!isOriginal) reListenIndex++;
      entries.push({
        listenedAt:    entry.listenedAt,
        rating:        entry.rating,
        review:        entry.review,
        isOriginal,
        reListenIndex: isOriginal ? undefined : reListenIndex,
      });
    }

    // Sort descending for display (most recent first)
    entries.sort((a, b) => new Date(b.listenedAt).getTime() - new Date(a.listenedAt).getTime());

    // Re-number reListenIndex in descending order
    let descIndex = entries.filter(e => !e.isOriginal).length;
    for (const entry of entries) {
      if (!entry.isOriginal) {
        entry.reListenIndex = descIndex--;
      }
    }

    return entries;
  } catch (err) {
    console.error('[AlbumListenHistory] fetch error:', err);
    return null;
  }
}

/** Entries after deleting one re-listen, re-numbered. */
export function withoutEntry(entries: SessionEntry[], entry: SessionEntry): SessionEntry[] {
  const remaining = entries.filter(e => e.listenedAt !== entry.listenedAt);
  let idx = remaining.filter(e => !e.isOriginal).length;
  return remaining.map(e => e.isOriginal ? e : { ...e, reListenIndex: idx-- });
}

// ─── Expandable review ────────────────────────────────────────────────────────

const REVIEW_COLLAPSED_LINES = 3;

// A long review was cut at three lines with nothing to tap. Tapping the text
// or "Read more" now shows all of it. An invisible uncapped copy measures the
// real line count, so the toggle only appears when something is actually cut.
function ExpandableReview({ review, color, toggleColor }: { review: string; color: string; toggleColor: string }) {
  const [expanded, setExpanded] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const text = `"${review}"`;

  return (
    <Pressable onPress={() => truncated && setExpanded(v => !v)} disabled={!truncated}>
      <Text
        style={[hm.entryReview, hm.entryReviewMeasure]}
        onTextLayout={e => setTruncated(e.nativeEvent.lines.length > REVIEW_COLLAPSED_LINES)}
        aria-hidden>
        {text}
      </Text>
      <Text style={[hm.entryReview, { color }]} numberOfLines={expanded ? undefined : REVIEW_COLLAPSED_LINES}>
        {text}
      </Text>
      {truncated && (
        <Text style={[hm.entryReviewToggle, { color: toggleColor }]}>{expanded ? 'Show less' : 'Read more'}</Text>
      )}
    </Pressable>
  );
}

// ─── History Modal ─────────────────────────────────────────────────────────────

export function AlbumListenHistoryModal({
  data,
  isDark,
  colors,
  onClose,
  onAlbumPress,
  onDeleteEntry,
}: {
  data: AlbumHistoryData;
  isDark: boolean;
  colors: any;
  onClose: () => void;
  onAlbumPress: () => void;
  onDeleteEntry?: (entry: SessionEntry) => void;
}) {
  const insets = useSafeAreaInsets();
  const border = isDark ? '#2a1e14' : '#e5e5e5';
  const { album, entries } = data;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }}>
        {/* Header */}
        <View style={[hm.header, { borderBottomColor: border }]}>
          <Pressable onPress={onClose} hitSlop={12}>
            <FontAwesome name="chevron-down" size={16} color={isDark ? '#A08060' : '#6B4C35'} />
          </Pressable>
          <Text style={[hm.headerTitle, { color: colors.text }]}>Listen History</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={hm.body} showsVerticalScrollIndicator={false}>
          {/* Album header */}
          <Pressable
            style={({ pressed }) => [hm.albumRow, { opacity: pressed ? 0.7 : 1 }]}
            onPress={onAlbumPress}>
            {album.artworkUrl ? (
              <ExpoImage source={{ uri: album.artworkUrl }} style={hm.art} contentFit="cover" cachePolicy="disk" />
            ) : (
              <View style={[hm.art, { backgroundColor: album.coverColor ?? '#2E2018', justifyContent: 'center', alignItems: 'center' }]}>
                <FontAwesome name="music" size={24} color="rgba(255,255,255,0.4)" />
              </View>
            )}
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[hm.albumTitle, { color: colors.text }]} numberOfLines={2}>{album.title}</Text>
              <Text style={[hm.albumArtist, { color: isDark ? '#A08060' : '#6B4C35' }]} numberOfLines={1}>
                {album.artist}{album.year > 0 ? ` · ${album.year}` : ''}
              </Text>
              <View style={hm.listenCountBadge}>
                <FontAwesome name="repeat" size={11} color={colors.tint} />
                <Text style={[hm.listenCountBadgeText, { color: colors.tint }]}>{entries.length} listen{entries.length !== 1 ? 's' : ''} total</Text>
              </View>
            </View>
          </Pressable>

          {/* Session entries */}
          <View style={[hm.entriesContainer, { borderColor: border }]}>
            {entries.map((entry, idx) => (
              <View
                key={idx}
                style={[hm.entryRow, idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border }]}>
                <View style={[hm.entryIconWrap, { backgroundColor: entry.isOriginal ? colors.tint : (isDark ? '#2E2018' : '#f0ede8') }]}>
                  <FontAwesome
                    name={entry.isOriginal ? 'headphones' : 'repeat'}
                    size={13}
                    color={entry.isOriginal ? '#fff' : colors.tint}
                  />
                </View>
                <View style={hm.entryInfo}>
                  <Text style={[hm.entryLabel, { color: colors.text }]}>
                    {entry.isOriginal ? 'First listen' : `Re-listen #${entry.reListenIndex}`}
                  </Text>
                  <Text style={[hm.entryDate, { color: isDark ? '#A08060' : '#6B4C35' }]}>
                    {formatDate(entry.listenedAt)}
                  </Text>
                  {entry.review ? (
                    <ExpandableReview
                      review={entry.review}
                      color={isDark ? '#a07850' : '#7a5535'}
                      toggleColor={colors.tint}
                    />
                  ) : null}
                </View>
                {entry.rating > 0 && (
                  <View style={[hm.entryRating, { borderColor: colors.tint }]}>
                    <Text style={[hm.entryRatingText, { color: colors.tint }]}>{entry.rating}</Text>
                  </View>
                )}
                {!entry.isOriginal && onDeleteEntry && (
                  <Pressable
                    onPress={() => onDeleteEntry(entry)}
                    hitSlop={10}
                    style={({ pressed }) => [hm.trashBtn, { opacity: pressed ? 0.5 : 1 }]}>
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

const hm = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  body: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 48, gap: 20 },
  albumRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  art: { width: 80, height: 80, borderRadius: 10, flexShrink: 0 },
  albumTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  albumArtist: { fontSize: 13 },
  listenCountBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  listenCountBadgeText: { color: '#D4A017', fontSize: 12, fontWeight: '600' },
  entriesContainer: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  entryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  entryIconWrap: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 },
  entryInfo: { flex: 1, gap: 3 },
  entryLabel: { fontSize: 14, fontWeight: '600' },
  entryDate: { fontSize: 12 },
  entryReview: { fontSize: 13, fontStyle: 'italic', marginTop: 4, lineHeight: 18 },
  entryReviewMeasure: { position: 'absolute', left: 0, right: 0, opacity: 0 },
  entryReviewToggle: { fontSize: 13, fontWeight: '500', marginTop: 4 },
  entryRating: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 2 },
  entryRatingText: { color: '#D4A017', fontSize: 12, fontWeight: '700' },
  trashBtn: { padding: 4, alignSelf: 'flex-start', marginTop: 4 },
});

