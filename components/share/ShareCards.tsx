import { View, Text, Image } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import type { LoggedAlbum, TopAlbum, TopArtist, TopSong } from '@/context/AlbumsContext';
import { effectiveRating } from '@/lib/effectiveRating';
import { RATING_LABELS } from '@/components/VolumeRatingPicker';
import VolumeBars from '@/components/VolumeBars';

const APP_ICON = require('@/assets/images/icon.png');
import Colors, { PALETTE } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { usePro } from '@/context/ProContext';
import { getProTheme, themeToColors } from '@/lib/proThemes';

// Shareable image cards (Instagram Story size). Each card is laid out at
// CARD_W x CARD_H points and captured at 1080x1920 by ShareCardSheet, so every
// size here is in "story points" (1pt = 3px in the saved image).
//
// Colours are always passed in (the user's Pro theme, or the default Listend
// palette), never read from the app's light/dark scheme: a card should look
// the same whether it was made at noon or midnight.

export const CARD_W = 360;
export const CARD_H = 640;

export type CardColors = {
  background: string;
  surface: string;
  text: string;
  subtext: string;
  tint: string;
};

/** Free users' cards, and Pro users on the default theme. */
export const DEFAULT_CARD_COLORS: CardColors = {
  background: PALETTE.background,
  surface: PALETTE.surface,
  text: PALETTE.textPrimary,
  subtext: PALETTE.textSecondary,
  tint: PALETTE.accent,
};

/** Your cards look like your app: your Pro theme, else the light or dark Listend look you're using. */
export function useOwnCardColors(): CardColors {
  const { isPro, proTheme } = usePro();
  const scheme = useColorScheme();
  const t = isPro && proTheme && proTheme !== 'default'
    ? themeToColors(getProTheme(proTheme))
    : Colors[scheme ?? 'dark'];
  return { background: t.background, surface: t.surface, text: t.text, subtext: t.subtext, tint: t.tint };
}

/** Apple's CDN serves any {n}x{n}bb; ask for enough pixels for a 3x capture. */
export function coverAt(url: string | undefined, pt: number): string | undefined {
  if (!url) return undefined;
  const n = Math.min(Math.ceil((pt * 3) / 100) * 100, 1200);
  return url
    .replace('{w}', String(n)).replace('{h}', String(n))
    .replace(/\/\d+x\d+bb\.(jpg|png|webp)$/i, `/${n}x${n}bb.$1`)
    .replace(/\/front-(250|500)$/, '/front-1200');
}

/** "Abbey Road (Remastered 2009)" → "Abbey Road": edition noise wastes card space. */
export function cardTitle(title: string): string {
  return title
    .replace(/\s*[([][^)\]]*\b(remaster(ed)?|deluxe|expanded|anniversary|edition|bonus|version)\b[^)\]]*[)\]]/gi, '')
    .replace(/\s+-\s+(\d{4}\s+)?remaster(ed)?.*$/i, '')
    .trim() || title;
}

// ─── Shared pieces ────────────────────────────────────────────────────────────

function Frame({ colors, handle, children, footer }: {
  colors: CardColors; handle: string; children: React.ReactNode; footer?: string;
}) {
  return (
    <View style={{ width: CARD_W, height: CARD_H, backgroundColor: colors.background, padding: 26, paddingTop: 30 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Image source={APP_ICON} style={{ width: 26, height: 26, borderRadius: 6 }} />
        <Text style={{ color: colors.tint, fontSize: 17, fontWeight: '800', letterSpacing: -0.3 }}>Listend</Text>
      </View>
      <View style={{ flex: 1, marginTop: 18 }}>{children}</View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 14 }}>
        <Text style={{ color: colors.subtext, fontSize: 12.5, fontWeight: '600', flexShrink: 1 }} numberOfLines={1}>
          {handle ? `@${handle}` : ''}
        </Text>
        <Text style={{ color: colors.subtext, fontSize: 12.5, fontWeight: '600' }}>{footer ?? 'listend.uk'}</Text>
      </View>
    </View>
  );
}

function Cover({ url, size, colors, radius = 6 }: { url?: string; size: number; colors: CardColors; radius?: number }) {
  const src = coverAt(url, size);
  return (
    <View style={{ width: size, height: size, borderRadius: radius, overflow: 'hidden', backgroundColor: colors.surface }}>
      {src ? <ExpoImage source={{ uri: src }} style={{ width: size, height: size }} contentFit="cover" cachePolicy="memory-disk" transition={0} /> : null}
    </View>
  );
}

function Stat({ value, label, colors, small, inRow = true }: {
  value: string | number; label: string; colors: CardColors; small?: boolean;
  /** flex:1 shares a row; in a column it would collapse the stat to nothing. */
  inRow?: boolean;
}) {
  return (
    <View style={inRow ? { flex: 1, minWidth: 0 } : undefined}>
      <Text style={{ color: colors.text, fontSize: small ? 17 : 30, fontWeight: '800', letterSpacing: -0.5 }} numberOfLines={1}>
        {value}
      </Text>
      <Text style={{ color: colors.subtext, fontSize: 12, marginTop: small ? 3 : 1 }}>{label}</Text>
    </View>
  );
}

// ─── Month / Year in Review ───────────────────────────────────────────────────

export function periodStats(albums: LoggedAlbum[]) {
  const byArtist = new Map<string, number>();
  for (const a of albums) byArtist.set(a.artist, (byArtist.get(a.artist) ?? 0) + 1);
  const topArtist = [...byArtist.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  const rated = albums.filter(a => effectiveRating(a) > 0);
  const avg = rated.length ? rated.reduce((s, a) => s + effectiveRating(a), 0) / rated.length : 0;
  const ms = albums.reduce((s, a) => s + (a.durationMs ?? 0), 0);
  const seen = new Set<string>();
  const best = [...albums]
    .sort((a, b) => effectiveRating(b) - effectiveRating(a)
      || new Date(b.dateLogged).getTime() - new Date(a.dateLogged).getTime())
    .filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true; });
  return {
    count: albums.length,
    artists: byArtist.size,
    topArtist,
    avg: avg ? avg.toFixed(1) : '',
    hours: ms > 0 ? Math.round(ms / 3_600_000) : 0,
    covers: best.filter(a => a.artworkUrl).map(a => a.artworkUrl!),
    topRated: rated.length ? best[0] : null,
  };
}

/**
 * Free users get the teaser (covers, album count, top artist); Pro users get
 * the full card. The free one is still a proper card worth posting: every post
 * is an advert, and the gap between the two is what sells Pro.
 */
export function PeriodCard({ title, albums, full, colors, handle }: {
  /** "My 2026 in music" / "My October". */
  title: string;
  albums: LoggedAlbum[];
  full: boolean;
  colors: CardColors;
  handle: string;
}) {
  const s = periodStats(albums);
  const GAP = 6;
  const cols = 3;
  const tile = (CARD_W - 52 - GAP * (cols - 1)) / cols;
  const covers = s.covers.slice(0, full ? 6 : 9);

  return (
    <Frame colors={colors} handle={handle}>
      <Text style={{ color: colors.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.8, lineHeight: 34 }}>{title}</Text>

      {covers.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP, marginTop: 18 }}>
          {covers.map((u, i) => <Cover key={i} url={u} size={tile} colors={colors} radius={5} />)}
        </View>
      )}

      {full ? (
        <View style={{ marginTop: 20, gap: 16 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Stat value={s.count} label={s.count === 1 ? 'album logged' : 'albums logged'} colors={colors} />
            <Stat value={s.hours ? `${s.hours}h` : '—'} label="listened" colors={colors} />
            <Stat value={s.avg || '—'} label="avg rating" colors={colors} />
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Stat value={s.topArtist || '—'} label="top artist" colors={colors} small />
            <Stat value={s.artists} label="artists" colors={colors} small />
          </View>
          {s.topRated && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <FontAwesome name="trophy" size={14} color={colors.tint} />
              <Text style={{ color: colors.text, fontSize: 13.5, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                {cardTitle(s.topRated.title)}
                <Text style={{ color: colors.subtext, fontWeight: '500' }}>{`  ${effectiveRating(s.topRated)}/10`}</Text>
              </Text>
            </View>
          )}
        </View>
      ) : (
        <View style={{ marginTop: 22, gap: 14 }}>
          <View>
            <Text style={{ color: colors.tint, fontSize: 56, fontWeight: '800', letterSpacing: -2, lineHeight: 60 }}>{s.count}</Text>
            <Text style={{ color: colors.subtext, fontSize: 14 }}>{s.count === 1 ? 'album logged' : 'albums logged'}</Text>
          </View>
          {!!s.topArtist && <Stat value={s.topArtist} label="top artist" colors={colors} small inRow={false} />}
        </View>
      )}
    </Frame>
  );
}

export function periodCardImages(albums: LoggedAlbum[], full: boolean): string[] {
  const tile = (CARD_W - 52 - 12) / 3;
  return periodStats(albums).covers.slice(0, full ? 6 : 9).map(u => coverAt(u, tile)!).filter(Boolean);
}

// ─── Review ───────────────────────────────────────────────────────────────────

export type ReviewCardAlbum = { title: string; artist: string; year?: number; artworkUrl?: string };

const REVIEW_COVER = 236;

export function ReviewCard({ album, rating, review, colors, handle }: {
  album: ReviewCardAlbum; rating: number; review?: string; colors: CardColors; handle: string;
}) {
  const text = (review ?? '').trim();
  return (
    <Frame colors={colors} handle={handle}>
      <View style={{ flex: 1, justifyContent: 'center' }}>
      <View style={{ alignItems: 'center' }}>
        <Cover url={album.artworkUrl} size={REVIEW_COVER} colors={colors} radius={8} />
      </View>
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5, marginTop: 18 }} numberOfLines={2}>
        {cardTitle(album.title)}
      </Text>
      <Text style={{ color: colors.subtext, fontSize: 14, marginTop: 3 }} numberOfLines={1}>
        {album.artist}{album.year ? ` · ${album.year}` : ''}
      </Text>
      {rating > 0 && (
        // The app's signature volume rating, at the size it has in the app:
        // speaker, ten-bar staircase, score, then the rating's name.
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 7, marginTop: 12 }}>
          <FontAwesome name="volume-up" size={14} color={colors.tint} />
          <VolumeBars
            rating={rating}
            activeColor={colors.tint}
            inactiveColor={colors.subtext + '40'}
            heights={[4, 5, 6.5, 8, 9.5, 11, 12.5, 14, 15.5, 17]}
            barWidth={3}
            gap={2}
          />
          <Text style={{ color: colors.tint, fontSize: 17, fontWeight: '800', lineHeight: 18, marginBottom: -1 }}>{rating}</Text>
          <Text style={{ color: colors.subtext, fontSize: 13.5, lineHeight: 18, marginBottom: -1 }}>· {RATING_LABELS[rating] ?? ''}</Text>
        </View>
      )}
      {text.length > 0 && (
        <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22, marginTop: 12, fontStyle: 'italic' }}
          numberOfLines={rating > 0 ? 5 : 7}>
          {`“${text}”`}
        </Text>
      )}
      </View>
    </Frame>
  );
}

export function reviewCardImages(album: ReviewCardAlbum): string[] {
  const u = coverAt(album.artworkUrl, REVIEW_COVER);
  return u ? [u] : [];
}

// ─── Top 5s ───────────────────────────────────────────────────────────────────

export type Top5Mode = 'albums' | 'artists' | 'songs' | 'all';
export const TOP5_MODES: { key: Top5Mode; label: string }[] = [
  { key: 'albums', label: 'Albums' }, { key: 'artists', label: 'Artists' },
  { key: 'songs', label: 'Songs' }, { key: 'all', label: 'All' },
];

type Top5Data = { albums: (TopAlbum | null)[]; artists: (TopArtist | null)[]; songs: (TopSong | null)[] };

const TOP5_COVER = 72;
const ALL_TILE = 54;

const filled = <T,>(xs: (T | null)[]) => xs.filter((x): x is T => !!x).slice(0, 5);

/** Which modes have something in them ('all' needs at least two kinds). */
export function top5ModesFor(d: Top5Data): Top5Mode[] {
  const has = { albums: filled(d.albums).length > 0, artists: filled(d.artists).length > 0, songs: filled(d.songs).length > 0 };
  const modes = TOP5_MODES.map(m => m.key).filter(k => k === 'all'
    ? [has.albums, has.artists, has.songs].filter(Boolean).length >= 2
    : has[k as 'albums' | 'artists' | 'songs']);
  return modes;
}

function RankRow({ n, url, round, title, sub, colors }: {
  n: number; url?: string; round?: boolean; title: string; sub?: string; colors: CardColors;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Text style={{ color: colors.tint, fontSize: 20, fontWeight: '800', width: 18 }}>{n}</Text>
      <Cover url={url} size={TOP5_COVER} colors={colors} radius={round ? TOP5_COVER / 2 : 6} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }} numberOfLines={2}>{title}</Text>
        {!!sub && <Text style={{ color: colors.subtext, fontSize: 13, marginTop: 2 }} numberOfLines={1}>{sub}</Text>}
      </View>
    </View>
  );
}

function SectionLabel({ children, colors }: { children: string; colors: CardColors }) {
  return <Text style={{ color: colors.subtext, fontSize: 11, fontWeight: '800', letterSpacing: 1.6, marginBottom: 8 }}>{children}</Text>;
}

export function Top5Card({ mode, data, colors, handle }: {
  mode: Top5Mode; data: Top5Data; colors: CardColors; handle: string;
}) {
  const albums = filled(data.albums);
  const artists = filled(data.artists);
  const songs = filled(data.songs);
  const heading = mode === 'all' ? 'My top 5s' : `My top 5\n${mode}`;

  return (
    <Frame colors={colors} handle={handle}>
      <Text style={{ color: colors.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.8, lineHeight: 34 }}>{heading}</Text>

      {mode === 'albums' && (
        <View style={{ marginTop: 18, gap: 10 }}>
          {albums.map((a, i) => <RankRow key={a.id} n={i + 1} url={a.artworkUrl} title={cardTitle(a.title)} sub={a.artist} colors={colors} />)}
        </View>
      )}
      {mode === 'artists' && (
        <View style={{ marginTop: 18, gap: 10 }}>
          {artists.map((a, i) => <RankRow key={a.id} n={i + 1} url={a.artworkUrl} round title={a.name} colors={colors} />)}
        </View>
      )}
      {mode === 'songs' && (
        <View style={{ marginTop: 18, gap: 10 }}>
          {songs.map((a, i) => <RankRow key={a.id} n={i + 1} url={a.artworkUrl} title={a.title} sub={a.artist} colors={colors} />)}
        </View>
      )}

      {mode === 'all' && (
        <View style={{ marginTop: 18, gap: 16 }}>
          {albums.length > 0 && (
            <View>
              <SectionLabel colors={colors}>ALBUMS</SectionLabel>
              <View style={{ flexDirection: 'row', gap: 7 }}>
                {albums.map(a => <Cover key={a.id} url={a.artworkUrl} size={ALL_TILE} colors={colors} radius={4} />)}
              </View>
            </View>
          )}
          {artists.length > 0 && (
            <View>
              <SectionLabel colors={colors}>ARTISTS</SectionLabel>
              <View style={{ flexDirection: 'row', gap: 7 }}>
                {artists.map(a => (
                  <View key={a.id} style={{ width: ALL_TILE, alignItems: 'center' }}>
                    <Cover url={a.artworkUrl} size={ALL_TILE} colors={colors} radius={ALL_TILE / 2} />
                    <Text style={{ color: colors.subtext, fontSize: 9.5, marginTop: 4, textAlign: 'center' }} numberOfLines={1}>{a.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          {songs.length > 0 && (
            <View>
              <SectionLabel colors={colors}>SONGS</SectionLabel>
              <View style={{ gap: 7 }}>
                {songs.map((a, i) => (
                  <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                    <Text style={{ color: colors.tint, fontSize: 13, fontWeight: '800', width: 12 }}>{i + 1}</Text>
                    <Cover url={a.artworkUrl} size={26} colors={colors} radius={3} />
                    <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                      {a.title}<Text style={{ color: colors.subtext, fontWeight: '500' }}>{`  ${a.artist}`}</Text>
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      )}
    </Frame>
  );
}

export function top5CardImages(mode: Top5Mode, d: Top5Data): string[] {
  const urls: (string | undefined)[] = [];
  if (mode === 'albums' || mode === 'all') urls.push(...filled(d.albums).map(a => coverAt(a.artworkUrl, mode === 'all' ? ALL_TILE : TOP5_COVER)));
  if (mode === 'artists' || mode === 'all') urls.push(...filled(d.artists).map(a => coverAt(a.artworkUrl, mode === 'all' ? ALL_TILE : TOP5_COVER)));
  if (mode === 'songs') urls.push(...filled(d.songs).map(a => coverAt(a.artworkUrl, TOP5_COVER)));
  if (mode === 'all') urls.push(...filled(d.songs).map(a => coverAt(a.artworkUrl, 26)));
  return urls.filter((u): u is string => !!u);
}

// ─── Flip a Record streak ─────────────────────────────────────────────────────

export function StreakCard({ streak, tierLabel, caption, tierColor, icon, listened, poolSize, colors, handle }: {
  streak: number;
  tierLabel: string;
  caption: string;
  tierColor: string;
  icon: string;
  /** Albums from the Flip pool the user has logged. */
  listened: number;
  poolSize: number;
  colors: CardColors;
  handle: string;
}) {
  return (
    <Frame colors={colors} handle={handle}>
      <Text style={{ color: colors.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.8, lineHeight: 34 }}>
        Flip a{'\n'}Record
      </Text>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{
          width: 150, height: 150, borderRadius: 75, borderWidth: 2, borderColor: tierColor + '66',
          alignItems: 'center', justifyContent: 'center', backgroundColor: tierColor + '18',
        }}>
          <FontAwesome name={icon as any} size={30} color={tierColor} />
          <Text style={{ color: tierColor, fontSize: 46, fontWeight: '800', letterSpacing: -1.5, lineHeight: 50, marginTop: 2 }}>{streak}</Text>
        </View>
        <Text style={{ color: tierColor, fontSize: 24, fontWeight: '800', letterSpacing: -0.5, marginTop: 20 }}>{tierLabel}</Text>
        <Text style={{ color: colors.subtext, fontSize: 14.5, marginTop: 4 }}>{caption}</Text>
        <Text style={{ color: colors.subtext, fontSize: 13, marginTop: 24, textAlign: 'center', lineHeight: 19 }}>
          {streak} {streak === 1 ? 'flip' : 'flips'} in a row
          {poolSize > 0 ? `\n${listened} of ${poolSize} classic albums listened` : ''}
        </Text>
      </View>
    </Frame>
  );
}
