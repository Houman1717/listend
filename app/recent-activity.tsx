import {
  StyleSheet,
  View,
  Text,
  Image,
  Pressable,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useAlbums } from '@/context/AlbumsContext';

// ─── Palette ──────────────────────────────────────────────────────────────────

const DARK_BG = '#0d0d0d';
const BORDER   = '#1e1e1e';
const TEXT     = '#f0f0f0';
const SUBTEXT  = '#777';

const TYPE_META = {
  reviewed:     { label: 'Reviewed',       color: '#818cf8', icon: 'pencil'     },
  rated:        { label: 'Rated',           color: '#c084fc', icon: 'star'       },
  listened:     { label: 'Listened',        color: '#FF3CAC', icon: 'headphones' },
  wantToListen: { label: 'Want to Listen',  color: '#34d399', icon: 'bookmark'   },
} as const;

type ActivityType = keyof typeof TYPE_META;

// ─── Unified activity item type ───────────────────────────────────────────────

type ActivityItem = {
  key:        string;
  type:       ActivityType;
  id:         string;
  title:      string;
  artist:     string;
  year:       number;
  artworkUrl: string | undefined;
  coverColor: string | undefined;
  dateMs:     number | null; // null = no timestamp (want-to-listen)
  dateLabel:  string;
  rating:     number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BAR_HEIGHTS = [3, 4, 5, 6, 7, 9, 11, 13, 15, 17];

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const MONTH_MAP: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

function parseDate(s: string): number | null {
  if (!s) return null;
  // ISO format (used by dateAdded on wantToListen items)
  let ms = new Date(s).getTime();
  if (!isNaN(ms)) return ms;
  // "Mar 24, 2026" — toLocaleDateString format; Hermes can't parse this
  const m = s.match(/^(\w{3})\s+(\d{1,2}),\s+(\d{4})$/);
  if (m && MONTH_MAP[m[1]] !== undefined) {
    ms = new Date(parseInt(m[3], 10), MONTH_MAP[m[1]], parseInt(m[2], 10)).getTime();
    if (!isNaN(ms)) return ms;
  }
  return null;
}

// ─── Row component ────────────────────────────────────────────────────────────

function ActivityRow({ item, onPress }: { item: ActivityItem; onPress: () => void }) {
  const meta = TYPE_META[item.type];

  return (
    <Pressable
      style={({ pressed }) => [s.row, { opacity: pressed ? 0.72 : 1 }]}
      onPress={onPress}>

      {/* Artwork */}
      {item.artworkUrl ? (
        <Image source={{ uri: item.artworkUrl }} style={s.art} />
      ) : (
        <View style={[s.art, { backgroundColor: item.coverColor ?? '#2a2a2a', justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={s.artInitial}>{item.title.charAt(0)}</Text>
        </View>
      )}

      {/* Text block */}
      <View style={s.info}>
        <Text style={s.title} numberOfLines={1}>{item.title}</Text>
        <Text style={s.artist} numberOfLines={1}>{item.artist}{item.year ? ` · ${item.year}` : ''}</Text>
        <View style={s.meta}>
          {/* Type pill */}
          <View style={[s.typePill, { borderColor: meta.color }]}>
            <FontAwesome name={meta.icon as any} size={9} color={meta.color} />
            <Text style={[s.typeLabel, { color: meta.color }]}>{meta.label}</Text>
          </View>
          {/* Date */}
          {item.dateLabel ? (
            <Text style={s.date}>{item.dateLabel}</Text>
          ) : null}
        </View>
      </View>

      {/* Rating bars (rated items only) */}
      {item.type === 'rated' && item.rating > 0 && (
        <View style={s.bars}>
          {BAR_HEIGHTS.map((h, i) => (
            <View
              key={i}
              style={[s.bar, { height: h, backgroundColor: i + 1 <= item.rating ? '#c084fc' : '#252525' }]}
            />
          ))}
        </View>
      )}
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function RecentActivityScreen() {
  const router = useRouter();
  const { loggedAlbums, wantToListen } = useAlbums();

  const feed = useMemo((): ActivityItem[] => {
    const items: ActivityItem[] = [];

    // Each logged album gets exactly one entry using the most specific type:
    // reviewed > rated > listened
    for (const a of loggedAlbums) {
      const type: ActivityType = a.review ? 'reviewed' : a.rating > 0 ? 'rated' : 'listened';
      items.push({
        key:        `logged-${a.id}`,
        type,
        id:         a.id,
        title:      a.title,
        artist:     a.artist,
        year:       a.year,
        artworkUrl: a.artworkUrl,
        coverColor: a.coverColor,
        dateMs:     parseDate(a.dateLogged),
        dateLabel:  formatDateLabel(a.dateLogged),
        rating:     a.rating,
      });
    }

    // Want-to-listen items — use dateAdded if present, otherwise sort to end
    for (const w of wantToListen) {
      const dateMs = w.dateAdded ? new Date(w.dateAdded).getTime() : null;
      const dateLabel = w.dateAdded
        ? new Date(w.dateAdded).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : '';
      items.push({
        key:        `want-${w.id}`,
        type:       'wantToListen',
        id:         w.id,
        title:      w.title,
        artist:     w.artist,
        year:       w.year,
        artworkUrl: w.artworkUrl,
        coverColor: undefined,
        dateMs,
        dateLabel,
        rating:     0,
      });
    }

    // Sort: dated items newest-first, undated items fall to the end
    items.sort((a, b) => {
      if (a.dateMs === null && b.dateMs === null) return 0;
      if (a.dateMs === null) return 1;
      if (b.dateMs === null) return -1;
      return b.dateMs - a.dateMs;
    });

    return items;
  }, [loggedAlbums, wantToListen]);

  if (feed.length === 0) {
    return (
      <View style={s.emptyWrap}>
        <View style={s.emptyRing}>
          <FontAwesome name="clock-o" size={36} color="#FF3CAC" />
        </View>
        <Text style={s.emptyTitle}>No activity yet</Text>
        <Text style={s.emptySub}>Log your first album to see{'\n'}your activity here.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={feed}
      keyExtractor={item => item.key}
      style={s.container}
      contentContainerStyle={s.list}
      showsVerticalScrollIndicator={false}
      ItemSeparatorComponent={() => <View style={s.sep} />}
      renderItem={({ item }) => (
        <ActivityRow
          item={item}
          onPress={() => router.push({ pathname: '/album-detail', params: { id: item.id } })}
        />
      )}
    />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_BG },
  list:      { paddingVertical: 8, paddingBottom: 48 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 13,
    gap: 13,
  },
  art:        { width: 52, height: 52, borderRadius: 8, flexShrink: 0 },
  artInitial: { color: 'rgba(255,255,255,0.45)', fontSize: 18, fontWeight: '700' },

  info:   { flex: 1, gap: 3 },
  title:  { color: TEXT, fontSize: 14, fontWeight: '600' },
  artist: { color: SUBTEXT, fontSize: 12 },

  meta:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3, flexWrap: 'wrap' },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  typeLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  date:      { color: SUBTEXT, fontSize: 11 },

  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 1.5, flexShrink: 0 },
  bar:  { width: 2.5, borderRadius: 1 },

  sep: { height: StyleSheet.hairlineWidth, backgroundColor: BORDER, marginLeft: 83 },

  emptyWrap: {
    flex: 1,
    backgroundColor: DARK_BG,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#1a0d14',
    borderWidth: 1,
    borderColor: '#3a1a2a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: { color: TEXT, fontSize: 18, fontWeight: '700', marginBottom: 10 },
  emptySub:   { color: SUBTEXT, fontSize: 14, lineHeight: 21, textAlign: 'center' },
});
