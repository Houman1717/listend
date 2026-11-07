import { useMemo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import type { LoggedAlbum } from '@/context/AlbumsContext';
import type { FlippedRecord } from '@/context/FlipContext';
import { libraryFinder, artistKey } from '@/lib/albumMatch';
import { effectiveRating } from '@/lib/effectiveRating';
import { primaryGenre } from '@/lib/genres';
import { bestFlipStreak, currentFlipStreak, getStreakTier, STREAK_META, isLightColor, readableTierColor } from '@/lib/flipStreak';
import { StatTile } from '@/components/StatTile';
import { StreakMedal } from '@/components/StreakMedal';

// My Stats' Flip a Record card: how often you follow through on a flip, how
// far the flips have pushed your taste, your streaks, and whether the dice
// pick better than you do.
//
// Everything about the album itself (cover, rating, genre, when it was logged)
// comes from the library entry the flip matches — the flip row only knows the
// pool's spelling. Same loose matcher as the pool-progress counts.

const MIN_RATED_TO_COMPARE = 3;   // rated flips before "vs your picks" means anything
const BEST_FINDS = 8;
const COVER = 76;

const decadeOf = (year: number) => (year > 0 ? `${Math.floor(year / 10) * 10}s` : undefined);

type Seen = { id: string; t: number };
const addSeen = (m: Map<string, Seen[]>, key: string | undefined, seen: Seen) => {
  if (!key) return;
  const list = m.get(key);
  if (list) list.push(seen); else m.set(key, [seen]);
};

type Colors = { tint: string; text: string; subtext: string; muted: string; cardBg: string; cardBorder: string };

export function FlipStatsCard({
  history, albums, isOwn, onAlbumPress, onShowAlbums, onShowArtists, onStartFlipping, colors,
}: {
  history: FlippedRecord[];        // newest first
  albums: LoggedAlbum[];           // the whole library
  isOwn: boolean;                  // "you" vs "they" in the copy
  onAlbumPress: (album: LoggedAlbum) => void;
  onShowAlbums: (title: string, albums: LoggedAlbum[]) => void;
  /** The artists a flip introduced, each with the flipped album that did it. */
  onShowArtists: (artists: LoggedAlbum[]) => void;
  /** Own stats with no flips yet: the button to go and flip one. */
  onStartFlipping?: () => void;
  colors: Colors;
}) {
  const stats = useMemo(() => {
    const logged  = history.filter(r => r.status === 'logged');
    const skipped = history.filter(r => r.status === 'didnt_listen').length;
    const waiting = history.filter(r => r.status === 'pending').length;
    const decided = logged.length + skipped;

    // Flip → the library entry it became (oldest flip first, so "first ever"
    // genres/decades are credited to the flip that actually opened them).
    const find = libraryFinder(albums);
    const flipped: { flip: FlippedRecord; album: LoggedAlbum }[] = [];
    for (const flip of [...logged].reverse()) {
      const album = find({ title: flip.title, artist: flip.artist });
      if (album && !flipped.some(f => f.album.id === album.id)) flipped.push({ flip, album });
    }
    const flippedIds = new Set(flipped.map(f => f.album.id));

    // Did you have anything like this before the flip? Only albums logged
    // before the flip count — the flipped album itself never does. Each map
    // holds every album's log time per artist/genre/decade, oldest first, so
    // the check reads at most two entries instead of scanning the library.
    const byArtist = new Map<string, Seen[]>(), byGenre = new Map<string, Seen[]>(), byDecade = new Map<string, Seen[]>();
    for (const a of albums) {
      const seen = { id: a.id, t: new Date(a.dateLogged).getTime() };
      addSeen(byArtist, artistKey(a.artist), seen);
      addSeen(byGenre, primaryGenre(a), seen);
      addSeen(byDecade, decadeOf(a.year), seen);
    }
    for (const m of [byArtist, byGenre, byDecade]) for (const list of m.values()) list.sort((x, y) => x.t - y.t);
    const hadBefore = (m: Map<string, Seen[]>, key: string, flip: FlippedRecord, self: LoggedAlbum) => {
      const first = (m.get(key) ?? []).find(e => e.id !== self.id);
      return !!first && first.t < flip.flippedAt;
    };

    const newArtists: LoggedAlbum[] = [];
    const newGenres = new Map<string, LoggedAlbum>();
    const newDecades = new Map<string, LoggedAlbum>();
    for (const { flip, album } of flipped) {
      const key = artistKey(album.artist);
      if (key && !hadBefore(byArtist, key, flip, album)) newArtists.push(album);
      const genre = primaryGenre(album);
      if (genre && !newGenres.has(genre) && !hadBefore(byGenre, genre, flip, album)) newGenres.set(genre, album);
      const decade = decadeOf(album.year || flip.year);
      if (decade && !newDecades.has(decade) && !hadBefore(byDecade, decade, flip, album)) newDecades.set(decade, album);
    }

    // Flips vs everything you picked yourself.
    const avg = (rs: number[]) => (rs.length ? rs.reduce((s, r) => s + r, 0) / rs.length : 0);
    const flipRatings  = flipped.map(f => effectiveRating(f.album)).filter(r => r > 0);
    const otherRatings = albums.filter(a => !flippedIds.has(a.id)).map(effectiveRating).filter(r => r > 0);
    const flipAvg  = avg(flipRatings);
    const otherAvg = avg(otherRatings);

    const bestFinds = flipped
      .map(f => f.album)
      .filter(a => effectiveRating(a) > 0)
      .sort((a, b) => effectiveRating(b) - effectiveRating(a))
      .slice(0, BEST_FINDS);

    return {
      logged: logged.length, skipped, waiting, decided,
      followPct: decided > 0 ? Math.round((logged.length / decided) * 100) : 0,
      flippedAlbums: flipped.map(f => f.album).reverse(),   // newest first for lists
      newArtists: newArtists.reverse(),
      newGenres: [...newGenres.entries()],
      newDecades: [...newDecades.entries()].sort((a, b) => a[0].localeCompare(b[0])),
      flipAvg, otherAvg, ratedFlips: flipRatings.length, hasOthers: otherRatings.length > 0,
      bestFinds,
      best: bestFlipStreak(history),
      current: currentFlipStreak(history),
    };
  }, [history, albums]);

  const you = isOwn ? 'You' : 'They';
  const your = isOwn ? 'your' : 'their';

  if (history.length === 0) {
    if (!isOwn) return null;
    return (
      <View style={[s.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
        <Text style={[s.title, { color: colors.muted }]}>FLIP A RECORD</Text>
        <Text style={[s.headline, { color: colors.text }]}>No flips yet</Text>
        <Text style={[s.sub, { color: colors.subtext }]}>
          Flip a record and log it to see how far it takes your taste.
        </Text>
        {onStartFlipping && (
          <Pressable onPress={onStartFlipping} style={({ pressed }) => [s.cta, { backgroundColor: colors.tint, opacity: pressed ? 0.7 : 1 }]}>
            <FontAwesome name="random" size={13} color="#fff" />
            <Text style={s.ctaText}>Flip a record</Text>
          </Pressable>
        )}
      </View>
    );
  }

  const tile = { tint: colors.tint, textColor: colors.text, subtextColor: colors.subtext, bg: colors.cardBg, border: colors.cardBorder };
  const diff = stats.flipAvg - stats.otherAvg;
  const showCompare = stats.ratedFlips >= MIN_RATED_TO_COMPARE && stats.hasOthers;
  const widened = stats.newArtists.length + stats.newGenres.length + stats.newDecades.length > 0;

  return (
    <View style={[s.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
      <View style={s.titleRow}>
        <Text style={[s.title, { color: colors.muted, marginBottom: 0 }]}>FLIP A RECORD</Text>
        <Text style={[s.titleValue, { color: colors.text }]}>{history.length} flipped</Text>
      </View>

      {/* ── Follow-through: logged vs skipped ─────────────────────────────── */}
      {stats.decided > 0 ? (
        <Pressable
          disabled={stats.flippedAlbums.length === 0}
          onPress={() => onShowAlbums('Flipped & logged', stats.flippedAlbums)}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
          <View style={s.pctRow}>
            <Text style={[s.pct, { color: colors.text }]}>{stats.followPct}%</Text>
            <Text style={[s.pctLabel, { color: colors.subtext }]}>
              of {your} flips {isOwn ? 'you' : 'they'} actually logged
            </Text>
          </View>
          <View style={[s.bar, { backgroundColor: colors.cardBorder }]}>
            {stats.logged > 0 && <View style={{ flex: stats.logged, backgroundColor: colors.tint }} />}
            {stats.skipped > 0 && <View style={{ flex: stats.skipped, backgroundColor: colors.subtext, opacity: 0.45 }} />}
          </View>
          <View style={s.legend}>
            <Legend color={colors.tint} label={`${stats.logged} logged`} textColor={colors.subtext} />
            <Legend color={colors.subtext} faded label={`${stats.skipped} skipped`} textColor={colors.subtext} />
            {stats.waiting > 0 && <Legend hollow color={colors.subtext} label={`${stats.waiting} waiting`} textColor={colors.subtext} />}
          </View>
        </Pressable>
      ) : (
        <Text style={[s.sub, { color: colors.subtext }]}>
          {you} haven't decided on a flip yet — log it or skip it to start the count.
        </Text>
      )}

      {/* ── Streaks ───────────────────────────────────────────────────────── */}
      <View style={s.tileRow}>
        <StreakTile streak={stats.best} caption="Best streak" colors={colors} />
        <StreakTile streak={stats.current} caption="Current streak" colors={colors} />
      </View>

      {/* ── How far it's widened your taste ───────────────────────────────── */}
      {widened && (
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>
            {isOwn ? 'Where flipping took you' : 'Where flipping took them'}
          </Text>
          <Text style={[s.sub, { color: colors.subtext }]}>
            New to {your} library — the first album {isOwn ? 'you' : 'they'} logged from each came from a flip.
          </Text>
          <View style={s.tileRow}>
            <StatTile icon="user-plus" value={stats.newArtists.length} label={stats.newArtists.length === 1 ? 'Artist' : 'Artists'} {...tile}
              onPress={stats.newArtists.length > 0 ? () => onShowArtists(stats.newArtists) : undefined} />
            <StatTile icon="tags" value={stats.newGenres.length} label={stats.newGenres.length === 1 ? 'Genre' : 'Genres'} {...tile}
              onPress={stats.newGenres.length > 0 ? () => onShowAlbums('New genres from flips', stats.newGenres.map(([, a]) => a)) : undefined} />
            <StatTile icon="hourglass-half" value={stats.newDecades.length} label={stats.newDecades.length === 1 ? 'Decade' : 'Decades'} {...tile}
              onPress={stats.newDecades.length > 0 ? () => onShowAlbums('New decades from flips', stats.newDecades.map(([, a]) => a)) : undefined} />
          </View>
          {(stats.newGenres.length > 0 || stats.newDecades.length > 0) && (
            <View style={s.chips}>
              {[...stats.newGenres, ...stats.newDecades].map(([label]) => (
                <View key={label} style={[s.chip, { borderColor: colors.cardBorder }]}>
                  <Text style={[s.chipText, { color: colors.text }]} numberOfLines={1}>{label}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* ── Flips vs your own picks ───────────────────────────────────────── */}
      {showCompare && (
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>
            {diff >= 0.3 ? 'The dice pick well'
              : diff <= -0.3 ? (isOwn ? 'You pick better than the dice' : 'They pick better than the dice')
              : 'Flips land right on average'}
          </Text>
          <Text style={[s.sub, { color: colors.subtext }]}>
            Average rating of {your} flips vs everything else {isOwn ? 'you' : 'they'}'ve logged.
          </Text>
          <Meter label="Flips" value={stats.flipAvg} highlight colors={colors} />
          <Meter label={isOwn ? 'Your picks' : 'Their picks'} value={stats.otherAvg} colors={colors} />
        </View>
      )}

      {/* ── Best finds ────────────────────────────────────────────────────── */}
      {stats.bestFinds.length > 0 && (
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>Best finds</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.finds}>
            {stats.bestFinds.map(album => (
              <Pressable key={album.id} onPress={() => onAlbumPress(album)} style={({ pressed }) => ({ width: COVER, opacity: pressed ? 0.7 : 1 })}>
                {album.artworkUrl
                  ? <ExpoImage source={{ uri: album.artworkUrl }} style={s.cover} contentFit="cover" cachePolicy="disk" />
                  : <View style={[s.cover, { backgroundColor: album.coverColor || colors.cardBorder }]} />}
                <View style={[s.rating, { backgroundColor: colors.tint }]}>
                  <Text style={s.ratingText}>{effectiveRating(album)}</Text>
                </View>
                <Text style={[s.findTitle, { color: colors.text }]} numberOfLines={1}>{album.title}</Text>
                <Text style={[s.findArtist, { color: colors.subtext }]} numberOfLines={1}>{album.artist}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// A streak tile: the shared animated medal, the run, its tier and what it is.
function StreakTile({ streak, caption, colors }: { streak: number; caption: string; colors: Colors }) {
  const tier = getStreakTier(streak);
  const meta = STREAK_META[tier];
  const color = tier === 0 ? colors.subtext : readableTierColor(meta.color, isLightColor(colors.cardBg));
  return (
    <View style={[s.streak, { backgroundColor: colors.cardBg, borderColor: tier === 0 ? colors.cardBorder : meta.color + '45' }]}>
      {tier > 0 && (
        <LinearGradient colors={[meta.color + '26', meta.color + '00']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
      )}
      <StreakMedal streak={streak} size={52} dimColor={colors.subtext} />
      <Text style={[s.streakValue, { color: colors.text, marginTop: 6 }]} numberOfLines={1}>
        {streak > 0 ? streak : '—'}
        {streak > 0 ? <Text style={[s.streakUnit, { color: colors.subtext }]}> in a row</Text> : null}
      </Text>
      <Text style={[s.streakTier, { color }]} numberOfLines={1}>{tier > 0 ? meta.label : 'No streak yet'}</Text>
      <Text style={[s.streakCaption, { color: colors.subtext }]} numberOfLines={1}>{caption}</Text>
    </View>
  );
}

function Legend({ color, label, textColor, hollow, faded }: { color: string; label: string; textColor: string; hollow?: boolean; faded?: boolean }) {
  return (
    <View style={s.legendItem}>
      <View style={[s.dot, hollow ? { borderWidth: 1, borderColor: color } : { backgroundColor: color, opacity: faded ? 0.45 : 1 }]} />
      <Text style={[s.legendText, { color: textColor }]}>{label}</Text>
    </View>
  );
}

function Meter({ label, value, highlight, colors }: { label: string; value: number; highlight?: boolean; colors: Colors }) {
  return (
    <View style={s.meterRow}>
      <Text style={[s.meterLabel, { color: highlight ? colors.text : colors.subtext }]}>{label}</Text>
      <View style={[s.meterTrack, { backgroundColor: colors.cardBorder }]}>
        <View style={{ width: `${Math.min(100, value * 10)}%` as `${number}%`, backgroundColor: colors.tint, opacity: highlight ? 1 : 0.45, borderRadius: 4 }} />
      </View>
      <Text style={[s.meterValue, { color: colors.text }]}>{value.toFixed(1)}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card:       { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 18, gap: 14 },
  titleRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title:      { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },
  titleValue: { fontSize: 15, fontWeight: '700' },
  headline:   { fontSize: 17, fontWeight: '700' },
  sub:        { fontSize: 13, lineHeight: 18 },

  pctRow:     { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 10 },
  pct:        { fontSize: 34, fontWeight: '800', letterSpacing: -1 },
  pctLabel:   { fontSize: 14, fontWeight: '500', flexShrink: 1 },
  bar:        { height: 10, borderRadius: 5, overflow: 'hidden', flexDirection: 'row' },
  legend:     { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot:        { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, fontWeight: '500' },

  tileRow:    { flexDirection: 'row', gap: 10 },
  streak:     { flex: 1, borderRadius: 14, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 10, alignItems: 'center', gap: 2, overflow: 'hidden' },
  streakValue:   { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  streakUnit:    { fontSize: 13, fontWeight: '600', letterSpacing: 0 },
  streakTier:    { fontSize: 12, fontWeight: '700' },
  streakCaption: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  section:    { gap: 10, marginTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },

  chips:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:       { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, maxWidth: '100%' },
  chipText:   { fontSize: 12, fontWeight: '600', flexShrink: 1 },

  meterRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  meterLabel: { width: 78, fontSize: 13, fontWeight: '600' },
  meterTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden', flexDirection: 'row' },
  meterValue: { width: 30, textAlign: 'right', fontSize: 14, fontWeight: '700' },

  finds:      { gap: 10 },
  cover:      { width: COVER, height: COVER, borderRadius: 6 },
  rating:     { position: 'absolute', top: 4, right: 4, minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  ratingText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  findTitle:  { fontSize: 12, fontWeight: '600', marginTop: 5 },
  findArtist: { fontSize: 11 },

  cta:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 10, paddingVertical: 11 },
  ctaText:    { color: '#fff', fontSize: 14, fontWeight: '700' },
});
