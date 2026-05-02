import {
  StyleSheet,
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useMemo, useEffect } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useAlbums, LoggedAlbum } from '@/context/AlbumsContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

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
  const colorScheme = useColorScheme();
  const colors      = Colors[colorScheme ?? 'light'];
  if (!rating) return null;
  return (
    <View style={[rb.wrap, { backgroundColor: colors.surface, borderColor: '#D4A017' }]}>
      <Text style={rb.text}>{rating}</Text>
    </View>
  );
}
const rb = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  text: { color: '#D4A017', fontSize: 11, fontWeight: '700' },
});

const COVER_COLORS = ['#2d5a27','#7a4a2e','#1a3018','#d4a017','#7a3a1a','#8b1a1a','#1a5a5a','#4a2818'];

export default function SessionsScreen() {
  const colorScheme = useColorScheme();
  const colors      = Colors[colorScheme ?? 'light'];
  const isDark      = colorScheme === 'dark';

  const { width } = useWindowDimensions();
  const router    = useRouter();
  const { loggedAlbums } = useAlbums();
  const { user } = useAuth();
  const { userId: paramUserId } = useLocalSearchParams<{ userId?: string }>();

  const viewingOther = paramUserId || null;
  const [otherAlbums, setOtherAlbums] = useState<LoggedAlbum[]>([]);

  useEffect(() => {
    if (!viewingOther) return;
    supabase
      .from('user_albums')
      .select('spotify_id, title, artist, artwork_url, year, rating, listened_at')
      .eq('user_id', viewingOther)
      .order('listened_at', { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        setOtherAlbums(data.map((a, i) => ({
          id:         a.spotify_id,
          title:      a.title      ?? '',
          artist:     a.artist     ?? '',
          year:       a.year       ?? 0,
          rating:     a.rating     ?? 0,
          dateLogged: a.listened_at ?? new Date().toISOString(),
          artworkUrl: a.artwork_url ?? undefined,
          coverColor: COVER_COLORS[i % COVER_COLORS.length],
        })));
      });
  }, [viewingOther]);

  const sourceAlbums = viewingOther ? otherAlbums : loggedAlbums;

  // Calendar navigation state — start at current month
  const now = new Date();
  const [viewYear,  setViewYear]  = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth()); // 0-indexed
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Build lookup: dateKey → albums[]
  const albumsByDate = useMemo(() => {
    const map = new Map<string, LoggedAlbum[]>();
    for (const album of sourceAlbums) {
      const d = parseLogged(album.dateLogged);
      if (!d) continue;
      const k = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(album);
    }
    return map;
  }, [sourceAlbums]);

  // Monthly & yearly stats
  const monthlyCount = useMemo(() => {
    let n = 0;
    for (const album of sourceAlbums) {
      const d = parseLogged(album.dateLogged);
      if (d && d.getFullYear() === viewYear && d.getMonth() === viewMonth) n++;
    }
    return n;
  }, [sourceAlbums, viewYear, viewMonth]);

  const yearlyCount = useMemo(() => {
    return sourceAlbums.filter(a => {
      const d = parseLogged(a.dateLogged);
      return d && d.getFullYear() === viewYear;
    }).length;
  }, [sourceAlbums, viewYear]);

  const monthlyAlbums = useMemo(() => {
    return sourceAlbums.filter(a => {
      const d = parseLogged(a.dateLogged);
      return d && d.getFullYear() === viewYear && d.getMonth() === viewMonth;
    });
  }, [sourceAlbums, viewYear, viewMonth]);

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
      style={[s.container, { backgroundColor: colors.background }]}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}>

      {/* ── Month navigator ───────────────────────────────────────────────────── */}
      <View style={s.monthNav}>
        <Pressable onPress={prevMonth} style={s.navBtn} hitSlop={12}>
          <FontAwesome name="chevron-left" size={15} color={colors.text} />
        </Pressable>
        <Text style={[s.monthTitle, { color: colors.text }]}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
        <Pressable onPress={nextMonth} style={s.navBtn} hitSlop={12}>
          <FontAwesome name="chevron-right" size={15} color={colors.text} />
        </Pressable>
      </View>

      {/* ── Day-of-week header ────────────────────────────────────────────────── */}
      <View style={s.weekRow}>
        {DAY_LABELS.map(d => (
          <Text key={d} style={[s.weekLabel, { width: cellSize, color: colors.subtext }]}>{d}</Text>
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
                isToday && !isSelected && { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
              ]}
              onPress={() => setSelectedKey(isSelected ? null : k)}>
              <Text style={[
                s.dayNum,
                { color: colors.text },
                isSelected && s.dayNumSelected,
                isToday && !isSelected && { color: '#D4A017' },
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
        <Text style={[s.monthSectionTitle, { color: colors.text }]}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </Text>
        {monthlyAlbums.length === 0 ? (
          <Text style={[s.noMonthAlbums, { color: colors.subtext }]}>No albums logged this month.</Text>
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
                  <View style={[s.monthArt, { backgroundColor: album.coverColor ?? colors.border, justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={s.monthArtInitial}>{album.title.charAt(0)}</Text>
                  </View>
                )}
                <Text style={[s.monthCardTitle, { color: colors.text }]} numberOfLines={1}>{album.title}</Text>
                <Text style={[s.monthCardArtist, { color: colors.subtext }]} numberOfLines={1}>{album.artist}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      {/* ── Selected date albums ─────────────────────────────────────────────── */}
      {selectedKey && (
        <View style={[s.dayDetail, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[s.dayDetailTitle, { color: colors.text }]}>
            {MONTH_NAMES[viewMonth]} {parseInt(selectedKey.split('-')[2], 10)}, {viewYear}
          </Text>
          <Text style={[s.dayAlbumCount, { color: colors.subtext }]}>
            {selectedAlbums.length === 1 ? '1 album' : `${selectedAlbums.length} albums`}
          </Text>
          {selectedAlbums.length === 0 ? (
            <Text style={[s.noAlbums, { color: colors.subtext }]}>No albums logged this day.</Text>
          ) : (
            selectedAlbums.map(album => (
              <Pressable
                key={album.id}
                style={({ pressed }) => [s.albumRow, { borderTopColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                onPress={() => router.push({ pathname: '/album-detail', params: { id: album.id } })}>
                {album.artworkUrl ? (
                  <Image source={{ uri: album.artworkUrl }} style={s.albumArt} />
                ) : (
                  <View style={[s.albumArt, { backgroundColor: album.coverColor, justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={s.albumInitial}>{album.title.charAt(0)}</Text>
                  </View>
                )}
                <View style={s.albumInfo}>
                  <Text style={[s.albumTitle, { color: colors.text }]} numberOfLines={1}>{album.title}</Text>
                  <Text style={[s.albumArtist, { color: colors.subtext }]} numberOfLines={1}>{album.artist}</Text>
                </View>
                <RatingPip rating={album.rating} />
              </Pressable>
            ))
          )}
        </View>
      )}

      {/* ── Monthly + yearly stats ────────────────────────────────────────────── */}
      <View style={[s.statsRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={s.statBox}>
          <Text style={[s.statValue, { color: colors.text }]}>{monthlyCount}</Text>
          <Text style={[s.statLabel, { color: colors.subtext }]}>{MONTH_NAMES[viewMonth].slice(0, 3)}</Text>
        </View>
        <View style={[s.statDivider, { backgroundColor: colors.border }]} />
        <View style={s.statBox}>
          <Text style={[s.statValue, { color: colors.text }]}>{yearlyCount}</Text>
          <Text style={[s.statLabel, { color: colors.subtext }]}>{viewYear}</Text>
        </View>
      </View>

    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
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
  monthTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },

  // Day labels
  weekRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  weekLabel: {
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
  dayCellSelected: { backgroundColor: '#D4A017' },
  dayNum:         { fontSize: 13, fontWeight: '500' },
  dayNumSelected: { color: '#fff', fontWeight: '700' },
  dot:         { width: 4, height: 4, borderRadius: 2, backgroundColor: '#D4A017' },
  dotSelected: { backgroundColor: '#fff' },

  // This Month section
  monthSection: {
    marginHorizontal: 20,
    marginTop: 24,
  },
  monthSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 14,
    letterSpacing: -0.2,
  },
  noMonthAlbums: { fontSize: 14 },
  monthRow: { gap: 12, paddingBottom: 4 },
  monthCard: { width: 100 },
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
  monthCardTitle:  { fontSize: 12, fontWeight: '600' },
  monthCardArtist: { fontSize: 11, marginTop: 1 },

  // Day detail
  dayDetail: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  dayDetailTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  dayAlbumCount:  { fontSize: 12, marginBottom: 12 },
  noAlbums:       { fontSize: 14 },
  albumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  albumArt:     { width: 44, height: 44, borderRadius: 6 },
  albumInitial: { color: 'rgba(255,255,255,0.5)', fontSize: 16, fontWeight: '700' },
  albumInfo:    { flex: 1, gap: 3 },
  albumTitle:   { fontSize: 14, fontWeight: '600' },
  albumArtist:  { fontSize: 12 },

  // Stats
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 24,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 18,
  },
  statBox: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 26, fontWeight: '700' },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
});
