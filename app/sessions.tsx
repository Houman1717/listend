import {
  StyleSheet,
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useMemo } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useAlbums, LoggedAlbum } from '@/context/AlbumsContext';

const DARK_BG = '#0d0d0d';
const CARD_BG  = '#111';
const BORDER   = '#1e1e1e';
const TEXT     = '#f0f0f0';
const SUBTEXT  = '#888';
const ACCENT   = '#FF3CAC';

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// "Mar 24, 2026" → Date object (returns null if unparseable)
function parseLogged(s: string): Date | null {
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// Date → "YYYY-MM-DD" key
function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Rating badge
function RatingPip({ rating }: { rating: number }) {
  if (!rating) return null;
  return (
    <View style={rb.wrap}>
      <Text style={rb.text}>{rating}</Text>
    </View>
  );
}
const rb = StyleSheet.create({
  wrap: {
    backgroundColor: '#1a0d14',
    borderWidth: 1,
    borderColor: ACCENT,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  text: { color: ACCENT, fontSize: 11, fontWeight: '700' },
});

export default function SessionsScreen() {
  const { width } = useWindowDimensions();
  const router    = useRouter();
  const { loggedAlbums } = useAlbums();

  // Calendar navigation state — start at current month
  const now = new Date();
  const [viewYear,  setViewYear]  = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth()); // 0-indexed
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Build lookup: dateKey → albums[]
  const albumsByDate = useMemo(() => {
    const map = new Map<string, LoggedAlbum[]>();
    for (const album of loggedAlbums) {
      const d = parseLogged(album.dateLogged);
      if (!d) continue;
      const k = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(album);
    }
    return map;
  }, [loggedAlbums]);

  // Monthly & yearly stats
  const monthlyCount = useMemo(() => {
    let n = 0;
    for (const album of loggedAlbums) {
      const d = parseLogged(album.dateLogged);
      if (d && d.getFullYear() === viewYear && d.getMonth() === viewMonth) n++;
    }
    return n;
  }, [loggedAlbums, viewYear, viewMonth]);

  const yearlyCount = useMemo(() => {
    return loggedAlbums.filter(a => {
      const d = parseLogged(a.dateLogged);
      return d && d.getFullYear() === viewYear;
    }).length;
  }, [loggedAlbums, viewYear]);

  const monthlyAlbums = useMemo(() => {
    return loggedAlbums.filter(a => {
      const d = parseLogged(a.dateLogged);
      return d && d.getFullYear() === viewYear && d.getMonth() === viewMonth;
    });
  }, [loggedAlbums, viewYear, viewMonth]);

  // Navigate months
  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
    setSelectedKey(null);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
    setSelectedKey(null);
  }

  // Build calendar grid cells
  const daysInMonth  = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstWeekDay = new Date(viewYear, viewMonth, 1).getDay();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const cellSize = Math.floor((width - 40) / 7); // 20px padding each side

  const selectedAlbums = selectedKey ? (albumsByDate.get(selectedKey) ?? []) : [];

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}>

      {/* ── Month navigator ───────────────────────────────────────────────────── */}
      <View style={s.monthNav}>
        <Pressable onPress={prevMonth} style={s.navBtn} hitSlop={12}>
          <FontAwesome name="chevron-left" size={15} color={TEXT} />
        </Pressable>
        <Text style={s.monthTitle}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
        <Pressable onPress={nextMonth} style={s.navBtn} hitSlop={12}>
          <FontAwesome name="chevron-right" size={15} color={TEXT} />
        </Pressable>
      </View>

      {/* ── Day-of-week header ────────────────────────────────────────────────── */}
      <View style={s.weekRow}>
        {DAY_LABELS.map(d => (
          <Text key={d} style={[s.weekLabel, { width: cellSize }]}>{d}</Text>
        ))}
      </View>

      {/* ── Calendar grid ────────────────────────────────────────────────────── */}
      <View style={s.calGrid}>
        {cells.map((day, idx) => {
          if (!day) {
            return <View key={`e-${idx}`} style={{ width: cellSize, height: cellSize + 10 }} />;
          }
          const k = dateKey(viewYear, viewMonth, day);
          const hasAlbums = albumsByDate.has(k);
          const isSelected = selectedKey === k;
          const isToday =
            day === now.getDate() &&
            viewMonth === now.getMonth() &&
            viewYear === now.getFullYear();

          return (
            <Pressable
              key={k}
              style={[
                s.dayCell,
                { width: cellSize, height: cellSize + 10 },
                isSelected && s.dayCellSelected,
                isToday && !isSelected && s.dayCellToday,
              ]}
              onPress={() => setSelectedKey(isSelected ? null : k)}>
              <Text style={[
                s.dayNum,
                isSelected && s.dayNumSelected,
                isToday && !isSelected && s.dayNumToday,
              ]}>
                {day}
              </Text>
              {hasAlbums && (
                <View style={[s.dot, isSelected && s.dotSelected]} />
              )}
            </Pressable>
          );
        })}
      </View>

      {/* ── This Month ───────────────────────────────────────────────────────── */}
      <View style={s.monthSection}>
        <Text style={s.monthSectionTitle}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </Text>
        {monthlyAlbums.length === 0 ? (
          <Text style={s.noMonthAlbums}>No albums logged this month.</Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.monthRow}>
            {monthlyAlbums.map(album => (
              <Pressable
                key={album.id}
                style={({ pressed }) => [s.monthCard, { opacity: pressed ? 0.7 : 1 }]}
                onPress={() => router.push({ pathname: '/album-detail', params: { id: album.id } })}>
                {album.artworkUrl ? (
                  <Image source={{ uri: album.artworkUrl }} style={s.monthArt} />
                ) : (
                  <View style={[s.monthArt, { backgroundColor: album.coverColor ?? '#2a2a2a', justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={s.monthArtInitial}>{album.title.charAt(0)}</Text>
                  </View>
                )}
                <Text style={s.monthCardTitle} numberOfLines={1}>{album.title}</Text>
                <Text style={s.monthCardArtist} numberOfLines={1}>{album.artist}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      {/* ── Selected date albums ─────────────────────────────────────────────── */}
      {selectedKey && (
        <View style={s.dayDetail}>
          <Text style={s.dayDetailTitle}>
            {MONTH_NAMES[viewMonth]} {parseInt(selectedKey.split('-')[2], 10)}, {viewYear}
          </Text>
          {selectedAlbums.length === 0 ? (
            <Text style={s.noAlbums}>No albums logged this day.</Text>
          ) : (
            selectedAlbums.map(album => (
              <Pressable
                key={album.id}
                style={({ pressed }) => [s.albumRow, { opacity: pressed ? 0.7 : 1 }]}
                onPress={() => router.push({ pathname: '/album-detail', params: { id: album.id } })}>
                {album.artworkUrl ? (
                  <Image source={{ uri: album.artworkUrl }} style={s.albumArt} />
                ) : (
                  <View style={[s.albumArt, { backgroundColor: album.coverColor, justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={s.albumInitial}>{album.title.charAt(0)}</Text>
                  </View>
                )}
                <View style={s.albumInfo}>
                  <Text style={s.albumTitle} numberOfLines={1}>{album.title}</Text>
                  <Text style={s.albumArtist} numberOfLines={1}>{album.artist}</Text>
                </View>
                <RatingPip rating={album.rating} />
              </Pressable>
            ))
          )}
        </View>
      )}

      {/* ── Monthly + yearly stats ────────────────────────────────────────────── */}
      <View style={s.statsRow}>
        <View style={s.statBox}>
          <Text style={s.statValue}>{monthlyCount}</Text>
          <Text style={s.statLabel}>{MONTH_NAMES[viewMonth].slice(0, 3)}</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statBox}>
          <Text style={s.statValue}>{yearlyCount}</Text>
          <Text style={s.statLabel}>{viewYear}</Text>
        </View>
      </View>

    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_BG },
  content:   { paddingBottom: 48 },

  // Month nav
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  navBtn:     { padding: 4 },
  monthTitle: { color: TEXT, fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },

  // Day labels
  weekRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  weekLabel: {
    color: SUBTEXT,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Grid
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    rowGap: 2,
  },
  dayCell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    gap: 3,
  },
  dayCellSelected: { backgroundColor: ACCENT },
  dayCellToday:    { backgroundColor: '#1a0d14', borderWidth: 1, borderColor: '#3a1a2a' },
  dayNum:         { color: TEXT, fontSize: 13, fontWeight: '500' },
  dayNumSelected: { color: '#fff', fontWeight: '700' },
  dayNumToday:    { color: ACCENT },
  dot:         { width: 4, height: 4, borderRadius: 2, backgroundColor: ACCENT },
  dotSelected: { backgroundColor: '#fff' },

  // This Month section
  monthSection: {
    marginHorizontal: 20,
    marginTop: 24,
  },
  monthSectionTitle: {
    color: TEXT,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 14,
    letterSpacing: -0.2,
  },
  noMonthAlbums: {
    color: SUBTEXT,
    fontSize: 14,
  },
  monthRow: {
    gap: 12,
    paddingBottom: 4,
  },
  monthCard: {
    width: 100,
  },
  monthArt: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginBottom: 6,
  },
  monthArtInitial: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 24,
    fontWeight: '700',
  },
  monthCardTitle: {
    color: TEXT,
    fontSize: 12,
    fontWeight: '600',
  },
  monthCardArtist: {
    color: SUBTEXT,
    fontSize: 11,
    marginTop: 1,
  },

  // Day detail
  dayDetail: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    padding: 16,
  },
  dayDetailTitle: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  noAlbums: { color: SUBTEXT, fontSize: 14 },
  albumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  albumArt:     { width: 44, height: 44, borderRadius: 6 },
  albumInitial: { color: 'rgba(255,255,255,0.5)', fontSize: 16, fontWeight: '700' },
  albumInfo:    { flex: 1, gap: 3 },
  albumTitle:   { color: TEXT, fontSize: 14, fontWeight: '600' },
  albumArtist:  { color: SUBTEXT, fontSize: 12 },

  // Stats
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 24,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    paddingVertical: 18,
  },
  statBox: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { color: TEXT, fontSize: 26, fontWeight: '700' },
  statLabel: {
    color: SUBTEXT,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: BORDER,
  },
});
