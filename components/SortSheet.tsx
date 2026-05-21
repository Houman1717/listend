import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SortKey =
  | 'date_new'        | 'date_old'
  | 'artist_az'       | 'artist_za'
  | 'title_az'        | 'title_za'
  | 'avg_rating_high' | 'avg_rating_low'
  | 'my_rating_high'  | 'my_rating_low'
  | 'release_new'     | 'release_old'
  | 'num_ratings_high'| 'num_ratings_low'
  | 'duration_long'   | 'duration_short'
  | 'shuffle';

type SortGroup = {
  label: string;
  a: { key: SortKey; label: string };
  b: { key: SortKey; label: string };
};

// ─── Sort group definitions ───────────────────────────────────────────────────

const SORT_GROUPS: SortGroup[] = [
  { label: 'Date Added',     a: { key: 'date_new',          label: 'Newest'   }, b: { key: 'date_old',         label: 'Oldest'   } },
  { label: 'Artist',         a: { key: 'artist_az',         label: 'A → Z'    }, b: { key: 'artist_za',        label: 'Z → A'    } },
  { label: 'Title',          a: { key: 'title_az',          label: 'A → Z'    }, b: { key: 'title_za',         label: 'Z → A'    } },
  { label: 'Average Rating', a: { key: 'avg_rating_high',   label: 'High'     }, b: { key: 'avg_rating_low',   label: 'Low'      } },
  { label: 'My Rating',      a: { key: 'my_rating_high',    label: 'High'     }, b: { key: 'my_rating_low',    label: 'Low'      } },
  { label: 'Release Date',   a: { key: 'release_new',       label: 'Newest'   }, b: { key: 'release_old',      label: 'Oldest'   } },
  { label: 'No. of Ratings', a: { key: 'num_ratings_high',  label: 'Most'     }, b: { key: 'num_ratings_low',  label: 'Fewest'   } },
  { label: 'Duration',       a: { key: 'duration_long',     label: 'Longest'  }, b: { key: 'duration_short',   label: 'Shortest' } },
];

// ─── Sort label helper ────────────────────────────────────────────────────────

export function sortLabel(key: SortKey): string {
  if (key === 'shuffle') return 'Shuffled';
  for (const g of SORT_GROUPS) {
    if (g.a.key === key) return `${g.label} · ${g.a.label}`;
    if (g.b.key === key) return `${g.label} · ${g.b.label}`;
  }
  return 'Sort';
}

// ─── Generic sort function ────────────────────────────────────────────────────

export function applySort<T extends {
  title: string;
  artist: string;
  year: number;
  rating?: number;
  dateLogged?: string;
  lastListenedAt?: string;
  dateAdded?: string;
  durationMs?: number;
}>(arr: T[], key: SortKey): T[] {
  const a = [...arr];
  const dateOf       = (x: T) => x.lastListenedAt ?? x.dateLogged ?? x.dateAdded ?? '';
  const ratingOf     = (x: T) => (x as any).lastRating ?? x.rating ?? 0;
  // Albums without a cached duration sort to the end regardless of direction
  const durationOf   = (x: T) => x.durationMs ?? -1;

  switch (key) {
    case 'date_new':          return a.sort((x, y) => dateOf(y).localeCompare(dateOf(x)));
    case 'date_old':          return a.sort((x, y) => dateOf(x).localeCompare(dateOf(y)));
    case 'artist_az':         return a.sort((x, y) => x.artist.localeCompare(y.artist));
    case 'artist_za':         return a.sort((x, y) => y.artist.localeCompare(x.artist));
    case 'title_az':          return a.sort((x, y) => x.title.localeCompare(y.title));
    case 'title_za':          return a.sort((x, y) => y.title.localeCompare(x.title));
    // Average Rating: community data not yet available — fallback to own rating
    case 'avg_rating_high':   return a.sort((x, y) => ratingOf(y) - ratingOf(x));
    case 'avg_rating_low':    return a.sort((x, y) => ratingOf(x) - ratingOf(y));
    case 'my_rating_high':    return a.sort((x, y) => ratingOf(y) - ratingOf(x));
    case 'my_rating_low':     return a.sort((x, y) => ratingOf(x) - ratingOf(y));
    case 'release_new':       return a.sort((x, y) => y.year - x.year);
    case 'release_old':       return a.sort((x, y) => x.year - y.year);
    // No. of Ratings: backend data not yet in local model — maintains current order
    case 'num_ratings_high':
    case 'num_ratings_low':   return a;
    // Duration: sorted by cached durationMs; albums not yet opened sort to the end
    case 'duration_long':     return a.sort((x, y) => durationOf(y) - durationOf(x));
    case 'duration_short':    return a.sort((x, y) => {
      const dx = x.durationMs ?? Number.MAX_SAFE_INTEGER;
      const dy = y.durationMs ?? Number.MAX_SAFE_INTEGER;
      return dx - dy;
    });
    default:                  return a;
  }
}

// ─── Sort bar (trigger button) ────────────────────────────────────────────────

export function SortBar({
  sortKey,
  count,
  noun,
  isDark,
  onPress,
  onSearchPress,
  searchActive,
}: {
  sortKey: SortKey;
  count: number;
  noun: string;
  isDark: boolean;
  onPress: () => void;
  onSearchPress?: () => void;
  searchActive?: boolean;
}) {
  const subtext = isDark ? '#a07850' : '#7a5535';
  const surface = isDark ? '#2e2018' : '#f0ece7';
  const border  = isDark ? '#3a2818' : '#ddd';
  return (
    <View style={[sb.bar, { backgroundColor: isDark ? '#1c1410' : '#faf7f4', borderBottomColor: border }]}>
      <Text style={[sb.count, { color: subtext }]}>{count} {noun}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {onSearchPress && (
          <Pressable
            onPress={onSearchPress}
            hitSlop={8}
            style={({ pressed }) => [sb.btn, { backgroundColor: searchActive ? '#D4A017' : surface, borderColor: border, opacity: pressed ? 0.7 : 1 }]}>
            <Ionicons name="search-outline" size={13} color={searchActive ? '#fff' : '#D4A017'} />
          </Pressable>
        )}
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [sb.btn, { backgroundColor: surface, borderColor: border, opacity: pressed ? 0.7 : 1 }]}>
          <Ionicons name="funnel-outline" size={13} color="#D4A017" />
          <Text style={[sb.btnText, { color: isDark ? '#f5e6c8' : '#1A0F0A' }]} numberOfLines={1}>
            {sortLabel(sortKey)}
          </Text>
          <Ionicons name="chevron-down" size={11} color={subtext} />
        </Pressable>
      </View>
    </View>
  );
}

// ─── Sort sheet (bottom modal) ────────────────────────────────────────────────

export function SortSheet({
  visible,
  activeKey,
  onSelect,
  onClose,
  isDark,
}: {
  visible: boolean;
  activeKey: SortKey;
  onSelect: (key: SortKey) => void;
  onClose: () => void;
  isDark: boolean;
}) {
  const bg      = isDark ? '#1c1410' : '#fff';
  const text    = isDark ? '#f5e6c8' : '#1A0F0A';
  const subtext = isDark ? '#a07850' : '#7a5535';
  const border  = isDark ? '#2e2018' : '#ececec';
  const surface = isDark ? '#2e2018' : '#f5f5f5';

  function handleSelect(key: SortKey) {
    onSelect(key);
    onClose();
  }

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill}>
      <Pressable style={ss.overlay} onPress={onClose} />
      <View style={[ss.sheet, { backgroundColor: bg }]}>
        {/* Handle */}
        <View style={[ss.handle, { backgroundColor: isDark ? '#3a2818' : '#ddd' }]} />

        <Text style={[ss.title, { color: text }]}>Sort By</Text>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ss.content}>
          {SORT_GROUPS.map((group) => (
            <View key={group.label} style={[ss.row, { borderBottomColor: border }]}>
              <Text style={[ss.groupLabel, { color: subtext }]}>{group.label}</Text>
              <View style={ss.btnPair}>
                {([group.a, group.b] as const).map((opt) => {
                  const active = activeKey === opt.key;
                  return (
                    <Pressable
                      key={opt.key}
                      onPress={() => handleSelect(opt.key)}
                      style={[
                        ss.optBtn,
                        active
                          ? ss.optBtnActive
                          : { backgroundColor: surface, borderColor: border },
                      ]}>
                      <Text style={[ss.optText, { color: active ? '#fff' : subtext }]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}

          {/* Shuffle */}
          <Pressable
            onPress={() => handleSelect('shuffle')}
            style={[
              ss.shuffleBtn,
              activeKey === 'shuffle'
                ? ss.shuffleBtnActive
                : { backgroundColor: surface, borderColor: border },
            ]}>
            <Ionicons
              name="shuffle"
              size={16}
              color={activeKey === 'shuffle' ? '#fff' : subtext}
            />
            <Text style={[ss.shuffleText, { color: activeKey === 'shuffle' ? '#fff' : subtext }]}>
              Shuffle
            </Text>
          </Pressable>
        </ScrollView>
      </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const sb = StyleSheet.create({
  bar:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  count:   { fontSize: 13 },
  btn:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  btnText: { fontSize: 13, fontWeight: '500', maxWidth: 180 },
});

const ss = StyleSheet.create({
  overlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:    { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40, maxHeight: '80%' },
  handle:   { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  title:    { fontSize: 17, fontWeight: '700', textAlign: 'center', paddingVertical: 14 },
  content:  { paddingHorizontal: 20, paddingBottom: 20 },

  row:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  groupLabel: { fontSize: 13, fontWeight: '600', flex: 1, marginRight: 12 },
  btnPair:    { flexDirection: 'row', gap: 8 },
  optBtn:     { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  optBtnActive: { backgroundColor: '#D4A017', borderColor: '#D4A017' },
  optText:    { fontSize: 13, fontWeight: '500' },

  shuffleBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14, paddingVertical: 12, borderRadius: 16, borderWidth: 1 },
  shuffleBtnActive: { backgroundColor: '#D4A017', borderColor: '#D4A017' },
  shuffleText:      { fontSize: 15, fontWeight: '600' },
});
