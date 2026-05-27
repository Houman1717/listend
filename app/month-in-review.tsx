import { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Pressable, FlatList,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { usePro } from '@/context/ProContext';
import { getProTheme, themeToColors } from '@/lib/proThemes';
import { useAlbums, LoggedAlbum } from '@/context/AlbumsContext';

const ACCENT  = '#D4A017';
const CARD_BG = '#2E2018';
const SUBTEXT = '#A08060';

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const MAIN_GENRES = new Set([
  'Hip-Hop / Rap', 'Pop', 'Rock', 'Latin', 'Afrobeats',
  'R&B / Soul', 'Electronic', 'Indie / Alternative', 'Metal',
  'Country', 'Jazz', 'Classical', 'Folk / Singer-Songwriter', 'Blues',
]);

function computeMonthStats(albums: LoggedAlbum[]) {
  const rated     = albums.filter(a => a.rating > 0);
  const avgRating = rated.length > 0
    ? (rated.reduce((s, a) => s + a.rating, 0) / rated.length).toFixed(1) : '—';
  const totalMs   = albums.reduce((s, a) => s + (a.durationMs ?? 0), 0);
  const hours     = totalMs > 0 ? Math.round(totalMs / 3_600_000) : 0;
  const artists   = new Set(albums.map(a => a.artist));

  const artistCounts = new Map<string, number>();
  for (const a of albums) artistCounts.set(a.artist, (artistCounts.get(a.artist) ?? 0) + 1);
  const topArtist = [...artistCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  const genreCounts = new Map<string, number>();
  for (const a of albums) {
    const g = (a.genreTags ?? []).find(t => MAIN_GENRES.has(t));
    if (g) genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
  }
  const topGenre  = [...genreCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const bestRated = [...rated].sort((a, b) => b.rating - a.rating)[0] ?? null;
  const sorted    = [...albums].sort((a, b) => new Date(a.dateLogged).getTime() - new Date(b.dateLogged).getTime());
  const firstAlbum = sorted[0] ?? null;

  return { avgRating, hours, artistCount: artists.size, topArtist, topGenre, bestRated, firstAlbum };
}

export default function MonthInReviewScreen() {
  const colorScheme = useColorScheme();
  const { isPro, proTheme } = usePro();
  const activeThemeKey = isPro ? proTheme : 'default';
  const colors = (activeThemeKey && activeThemeKey !== 'default')
    ? themeToColors(getProTheme(activeThemeKey))
    : Colors[colorScheme ?? 'dark'];
  const insets  = useSafeAreaInsets();
  const router  = useRouter();
  const params  = useLocalSearchParams<{ year?: string; month?: string }>();
  const { loggedAlbums } = useAlbums();

  // Build list of months that have data, most recent first
  const monthsWithData = (() => {
    const seen = new Set<string>();
    const list: { year: number; month: number }[] = [];
    for (const a of loggedAlbums) {
      const d = new Date(a.dateLogged);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!seen.has(key)) {
        seen.add(key);
        list.push({ year: d.getFullYear(), month: d.getMonth() });
      }
    }
    return list.sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month);
  })();

  const defaultMonth = monthsWithData[0] ?? { year: new Date().getFullYear(), month: new Date().getMonth() };
  const initYear  = params.year  ? parseInt(params.year)  : defaultMonth.year;
  const initMonth = params.month !== undefined ? parseInt(params.month) : defaultMonth.month;

  const [selectedYear,  setSelectedYear]  = useState(initYear);
  const [selectedMonth, setSelectedMonth] = useState(initMonth);

  const monthAlbums = loggedAlbums.filter(a => {
    const d = new Date(a.dateLogged);
    return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
  });

  const stats    = computeMonthStats(monthAlbums);
  const cardBg   = colors.surface;
  const cardBorder = colors.border;

  function StatCell({ label, value }: { label: string; value: string | number }) {
    return (
      <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>{value}</Text>
        <Text style={{ color: colors.subtext, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' }}>{label}</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{
        title: 'Monthly Stats',
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }} />

      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 48, gap: 16 }}
        showsVerticalScrollIndicator={false}>

        {monthsWithData.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <Text style={{ color: colors.subtext, fontSize: 15 }}>No listening history yet.</Text>
          </View>
        ) : (
          <>
            {/* Month picker */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              {monthsWithData.map(({ year, month }) => {
                const isSelected = year === selectedYear && month === selectedMonth;
                return (
                  <Pressable
                    key={`${year}-${month}`}
                    onPress={() => { setSelectedYear(year); setSelectedMonth(month); }}
                    style={{
                      paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
                      backgroundColor: isSelected ? colors.tint : cardBg,
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: isSelected ? colors.tint : cardBorder,
                    }}>
                    <Text style={{ color: isSelected ? '#fff' : colors.subtext, fontSize: 13, fontWeight: '700' }}>
                      {MONTH_NAMES[month].slice(0, 3)} {year}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {monthAlbums.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Text style={{ color: colors.subtext, fontSize: 15 }}>
                  No albums logged in {MONTH_NAMES[selectedMonth]} {selectedYear}.
                </Text>
              </View>
            ) : (
              <>
                {/* Hero */}
                <View style={[st.card, { backgroundColor: cardBg, borderColor: cardBorder, alignItems: 'center', gap: 6 }]}>
                  <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' }}>
                    {MONTH_NAMES[selectedMonth]} {selectedYear}
                  </Text>
                  <Text style={{ color: colors.tint, fontSize: 64, fontWeight: '800', letterSpacing: -3 }}>{monthAlbums.length}</Text>
                  <Text style={{ color: colors.subtext, fontSize: 14 }}>albums logged</Text>
                </View>

                {/* Stats grid */}
                <View style={[st.card, { backgroundColor: cardBg, borderColor: cardBorder, padding: 0, overflow: 'hidden' }]}>
                  <View style={{ flexDirection: 'row', paddingVertical: 18 }}>
                    <StatCell label="Hours" value={stats.hours || '—'} />
                    <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: cardBorder }} />
                    <StatCell label="Artists" value={stats.artistCount} />
                    <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: cardBorder }} />
                    <StatCell label="Avg Rating" value={stats.avgRating} />
                  </View>
                </View>

                {/* Top artist */}
                {stats.topArtist && (
                  <View style={[st.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                    <Text style={[st.label, { color: colors.textMuted }]}>TOP ARTIST</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', flex: 1 }} numberOfLines={1}>{stats.topArtist[0]}</Text>
                      <Text style={{ color: colors.tint, fontSize: 14, fontWeight: '700' }}>{stats.topArtist[1]} albums</Text>
                    </View>
                  </View>
                )}

                {/* Top genre */}
                {stats.topGenre && (
                  <View style={[st.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                    <Text style={[st.label, { color: colors.textMuted }]}>TOP GENRE</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{stats.topGenre[0]}</Text>
                      <Text style={{ color: colors.tint, fontSize: 14, fontWeight: '700' }}>{stats.topGenre[1]} albums</Text>
                    </View>
                  </View>
                )}

                {/* Best rated */}
                {stats.bestRated && (
                  <Pressable
                    onPress={() => router.push({ pathname: '/album-detail', params: { id: stats.bestRated!.id, title: stats.bestRated!.title, artist: stats.bestRated!.artist, year: String(stats.bestRated!.year), artworkUrl: stats.bestRated!.artworkUrl ?? '' } } as any)}
                    style={({ pressed }) => [st.card, { backgroundColor: cardBg, borderColor: cardBorder, flexDirection: 'row', gap: 14, alignItems: 'center', opacity: pressed ? 0.7 : 1 }]}>
                    {stats.bestRated.artworkUrl
                      ? <ExpoImage source={{ uri: stats.bestRated.artworkUrl }} style={{ width: 64, height: 64, borderRadius: 8 }} contentFit="cover" />
                      : <View style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: CARD_BG, alignItems: 'center', justifyContent: 'center' }}><FontAwesome name="music" size={24} color={SUBTEXT} /></View>}
                    <View style={{ flex: 1 }}>
                      <Text style={[st.label, { color: colors.textMuted, marginBottom: 6 }]}>BEST RATED</Text>
                      <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>{stats.bestRated.title}</Text>
                      <Text style={{ color: colors.subtext, fontSize: 13 }} numberOfLines={1}>{stats.bestRated.artist}</Text>
                    </View>
                    <Text style={{ color: colors.tint, fontSize: 22, fontWeight: '800' }}>{stats.bestRated.rating}</Text>
                  </Pressable>
                )}

                {/* First album of the month */}
                {stats.firstAlbum && (
                  <Pressable
                    onPress={() => router.push({ pathname: '/album-detail', params: { id: stats.firstAlbum!.id, title: stats.firstAlbum!.title, artist: stats.firstAlbum!.artist, year: String(stats.firstAlbum!.year), artworkUrl: stats.firstAlbum!.artworkUrl ?? '' } } as any)}
                    style={({ pressed }) => [st.card, { backgroundColor: cardBg, borderColor: cardBorder, flexDirection: 'row', gap: 14, alignItems: 'center', opacity: pressed ? 0.7 : 1 }]}>
                    {stats.firstAlbum.artworkUrl
                      ? <ExpoImage source={{ uri: stats.firstAlbum.artworkUrl }} style={{ width: 64, height: 64, borderRadius: 8 }} contentFit="cover" />
                      : <View style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: CARD_BG, alignItems: 'center', justifyContent: 'center' }}><FontAwesome name="music" size={24} color={SUBTEXT} /></View>}
                    <View style={{ flex: 1 }}>
                      <Text style={[st.label, { color: colors.textMuted, marginBottom: 6 }]}>FIRST ALBUM THIS MONTH</Text>
                      <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>{stats.firstAlbum.title}</Text>
                      <Text style={{ color: colors.subtext, fontSize: 13 }} numberOfLines={1}>{stats.firstAlbum.artist}</Text>
                    </View>
                    {stats.firstAlbum.rating > 0 && (
                      <Text style={{ color: colors.tint, fontSize: 22, fontWeight: '800' }}>{stats.firstAlbum.rating}</Text>
                    )}
                  </Pressable>
                )}

                {/* All albums that month */}
                <View style={[st.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                  <Text style={[st.label, { color: colors.textMuted }]}>ALL {monthAlbums.length} ALBUMS</Text>
                  <View style={{ marginTop: 12, gap: 10 }}>
                    {monthAlbums
                      .slice()
                      .sort((a, b) => new Date(b.dateLogged).getTime() - new Date(a.dateLogged).getTime())
                      .map(album => (
                        <Pressable
                          key={album.id + album.dateLogged}
                          onPress={() => router.push({ pathname: '/album-detail', params: { id: album.id, title: album.title, artist: album.artist, year: String(album.year), artworkUrl: album.artworkUrl ?? '' } } as any)}
                          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.7 : 1 })}>
                          {album.artworkUrl
                            ? <ExpoImage source={{ uri: album.artworkUrl }} style={{ width: 44, height: 44, borderRadius: 6 }} contentFit="cover" />
                            : <View style={{ width: 44, height: 44, borderRadius: 6, backgroundColor: CARD_BG }} />}
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>{album.title}</Text>
                            <Text style={{ color: colors.subtext, fontSize: 12 }} numberOfLines={1}>{album.artist}</Text>
                          </View>
                          {album.rating > 0 && (
                            <Text style={{ color: colors.tint, fontSize: 14, fontWeight: '800' }}>{album.rating}</Text>
                          )}
                        </Pressable>
                      ))}
                  </View>
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </>
  );
}

const st = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});
