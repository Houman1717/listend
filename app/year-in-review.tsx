import { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Pressable,
  ActivityIndicator, FlatList,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
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

const MAIN_GENRES = new Set([
  'Hip-Hop / Rap', 'Pop', 'Rock', 'Latin', 'Afrobeats',
  'R&B / Soul', 'Electronic', 'Indie / Alternative', 'Metal',
  'Country', 'Jazz', 'Classical', 'Folk / Singer-Songwriter', 'Blues',
]);

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function computeYearStats(albums: LoggedAlbum[]) {
  const rated      = albums.filter(a => a.rating > 0);
  const avgRating  = rated.length > 0
    ? (rated.reduce((s, a) => s + a.rating, 0) / rated.length).toFixed(1) : '—';
  const totalMs    = albums.reduce((s, a) => s + (a.durationMs ?? 0), 0);
  const hours      = totalMs > 0 ? Math.round(totalMs / 3_600_000) : 0;
  const artists    = new Set(albums.map(a => a.artist));

  // Top artist
  const artistCounts = new Map<string, number>();
  for (const a of albums) artistCounts.set(a.artist, (artistCounts.get(a.artist) ?? 0) + 1);
  const topArtist = [...artistCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  // Top genre
  const genreCounts = new Map<string, number>();
  for (const a of albums) {
    const g = (a.genreTags ?? []).find(t => MAIN_GENRES.has(t));
    if (g) genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
  }
  const topGenre = [...genreCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  // Best rated
  const bestRated = [...rated].sort((a, b) => b.rating - a.rating)[0] ?? null;

  // Most active month
  const monthCounts = new Map<number, number>();
  for (const a of albums) monthCounts.set(new Date(a.dateLogged).getMonth(), (monthCounts.get(new Date(a.dateLogged).getMonth()) ?? 0) + 1);
  const topMonth = [...monthCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  // First album
  const sorted    = [...albums].sort((a, b) => new Date(a.dateLogged).getTime() - new Date(b.dateLogged).getTime());
  const firstAlbum = sorted[0] ?? null;

  // Avg era
  const years = albums.map(a => a.year).filter(y => y > 1900);
  const avgEra = years.length > 0 ? Math.round(years.reduce((s, y) => s + y, 0) / years.length) : null;

  return { avgRating, hours, artistCount: artists.size, topArtist, topGenre, bestRated, topMonth, firstAlbum, avgEra, ratedCount: rated.length };
}

export default function YearInReviewScreen() {
  const colorScheme = useColorScheme();
  const { isPro, proTheme } = usePro();
  const activeThemeKey = isPro ? proTheme : 'default';
  const colors = (activeThemeKey && activeThemeKey !== 'default')
    ? themeToColors(getProTheme(activeThemeKey))
    : Colors[colorScheme ?? 'dark'];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { loggedAlbums } = useAlbums();

  // Build list of years that have data
  const years = [...new Set(loggedAlbums.map(a => new Date(a.dateLogged).getFullYear()))]
    .filter(y => y > 2000)
    .sort((a, b) => b - a);

  const [selectedYear, setSelectedYear] = useState<number>(years[0] ?? new Date().getFullYear());

  const yearAlbums = loggedAlbums.filter(a => new Date(a.dateLogged).getFullYear() === selectedYear);
  const stats      = computeYearStats(yearAlbums);

  // All-time avg for comparison
  const allRated   = loggedAlbums.filter(a => a.rating > 0);
  const allTimeAvg = allRated.length > 0
    ? (allRated.reduce((s, a) => s + a.rating, 0) / allRated.length).toFixed(1) : null;

  const cardBg     = colors.surface;
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
        title: 'Year in Review',
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }} />

      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 48, gap: 16 }}
        showsVerticalScrollIndicator={false}>

        {/* Year picker */}
        {years.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <Text style={{ color: colors.subtext, fontSize: 15 }}>No listening history yet.</Text>
          </View>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              {years.map(y => (
                <Pressable
                  key={y}
                  onPress={() => setSelectedYear(y)}
                  style={{
                    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20,
                    backgroundColor: selectedYear === y ? colors.tint : cardBg,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: selectedYear === y ? colors.tint : cardBorder,
                  }}>
                  <Text style={{ color: selectedYear === y ? '#fff' : colors.subtext, fontSize: 15, fontWeight: '700' }}>{y}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {yearAlbums.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Text style={{ color: colors.subtext, fontSize: 15 }}>No albums logged in {selectedYear}.</Text>
              </View>
            ) : (
              <>
                {/* Hero number */}
                <View style={[st.card, { backgroundColor: cardBg, borderColor: cardBorder, alignItems: 'center', gap: 6 }]}>
                  <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' }}>{selectedYear}</Text>
                  <Text style={{ color: colors.tint, fontSize: 64, fontWeight: '800', letterSpacing: -3 }}>{yearAlbums.length}</Text>
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
                    <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: cardBorder }} />
                    <StatCell label="Avg Era" value={stats.avgEra ?? '—'} />
                  </View>
                </View>

                {/* Avg rating vs all-time */}
                {allTimeAvg && stats.avgRating !== '—' && (
                  <View style={[st.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                    <Text style={[st.label, { color: colors.textMuted }]}>RATING VS ALL-TIME</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginTop: 8 }}>
                      <View style={{ alignItems: 'center', gap: 4 }}>
                        <Text style={{ color: colors.tint, fontSize: 28, fontWeight: '800' }}>{stats.avgRating}</Text>
                        <Text style={{ color: colors.subtext, fontSize: 12 }}>{selectedYear} avg</Text>
                      </View>
                      <View style={{ alignItems: 'center', gap: 4 }}>
                        {(() => {
                          const diff = (parseFloat(stats.avgRating) - parseFloat(allTimeAvg)).toFixed(1);
                          const isUp = parseFloat(diff) > 0;
                          const isEq = parseFloat(diff) === 0;
                          return (
                            <>
                              <Text style={{ color: isEq ? colors.subtext : isUp ? '#a8c44a' : '#B85040', fontSize: 22, fontWeight: '800' }}>
                                {isEq ? '=' : isUp ? `+${diff}` : diff}
                              </Text>
                              <Text style={{ color: colors.subtext, fontSize: 12 }}>vs all-time</Text>
                            </>
                          );
                        })()}
                      </View>
                      <View style={{ alignItems: 'center', gap: 4 }}>
                        <Text style={{ color: colors.subtext, fontSize: 28, fontWeight: '800' }}>{allTimeAvg}</Text>
                        <Text style={{ color: colors.subtext, fontSize: 12 }}>all-time avg</Text>
                      </View>
                    </View>
                  </View>
                )}

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

                {/* Best rated album */}
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

                {/* Most active month */}
                {stats.topMonth && (
                  <View style={[st.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                    <Text style={[st.label, { color: colors.textMuted }]}>MOST ACTIVE MONTH</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{MONTH_NAMES[stats.topMonth[0]]}</Text>
                      <Text style={{ color: colors.tint, fontSize: 14, fontWeight: '700' }}>{stats.topMonth[1]} albums</Text>
                    </View>
                  </View>
                )}

                {/* First album of the year */}
                {stats.firstAlbum && (
                  <Pressable
                    onPress={() => router.push({ pathname: '/album-detail', params: { id: stats.firstAlbum!.id, title: stats.firstAlbum!.title, artist: stats.firstAlbum!.artist, year: String(stats.firstAlbum!.year), artworkUrl: stats.firstAlbum!.artworkUrl ?? '' } } as any)}
                    style={({ pressed }) => [st.card, { backgroundColor: cardBg, borderColor: cardBorder, flexDirection: 'row', gap: 14, alignItems: 'center', opacity: pressed ? 0.7 : 1 }]}>
                    {stats.firstAlbum.artworkUrl
                      ? <ExpoImage source={{ uri: stats.firstAlbum.artworkUrl }} style={{ width: 64, height: 64, borderRadius: 8 }} contentFit="cover" />
                      : <View style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: CARD_BG, alignItems: 'center', justifyContent: 'center' }}><FontAwesome name="music" size={24} color={SUBTEXT} /></View>}
                    <View style={{ flex: 1 }}>
                      <Text style={[st.label, { color: colors.textMuted, marginBottom: 6 }]}>FIRST ALBUM OF {selectedYear}</Text>
                      <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>{stats.firstAlbum.title}</Text>
                      <Text style={{ color: colors.subtext, fontSize: 13 }} numberOfLines={1}>{stats.firstAlbum.artist}</Text>
                    </View>
                    {stats.firstAlbum.rating > 0 && (
                      <Text style={{ color: colors.tint, fontSize: 22, fontWeight: '800' }}>{stats.firstAlbum.rating}</Text>
                    )}
                  </Pressable>
                )}

                {/* Monthly breakdown */}
                <View style={[st.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                  <Text style={[st.label, { color: colors.textMuted }]}>MONTHLY BREAKDOWN</Text>
                  <View style={{ marginTop: 12, gap: 8 }}>
                    {MONTH_NAMES.map((name, i) => {
                      const count = yearAlbums.filter(a => new Date(a.dateLogged).getMonth() === i).length;
                      const maxCount = Math.max(...MONTH_NAMES.map((_, mi) => yearAlbums.filter(a => new Date(a.dateLogged).getMonth() === mi).length), 1);
                      if (count === 0) return null;
                      return (
                        <Pressable
                          key={name}
                          onPress={() => router.push({ pathname: '/month-in-review', params: { year: selectedYear, month: i } } as any)}
                          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, opacity: pressed ? 0.7 : 1 })}>
                          <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: '600', width: 32 }}>{name.slice(0, 3)}</Text>
                          <View style={{ flex: 1, height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' }}>
                            <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.tint, width: `${(count / maxCount) * 100}%` }} />
                          </View>
                          <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700', width: 24, textAlign: 'right' }}>{count}</Text>
                          <FontAwesome name="chevron-right" size={10} color={colors.subtext} />
                        </Pressable>
                      );
                    })}
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
