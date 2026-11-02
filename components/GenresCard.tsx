import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import type { LoggedAlbum } from '@/context/AlbumsContext';
import { effectiveRating } from '@/lib/effectiveRating';
import { MAIN_GENRES } from '@/lib/genres';
import { GenreDonut } from '@/components/GenreDonut';
import VolumeBars from '@/components/VolumeBars';

// The "Genres" card on My Stats and Month / Year in Review: Most Listend as a
// donut of the genre mix, Highest Rated as volume meters. Works from whatever
// albums it's given (a library, a month, a year), so all three read the same.

const TOP = 6;

const genreOf = (a: LoggedAlbum) => (a.genreTags ?? []).find(t => MAIN_GENRES.has(t));

export function GenresCard({
  albums,
  onShowAlbums,
  onSeeAll,
  colors,
}: {
  albums: LoggedAlbum[];
  /** Tapping a genre (or "Other"): the albums behind it. */
  onShowAlbums: (title: string, albums: LoggedAlbum[]) => void;
  /** My Stats' ranked list of every genre, for the tab that's open; without it, "See all" isn't shown. */
  onSeeAll?: (view: 'listend' | 'rated') => void;
  colors: { tint: string; text: string; subtext: string; muted: string; cardBg: string; cardBorder: string; toggleBg: string };
}) {
  const [view, setView] = useState<'listend' | 'rated'>('listend');

  const counts = new Map<string, number>();
  const ratings = new Map<string, number[]>();
  for (const a of albums) {
    const g = genreOf(a);
    if (!g) continue;
    counts.set(g, (counts.get(g) ?? 0) + 1);
    const r = effectiveRating(a);
    if (r > 0) ratings.set(g, [...(ratings.get(g) ?? []), r]);
  }
  const listend = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const rated = [...ratings.entries()]
    .map(([g, rs]) => [g, rs.reduce((s, r) => s + r, 0) / rs.length] as [string, number])
    .sort((a, b) => b[1] - a[1]);
  const tagged = listend.reduce((n, [, c]) => n + c, 0);

  const albumsIn = (genre: string, ratedOnly = false) =>
    albums.filter(a => genreOf(a) === genre && (!ratedOnly || effectiveRating(a) > 0));
  const shownGenres = new Set(listend.slice(0, 5).map(([g]) => g));

  return (
    <View style={[s.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
      <View style={s.titleRow}>
        <Text style={[s.title, { color: colors.muted }]}>GENRES</Text>
        <View style={[s.toggle, { backgroundColor: colors.toggleBg }]}>
          {(['listend', 'rated'] as const).map(v => (
            <Pressable key={v} onPress={() => setView(v)} style={[s.toggleBtn, view === v && { backgroundColor: colors.tint }]}>
              <Text style={[s.toggleText, { color: colors.subtext }, view === v && s.toggleTextActive]}>
                {v === 'listend' ? 'Most Listend' : 'Highest Rated'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {view === 'listend' ? (
        listend.length > 0 ? (
          <>
            <GenreDonut
              genres={listend}
              onGenrePress={g => onShowAlbums(g, albumsIn(g))}
              onOtherPress={onSeeAll ? () => onSeeAll('listend') : (() => onShowAlbums('Other genres', albums.filter(a => {
                const g = genreOf(a);
                return !!g && !shownGenres.has(g);
              })))}
              tint={colors.tint}
              textColor={colors.text}
              subtextColor={colors.subtext}
              cardBg={colors.cardBg}
              otherColor={colors.cardBorder}
            />
            {onSeeAll && listend.length > TOP && <SeeAll label={`See all ${listend.length} genres`} tint={colors.tint} onPress={() => onSeeAll('listend')} />}
            <Text style={[s.footnote, { color: colors.subtext }]}>Based on {tagged} of {albums.length} logged albums</Text>
          </>
        ) : (
          <Text style={[s.empty, { color: colors.subtext }]}>No genres to show yet.</Text>
        )
      ) : (
        rated.length > 0 ? (
          <>
            <View style={{ gap: 12, marginTop: 4 }}>
              {rated.slice(0, TOP).map(([genre, avg]) => (
                <Pressable
                  key={genre}
                  onPress={() => onShowAlbums(genre, albumsIn(genre, true))}
                  style={({ pressed }) => [s.ratedRow, { opacity: pressed ? 0.6 : 1 }]}>
                  <Text style={[s.ratedName, { color: colors.text }]} numberOfLines={1}>{genre}</Text>
                  <View style={s.meter}>
                    <FontAwesome name="volume-up" size={11} color={colors.tint} />
                    <VolumeBars rating={Math.round(avg)} activeColor={colors.tint} inactiveColor={colors.cardBorder} />
                  </View>
                  <Text style={[s.ratedAvg, { color: colors.text }]} numberOfLines={1}>{avg >= 9.95 ? '10' : avg.toFixed(1)}</Text>
                </Pressable>
              ))}
            </View>
            {onSeeAll && rated.length > TOP && <SeeAll label={`See all ${rated.length} genres`} tint={colors.tint} onPress={() => onSeeAll('rated')} />}
            <Text style={[s.footnote, { color: colors.subtext }]}>Based on rated albums only</Text>
          </>
        ) : (
          <Text style={[s.empty, { color: colors.subtext }]}>Rate some albums to see the highest rated genres.</Text>
        )
      )}
    </View>
  );
}

function SeeAll({ label, tint, onPress }: { label: string; tint: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={({ pressed }) => [s.seeAll, { opacity: pressed ? 0.6 : 1 }]}>
      <Text style={{ color: tint, fontSize: 14, fontWeight: '700' }}>{label}</Text>
      <FontAwesome name="chevron-right" size={11} color={tint} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  card:             { borderRadius: 14, padding: 18, borderWidth: StyleSheet.hairlineWidth },
  titleRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  title:            { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  toggle:           { flexDirection: 'row', borderRadius: 8, padding: 2 },
  toggleBtn:        { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 7 },
  toggleText:       { fontSize: 13, fontWeight: '600' },
  toggleTextActive: { color: '#0F0A07', fontWeight: '700' },
  ratedRow:         { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ratedName:        { flex: 1, fontSize: 14, fontWeight: '600' },
  meter:            { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ratedAvg:         { minWidth: 36, textAlign: 'right', fontSize: 14, fontWeight: '800' },
  seeAll:           { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, marginTop: 6 },
  footnote:         { fontSize: 12, marginTop: 6 },
  empty:            { fontSize: 13, lineHeight: 19, paddingVertical: 8 },
});
