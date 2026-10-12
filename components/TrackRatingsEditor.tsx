import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Modal,
  StyleSheet,
  ActivityIndicator,
  LayoutAnimation,
} from 'react-native';
import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSongReviews } from '@/context/SongReviewsContext';
import { CompactVolumePicker } from '@/components/VolumeRatingPicker';
import type { SongMeta } from '@/lib/songReviews';

// The optional "Rate the tracks" section — per-track rating, review and a
// favourite track — shared by Log Album and album-detail's edit mode. The
// draft lives in useTrackRatingsDraft; nothing is written until save().

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';
const ACCENT  = '#D4A017';

export type AlbumTrack = { number: number; id: string; title: string; durationMs: number };

export type TrackAlbum = {
  id:          string;
  title:       string;
  artist:      string;
  artworkUrl?: string;
};

export function useTrackRatingsDraft(album: TrackAlbum | null, preloadedTracks?: AlbumTrack[] | null) {
  const { getSongReview, saveSongReview, setFavoriteSong, songsLoaded } = useSongReviews();
  const [open,          setOpen]          = useState(false);
  const [fetched,       setFetched]       = useState<AlbumTrack[] | null>(null);
  const [failed,        setFailed]        = useState(false);
  const [ratings,       setRatings]       = useState<Record<string, number>>({});
  const [reviews,       setReviews]       = useState<Record<string, string>>({});
  const [favoriteId,    setFavoriteId]    = useState<string | null>(null);
  const [openReviewId,  setOpenReviewId]  = useState<string | null>(null);
  const [favPickerOpen, setFavPickerOpen] = useState(false);
  const [seededFor,     setSeededFor]     = useState<AlbumTrack[] | null>(null);

  const tracks = preloadedTracks && preloadedTracks.length > 0 ? preloadedTracks : fetched;

  // Fetch the tracklist the first time the section opens (unless the caller
  // already has it).
  useEffect(() => {
    if (!open || tracks || !album?.id) return;
    let cancelled = false;
    setFailed(false);
    fetch(`${API_URL}/catalog/album/${album.id}/tracks`)
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then((data: AlbumTrack[]) => { if (!cancelled) setFetched(data); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [open, !!tracks, album?.id]);

  /** Re-seed the draft from what's saved (on open, and to discard edits). */
  function reset(list: AlbumTrack[] | null = tracks) {
    if (!list) return;
    const r: Record<string, number> = {};
    const rv: Record<string, string> = {};
    let fav: string | null = null;
    for (const t of list) {
      const saved = getSongReview(t.id);
      if (saved) r[t.id] = saved.rating;
      if (saved?.review) rv[t.id] = saved.review;
      if (saved?.isFavorite) fav = t.id;
    }
    setRatings(r);
    setReviews(rv);
    setFavoriteId(fav);
    setOpenReviewId(null);
    setSeededFor(list);
  }

  // Seed only once the user's saved song ratings are loaded — seeding from an
  // empty list would make save() see every saved rating as "changed to 0".
  useEffect(() => {
    if (tracks && songsLoaded && seededFor !== tracks) reset(tracks);
  }, [tracks, songsLoaded]);

  const ready = !!tracks && seededFor === tracks;

  function meta(t: AlbumTrack): SongMeta {
    return {
      id:         t.id,
      title:      t.title,
      artist:     album!.artist,
      albumId:    album!.id,
      albumTitle: album!.title,
      artworkUrl: album!.artworkUrl || undefined,
      durationMs: t.durationMs,
    };
  }

  /**
   * Saves only the tracks the user actually touched: a changed rating or
   * review, or a new favourite. Untouched tracks are never logged as listened.
   * Returns false if any write failed.
   */
  async function save(): Promise<boolean> {
    if (!tracks || !album || seededFor !== tracks) return true;
    const writes: Promise<boolean>[] = [];
    for (const t of tracks) {
      const existing   = getSongReview(t.id);
      const next       = ratings[t.id] ?? 0;
      const nextReview = (reviews[t.id] ?? '').trim();
      const changed = existing
        ? existing.rating !== next || (existing.review ?? '') !== nextReview
        : next > 0 || nextReview.length > 0;
      if (changed) writes.push(saveSongReview({ song: meta(t), rating: next, review: nextReview }));
    }
    const results = await Promise.all(writes);
    const prevFav = tracks.find(t => getSongReview(t.id)?.isFavorite)?.id ?? null;
    if (favoriteId !== prevFav) {
      const target = tracks.find(x => x.id === (favoriteId ?? prevFav));
      if (target) results.push(await setFavoriteSong(meta(target), !!favoriteId));
    }
    return results.every(Boolean);
  }

  return {
    open, setOpen, tracks, failed, ready,
    ratings, setRatings, reviews, setReviews,
    favoriteId, setFavoriteId, openReviewId, setOpenReviewId,
    favPickerOpen, setFavPickerOpen,
    reset, save,
  };
}

export type TrackRatingsDraft = ReturnType<typeof useTrackRatingsDraft>;

export function TrackRatingsEditor({ draft, isDark, colors }: {
  draft:  TrackRatingsDraft;
  isDark: boolean;
  colors: { text: string; subtext: string };
}) {
  const insets  = useSafeAreaInsets();
  const border  = isDark ? '#3a2818' : '#e0e0e0';
  const divider = isDark ? '#2a1e14' : '#ececec';
  const { open, tracks, failed, ready } = draft;

  return (
    <View style={s.wrap}>
      <Pressable
        style={[s.toggle, { borderColor: border }]}
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          draft.setOpen(v => !v);
        }}>
        <FontAwesome name="list-ol" size={13} color={ACCENT} />
        <Text style={[s.toggleText, { color: colors.text }]}>
          Rate the tracks <Text style={{ color: colors.subtext, fontWeight: '400' }}>(optional)</Text>
        </Text>
        <FontAwesome name={open ? 'chevron-up' : 'chevron-down'} size={12} color={colors.subtext} />
      </Pressable>

      {open && (
        <View style={s.list}>
          {failed && !tracks ? (
            <Text style={[s.empty, { color: colors.subtext }]}>Couldn't load the tracklist.</Text>
          ) : !ready ? (
            <ActivityIndicator color={ACCENT} style={{ marginVertical: 16 }} />
          ) : tracks!.length === 0 ? (
            <Text style={[s.empty, { color: colors.subtext }]}>No tracks available.</Text>
          ) : (
            <>
              <Pressable
                style={[s.favRow, { borderColor: border }]}
                onPress={() => draft.setFavPickerOpen(true)}>
                <Ionicons name="trophy" size={14} color={ACCENT} />
                <Text style={[s.favLabel, { color: colors.subtext }]}>Favourite track</Text>
                <Text style={[s.favValue, { color: draft.favoriteId ? colors.text : colors.subtext }]} numberOfLines={1}>
                  {tracks!.find(t => t.id === draft.favoriteId)?.title ?? 'Choose'}
                </Text>
                <FontAwesome name="chevron-right" size={11} color={colors.subtext} />
              </Pressable>
              <Text style={[s.hint, { color: colors.subtext }]}>
                Tap or drag the bars to rate. Tap a track name to review it.
              </Text>
              {tracks!.map(t => {
                const fav        = draft.favoriteId === t.id;
                const reviewOpen = draft.openReviewId === t.id;
                const hasReview  = (draft.reviews[t.id] ?? '').trim().length > 0;
                return (
                  <View key={t.id} style={[s.block, { borderBottomColor: divider }]}>
                    <View style={s.row}>
                      <Text style={[s.num, { color: colors.subtext }]}>{t.number}</Text>
                      <Pressable
                        style={s.titleBtn}
                        hitSlop={{ top: 8, bottom: 8 }}
                        onPress={() => {
                          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                          draft.setOpenReviewId(reviewOpen ? null : t.id);
                        }}>
                        <Text style={[s.title, { color: colors.text }]} numberOfLines={1}>{t.title}</Text>
                        {fav && <Ionicons name="trophy" size={12} color={ACCENT} />}
                        {(hasReview || reviewOpen) && <FontAwesome name="pencil" size={11} color={ACCENT} />}
                      </Pressable>
                      <CompactVolumePicker
                        rating={draft.ratings[t.id] ?? 0}
                        onChange={r => draft.setRatings(prev => ({ ...prev, [t.id]: r }))}
                        isDark={isDark}
                        width={80}
                      />
                    </View>
                    {reviewOpen && (
                      <TextInput
                        style={[s.reviewInput, {
                          color: colors.text,
                          backgroundColor: isDark ? '#2e2018' : '#f2f2f2',
                          borderColor: border,
                        }]}
                        placeholder={`Your thoughts on "${t.title}"…`}
                        placeholderTextColor={colors.subtext}
                        value={draft.reviews[t.id] ?? ''}
                        onChangeText={text => draft.setReviews(prev => ({ ...prev, [t.id]: text }))}
                        multiline
                        autoFocus
                        textAlignVertical="top"
                        maxLength={5000}
                      />
                    )}
                  </View>
                );
              })}
            </>
          )}
        </View>
      )}

      <Modal
        visible={draft.favPickerOpen && !!tracks}
        transparent
        animationType="slide"
        onRequestClose={() => draft.setFavPickerOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => draft.setFavPickerOpen(false)} />
        <View style={[s.sheet, { backgroundColor: isDark ? '#141414' : '#fff', paddingBottom: 20 + insets.bottom }]}>
          <View style={s.handle} />
          <Text style={[s.sheetTitle, { color: colors.text }]}>Favourite track</Text>
          <ScrollView style={{ flexGrow: 0 }} showsVerticalScrollIndicator={false}>
            {[{ id: '', number: 0, title: 'No favourite' }, ...(tracks ?? [])].map(t => {
              const selected = (draft.favoriteId ?? '') === t.id;
              return (
                <Pressable
                  key={t.id || 'none'}
                  onPress={() => { draft.setFavoriteId(t.id || null); draft.setFavPickerOpen(false); }}
                  style={({ pressed }) => [s.option, { borderBottomColor: divider, opacity: pressed ? 0.6 : 1 }]}>
                  <Text style={[s.num, { color: colors.subtext }]}>{t.number || ''}</Text>
                  <Text
                    style={[s.optionText, { color: t.id ? colors.text : colors.subtext, fontWeight: selected ? '700' : '400' }]}
                    numberOfLines={1}>
                    {t.title}
                  </Text>
                  {selected && <FontAwesome name="check" size={13} color={ACCENT} />}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { width: '100%' },
  toggle: { marginTop: 24, width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10 },
  toggleText: { flex: 1, fontSize: 14, fontWeight: '600' },
  list: { width: '100%', marginTop: 6 },
  favRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, paddingVertical: 10, paddingHorizontal: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10 },
  favLabel: { fontSize: 13 },
  favValue: { flex: 1, fontSize: 14, fontWeight: '600', textAlign: 'right' },
  hint: { fontSize: 12, marginVertical: 6 },
  empty: { fontSize: 13, marginVertical: 12, textAlign: 'center' },
  block: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  num: { width: 20, fontSize: 12, textAlign: 'right' },
  titleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flexShrink: 1, fontSize: 14 },
  reviewInput: { marginTop: 8, marginLeft: 30, minHeight: 64, borderRadius: 8, borderWidth: 1, padding: 10, fontSize: 14, lineHeight: 20 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { maxHeight: '70%', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 10, paddingHorizontal: 20 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#4a3020', alignSelf: 'center', marginBottom: 14 },
  sheetTitle: { fontSize: 17, fontWeight: '700', marginBottom: 6 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  optionText: { flex: 1, fontSize: 15 },
});
