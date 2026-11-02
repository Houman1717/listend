import type { ComponentProps, ReactNode } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import type { LoggedAlbum } from '@/context/AlbumsContext';
import { effectiveRating } from '@/lib/effectiveRating';
import { MAIN_GENRES } from '@/lib/genres';
import { CoverMosaic, mosaicCovers, MIN_MOSAIC_COVERS } from '@/components/CoverMosaic';
import VolumeBars from '@/components/VolumeBars';

// The Compare tab in My Stats, in the same language as the rest of the stats:
// a cover-mosaic hero, icon rows, covers and artist photos instead of bullet
// lists, and charts that put you and them side by side.

export type CompareColors = {
  text: string; subtext: string; muted: string; tint: string;
  cardBg: string; cardBorder: string; background: string;
};

type Person = { name: string; avatarUrl: string | null };

const THEM_OPACITY = 0.45; // "them" is the tint at this strength, "you" is solid

function Avatar({ person, size, ring }: { person: Person; size: number; ring?: string }) {
  const style = { width: size, height: size, borderRadius: size / 2, borderWidth: ring ? 2 : 0, borderColor: ring };
  return person.avatarUrl
    ? <ExpoImage source={{ uri: person.avatarUrl }} style={style} contentFit="cover" cachePolicy="disk" />
    : (
      <View style={[style, { backgroundColor: '#5a4636', alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: '#f5e6c8', fontSize: size * 0.4, fontWeight: '700' }}>{(person.name.trim()[0] ?? '?').toUpperCase()}</Text>
      </View>
    );
}

function Card({ title, right, children, colors }: { title: string; right?: ReactNode; children: ReactNode; colors: CompareColors }) {
  return (
    <View style={[s.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
      <View style={s.titleRow}>
        <Text style={[s.title, { color: colors.muted }]}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

/** "You ▮  ▮ Them" — for the cards that draw both of you. */
function Legend({ them, colors }: { them: string; colors: CompareColors }) {
  return (
    <View style={s.legend}>
      <View style={[s.swatch, { backgroundColor: colors.tint }]} />
      <Text style={[s.legendText, { color: colors.subtext }]}>You</Text>
      <View style={[s.swatch, { backgroundColor: colors.tint, opacity: THEM_OPACITY, marginLeft: 8 }]} />
      <Text style={[s.legendText, { color: colors.subtext }]} numberOfLines={1}>{them}</Text>
    </View>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

export function CompareHero({
  me, them, compatibility, label, sharedAlbums, sharedArtists, fallbackAlbums, colors,
}: {
  me: Person; them: Person;
  compatibility: number;
  /** "Frequency Matched" etc. */
  label: string;
  sharedAlbums: LoggedAlbum[];
  sharedArtists: number;
  /** Both libraries, for the mosaic when you share too few albums. */
  fallbackAlbums: LoggedAlbum[];
  colors: CompareColors;
}) {
  const shared = mosaicCovers(sharedAlbums);
  const covers = shared.length >= MIN_MOSAIC_COVERS ? shared : mosaicCovers(fallbackAlbums);
  const mosaic = covers.length >= MIN_MOSAIC_COVERS;
  const fg = mosaic ? '#FFFFFF' : colors.tint;
  const fgSub = mosaic ? 'rgba(255,255,255,0.88)' : colors.subtext;

  return (
    <View style={[s.hero, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
      {mosaic && <CoverMosaic covers={covers} dim={0.72} />}
      <View style={s.heroAvatars}>
        <Avatar person={me} size={44} ring={mosaic ? '#FFFFFF' : colors.cardBorder} />
        <View style={{ marginLeft: -12 }}>
          <Avatar person={them} size={44} ring={mosaic ? '#FFFFFF' : colors.cardBorder} />
        </View>
      </View>
      <Text style={[s.heroLabel, { color: mosaic ? 'rgba(255,255,255,0.75)' : colors.muted }]} numberOfLines={1}>
        YOU &amp; {them.name.toUpperCase()}
      </Text>
      <Text style={[s.heroValue, { color: fg }]}>{compatibility}%</Text>
      <Text style={[s.heroCaption, { color: fgSub }]}>{label}</Text>
      <View style={[s.chip, { backgroundColor: mosaic ? 'rgba(255,255,255,0.18)' : colors.cardBorder }]}>
        <Text style={[s.chipText, { color: mosaic ? '#FFFFFF' : colors.subtext }]}>
          {sharedArtists} artist{sharedArtists !== 1 ? 's' : ''} · {sharedAlbums.length} album{sharedAlbums.length !== 1 ? 's' : ''} in common
        </Text>
      </View>
    </View>
  );
}

// ─── Head to head ─────────────────────────────────────────────────────────────

type Num = number | null; // null: not known (yet)
export type HeadToHeadRow = {
  icon: ComponentProps<typeof FontAwesome>['name'];
  label: string;
  mine: string; theirs: string;
  /** For the tug bar; omit for rows that aren't "more is more" (era, peak month). */
  mineN?: Num; theirsN?: Num;
  /** Avg rating: draw volume meters instead of a bar. */
  rating?: boolean;
};

export function HeadToHead({ me, them, rows, colors }: { me: Person; them: Person; rows: HeadToHeadRow[]; colors: CompareColors }) {
  return (
    <Card title="HEAD TO HEAD" colors={colors}>
      <View style={s.hhHeader}>
        <View style={s.hhWho}>
          <Avatar person={me} size={28} />
          <Text style={[s.hhName, { color: colors.tint }]}>You</Text>
        </View>
        <View style={[s.hhWho, { justifyContent: 'flex-end' }]}>
          <Text style={[s.hhName, { color: colors.text }]} numberOfLines={1}>{them.name}</Text>
          <Avatar person={them} size={28} />
        </View>
      </View>

      {rows.map((r, i) => {
        const both = r.mineN != null && r.theirsN != null && (r.mineN + r.theirsN) > 0;
        const mineWins = both && r.mineN! > r.theirsN!;
        const theirsWins = both && r.theirsN! > r.mineN!;
        const share = both ? r.mineN! / (r.mineN! + r.theirsN!) : 0.5;
        return (
          <View key={r.label} style={[s.hhRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.cardBorder }]}>
            <View style={s.hhLine}>
              <Text style={[s.hhValue, { color: mineWins ? colors.tint : colors.text }, !mineWins && both && s.hhValueLose]} numberOfLines={1}>{r.mine}</Text>
              <View style={s.hhLabelWrap}>
                <FontAwesome name={r.icon} size={11} color={colors.subtext} />
                <Text style={[s.hhLabel, { color: colors.subtext }]} numberOfLines={1}>{r.label}</Text>
              </View>
              <Text style={[s.hhValue, { color: colors.text, textAlign: 'right' }, !theirsWins && both && s.hhValueLose]} numberOfLines={1}>{r.theirs}</Text>
            </View>
            {r.rating ? (
              <View style={s.hhMeters}>
                <View style={s.meter}>
                  <FontAwesome name="volume-up" size={10} color={colors.tint} />
                  <VolumeBars rating={Math.round(r.mineN ?? 0)} activeColor={colors.tint} inactiveColor={colors.cardBorder} />
                </View>
                <View style={s.meter}>
                  <FontAwesome name="volume-up" size={10} color={colors.tint} style={{ opacity: THEM_OPACITY }} />
                  <View style={{ opacity: THEM_OPACITY + 0.15 }}>
                    <VolumeBars rating={Math.round(r.theirsN ?? 0)} activeColor={colors.tint} inactiveColor={colors.cardBorder} />
                  </View>
                </View>
              </View>
            ) : both ? (
              <View style={[s.tug, { backgroundColor: colors.cardBorder }]}>
                <View style={{ flex: share, backgroundColor: colors.tint }} />
                <View style={{ width: 2, backgroundColor: colors.cardBg }} />
                <View style={{ flex: 1 - share, backgroundColor: colors.tint, opacity: THEM_OPACITY }} />
              </View>
            ) : null}
          </View>
        );
      })}
    </Card>
  );
}

// ─── In common ────────────────────────────────────────────────────────────────

export function InCommon({
  albums, albumRatings, artists, artistImages, likedArtists, onAlbumPress, onSeeAlbums, onSeeArtists, colors,
}: {
  /** Shared albums, best first. */
  albums: LoggedAlbum[];
  /** Your rating and theirs per album id. */
  albumRatings: Map<string, { mine: number; theirs: number }>;
  /** Shared artist names (display case), most-logged first. */
  artists: string[];
  artistImages: Record<string, string>;
  likedArtists: string[];
  onAlbumPress: (album: LoggedAlbum) => void;
  onSeeAlbums: () => void;
  onSeeArtists: () => void;
  colors: CompareColors;
}) {
  return (
    <Card title="IN COMMON" colors={colors}>
      <SectionHead icon="music" text={`${albums.length} album${albums.length !== 1 ? 's' : ''}`} onSeeAll={albums.length > 0 ? onSeeAlbums : undefined} colors={colors} />
      {albums.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
          {albums.slice(0, 12).map(a => {
            const r = albumRatings.get(a.id);
            return (
              <Pressable key={a.id} onPress={() => onAlbumPress(a)} style={({ pressed }) => [s.coverCard, { opacity: pressed ? 0.7 : 1 }]}>
                {a.artworkUrl
                  ? <ExpoImage source={{ uri: a.artworkUrl }} style={s.cover} contentFit="cover" cachePolicy="disk" />
                  : <View style={[s.cover, { backgroundColor: colors.cardBorder }]} />}
                <Text style={[s.coverTitle, { color: colors.text }]} numberOfLines={1}>{a.title}</Text>
                {r && (r.mine > 0 || r.theirs > 0) ? (
                  <View style={s.pair}>
                    <Text style={[s.pairMine, { color: colors.tint }]}>{r.mine > 0 ? r.mine : '–'}</Text>
                    <Text style={[s.pairVs, { color: colors.subtext }]}>vs</Text>
                    <Text style={[s.pairTheirs, { color: colors.subtext }]}>{r.theirs > 0 ? r.theirs : '–'}</Text>
                  </View>
                ) : (
                  <Text style={[s.coverSub, { color: colors.subtext }]} numberOfLines={1}>{a.artist}</Text>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <Text style={[s.empty, { color: colors.subtext }]}>No albums in common yet.</Text>
      )}

      <View style={[s.divider, { backgroundColor: colors.cardBorder }]} />

      <SectionHead icon="users" text={`${artists.length} artist${artists.length !== 1 ? 's' : ''}`} onSeeAll={artists.length > 0 ? onSeeArtists : undefined} colors={colors} />
      {artists.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
          {artists.slice(0, 12).map(name => (
            <View key={name} style={s.artistCard}>
              {artistImages[name]
                ? <ExpoImage source={{ uri: artistImages[name] }} style={s.artistPhoto} contentFit="cover" cachePolicy="disk" />
                : (
                  <View style={[s.artistPhoto, { backgroundColor: colors.cardBorder, alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ color: colors.subtext, fontSize: 20, fontWeight: '700' }}>{name.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
              <Text style={[s.artistName, { color: colors.text }]} numberOfLines={1}>{name}</Text>
            </View>
          ))}
        </ScrollView>
      ) : (
        <Text style={[s.empty, { color: colors.subtext }]}>No artists in common yet.</Text>
      )}

      {likedArtists.length > 0 && (
        <View style={[s.liked, { backgroundColor: colors.background }]}>
          <FontAwesome name="heart" size={12} color={colors.tint} />
          <Text style={[s.likedText, { color: colors.subtext }]} numberOfLines={2}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>You both liked </Text>
            {likedArtists.slice(0, 4).join(', ')}{likedArtists.length > 4 ? ` +${likedArtists.length - 4} more` : ''}
          </Text>
        </View>
      )}
    </Card>
  );
}

function SectionHead({ icon, text, onSeeAll, colors }: {
  icon: ComponentProps<typeof FontAwesome>['name']; text: string; onSeeAll?: () => void; colors: CompareColors;
}) {
  return (
    <View style={s.sectionHead}>
      <View style={[s.iconDot, { overflow: 'hidden' }]}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.tint, opacity: 0.14 }]} />
        <FontAwesome name={icon} size={12} color={colors.tint} />
      </View>
      <Text style={[s.sectionText, { color: colors.text }]}>{text}</Text>
      {onSeeAll && (
        <Pressable onPress={onSeeAll} hitSlop={8} style={({ pressed }) => [s.seeAll, { opacity: pressed ? 0.6 : 1 }]}>
          <Text style={{ color: colors.tint, fontSize: 13, fontWeight: '700' }}>See all</Text>
          <FontAwesome name="chevron-right" size={10} color={colors.tint} />
        </Pressable>
      )}
    </View>
  );
}

// ─── Top 5 overlap ────────────────────────────────────────────────────────────

type Top5Album = { id: string; title: string; artworkUrl?: string };
type Top5Artist = { id: string; name: string; artworkUrl?: string };

export function Top5Overlap({ theirName, albums, artists, sharedAlbumIds, sharedArtistIds, colors }: {
  theirName: string;
  albums: Top5Album[];
  artists: Top5Artist[];
  sharedAlbumIds: Set<string>;
  sharedArtistIds: Set<string>;
  colors: CompareColors;
}) {
  const nA = albums.filter(a => sharedAlbumIds.has(a.id)).length;
  const nB = artists.filter(a => sharedArtistIds.has(a.id)).length;
  const parts = [nA > 0 && `${nA} album${nA !== 1 ? 's' : ''}`, nB > 0 && `${nB} artist${nB !== 1 ? 's' : ''}`].filter(Boolean);
  const headline = parts.length > 0 ? `${parts.join(' and ')} in both your Top 5s` : 'No overlap in your Top 5s';

  return (
    <Card title="TOP 5 OVERLAP" colors={colors}>
      <Text style={[s.headline, { color: colors.text }]}>{headline}</Text>
      <Text style={[s.sub, { color: colors.subtext }]}>{theirName}'s Top 5 — gold means it's in yours too</Text>
      {albums.length > 0 && (
        <View style={s.top5Row}>
          {albums.map(a => {
            const shared = sharedAlbumIds.has(a.id);
            return (
              <View key={a.id} style={[s.top5Cover, { borderColor: shared ? colors.tint : 'transparent', opacity: shared ? 1 : 0.45 }]}>
                {a.artworkUrl
                  ? <ExpoImage source={{ uri: a.artworkUrl }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" />
                  : <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.cardBorder }]} />}
              </View>
            );
          })}
        </View>
      )}
      {artists.length > 0 && (
        <View style={s.top5Row}>
          {artists.map(a => {
            const shared = sharedArtistIds.has(a.id);
            return (
              <View key={a.id} style={[s.top5Artist, { borderColor: shared ? colors.tint : 'transparent', opacity: shared ? 1 : 0.45 }]}>
                {a.artworkUrl
                  ? <ExpoImage source={{ uri: a.artworkUrl }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" />
                  : <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.cardBorder }]} />}
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
}

// ─── Rating breakdown, side by side ───────────────────────────────────────────

const RC_H = 110;

export function RatingCompare({ mine, theirs, theirName, colors }: {
  mine: LoggedAlbum[]; theirs: LoggedAlbum[]; theirName: string; colors: CompareColors;
}) {
  const dist = (albums: LoggedAlbum[]) => {
    const rated = albums.map(effectiveRating).filter(r => r > 0);
    const counts = Array.from({ length: 10 }, (_, i) => rated.filter(r => r === i + 1).length);
    const avg = rated.length > 0 ? rated.reduce((n, r) => n + r, 0) / rated.length : null;
    // Shares, not counts: libraries differ in size, the shape is what compares.
    return { share: counts.map(c => (rated.length > 0 ? c / rated.length : 0)), avg };
  };
  const a = dist(mine);
  const b = dist(theirs);
  if (a.avg === null || b.avg === null) return null;
  const max = Math.max(...a.share, ...b.share, 0.01);
  const diff = a.avg - b.avg;
  const headline = Math.abs(diff) < 0.15
    ? 'You both rate about the same'
    : diff > 0 ? `You rate ${diff.toFixed(1)} higher on average` : `You rate ${(-diff).toFixed(1)} lower on average`;

  return (
    <Card title="RATING BREAKDOWN" right={<Legend them={theirName} colors={colors} />} colors={colors}>
      <Text style={[s.headline, { color: colors.text }]}>{headline}</Text>
      <Text style={[s.sub, { color: colors.subtext }]}>{a.avg.toFixed(1)} vs {b.avg.toFixed(1)} · share of each library at every rating</Text>
      <View style={s.rcChart}>
        {a.share.map((v, i) => (
          <View key={i} style={s.rcCol}>
            <View style={[s.rcBar, { height: v > 0 ? Math.max((v / max) * RC_H, 3) : 0, backgroundColor: colors.tint }]} />
            <View style={[s.rcBar, { height: b.share[i] > 0 ? Math.max((b.share[i] / max) * RC_H, 3) : 0, backgroundColor: colors.tint, opacity: THEM_OPACITY }]} />
          </View>
        ))}
      </View>
      <View style={s.rcAxis}>
        {a.share.map((_, i) => <Text key={i} style={[s.rcLabel, { color: colors.subtext }]}>{i + 1}</Text>)}
      </View>
    </Card>
  );
}

// ─── Genres, mirrored ─────────────────────────────────────────────────────────

export function GenreCompare({ mine, theirs, theirName, colors }: {
  mine: LoggedAlbum[]; theirs: LoggedAlbum[]; theirName: string; colors: CompareColors;
}) {
  const shares = (albums: LoggedAlbum[]) => {
    const m = new Map<string, number>();
    let n = 0;
    for (const al of albums) {
      const g = (al.genreTags ?? []).find(t => MAIN_GENRES.has(t));
      if (!g) continue;
      m.set(g, (m.get(g) ?? 0) + 1);
      n++;
    }
    return { m, n };
  };
  const a = shares(mine);
  const b = shares(theirs);
  if (a.n === 0 || b.n === 0) return null;
  const pa = (g: string) => (a.m.get(g) ?? 0) / a.n;
  const pb = (g: string) => (b.m.get(g) ?? 0) / b.n;
  const genres = [...new Set([...a.m.keys(), ...b.m.keys()])]
    .sort((x, y) => (pa(y) + pb(y)) - (pa(x) + pb(x)))
    .slice(0, 7);
  const max = Math.max(...genres.map(g => Math.max(pa(g), pb(g))), 0.01);
  const topA = [...a.m.entries()].sort((x, y) => y[1] - x[1])[0][0];
  const topB = [...b.m.entries()].sort((x, y) => y[1] - x[1])[0][0];
  const headline = topA === topB ? `You both live in ${topA}` : `You lean ${topA}, they lean ${topB}`;

  return (
    <Card title="GENRES" right={<Legend them={theirName} colors={colors} />} colors={colors}>
      <Text style={[s.headline, { color: colors.text, marginBottom: 12 }]}>{headline}</Text>
      <View style={{ gap: 9 }}>
        {genres.map(g => (
          <View key={g} style={s.gRow}>
            <Text style={[s.gPct, { color: colors.tint }]}>{Math.round(pa(g) * 100)}%</Text>
            <View style={[s.gSide, { justifyContent: 'flex-end' }]}>
              <View style={[s.gBar, { width: `${(pa(g) / max) * 100}%`, backgroundColor: colors.tint, borderTopLeftRadius: 4, borderBottomLeftRadius: 4 }]} />
            </View>
            <Text style={[s.gName, { color: colors.text }]} numberOfLines={1}>{g}</Text>
            <View style={s.gSide}>
              <View style={[s.gBar, { width: `${(pb(g) / max) * 100}%`, backgroundColor: colors.tint, opacity: THEM_OPACITY, borderTopRightRadius: 4, borderBottomRightRadius: 4 }]} />
            </View>
            <Text style={[s.gPct, { color: colors.subtext, textAlign: 'right' }]}>{Math.round(pb(g) * 100)}%</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  card:        { borderRadius: 14, padding: 18, borderWidth: StyleSheet.hairlineWidth },
  titleRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 10 },
  title:       { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  headline:    { fontSize: 16, fontWeight: '700' },
  sub:         { fontSize: 12, fontWeight: '500', marginTop: 2, marginBottom: 12 },
  legend:      { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  swatch:      { width: 9, height: 9, borderRadius: 2 },
  legendText:  { fontSize: 11, fontWeight: '600', flexShrink: 1 },

  hero:        { height: 220, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  heroAvatars: { flexDirection: 'row', marginBottom: 8 },
  heroLabel:   { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, paddingHorizontal: 20 },
  heroValue:   { fontSize: 64, fontWeight: '800', letterSpacing: -2.5, lineHeight: 72 },
  heroCaption: { fontSize: 15, fontWeight: '700' },
  chip:        { marginTop: 8, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  chipText:    { fontSize: 12, fontWeight: '600' },

  hhHeader:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  hhWho:       { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  hhName:      { fontSize: 14, fontWeight: '800', flexShrink: 1 },
  hhRow:       { paddingVertical: 11, gap: 7 },
  hhLine:      { flexDirection: 'row', alignItems: 'center' },
  hhValue:     { width: 86, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  hhValueLose: { fontWeight: '600', opacity: 0.7 },
  hhLabelWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  hhLabel:     { fontSize: 12, fontWeight: '600' },
  hhMeters:    { flexDirection: 'row', justifyContent: 'space-between' },
  meter:       { flexDirection: 'row', alignItems: 'flex-end', gap: 5 },
  tug:         { height: 6, borderRadius: 3, overflow: 'hidden', flexDirection: 'row' },

  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  iconDot:     { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sectionText: { flex: 1, fontSize: 15, fontWeight: '700' },
  seeAll:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  row:         { gap: 12 },
  coverCard:   { width: 84, gap: 3 },
  cover:       { width: 84, height: 84, borderRadius: 6 },
  coverTitle:  { fontSize: 12, fontWeight: '600', marginTop: 2 },
  coverSub:    { fontSize: 11 },
  pair:        { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  pairMine:    { fontSize: 12, fontWeight: '800' },
  pairVs:      { fontSize: 10, fontWeight: '600' },
  pairTheirs:  { fontSize: 12, fontWeight: '700' },
  artistCard:  { width: 72, alignItems: 'center', gap: 5 },
  artistPhoto: { width: 60, height: 60, borderRadius: 30 },
  artistName:  { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  divider:     { height: StyleSheet.hairlineWidth, marginVertical: 16 },
  empty:       { fontSize: 13, paddingVertical: 6 },
  liked:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, padding: 10, borderRadius: 10 },
  likedText:   { flex: 1, fontSize: 12, lineHeight: 17 },

  top5Row:     { flexDirection: 'row', gap: 8, marginTop: 4 },
  top5Cover:   { flex: 1, aspectRatio: 1, borderRadius: 6, borderWidth: 2, overflow: 'hidden' },
  top5Artist:  { flex: 1, aspectRatio: 1, borderRadius: 999, borderWidth: 2, overflow: 'hidden', marginTop: 6 },

  rcChart:     { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: RC_H },
  rcCol:       { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  rcBar:       { flex: 1, borderRadius: 3 },
  rcAxis:      { flexDirection: 'row', gap: 6, marginTop: 6 },
  rcLabel:     { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700' },

  gRow:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  gPct:        { width: 32, fontSize: 11, fontWeight: '700' },
  gSide:       { flex: 1, flexDirection: 'row' },
  gBar:        { height: 10 },
  gName:       { width: 104, fontSize: 12, fontWeight: '600', textAlign: 'center' },
});
