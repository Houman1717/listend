import { StyleSheet, View, Text, ScrollView, Pressable, Modal, FlatList, useWindowDimensions, TextInput, ActivityIndicator, Platform, KeyboardAvoidingView, Keyboard, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { useState, useEffect, useMemo, useRef } from 'react';
import { effectiveRating } from '@/lib/effectiveRating';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { VOLUME_EMPTY_DARK, VOLUME_EMPTY_LIGHT } from '@/constants/Colors';
import VolumeBars from '@/components/VolumeBars';
import { usePro } from '@/context/ProContext';
import { getProTheme, themeToColors } from '@/lib/proThemes';
import { ProBadge } from '@/components/ProBadge';
import { useAlbums, LoggedAlbum } from '@/context/AlbumsContext';
import { supabase } from '@/lib/supabase';
import { fetchAllRows } from '@/lib/supabaseQuery';
import { fetchAlbumDurations } from '@/lib/albumDurations';
import { fetchMembers, rankMembers, memberQuery, type MemberRow } from '@/lib/memberSearch';
import { handleText, nameOrHandle } from '@/lib/userHandle';
import { cardWidth as calcCardWidth, GAP, COLS, PADDING } from '@/components/AlbumGridCard';
import { FLIP_POOL } from '@/constants/FlipPool';
import { useFlip, poolLoggedIds } from '@/context/FlipContext';
import { libraryMatcher } from '@/lib/albumMatch';
import { LinearGradient } from 'expo-linear-gradient';
import { MAIN_GENRES } from '@/lib/genres';
import { StatsMilestones } from '@/components/StatsMilestones';
import { SongStatsCard } from '@/components/SongStatsCard';
import { ReleaseYearChart } from '@/components/ReleaseYearChart';
import { ReviewHero } from '@/components/ReviewHero';
import { StatTile } from '@/components/StatTile';
import { GenresCard } from '@/components/GenresCard';
import { RatingChart } from '@/components/RatingChart';
import { CompareHero, HeadToHead, InCommon, RatingCompare, GenreCompare, Top5Overlap } from '@/components/CompareCards';
import { UnlockCard } from '@/components/ProLockedSection';
import { openSongPage } from '@/lib/openSong';
import { useAndroidKeyboardHeight } from '@/hooks/useAndroidKeyboardHeight';

// Album titles per `.in('title', …)` request for community averages — keeps URLs short.
const COMMUNITY_TITLE_CHUNK = 80;

// Previews on the stats cards; "See all" opens the full ranking.
const STATS_GRID_ARTISTS = 9;
const STATS_TOP_GENRES   = 6;

// Artists vs Community: an album counts once it has this many community
// ratings (same floor as the artist-detail Artist Rating), an artist needs this
// many such albums, and shows once your average differs by at least MIN_DIFF.
const ARTIST_COMP_MIN_ALBUM_RATINGS = 5;
const ARTIST_COMP_MIN_ALBUMS        = 2;
const ARTIST_COMP_MIN_DIFF          = 0.5;
// Albums the duration endpoint can answer for: Apple Music (numeric) or the
// manual catalog (lst-). Legacy Spotify ids never resolve — don't wait on them.
const hasLookupableId = (id: string) => /^\d+$/.test(id) || id.startsWith('lst-');
const HOURS_WAIT_MS = 5000;

type ComparePerson = { id: string; displayName: string; username: string; avatarUrl: string | null; isPro: boolean };
type ArtistCompEntry = { artist: string; mine: number; community: number; delta: number; albums: LoggedAlbum[] };



const CARD_BG  = '#2E2018';
const BORDER   = '#2a1e14';
const TEXT     = '#f5e6c8';
const SUBTEXT  = '#A08060';
const ACCENT   = '#D4A017';

const TAG_COLORS  = ['#7a5018', '#8B6914', '#5c3a10', '#6B4422', '#9a7020', '#4a3218'];
const GROW_CLR    = '#a8c44a';
const FADE_CLR    = '#B85040';

type EvolutionEntry = {
  album:        LoggedAlbum;
  firstRating:  number;
  latestRating: number;
  delta:        number;
};

function EvolutionCard({ entry, onPress, textColor = TEXT, subtextColor = SUBTEXT, surfaceColor = CARD_BG }: {
  entry: EvolutionEntry; onPress: () => void;
  textColor?: string; subtextColor?: string; surfaceColor?: string;
}) {
  const { album, firstRating, latestRating, delta } = entry;
  const isGrow     = delta > 0;
  const deltaColor = isGrow ? GROW_CLR : FADE_CLR;
  const sign       = isGrow ? '+' : '';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [ev.card, { opacity: pressed ? 0.75 : 1 }]}>
      {album.artworkUrl ? (
        <ExpoImage source={{ uri: album.artworkUrl }} style={ev.art} contentFit="cover" cachePolicy="disk" />
      ) : (
        <View style={[ev.art, { backgroundColor: surfaceColor, alignItems: 'center', justifyContent: 'center' }]}>
          <FontAwesome name="music" size={22} color={subtextColor} />
        </View>
      )}
      <View style={[ev.badge, { backgroundColor: deltaColor }]}>
        <Text style={ev.badgeText}>{sign}{delta}</Text>
      </View>
      <Text style={[ev.title, { color: textColor }]} numberOfLines={2}>{album.title}</Text>
      <View style={ev.ratingRow}>
        <Text style={[ev.ratingOld, { color: subtextColor }]}>{firstRating}</Text>
        <FontAwesome name={isGrow ? 'arrow-up' : 'arrow-down'} size={10} color={deltaColor} />
        <Text style={[ev.ratingNew, { color: deltaColor }]}>{latestRating}</Text>
      </View>
    </Pressable>
  );
}

const ev = StyleSheet.create({
  card:      { width: 110, gap: 6 },
  art:       { width: 110, height: 110, borderRadius: 10 },
  badge:     { position: 'absolute', top: 8, right: 8, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  title:     { color: TEXT,    fontSize: 12, fontWeight: '600', lineHeight: 16 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ratingOld: { color: SUBTEXT, fontSize: 12, fontWeight: '600' },
  ratingNew: { fontSize: 12, fontWeight: '700' },
});

function VolumeBadge({ rating, tint = ACCENT, isDark = true }: { rating: number; tint?: string; isDark?: boolean }) {
  const inactive = isDark ? VOLUME_EMPTY_DARK : VOLUME_EMPTY_LIGHT;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <FontAwesome name="volume-up" size={9} color={tint} />
      <VolumeBars rating={rating} activeColor={tint} inactiveColor={inactive} />
      <Text style={{ color: tint, fontSize: 10, fontWeight: '700' }}>{rating}</Text>
    </View>
  );
}

// ─── Album List Modal (reused for rating drilldown + year drilldown) ──────────

type ModalColors = {
  background: string; surface: string; text: string;
  subtext: string; tint: string; border: string;
  isDark?: boolean;
};

function AlbumListModal({
  title,
  albums,
  onClose,
  onAlbumPress,
  onTitlePress,
  themeColors,
}: {
  title: string | null;
  albums: LoggedAlbum[];
  onClose: () => void;
  onAlbumPress: (album: LoggedAlbum) => void;
  onTitlePress?: () => void;
  themeColors?: ModalColors;
}) {
  const insets  = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cw      = calcCardWidth(width);

  const bg      = themeColors?.background ?? '#161616';
  const txt     = themeColors?.text       ?? TEXT;
  const sub     = themeColors?.subtext    ?? SUBTEXT;
  const tint    = themeColors?.tint       ?? ACCENT;
  const border  = themeColors?.border     ?? BORDER;
  const surface = themeColors?.surface    ?? CARD_BG;

  return (
    <Modal visible={title !== null} transparent animationType="slide" onRequestClose={onClose}>
      <View style={rm.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[rm.sheet, { backgroundColor: bg, borderTopColor: border, paddingBottom: Math.max(insets.bottom + 16, 32) }]}>
          <View style={[rm.handle, { backgroundColor: border }]} />
          <View style={rm.header}>
            <Pressable onPress={onTitlePress} disabled={!onTitlePress} style={{ flex: 1, marginRight: 12 }}>
              <Text style={[rm.title, { color: onTitlePress ? tint : txt }]}>{title}</Text>
              {onTitlePress && (
                <Text style={{ color: sub, fontSize: 12, marginTop: 2 }}>View artist profile →</Text>
              )}
            </Pressable>
            <Pressable onPress={onClose} hitSlop={12}>
              <FontAwesome name="times" size={16} color={sub} />
            </Pressable>
          </View>
          <Text style={[rm.subtitle, { color: sub }]}>{albums.length} album{albums.length !== 1 ? 's' : ''}</Text>

          <FlatList
            data={albums}
            keyExtractor={a => a.id}
            numColumns={COLS}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: PADDING, paddingTop: 12, paddingBottom: 8 }}
            columnWrapperStyle={{ gap: GAP, marginBottom: GAP }}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [{ width: cw, opacity: pressed ? 0.7 : 1 }]}
                onPress={() => { onClose(); setTimeout(() => onAlbumPress(item), 300); }}>
                {item.artworkUrl ? (
                  <ExpoImage
                    source={{ uri: item.artworkUrl }}
                    style={{ width: cw, height: cw, borderRadius: 8 }}
                    contentFit="cover"
                    cachePolicy="disk"
                    transition={200}
                  />
                ) : (
                  <View style={[rm.fallback, { width: cw, height: cw, backgroundColor: surface }]}>
                    <FontAwesome name="music" size={cw * 0.28} color={sub} />
                  </View>
                )}
                <Text style={[rm.cardTitle,  { color: txt }]} numberOfLines={1}>{item.title}</Text>
                <Text style={[rm.cardArtist, { color: sub }]} numberOfLines={1}>{item.artist}</Text>
                {effectiveRating(item) > 0 && (
                  <View style={{ marginTop: 3 }}>
                    <VolumeBadge rating={effectiveRating(item)} tint={tint} isDark={themeColors?.isDark ?? true} />
                  </View>
                )}
              </Pressable>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const rm = StyleSheet.create({
  overlay:    { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet:      { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: StyleSheet.hairlineWidth, maxHeight: '85%' },
  handle:     { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  title:      { fontSize: 18, fontWeight: '700' },
  subtitle:   { fontSize: 13, paddingHorizontal: 16, marginBottom: 8 },
  fallback:   { borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  cardTitle:  { fontSize: 12, fontWeight: '600', marginTop: 4 },
  cardArtist: { fontSize: 11, marginTop: 1 },
  cardRating: { fontSize: 11, fontWeight: '700', marginTop: 2 },
});

// ─── Ranked List Modal ("See all" for artists / genres) ──────────────────────

type RankedItem = { key: string; label: string; value: string; imageUrl?: string; onPress: () => void };

// Lowercased, accents stripped, so "beyonce" finds Beyoncé.
function foldForSearch(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function RankedListModal({ title, items, showImages, searchPlaceholder, onClose, themeColors }: {
  title: string | null;
  items: RankedItem[];
  showImages: boolean;
  /** Shows a search field that filters the list by label. */
  searchPlaceholder?: string;
  onClose: () => void;
  themeColors?: ModalColors;
}) {
  const insets = useSafeAreaInsets();
  const androidKeyboard = useAndroidKeyboardHeight();
  const bg     = themeColors?.background ?? '#161616';
  const txt    = themeColors?.text       ?? TEXT;
  const sub    = themeColors?.subtext    ?? SUBTEXT;
  const border = themeColors?.border     ?? BORDER;
  const surface = themeColors?.surface   ?? border;

  const [query, setQuery] = useState('');
  // A new list (or reopening the sheet) starts unfiltered.
  useEffect(() => { setQuery(''); }, [title]);

  // Rows keep their rank in the full list, so a match still says where that
  // artist stands overall.
  const ranked = useMemo(() => items.map((item, i) => ({ item, rank: i + 1 })), [items]);
  const needle = foldForSearch(query.trim());
  const visible = needle ? ranked.filter(r => foldForSearch(r.item.label).includes(needle)) : ranked;

  // Android never resizes the window for the keyboard (edge-to-edge), so lift
  // the sheet by the keyboard plus the nav bar it's measured from.
  const bottomPad = androidKeyboard > 0
    ? androidKeyboard + insets.bottom + 8
    : Math.max(insets.bottom + 16, 32);

  return (
    <Modal visible={title !== null} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={rm.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        {/* A fixed height when searchable, so the sheet doesn't jump as matches narrow. */}
        <View style={[rm.sheet, searchPlaceholder ? { height: '85%' } : null, { backgroundColor: bg, borderTopColor: border, paddingBottom: bottomPad }]}>
          <View style={[rm.handle, { backgroundColor: border }]} />
          <View style={rm.header}>
            <Text style={[rm.title, { color: txt, flex: 1, marginRight: 12 }]}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <FontAwesome name="times" size={16} color={sub} />
            </Pressable>
          </View>
          {searchPlaceholder ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 8, backgroundColor: surface, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: border, paddingHorizontal: 12 }}>
              <FontAwesome name="search" size={14} color={sub} />
              <TextInput
                style={{ flex: 1, paddingHorizontal: 10, paddingVertical: 10, color: txt, fontSize: 15 }}
                placeholder={searchPlaceholder}
                placeholderTextColor={sub}
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
              {query.length > 0 && (
                <Pressable onPress={() => setQuery('')} hitSlop={10} style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesome name="times-circle" size={16} color={sub} />
                </Pressable>
              )}
            </View>
          ) : null}
          <FlatList
            data={visible}
            keyExtractor={r => r.item.key}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}
            ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: border }} />}
            ListEmptyComponent={needle ? (
              <Text style={{ color: sub, fontSize: 14, textAlign: 'center', paddingVertical: 24 }}>No artists match “{query.trim()}”</Text>
            ) : null}
            renderItem={({ item: { item, rank } }) => (
              <Pressable onPress={() => { Keyboard.dismiss(); item.onPress(); }} style={({ pressed }) => [rk.row, { opacity: pressed ? 0.6 : 1 }]}>
                <Text style={[rk.rank, { color: sub }]}>{rank}</Text>
                {showImages && (item.imageUrl ? (
                  <ExpoImage source={{ uri: item.imageUrl }} style={rk.avatar} contentFit="cover" cachePolicy="disk" />
                ) : (
                  <View style={[rk.avatar, { backgroundColor: INITIAL_COLORS[item.label.charCodeAt(0) % INITIAL_COLORS.length], alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>{item.label.trim().charAt(0).toUpperCase()}</Text>
                  </View>
                ))}
                <Text style={[rk.label, { color: txt }]} numberOfLines={1}>{item.label}</Text>
                <Text style={[rk.value, { color: sub }]}>{item.value}</Text>
                <FontAwesome name="chevron-right" size={11} color={sub} />
              </Pressable>
            )}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const rk = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rank:   { width: 24, fontSize: 13, fontWeight: '700', textAlign: 'right' },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  label:  { flex: 1, fontSize: 15, fontWeight: '600' },
  value:  { fontSize: 13, fontWeight: '500' },
});

function SeeAllButton({ label, tint, onPress }: { label: string; tint: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={({ pressed }) => ({ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, opacity: pressed ? 0.6 : 1 })}>
      <Text style={{ color: tint, fontSize: 14, fontWeight: '700' }}>{label}</Text>
      <FontAwesome name="chevron-right" size={11} color={tint} />
    </Pressable>
  );
}

// ─── Artist List Modal ────────────────────────────────────────────────────────

function ArtistListModal({
  visible,
  albums,
  onClose,
  onArtistPress,
  themeColors,
}: {
  visible: boolean;
  albums: LoggedAlbum[];
  onClose: () => void;
  onArtistPress: (artist: string, artistAlbums: LoggedAlbum[]) => void;
  themeColors?: ModalColors;
}) {
  const insets = useSafeAreaInsets();
  const bg     = themeColors?.background ?? '#161616';
  const txt    = themeColors?.text       ?? TEXT;
  const sub    = themeColors?.subtext    ?? SUBTEXT;
  const border = themeColors?.border     ?? BORDER;
  const tint   = themeColors?.tint       ?? ACCENT;

  const artists = useMemo(() => {
    const map = new Map<string, LoggedAlbum[]>();
    for (const a of albums) {
      const name = a.artist || 'Unknown';
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push(a);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  }, [albums]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={rm.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[rm.sheet, { backgroundColor: bg, borderTopColor: border, paddingBottom: Math.max(insets.bottom + 16, 32) }]}>
          <View style={[rm.handle, { backgroundColor: border }]} />
          <View style={rm.header}>
            <Text style={[rm.title, { color: txt, flex: 1 }]}>Unique Artists</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <FontAwesome name="times" size={16} color={sub} />
            </Pressable>
          </View>
          <Text style={[rm.subtitle, { color: sub }]}>{artists.length} artist{artists.length !== 1 ? 's' : ''}</Text>
          <FlatList
            data={artists}
            keyExtractor={([name]) => name}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 }}
            renderItem={({ item: [name, artistAlbums] }) => (
              <Pressable
                onPress={() => { onClose(); setTimeout(() => onArtistPress(name, artistAlbums), 300); }}
                style={({ pressed }) => [{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: border,
                  opacity: pressed ? 0.6 : 1,
                }]}>
                <Text style={{ color: txt, fontSize: 15, fontWeight: '600', flex: 1 }} numberOfLines={1}>{name}</Text>
                <Text style={{ color: sub, fontSize: 13 }}>{artistAlbums.length} album{artistAlbums.length !== 1 ? 's' : ''}</Text>
                <FontAwesome name="chevron-right" size={11} color={sub} style={{ marginLeft: 10 }} />
              </Pressable>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

// ─── Year in Review / Monthly Stats links ─────────────────────────────────────
// Doorways, not stats: a tinted card, solid icon and arrow, so they don't read
// as quieter versus the bold stat tiles above them.

function ReviewLink({
  icon, title, sub, onPress, tint, textColor, subtextColor, bg,
}: {
  icon: 'calendar' | 'bar-chart';
  title: string;
  sub: string;
  onPress: () => void;
  tint: string; textColor: string; subtextColor: string; bg: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [rl2.card, { backgroundColor: bg, borderColor: tint, opacity: pressed ? 0.7 : 1 }]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: tint, opacity: 0.1 }]} />
      <View style={rl2.top}>
        <View style={[rl2.icon, { backgroundColor: tint }]}>
          <FontAwesome name={icon} size={15} color="#FFFFFF" />
        </View>
        <FontAwesome name="arrow-right" size={14} color={tint} />
      </View>
      <Text style={[rl2.title, { color: textColor }]}>{title}</Text>
      <Text style={[rl2.sub, { color: subtextColor }]}>{sub}</Text>
    </Pressable>
  );
}

const rl2 = StyleSheet.create({
  card:  { flex: 1, borderRadius: 14, borderWidth: 1, padding: 14, gap: 4, overflow: 'hidden' },
  top:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  icon:  { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  sub:   { fontSize: 13 },
});

// ─── "vs community" loading row ───────────────────────────────────────────────

function CommunityLoading({ tint, color }: { tint: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18 }}>
      <ActivityIndicator size="small" color={tint} />
      <Text style={{ color, fontSize: 13 }}>Comparing with the community…</Text>
    </View>
  );
}

// ─── Artist grid card ─────────────────────────────────────────────────────────

const INITIAL_COLORS = ['#7a5018', '#5c3a10', '#6B4422', '#4a3218', '#8B6914', '#3d2a0e'];

function ArtistGridCard({
  artist,
  label,
  imageUrl,
  onPress,
  cardW,
  textColor = TEXT,
  subtextColor = SUBTEXT,
}: {
  artist: string;
  label: string;
  imageUrl?: string;
  onPress: () => void;
  cardW: number;
  textColor?: string;
  subtextColor?: string;
}) {
  const imgSize = cardW - 20;
  const initial = artist.trim().charAt(0).toUpperCase();
  const bgColor = INITIAL_COLORS[artist.charCodeAt(0) % INITIAL_COLORS.length];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ width: cardW, alignItems: 'center', gap: 6, opacity: pressed ? 0.7 : 1 }]}>
      {imageUrl ? (
        <ExpoImage
          source={{ uri: imageUrl }}
          style={{ width: imgSize, height: imgSize, borderRadius: imgSize / 2 }}
          contentFit="cover"
          cachePolicy="disk"
        />
      ) : (
        <View style={{ width: imgSize, height: imgSize, borderRadius: imgSize / 2, backgroundColor: bgColor, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#f5e6c8', fontSize: imgSize * 0.38, fontWeight: '700' }}>{initial}</Text>
        </View>
      )}
      <Text style={[ag.name, { color: textColor }]} numberOfLines={2}>{artist}</Text>
      <Text style={[ag.sub,  { color: subtextColor }]}>{label}</Text>
    </Pressable>
  );
}

const ag = StyleSheet.create({
  name: { color: TEXT,    fontSize: 12, fontWeight: '600', textAlign: 'center' },
  sub:  { color: SUBTEXT, fontSize: 11, fontWeight: '500', textAlign: 'center' },
});

// ─── Release Year Chart ──────────────────────────────────────────────────────
// The chart itself is components/ReleaseYearChart (shared with Month and Year
// in Review); this keeps My Stats' own album list pop-up.

function YearChart({
  loggedAlbums,
  onAlbumPress,
  tint = ACCENT,
  textColor = TEXT,
  subtextColor = SUBTEXT,
  borderColor = BORDER,
  themeColors,
  ownerName,
}: {
  loggedAlbums: LoggedAlbum[];
  onAlbumPress: (album: LoggedAlbum) => void;
  tint?: string;
  textColor?: string;
  subtextColor?: string;
  borderColor?: string;
  themeColors?: ModalColors;
  /** Someone else's stats: their name for the headline. Omitted for your own. */
  ownerName?: string;
}) {
  const [modal, setModal] = useState<{ title: string; albums: LoggedAlbum[] } | null>(null);

  return (
    <>
      <AlbumListModal
        title={modal?.title ?? null}
        albums={modal?.albums ?? []}
        onClose={() => setModal(null)}
        onAlbumPress={(album) => { setModal(null); setTimeout(() => onAlbumPress(album), 300); }}
        themeColors={themeColors}
      />
      <ReleaseYearChart
        albums={loggedAlbums}
        onShowAlbums={(title, albums) => setModal({ title, albums })}
        livesIn={ownerName ? `${ownerName} lives` : 'You live'}
        empty={<EmptyState text="Log some albums to see your year breakdown." />}
        tint={tint}
        textColor={textColor}
        subtextColor={subtextColor}
        borderColor={borderColor}
      />
    </>
  );
}

// Toggle styles, shared by the artist and genre cards' Albums / Avg Rating switches.
const yc = StyleSheet.create({
  toggle: {
    flexDirection: 'row',
    backgroundColor: BORDER,
    borderRadius: 8,
    padding: 2,
  },
  toggleBtn:        { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 7 },
  toggleText:       { color: SUBTEXT, fontSize: 13, fontWeight: '600' },
  toggleTextActive: { color: '#0F0A07', fontSize: 13, fontWeight: '700' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MyStatsScreen() {
  const colorScheme = useColorScheme();
  const { isPro, proLoaded, proTheme: ownProTheme, showPaywall } = usePro();
  const params = useLocalSearchParams<{ userId?: string; proTheme?: string; displayName?: string; viewedIsPro?: string }>();
  const viewedUserId  = params.userId ?? null;
  const viewedIsPro   = params.viewedIsPro === '1';

  // Resolve colors: other-user uses their proTheme param; own view uses own Pro context
  const activeThemeKey = viewedUserId ? (params.proTheme ?? 'default') : (isPro ? ownProTheme : 'default');
  const colors = (activeThemeKey && activeThemeKey !== 'default')
    ? themeToColors(getProTheme(activeThemeKey))
    : Colors[colorScheme ?? 'dark'];
  const isDark = colors.isDark;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { loggedAlbums: ownAlbums, isLoaded: ownLoaded, topAlbums: myTop5Albums, topArtists: myTop5Artists, updateDurations } = useAlbums();
  const { history: flipHistory } = useFlip();

  // Other-user album fetch
  const [otherAlbums,  setOtherAlbums]  = useState<LoggedAlbum[]>([]);
  const [otherLoaded,  setOtherLoaded]  = useState(false);

  useEffect(() => {
    if (!viewedUserId) return;
    setOtherLoaded(false);
    fetchAllRows<any>(
      (from, to) => supabase
        .from('user_albums')
        .select('spotify_id, title, artist, artwork_url, rating, year, listened_at, duration_ms, genre_tags, re_listen_count, is_relistened')
        .eq('user_id', viewedUserId)
        .not('listened_at', 'is', null)
        .order('listened_at', { ascending: false })
        .order('spotify_id')
        .range(from, to),
      20,
    )
      .then((data) => {
        const albums: LoggedAlbum[] = (data ?? []).map((row, i) => ({
          id:            row.spotify_id,
          title:         row.title        ?? '',
          artist:        row.artist       ?? '',
          year:          row.year         ?? 0,
          rating:        row.rating       ?? 0,
          dateLogged:    row.listened_at  ?? new Date().toISOString(),
          artworkUrl:    row.artwork_url  ?? undefined,
          coverColor:    '#2E2018',
          durationMs:    row.duration_ms  ?? undefined,
          reListenCount: row.re_listen_count ?? 0,
          isRelistened:  row.is_relistened   ?? false,
          genreTags:     row.genre_tags   ?? [],
        }));
        setOtherAlbums(albums);
        setOtherLoaded(true);
      });
  }, [viewedUserId]);

  const loggedAlbumsRaw = viewedUserId ? otherAlbums  : ownAlbums;
  const isLoaded        = viewedUserId ? otherLoaded  : ownLoaded;

  // duration_ms is only saved when the owner opens an album's page or sorts a
  // library by duration, so most logged albums have none and Listening Hours
  // read far too low (one 1163-album library had 878 blanks). Fill the gaps
  // once per library: our own answers are written back via updateDurations so
  // the lookup isn't repeated; another user's stay in memory (RLS).
  // The server backfills these too, so normally only a handful are left;
  // hours show "…" while they're fetched rather than a too-low number that
  // jumps, capped at HOURS_WAIT_MS so a slow lookup can't hide the stat.
  const durationsHydratedFor = useRef<string | null>(null);
  const [hoursPending, setHoursPending] = useState(false);
  useEffect(() => {
    if (!isLoaded) return;
    const key = viewedUserId ?? 'me';
    if (durationsHydratedFor.current === key) return;
    durationsHydratedFor.current = key;
    const missing = loggedAlbumsRaw.filter(a => !a.durationMs && hasLookupableId(a.id)).map(a => a.id);
    if (missing.length === 0) return;
    let cancelled = false;
    setHoursPending(true);
    const giveUp = setTimeout(() => setHoursPending(false), HOURS_WAIT_MS);
    fetchAlbumDurations(missing, () => cancelled).then(found => {
      if (cancelled) return;
      if (Object.keys(found).length > 0) {
        if (viewedUserId) {
          setOtherAlbums(prev => prev.map(a => (found[a.id] && !a.durationMs ? { ...a, durationMs: found[a.id] } : a)));
        } else {
          updateDurations(found);
        }
      }
      clearTimeout(giveUp);
      setHoursPending(false);
    });
    return () => {
      cancelled = true;
      clearTimeout(giveUp);
      setHoursPending(false);
      if (durationsHydratedFor.current === key) durationsHydratedFor.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, viewedUserId]);

  const [listModal,      setListModal]        = useState<{ title: string; albums: LoggedAlbum[]; onTitlePress?: () => void } | null>(null);
  const [rankedModal,    setRankedModal]      = useState<'artists' | 'genres' | null>(null);
  const [artistView,     setArtistView]       = useState<'listend' | 'rated'>('listend');
  const [genreView,      setGenreView]        = useState<'listend' | 'rated'>('listend');

  // ── Compare tab ───────────────────────────────────────────────────────────
  const [mainTab,          setMainTab]          = useState<'stats' | 'compare'>('stats');
  const [compareQuery,     setCompareQuery]     = useState('');
  const [compareSearching, setCompareSearching] = useState(false);
  const [compareError,     setCompareError]     = useState<string | null>(null);
  const [compareFriend,    setCompareFriend]    = useState<ComparePerson | null>(null);
  const [compareResults,   setCompareResults]   = useState<ComparePerson[]>([]);
  const compareReqId      = useRef(0);
  const compareDebounce   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const compareExcludeIds = useRef<Set<string>>(new Set());
  const selectedFriendId  = useRef<string | null>(null);
  const [friendAlbums,  setFriendAlbums]  = useState<LoggedAlbum[]>([]);
  const [friendLoading, setFriendLoading] = useState(false);
  const [friendHoursPending, setFriendHoursPending] = useState(false);
  const [sharedModal,        setSharedModal]        = useState<'albums' | 'artists' | null>(null);
  const [followingList,      setFollowingList]      = useState<ComparePerson[]>([]);
  const [friendTop5Albums,   setFriendTop5Albums]   = useState<{ id: string; title: string; artworkUrl?: string }[]>([]);
  const [friendTop5Artists,  setFriendTop5Artists]  = useState<{ id: string; name: string; artworkUrl?: string }[]>([]);
  const [friendLikedArtists, setFriendLikedArtists] = useState<{ artistId: string; name: string }[]>([]);
  const [myLikedArtists,     setMyLikedArtists]     = useState<{ artistId: string; name: string }[]>([]);
  const [friendReviewCount,  setFriendReviewCount]  = useState(0);
  const [artistImages,   setArtistImages]     = useState<Record<string, string>>({});
  const [allReLists,     setAllReLists]       = useState<Map<string, { rating: number; listenedAt: string }[]>>(new Map());

  // A re-listen replaces the user's score; user_albums.rating stays frozen at
  // the first listen (the rating-evolution charts need that original). Attach
  // the latest re-listen rating as `lastRating` so every average and breakdown
  // below counts the album under the score the user actually holds today.
  // Own albums already carry lastRating from AlbumsContext; another user's
  // rows are hydrated here from the re_listens fetch.
  const loggedAlbums = useMemo(() => loggedAlbumsRaw.map(a => {
    const lists = allReLists.get(a.id);
    if (!lists || lists.length === 0) return a;
    const latestRated = [...lists].reverse().find(r => r.rating > 0);
    return latestRated ? { ...a, lastRating: latestRated.rating } : a;
  }), [loggedAlbumsRaw, allReLists]);
  const [communityAvgs,  setCommunityAvgs]    = useState<Record<string, { avg: number; count: number }>>({});
  // Until the first answer, the "vs community" cards say so rather than
  // showing their "not enough listeners yet" message, which read as broken.
  const [communityLoaded, setCommunityLoaded] = useState(false);
  // Free view: the cover-backed unlock card sits a screen down, so a slim
  // pinned button covers the way there and fades out once the card shows.
  const [teaseCardY, setTeaseCardY] = useState<number | null>(null);
  const [pinnedUnlockShown, setPinnedUnlockShown] = useState(true);
  const teaseViewportH = useRef(0);
  const teaseScrollY = useRef(0);
  const pinnedUnlockOpacity = useRef(new Animated.Value(1)).current;
  const updatePinnedUnlock = (cardY: number | null = teaseCardY) => {
    if (cardY == null || teaseViewportH.current === 0) return;
    const show = teaseScrollY.current + teaseViewportH.current < cardY + 120;
    if (show === pinnedUnlockShown) return;
    setPinnedUnlockShown(show);
    Animated.timing(pinnedUnlockOpacity, { toValue: show ? 1 : 0, duration: 180, useNativeDriver: true }).start();
  };
  const [playlistAlbums, setPlaylistAlbums]   = useState<Record<string, { title: string; artist: string }[]>>({});
  const [genreAlbums,    setGenreAlbums]      = useState<Record<string, { title: string; artist: string }[]>>({});
  const [decadeAlbums,   setDecadeAlbums]     = useState<Record<string, { title: string; artist: string }[]>>({});
  const [showAllPlaylists, setShowAllPlaylists] = useState(false);
  const [artistModalOpen,  setArtistModalOpen]  = useState(false);
  const { width: screenWidth } = useWindowDimensions();

  const cardBg  = colors.surface;
  const cardBorder = colors.border;

  // ── Hero stats ────────────────────────────────────────────────────────────
  const ratedAlbums    = loggedAlbums.filter(a => effectiveRating(a) > 0);
  const avgRating      = ratedAlbums.length > 0
    ? (ratedAlbums.reduce((sum, a) => sum + effectiveRating(a), 0) / ratedAlbums.length).toFixed(1)
    : '—';
  const uniqueArtists  = new Set(loggedAlbums.map(a => a.artist)).size;
  const totalMs        = loggedAlbums.reduce((sum, a) => sum + (a.durationMs ?? 0), 0);
  const totalHours     = hoursPending ? '…' : totalMs > 0 ? Math.round(totalMs / 3_600_000) : '—';

  // ── Streak helpers ────────────────────────────────────────────────────────
  // Build a set of "YYYY-M-D" keys (0-indexed month) for every day with a log
  const listenDayKeys = new Set(
    loggedAlbums.map(a => {
      const d = new Date(a.dateLogged);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    })
  );

  // Convert a set of "YYYY-M-D" keys → sorted timestamps → find the longest run
  function longestConsecutiveStreak(dayKeys: Set<string>): number {
    if (dayKeys.size === 0) return 0;
    const times = [...dayKeys]
      .map(k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m, d).getTime(); })
      .sort((a, b) => a - b);
    let longest = 1, current = 1;
    for (let i = 1; i < times.length; i++) {
      if (times[i] - times[i - 1] === 86_400_000) { current++; longest = Math.max(longest, current); }
      else { current = 1; }
    }
    return longest;
  }

  // Current streak — count back from today
  let streakDays = 0;
  const today = new Date();
  for (let i = 0; i <= 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (listenDayKeys.has(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`)) { streakDays++; }
    else { break; }
  }

  // Longest streak ever
  const longestStreak = longestConsecutiveStreak(listenDayKeys);

  // Flip a Record streak — longest consecutive logged run across all history
  const flipStreak = (() => {
    let best = 0, current = 0;
    for (const r of flipHistory) {
      if (r.status === 'pending') continue;
      if (r.status === 'logged') { current++; if (current > best) best = current; }
      else current = 0;
    }
    return best;
  })();

  const heroStats = [
    { label: 'Albums Logged',   value: loggedAlbums.length, onPress: loggedAlbums.length > 0 ? () => setListModal({ title: 'Albums Logged', albums: loggedAlbums }) : undefined },
    { label: 'Listening Hours', value: totalHours },
    { label: 'Unique Artists',  value: uniqueArtists, onPress: uniqueArtists > 0 ? () => setArtistModalOpen(true) : undefined },
    { label: 'Avg Rating',      value: avgRating },
    { label: 'Top Flip Streak', value: flipStreak > 0 ? flipStreak : '—' },
    { label: 'Best Streak',     value: longestStreak > 0 ? longestStreak : '—' },
  ];

  // When the library starts, for the hero's "Since Jun 2022".
  const firstLogged = (() => {
    const first = loggedAlbums.reduce<string | null>(
      (min, a) => (a.dateLogged && (!min || a.dateLogged < min) ? a.dateLogged : min), null);
    return first ? new Date(first).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : null;
  })();

  // ── Most listend artists ──────────────────────────────────────────────────
  const artistCounts = new Map<string, number>();
  for (const album of loggedAlbums) {
    if (!album.artist) continue;
    artistCounts.set(album.artist, (artistCounts.get(album.artist) ?? 0) + 1);
  }
  const allArtistsByCount = [...artistCounts.entries()].sort((a, b) => b[1] - a[1]);
  const topArtists     = allArtistsByCount.slice(0, STATS_GRID_ARTISTS);
  const maxArtistCount = topArtists[0]?.[1] ?? 1;

  // ── Highest rated artists ─────────────────────────────────────────────────
  const artistRatings = new Map<string, number[]>();
  for (const album of loggedAlbums) {
    if (!album.artist || effectiveRating(album) <= 0) continue;
    if (!artistRatings.has(album.artist)) artistRatings.set(album.artist, []);
    artistRatings.get(album.artist)!.push(effectiveRating(album));
  }
  const allRatedArtists = [...artistRatings.entries()]
    .filter(([, ratings]) => ratings.length >= 2)
    .map(([artist, ratings]) => [artist, ratings.reduce((s, r) => s + r, 0) / ratings.length] as [string, number])
    .sort((a, b) => b[1] - a[1]);
  const topRatedArtists = allRatedArtists.slice(0, STATS_GRID_ARTISTS);

  // ── Favourite genres ──────────────────────────────────────────────────────
  const genreCounts = new Map<string, number>();
  for (const album of loggedAlbums) {
    const genre = (album.genreTags ?? []).find(t => MAIN_GENRES.has(t));
    if (genre) genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
  }
  const allGenres     = [...genreCounts.entries()].sort((a, b) => b[1] - a[1]);
  const topGenres     = allGenres.slice(0, STATS_TOP_GENRES);
  const maxGenreCount = topGenres[0]?.[1] ?? 1;
  const totalTagged   = loggedAlbums.filter(a => (a.genreTags ?? []).some(t => MAIN_GENRES.has(t))).length;

  // ── Highest rated genres ──────────────────────────────────────────────────
  const genreRatings = new Map<string, number[]>();
  for (const album of loggedAlbums) {
    if (effectiveRating(album) <= 0) continue;
    const genre = (album.genreTags ?? []).find(t => MAIN_GENRES.has(t));
    if (genre) {
      if (!genreRatings.has(genre)) genreRatings.set(genre, []);
      genreRatings.get(genre)!.push(effectiveRating(album));
    }
  }
  const allRatedGenres = [...genreRatings.entries()]
    .map(([genre, ratings]) => [genre, ratings.reduce((s, r) => s + r, 0) / ratings.length] as [string, number])
    .sort((a, b) => b[1] - a[1]);
  const topRatedGenres = allRatedGenres.slice(0, STATS_TOP_GENRES);


  // Fetch artist images using the same /search?type=artist call that artist-detail uses
  useEffect(() => {
    if (!isLoaded || loggedAlbums.length === 0) return;
    const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
    const allNames = [...new Set([
      ...topArtists.map(([a]) => a),
      ...topRatedArtists.map(([a]) => a),
    ])] as string[];
    if (allNames.length === 0) return;
    Promise.allSettled(
      allNames.map(name =>
        fetch(`${API_URL}/search?q=${encodeURIComponent(name)}&type=artist`)
          .then(r => r.ok ? r.json() : [])
          .then((results: { artworkUrl: string }[]) => ({ name, url: results[0]?.artworkUrl ?? '' }))
          .catch(() => ({ name, url: '' }))
      )
    ).then(results => {
      const images: Record<string, string> = {};
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.url) images[r.value.name] = r.value.url;
      }
      if (Object.keys(images).length > 0) setArtistImages(prev => ({ ...prev, ...images }));
    });
  }, [loggedAlbums]);

  // Fetch all re-listen rows for grower/fader computation (scoped to viewed user)
  useEffect(() => {
    if (!isLoaded) return;
    const run = async (uid: string) => {
      const data = await fetchAllRows<any>(
        (from, to) => supabase
          .from('re_listens')
          .select('spotify_id, rating, listened_at')
          .eq('user_id', uid)
          .order('listened_at', { ascending: true })
          .order('spotify_id')
          .range(from, to),
        20,
      );
      if (data === null) return;
      const map = new Map<string, { rating: number; listenedAt: string }[]>();
      for (const r of data ?? []) {
        if (!map.has(r.spotify_id)) map.set(r.spotify_id, []);
        map.get(r.spotify_id)!.push({ rating: r.rating ?? 0, listenedAt: r.listened_at ?? '' });
      }
      setAllReLists(map);
    };
    if (viewedUserId) {
      run(viewedUserId);
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user?.id) run(session.user.id);
      });
    }
  }, [isLoaded, viewedUserId]);

  // Fetch community averages for all rated albums (excluding viewed user's own rating)
  useEffect(() => {
    if (!isLoaded) return;
    const ratedAlbums = loggedAlbums.filter(a => effectiveRating(a) > 0);
    if (ratedAlbums.length === 0) { setCommunityLoaded(true); return; }
    // Match by title+year (not spotify_id) — different users may have
    // different AM IDs for the same album. Keyed title_lower::year.
    const fetchCommunity = async (excludeUid: string): Promise<Map<string, { avg: number; count: number }> | null> => {
      // Fast path: the database averages in one request (~0.3s, one row per
      // album). supabase/add-community-album-avgs.sql; until it's applied,
      // or if it fails, fall through to the old download below.
      const { data: rows, error } = await supabase.rpc('community_album_avgs', { p_user: excludeUid });
      if (!error && Array.isArray(rows)) {
        return new Map((rows as { title_key: string; year: number; avg_rating: number | string; rating_count: number }[])
          .map(r => [`${r.title_key}::${r.year}`, { avg: Number(r.avg_rating), count: r.rating_count }]));
      }

      // Slow path: download every rating of every album sharing one of these
      // titles (30k rows for a 370-album library) and average here. Chunked
      // and paged — an unfiltered select stops at PostgREST's 1000 rows.
      const titles = [...new Set(ratedAlbums.map(a => a.title).filter(Boolean))];
      const chunks: string[][] = [];
      for (let i = 0; i < titles.length; i += COMMUNITY_TITLE_CHUNK) chunks.push(titles.slice(i, i + COMMUNITY_TITLE_CHUNK));
      const pages = await Promise.all(chunks.map(chunk => fetchAllRows<{ title: string | null; year: number | null; rating: number }>(
        (from, to) => supabase
          .from('user_albums')
          .select('title, year, rating')
          .in('title', chunk)
          .gt('rating', 0)
          .neq('user_id', excludeUid)
          .range(from, to),
        20,
      )));
      // A failed chunk would undercount — keep whatever we showed before.
      if (pages.some(p => p === null)) return null;
      const sums = new Map<string, { sum: number; count: number }>();
      for (const row of pages.flatMap(p => p ?? [])) {
        const key = `${(row.title ?? '').toLowerCase()}::${row.year ?? 0}`;
        const e = sums.get(key) ?? { sum: 0, count: 0 };
        e.sum += row.rating; e.count += 1;
        sums.set(key, e);
      }
      return new Map([...sums].map(([k, e]) => [k, { avg: e.sum / e.count, count: e.count }]));
    };
    const run = async (excludeUid: string) => {
      const community = await fetchCommunity(excludeUid);
      if (community) {
        const avgs: Record<string, { avg: number; count: number }> = {};
        for (const album of ratedAlbums) {
          const c = community.get(`${album.title.toLowerCase()}::${album.year ?? 0}`);
          if (c && c.count > 0) avgs[album.id] = c;
        }
        setCommunityAvgs(avgs);
      }
      setCommunityLoaded(true);
    };
    if (viewedUserId) {
      run(viewedUserId);
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user?.id) run(session.user.id);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, viewedUserId]);


  // Fetch featured playlist album lists (in parallel, once)
  useEffect(() => {
    const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
    const featuredIds = FEATURED_PLAYLISTS.filter(p => p.id !== 'flip-a-record').map(p => p.id);
    Promise.allSettled(
      featuredIds.map(id =>
        fetch(`${API_URL}/api/featured-playlists/${id}`)
          .then(r => r.ok ? r.json() : [])
          .then((data: { title: string; artist: string }[]) => ({ id, albums: data }))
          .catch(() => ({ id, albums: [] }))
      )
    ).then(results => {
      const map: Record<string, { title: string; artist: string }[]> = {};
      for (const r of results) {
        if (r.status === 'fulfilled') map[r.value.id] = r.value.albums;
      }
      setPlaylistAlbums(map);
    });
  }, []);

  // Fetch genre album lists (once)
  useEffect(() => {
    const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
    fetch(`${API_URL}/genres`)
      .then(r => r.ok ? r.json() : {})
      .then((data: Record<string, { title: string; artist: string }[]>) => setGenreAlbums(data))
      .catch(() => {});
  }, []);

  // Fetch decade album lists (once)
  useEffect(() => {
    const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
    fetch(`${API_URL}/decades`)
      .then(r => r.ok ? r.json() : {})
      .then((data: Record<string, { title: string; artist: string }[]>) => setDecadeAlbums(data))
      .catch(() => {});
  }, []);

  // ── Re-Listend evolution (growers / faders) ───────────────────────────────
  const reListenedAlbums = loggedAlbums.filter(a => a.isRelistened);
  const totalReListens   = reListenedAlbums.reduce((s, a) => s + (a.reListenCount ?? 0), 0);
  const evGrowers: EvolutionEntry[] = [];
  const evFaders:  EvolutionEntry[] = [];
  let evSumFirst = 0, evSumLatest = 0, evCount = 0;
  for (const album of reListenedAlbums) {
    const lists = allReLists.get(album.id);
    if (!lists || lists.length === 0) continue;
    const latestRated = [...lists].reverse().find(r => r.rating > 0);
    const latestRating = latestRated?.rating ?? 0;
    const firstRating  = album.rating;
    if (firstRating <= 0 || latestRating <= 0) continue;
    const delta = latestRating - firstRating;
    evSumFirst += firstRating; evSumLatest += latestRating; evCount++;
    if (delta >= 1)  evGrowers.push({ album, firstRating, latestRating, delta });
    if (delta <= -1) evFaders.push({ album, firstRating, latestRating, delta });
  }
  evGrowers.sort((a, b) => b.delta - a.delta);
  evFaders.sort((a, b) => a.delta - b.delta);
  const evAvgDelta      = evCount > 0 ? (evSumLatest - evSumFirst) / evCount : 0;
  const evFirstListenAvg = evCount > 0 ? evSumFirst  / evCount : 0;
  const evLongTermAvg    = evCount > 0 ? evSumLatest / evCount : 0;

  // ── Community comparison (rated higher / lower than average) ─────────────
  const MIN_COMMUNITY = 10;
  type CompEntry = { album: LoggedAlbum; communityAvg: number; delta: number };
  const compHigher: CompEntry[] = [];
  const compLower:  CompEntry[] = [];
  for (const album of loggedAlbums.filter(a => effectiveRating(a) > 0)) {
    const c = communityAvgs[album.id];
    if (!c || c.count < MIN_COMMUNITY) continue;
    const delta = effectiveRating(album) - c.avg;
    if (delta >= 1)  compHigher.push({ album, communityAvg: c.avg, delta });
    if (delta <= -1) compLower.push({  album, communityAvg: c.avg, delta: Math.abs(delta) });
  }
  compHigher.sort((a, b) => b.delta - a.delta);
  compLower.sort((a, b) => b.delta - a.delta);
  const hasComparison = compHigher.length > 0 || compLower.length > 0;

  // ── Artist comparison (your avg for an artist vs the community's) ─────────
  // Apples to apples: only albums you rated that also have community ratings,
  // and the community side pools every rating on those same albums (as the
  // artist-detail Artist Rating does) rather than averaging album averages.
  const artistCompGroups = new Map<string, { mine: number[]; communitySum: number; communityCount: number; albums: LoggedAlbum[] }>();
  for (const album of loggedAlbums) {
    if (!album.artist || effectiveRating(album) <= 0) continue;
    const c = communityAvgs[album.id];
    if (!c || c.count < ARTIST_COMP_MIN_ALBUM_RATINGS) continue;
    const g = artistCompGroups.get(album.artist) ?? { mine: [], communitySum: 0, communityCount: 0, albums: [] };
    g.mine.push(effectiveRating(album));
    g.communitySum   += c.avg * c.count;
    g.communityCount += c.count;
    g.albums.push(album);
    artistCompGroups.set(album.artist, g);
  }
  const artistHigher: ArtistCompEntry[] = [];
  const artistLower:  ArtistCompEntry[] = [];
  for (const [artist, g] of artistCompGroups) {
    if (g.albums.length < ARTIST_COMP_MIN_ALBUMS) continue;
    const mine      = g.mine.reduce((sum, r) => sum + r, 0) / g.mine.length;
    const community = g.communitySum / g.communityCount;
    const delta     = mine - community;
    if (delta >= ARTIST_COMP_MIN_DIFF)  artistHigher.push({ artist, mine, community, delta, albums: g.albums });
    if (delta <= -ARTIST_COMP_MIN_DIFF) artistLower.push({ artist, mine, community, delta, albums: g.albums });
  }
  artistHigher.sort((a, b) => b.delta - a.delta);
  artistLower.sort((a, b) => a.delta - b.delta);

  // ── Full rankings for the "See all" sheet ────────────────────────────────
  const artistAlbumsFor = (artist: string, ratedOnly: boolean) =>
    loggedAlbums.filter(a => a.artist === artist && (!ratedOnly || effectiveRating(a) > 0));
  const openArtistAlbums = (artist: string, ratedOnly: boolean) => setListModal({
    title: artist,
    albums: artistAlbumsFor(artist, ratedOnly),
    onTitlePress: () => {
      setListModal(null);
      setTimeout(() => router.push({ pathname: '/artist-detail', params: { name: artist, artworkUrl: artistImages[artist] ?? '' } } as any), 300);
    },
  });
  const genreOf = (a: LoggedAlbum) => (a.genreTags ?? []).find(t => MAIN_GENRES.has(t));
  // Closing the ranked sheet before opening the album sheet — two RN Modals
  // can't be presented at once on iOS.
  const fromRanked = (open: () => void) => { setRankedModal(null); setTimeout(open, 300); };
  const rankedArtistItems: RankedItem[] = (artistView === 'listend' ? allArtistsByCount : allRatedArtists).map(([artist, v]) => ({
    key: artist,
    label: artist,
    value: artistView === 'listend' ? `${v} album${v !== 1 ? 's' : ''}` : `${v.toFixed(1)} avg`,
    imageUrl: artistImages[artist],
    onPress: () => fromRanked(() => openArtistAlbums(artist, artistView === 'rated')),
  }));
  const rankedGenreItems: RankedItem[] = (genreView === 'listend' ? allGenres : allRatedGenres).map(([genre, v]) => ({
    key: genre,
    label: genre,
    value: genreView === 'listend' ? `${v} album${v !== 1 ? 's' : ''}` : `${v.toFixed(1)} avg`,
    onPress: () => fromRanked(() => setListModal({
      title: genre,
      albums: loggedAlbums.filter(a => genreOf(a) === genre && (genreView === 'listend' || effectiveRating(a) > 0)),
    })),
  }));

  // Photos for the full artist list, fetched only once the sheet is opened.
  useEffect(() => {
    if (rankedModal !== 'artists') return;
    const names = (artistView === 'listend' ? allArtistsByCount : allRatedArtists).map(([a]) => a).filter(n => !artistImages[n]);
    if (names.length === 0) return;
    let cancelled = false;
    const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
    (async () => {
      // Small batches so a 100-artist library doesn't fire 100 searches at once.
      for (let i = 0; i < names.length && !cancelled; i += 6) {
        const batch = names.slice(i, i + 6);
        const results = await Promise.allSettled(batch.map(name =>
          fetch(`${API_URL}/search?q=${encodeURIComponent(name)}&type=artist`)
            .then(r => r.ok ? r.json() : [])
            .then((res: { artworkUrl: string }[]) => ({ name, url: res[0]?.artworkUrl ?? '' }))
        ));
        if (cancelled) return;
        const images: Record<string, string> = {};
        for (const r of results) if (r.status === 'fulfilled' && r.value.url) images[r.value.name] = r.value.url;
        if (Object.keys(images).length > 0) setArtistImages(prev => ({ ...prev, ...images }));
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rankedModal, artistView]);

  // Photos for compared artists that aren't already in the top-artist grids.
  const artistCompNamesKey = [...artistHigher, ...artistLower].map(e => e.artist).sort().join('|');
  useEffect(() => {
    const names = artistCompNamesKey ? artistCompNamesKey.split('|').filter(n => !artistImages[n]) : [];
    if (names.length === 0) return;
    const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
    Promise.allSettled(names.map(name =>
      fetch(`${API_URL}/search?q=${encodeURIComponent(name)}&type=artist`)
        .then(r => r.ok ? r.json() : [])
        .then((results: { artworkUrl: string }[]) => ({ name, url: results[0]?.artworkUrl ?? '' }))
        .catch(() => ({ name, url: '' }))
    )).then(results => {
      const images: Record<string, string> = {};
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.url) images[r.value.name] = r.value.url;
      }
      if (Object.keys(images).length > 0) setArtistImages(prev => ({ ...prev, ...images }));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artistCompNamesKey]);

  // ── Playlist progress ─────────────────────────────────────────────────────
  const isLogged = libraryMatcher(loggedAlbums);

  const flipTotal = FLIP_POOL.length;
  // Same matcher as the Flip a Record screen — an exact title compare here
  // missed every album Apple Music returns with an edition suffix
  // ("Green (Remastered 2013)"), so this ring undercounted the flip screen.
  const flipDone  = poolLoggedIds(loggedAlbums).size;

  const playlistProgress = [
    ...FEATURED_PLAYLISTS.map(pl => {
      if (pl.id === 'flip-a-record') return { ...pl, kind: 'featured' as const, done: flipDone, total: flipTotal };
      const albums = playlistAlbums[pl.id] ?? [];
      const done = albums.filter(isLogged).length;
      return { ...pl, kind: 'featured' as const, done, total: albums.length };
    }),
    ...GENRE_LABELS.map(label => {
      const albums = genreAlbums[label] ?? [];
      const done = albums.filter(isLogged).length;
      return { id: label, name: label, kind: 'genre' as const, done, total: albums.length };
    }),
    ...DECADE_LABELS.map(label => {
      const albums = decadeAlbums[label] ?? [];
      const done = albums.filter(isLogged).length;
      return { id: label, name: label, kind: 'decade' as const, done, total: albums.length };
    }),
  ];

  // ── Compare: load following list when tab opens ───────────────────────────
  useEffect(() => {
    if (mainTab !== 'compare' || viewedUserId || followingList.length > 0) return;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const uid = session?.user?.id;
      if (!uid) return;
      // Self + blocked users (both directions) never appear in compare suggestions.
      Promise.all([
        supabase.from('blocked_users').select('blocked_id').eq('blocker_id', uid),
        supabase.from('blocked_users').select('blocker_id').eq('blocked_id', uid),
      ]).then(([byMe, byThem]) => {
        compareExcludeIds.current = new Set([
          uid,
          ...(byMe.data ?? []).map((r: any) => r.blocked_id),
          ...(byThem.data ?? []).map((r: any) => r.blocker_id),
        ]);
      }).catch(() => { compareExcludeIds.current = new Set([uid]); });
      const { data } = await supabase
        .from('follows')
        .select('following_id, profiles!follows_following_id_fkey(id, display_name, username, avatar_url, is_pro)')
        .eq('follower_id', uid)
        .limit(50);
      if (!data) return;
      setFollowingList(
        (data as any[])
          .map(r => r.profiles)
          .filter(Boolean)
          .map((p: any) => ({
            id: p.id,
            displayName: nameOrHandle(p.display_name, p.username, p.id, ''),
            username: p.username || '',
            avatarUrl: p.avatar_url ?? null,
            isPro: p.is_pro ?? false,
          }))
      );
    });
  }, [mainTab]);

  // ── Compare: search-as-you-type ───────────────────────────────────────────
  // Same search and ordering as the Search tab's members (lib/memberSearch),
  // with people you follow winning ties. They also match instantly from the
  // already-loaded list; everyone else arrives from a debounced query. reqId
  // drops responses that land after a newer keystroke.
  const asMemberRow = (p: ComparePerson): MemberRow & { person: ComparePerson } => ({
    id: p.id, username: p.username || null, display_name: p.displayName || null,
    avatar_url: p.avatarUrl, is_pro: p.isPro, person: p,
  });

  function handleCompareQueryChange(text: string) {
    setCompareQuery(text);
    setCompareError(null);
    if (compareFriend) { setCompareFriend(null); selectedFriendId.current = null; }
    if (compareDebounce.current) clearTimeout(compareDebounce.current);
    const reqId = ++compareReqId.current;

    const q = memberQuery(text);
    if (!q) { setCompareResults([]); setCompareSearching(false); return; }

    const followingIds = new Set(followingList.map(p => p.id));
    const localRows = followingList
      .filter(p => p.username.toLowerCase().includes(q) || p.displayName.toLowerCase().includes(q))
      .map(asMemberRow);
    setCompareResults(rankMembers(localRows, q, followingIds).map(r => r.person));

    setCompareSearching(true);
    compareDebounce.current = setTimeout(async () => {
      let rows: MemberRow[] = [];
      try { rows = await fetchMembers(text); } catch { /* keep the local matches */ }
      if (reqId !== compareReqId.current) return;
      const byId = new Map(localRows.map(r => [r.id, r]));
      for (const r of rows) {
        if (byId.has(r.id) || compareExcludeIds.current.has(r.id)) continue;
        byId.set(r.id, asMemberRow({
          id: r.id,
          displayName: nameOrHandle(r.display_name, r.username, r.id, ''),
          username: r.username || '',
          avatarUrl: r.avatar_url ?? null,
          isPro: r.is_pro ?? false,
        }));
      }
      const merged = rankMembers([...byId.values()], q, followingIds).map(r => r.person);
      setCompareResults(merged);
      setCompareSearching(false);
      if (merged.length === 0) setCompareError('No users match that name.');
    }, 250);
  }

  function clearCompareSearch() {
    if (compareDebounce.current) clearTimeout(compareDebounce.current);
    compareReqId.current++;
    selectedFriendId.current = null;
    setCompareQuery('');
    setCompareResults([]);
    setCompareSearching(false);
    setCompareError(null);
    setCompareFriend(null);
  }

  async function selectCompareFriend(person: ComparePerson) {
    Keyboard.dismiss();
    if (compareDebounce.current) clearTimeout(compareDebounce.current);
    compareReqId.current++;
    selectedFriendId.current = person.id;
    setCompareQuery(person.displayName);
    setCompareResults([]);
    setCompareSearching(false);
    setCompareError(null);
    setFriendAlbums([]);
    setFriendTop5Albums([]);
    setFriendTop5Artists([]);
    setFriendLikedArtists([]);
    setFriendHoursPending(false);
    setCompareFriend(person);
    if (person.isPro) {
      setFriendLoading(true);
      await loadFriendData(person.id);
      if (selectedFriendId.current === person.id) setFriendLoading(false);
    }
  }

  function renderComparePersonRow(person: ComparePerson, i: number) {
    return (
      <Pressable
        key={person.id}
        onPress={() => selectCompareFriend(person)}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', gap: 12,
          paddingHorizontal: 18, paddingVertical: 12, opacity: pressed ? 0.7 : 1,
          borderTopWidth: i === 0 ? StyleSheet.hairlineWidth : 0,
          borderTopColor: colors.border,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        })}>
        {person.avatarUrl
          ? <ExpoImage source={{ uri: person.avatarUrl }} style={{ width: 40, height: 40, borderRadius: 20 }} contentFit="cover" />
          : <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: CARD_BG, alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesome name="user" size={18} color={SUBTEXT} />
            </View>}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', flexShrink: 1 }} numberOfLines={1}>{person.displayName}</Text>
            {person.isPro && <ProBadge size="xs" />}
          </View>
          {handleText(person.username, person.id) ? <Text style={{ color: colors.subtext, fontSize: 12 }}>{handleText(person.username, person.id)}</Text> : null}
        </View>
        <FontAwesome name="chevron-right" size={12} color={colors.subtext} />
      </Pressable>
    );
  }

  async function loadFriendData(friendId: string) {
    const [albumsRes, profileRes, likedRes, myLikedRes, reListenRes] = await Promise.allSettled([
      fetchAllRows<any>(
        (from, to) => supabase.from('user_albums')
          .select('spotify_id, title, artist, artwork_url, rating, year, listened_at, duration_ms, genre_tags, review, is_relistened')
          .eq('user_id', friendId).not('listened_at', 'is', null)
          .order('listened_at', { ascending: false }).order('spotify_id')
          .range(from, to),
        20,
      ).then(data => ({ data })),
      supabase.from('profiles')
        .select('top_albums, top_artists')
        .eq('id', friendId).single(),
      fetchAllRows<any>(
        (from, to) => supabase.from('liked_artists')
          .select('artist_id, name').eq('user_id', friendId).order('artist_id').range(from, to),
        10,
      ).then(data => ({ data })),
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (!session?.user?.id) return { data: [] };
        const data = await fetchAllRows<any>(
          (from, to) => supabase.from('liked_artists')
            .select('artist_id, name').eq('user_id', session.user.id).order('artist_id').range(from, to),
          10,
        );
        return { data };
      }),
      fetchAllRows<any>(
        (from, to) => supabase.from('re_listens')
          .select('spotify_id, rating, listened_at')
          .eq('user_id', friendId).order('listened_at', { ascending: true }).order('spotify_id')
          .range(from, to),
        20,
      ).then(data => ({ data })),
    ]);
    // A different friend was picked while this one was loading.
    if (selectedFriendId.current !== friendId) return;

    // Latest re-listen rating per album — same reason as loggedAlbums above:
    // their avg rating here must match what their own profile shows.
    const friendLastRating = new Map<string, number>();
    if (reListenRes.status === 'fulfilled' && (reListenRes.value as any).data) {
      for (const r of (reListenRes.value as any).data as any[]) {
        if ((r.rating ?? 0) > 0) friendLastRating.set(r.spotify_id, r.rating);
      }
    }

    if (albumsRes.status === 'fulfilled' && albumsRes.value.data) {
      const rows = albumsRes.value.data;
      setFriendAlbums(rows.map(r => ({
        id: r.spotify_id, title: r.title ?? '', artist: r.artist ?? '',
        year: r.year ?? 0, rating: r.rating ?? 0,
        lastRating: friendLastRating.get(r.spotify_id),
        dateLogged: r.listened_at ?? new Date().toISOString(),
        artworkUrl: r.artwork_url ?? undefined, coverColor: '#2E2018',
        durationMs: r.duration_ms ?? undefined, genreTags: r.genre_tags ?? [],
        reListenCount: 0, isRelistened: r.is_relistened ?? false,
        review: r.review ?? undefined,
      })));
      setFriendReviewCount(rows.filter(r => r.review).length);

      // Same blank-duration gap as our own library — fill it so their
      // Listening Hours aren't undercounted. Not awaited: the comparison
      // renders now and the hours catch up when the lookup lands.
      const missing = rows.filter(r => !r.duration_ms && hasLookupableId(r.spotify_id)).map(r => r.spotify_id);
      if (missing.length > 0) {
        setFriendHoursPending(true);
        const giveUp = setTimeout(() => {
          if (selectedFriendId.current === friendId) setFriendHoursPending(false);
        }, HOURS_WAIT_MS);
        fetchAlbumDurations(missing, () => selectedFriendId.current !== friendId).then(found => {
          if (selectedFriendId.current !== friendId) return;
          clearTimeout(giveUp);
          if (Object.keys(found).length > 0) {
            setFriendAlbums(prev => prev.map(a => (found[a.id] && !a.durationMs ? { ...a, durationMs: found[a.id] } : a)));
          }
          setFriendHoursPending(false);
        });
      }
    }
    if (profileRes.status === 'fulfilled' && profileRes.value.data) {
      const p = profileRes.value.data;
      setFriendTop5Albums((p.top_albums ?? []).filter(Boolean).map((a: any) => ({ id: a.id, title: a.title, artworkUrl: a.artworkUrl })));
      setFriendTop5Artists((p.top_artists ?? []).filter(Boolean).map((a: any) => ({ id: a.id, name: a.name, artworkUrl: a.artworkUrl })));
    }
    if (likedRes.status === 'fulfilled' && likedRes.value.data) {
      setFriendLikedArtists((likedRes.value.data as any[]).map(r => ({ artistId: r.artist_id, name: r.name })));
    }
    if (myLikedRes.status === 'fulfilled') {
      const res = myLikedRes.value as any;
      setMyLikedArtists((res.data ?? []).map((r: any) => ({ artistId: r.artist_id, name: r.name })));
    }
  }

  // ── Compare: computed values ──────────────────────────────────────────────
  const myAlbumIdSet     = new Set(ownAlbums.map(a => a.id));
  const friendAlbumIdSet = new Set(friendAlbums.map(a => a.id));
  const sharedAlbumList  = friendAlbums.filter(a => myAlbumIdSet.has(a.id));
  const unionAlbumCount  = new Set([...myAlbumIdSet, ...friendAlbumIdSet]).size;
  const albumScore       = unionAlbumCount > 0 ? sharedAlbumList.length / unionAlbumCount : 0;

  const myArtistSet      = new Set(ownAlbums.map(a => a.artist.toLowerCase().trim()));
  const friendArtistSet  = new Set(friendAlbums.map(a => a.artist.toLowerCase().trim()));
  const sharedArtistList = [...myArtistSet].filter(a => friendArtistSet.has(a)).sort();
  const unionArtistCount = new Set([...myArtistSet, ...friendArtistSet]).size;
  const artistScore      = unionArtistCount > 0 ? sharedArtistList.length / unionArtistCount : 0;
  const compatibility    = Math.round((artistScore * 0.6 + albumScore * 0.4) * 100);

  // Friend hero stats
  const friendRated     = friendAlbums.filter(a => effectiveRating(a) > 0);
  const friendAvgRating = friendRated.length > 0
    ? (friendRated.reduce((s, a) => s + effectiveRating(a), 0) / friendRated.length).toFixed(1) : '—';
  const friendHours     = friendAlbums.reduce((s, a) => s + (a.durationMs ?? 0), 0);
  const friendHoursVal  = friendHoursPending ? '…' : friendHours > 0 ? Math.round(friendHours / 3_600_000) : '—';
  const friendArtistCount = new Set(friendAlbums.map(a => a.artist)).size;

  // Friend top genres
  const friendGenreCounts = new Map<string, number>();
  for (const album of friendAlbums) {
    const genre = (album.genreTags ?? []).find(t => MAIN_GENRES.has(t));
    if (genre) friendGenreCounts.set(genre, (friendGenreCounts.get(genre) ?? 0) + 1);
  }
  const friendTopGenres   = [...friendGenreCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  // ── Extra compare stats ───────────────────────────────────────────────────
  // Era preference
  const myYears     = ownAlbums.map(a => a.year).filter(y => y > 1900);
  const friendYears = friendAlbums.map(a => a.year).filter(y => y > 1900);
  const myAvgEra    = myYears.length > 0 ? Math.round(myYears.reduce((s, y) => s + y, 0) / myYears.length) : null;
  const friendAvgEra = friendYears.length > 0 ? Math.round(friendYears.reduce((s, y) => s + y, 0) / friendYears.length) : null;

  // Re-listen rate
  const myRelistenRate     = ownAlbums.length > 0 ? Math.round((ownAlbums.filter(a => a.isRelistened).length / ownAlbums.length) * 100) : 0;
  const friendRelistenRate = friendAlbums.length > 0 ? Math.round((friendAlbums.filter(a => a.isRelistened).length / friendAlbums.length) * 100) : 0;

  // Most active month
  function mostActiveMonth(albums: LoggedAlbum[]) {
    const counts = new Map<string, number>();
    for (const a of albums) {
      const d = new Date(a.dateLogged);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    if (counts.size === 0) return '—';
    const [top] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const [year, month] = top[0].split('-');
    return new Date(Number(year), Number(month) - 1).toLocaleString('default', { month: 'short', year: 'numeric' });
  }
  const myActiveMonth     = mostActiveMonth(ownAlbums);
  const friendActiveMonth = mostActiveMonth(friendAlbums);

  // Review count
  const myReviewCount = ownAlbums.filter(a => a.review).length;

  // Top 5 overlap
  const myTop5AlbumIds   = new Set(myTop5Albums.filter(Boolean).map((a: any) => a?.id));
  const myTop5ArtistIds  = new Set(myTop5Artists.filter(Boolean).map((a: any) => a?.id));
  const sharedTop5Albums  = friendTop5Albums.filter(a => myTop5AlbumIds.has(a.id));
  const sharedTop5Artists = friendTop5Artists.filter(a => myTop5ArtistIds.has(a.id));

  // Liked artists in common
  const myLikedSet      = new Set(myLikedArtists.map(a => a.artistId));
  const sharedLikedArtists = friendLikedArtists.filter(a => myLikedSet.has(a.artistId));

  // Taste label
  function tasteLabel(pct: number): { label: string; emoji: string } {
    if (pct >= 80) return { label: 'Music Twins',        emoji: '' };
    if (pct >= 60) return { label: 'Frequency Matched', emoji: '' };
    if (pct >= 40) return { label: 'Vibe Aligned',      emoji: '' };
    if (pct >= 20) return { label: 'Different Worlds',  emoji: '' };
    return              { label: 'Polar Opposites',     emoji: '' };
  }
  const taste = tasteLabel(compatibility);

  // Shared albums best-first (your rating + theirs), shared artists in their
  // display case, most-logged between you first.
  const friendRatingById = new Map(friendAlbums.map(a => [a.id, effectiveRating(a)]));
  const myRatingById     = new Map(ownAlbums.map(a => [a.id, effectiveRating(a)]));
  const sharedAlbumRatings = new Map(sharedAlbumList.map(a => [a.id, { mine: myRatingById.get(a.id) ?? 0, theirs: friendRatingById.get(a.id) ?? 0 }]));
  const sharedAlbumsBest = [...sharedAlbumList].sort((a, b) => {
    const ra = sharedAlbumRatings.get(a.id)!, rb = sharedAlbumRatings.get(b.id)!;
    return (rb.mine + rb.theirs) - (ra.mine + ra.theirs);
  });
  const artistDisplay = new Map(ownAlbums.map(a => [a.artist.toLowerCase().trim(), a.artist]));
  const artistLogCount = new Map<string, number>();
  for (const a of [...ownAlbums, ...friendAlbums]) {
    const k = a.artist.toLowerCase().trim();
    artistLogCount.set(k, (artistLogCount.get(k) ?? 0) + 1);
  }
  const sharedArtistNames = [...sharedArtistList]
    .sort((a, b) => (artistLogCount.get(b) ?? 0) - (artistLogCount.get(a) ?? 0))
    .map(k => artistDisplay.get(k) ?? k);

  // Photos for the shared artists on screen.
  const sharedArtistPhotoKey = sharedArtistNames.slice(0, 12).join('|');
  useEffect(() => {
    const names = sharedArtistPhotoKey ? sharedArtistPhotoKey.split('|').filter(n => !artistImages[n]) : [];
    if (names.length === 0) return;
    const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
    Promise.allSettled(names.map(name =>
      fetch(`${API_URL}/search?q=${encodeURIComponent(name)}&type=artist`)
        .then(r => r.ok ? r.json() : [])
        .then((results: { artworkUrl: string }[]) => ({ name, url: results[0]?.artworkUrl ?? '' }))
    )).then(results => {
      const images: Record<string, string> = {};
      for (const r of results) if (r.status === 'fulfilled' && r.value.url) images[r.value.name] = r.value.url;
      if (Object.keys(images).length > 0) setArtistImages(prev => ({ ...prev, ...images }));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedArtistPhotoKey]);

  // Your own avatar and name for the Compare hero.
  const [me, setMe] = useState<{ name: string; avatarUrl: string | null }>({ name: 'You', avatarUrl: null });
  useEffect(() => {
    if (mainTab !== 'compare' || viewedUserId || me.avatarUrl) return;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) return;
      const { data } = await supabase.from('profiles').select('display_name, avatar_url').eq('id', session.user.id).maybeSingle();
      if (data) setMe({ name: data.display_name || 'You', avatarUrl: data.avatar_url ?? null });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainTab]);


  function handleAlbumPress(album: LoggedAlbum) {
    router.push({
      pathname: '/album-detail',
      params: { id: album.id, title: album.title, artist: album.artist, year: String(album.year ?? ''), artworkUrl: album.artworkUrl ?? '' },
    } as any);
  }

  // ── Other-user gate — the viewed profile isn't Pro, so there's nothing to show ──
  if (viewedUserId && !viewedIsPro) {
    const c = Colors[colorScheme ?? 'dark'];
    return (
      <>
        <Stack.Screen options={{
          title: 'My Stats',
          headerStyle: { backgroundColor: c.background },
          headerTintColor: c.text,
          headerShadowVisible: false,
        }} />
        <View style={{ flex: 1, backgroundColor: c.background, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 20 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#2A1E00', borderWidth: 1.5, borderColor: ACCENT, alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome name="lock" size={28} color={ACCENT} />
          </View>
          <Text style={{ color: c.text, fontSize: 22, fontWeight: '800', textAlign: 'center', letterSpacing: -0.3 }}>
            Stats Not Available
          </Text>
          <Text style={{ color: SUBTEXT, fontSize: 14, textAlign: 'center', lineHeight: 21 }}>
            {`${params.displayName || 'This user'} hasn't unlocked Listend Pro, so their stats aren't available to view.`}
          </Text>
        </View>
      </>
    );
  }

  // ── Pro status still loading — hold rather than flash the tease at a paying
  //    user while the profile query is in flight ──
  if (!viewedUserId && !proLoaded) {
    const c = Colors[colorScheme ?? 'dark'];
    return (
      <>
        <Stack.Screen options={{
          title: 'My Stats',
          headerStyle: { backgroundColor: c.background },
          headerTintColor: c.text,
          headerShadowVisible: false,
        }} />
        <View style={{ flex: 1, backgroundColor: c.background, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={ACCENT} />
        </View>
      </>
    );
  }

  // ── Own Pro gate — tease with one real, unlocked number, then blur the rest.
  //    Only for your own stats: viewing a Pro user's stats is free for everyone
  //    (the viewed user's Pro status is checked above). ──
  if (!viewedUserId && !isPro) {
    const c = Colors[colorScheme ?? 'dark'];
    // Everything below the hero stays locked. Labels are real so the preview is
    // honest about what's inside; the values are masked.
    const hasHours = hoursPending || (typeof totalHours === 'number' && totalHours > 0);
    const lockedTiles: { icon: 'music' | 'headphones' | 'users' | 'volume-up' | 'fire'; label: string; value: string }[] = [
      hasHours
        ? { icon: 'music',      label: 'Albums logged', value: String(loggedAlbums.length) }
        : { icon: 'headphones', label: 'Listening',     value: '•••' },
      { icon: 'users',     label: 'Artists',               value: '••' },
      { icon: 'volume-up', label: 'Avg rating',            value: '•••' },
      { icon: 'fire',      label: 'Best listening streak', value: '••' },
    ];
    const lockedSections = [
      { icon: 'pie-chart',  label: 'Genre Breakdown',      sub: 'What you actually listen to, ranked' },
      { icon: 'bar-chart',  label: 'Decade Distribution',  sub: 'Every decade you’ve logged, drillable by year' },
      { icon: 'users',      label: 'You vs the Community', sub: 'Where you rate higher and lower than everyone else' },
      { icon: 'line-chart', label: 'Growers & Faders',     sub: 'Albums your re-listens changed your mind about' },
      { icon: 'star',       label: 'Most Listend Artists', sub: 'Your most-played artists of all time' },
      { icon: 'flag',       label: 'Milestones',           sub: 'Your 1st, 50th, 100th album and when you logged it' },
    ];

    return (
      <>
        <Stack.Screen options={{
          title: 'My Stats',
          headerStyle: { backgroundColor: c.background },
          headerTintColor: c.text,
          headerShadowVisible: false,
        }} />
        <View style={{ flex: 1, backgroundColor: c.background }}>
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onLayout={e => { teaseViewportH.current = e.nativeEvent.layout.height; updatePinnedUnlock(); }}
            onScroll={e => { teaseScrollY.current = e.nativeEvent.contentOffset.y; updatePinnedUnlock(); }}>

            {/* Hero — one real number, given away for free, over the listener's
                own covers like the Pro screen. Durations aren't always cached,
                so fall back to the album count rather than showing a dash. */}
            <ReviewHero
              label={hasHours ? "You've listened for" : "You've logged"}
              albums={loggedAlbums}
              value={hasHours ? totalHours : loggedAlbums.length}
              caption={hasHours
                ? (totalHours === 1 ? 'hour' : 'hours')
                : (loggedAlbums.length === 1 ? 'album' : 'albums')}
              note={firstLogged ? `Since ${firstLogged}` : undefined}
              cardBg={c.card}
              cardBorder={c.border}
              tint={ACCENT}
              subtextColor={c.subtext}
              mutedColor={c.subtext}
            />
            <Text style={{ color: c.subtext, fontSize: 13, textAlign: 'center', lineHeight: 20, marginTop: 12, paddingHorizontal: 12 }}>
              That's one of {lockedSections.length + lockedTiles.length + 1} things My Stats knows about your listening. Here's the rest.
            </Text>

            {/* Locked tiles + sections, faded behind a scrim */}
            <View style={{ marginTop: 14 }}>
              <View style={{ opacity: 0.4 }} pointerEvents="none">
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {lockedTiles.map(t => (
                    <View key={t.label} style={{ flexBasis: '47%', flexGrow: 1, flexDirection: 'row' }}>
                      <StatTile icon={t.icon} value={t.value} label={t.label}
                        tint={ACCENT} textColor={c.text} subtextColor={c.subtext} bg={c.card} border={c.border} />
                    </View>
                  ))}
                </View>

                <View style={{ marginTop: 10, gap: 10 }}>
                  {lockedSections.map(sec => (
                    <View
                      key={sec.label}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: c.card, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, padding: 16 }}>
                      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(212,160,23,0.14)', alignItems: 'center', justifyContent: 'center' }}>
                        <FontAwesome name={sec.icon as any} size={15} color={ACCENT} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: c.text, fontSize: 14, fontWeight: '700' }}>{sec.label}</Text>
                        <Text style={{ color: c.subtext, fontSize: 12, marginTop: 2 }}>{sec.sub}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              {/* Fade the locked stack out into the background */}
              <LinearGradient
                colors={['transparent', c.background]}
                style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 220 }}
                pointerEvents="none"
              />
            </View>

            {/* The same pitch as the recaps: on the listener's own covers */}
            <View
              style={{ marginTop: 4 }}
              onLayout={e => { setTeaseCardY(e.nativeEvent.layout.y); updatePinnedUnlock(e.nativeEvent.layout.y); }}>
              <UnlockCard
                title="Unlock My Stats"
                sub={`Genres, decades, you vs the community and more, all from your ${loggedAlbums.length} album${loggedAlbums.length === 1 ? '' : 's'}.`}
                albums={loggedAlbums}
                colors={c}
              />
            </View>
          </ScrollView>

          {/* Pinned until the card above scrolls into view */}
          <Animated.View
            pointerEvents={pinnedUnlockShown ? 'auto' : 'none'}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, opacity: pinnedUnlockOpacity, paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: c.background, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }}>
            <Pressable
              onPress={showPaywall}
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
              <View style={{ backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 15, alignItems: 'center' }}>
                <Text style={{ color: '#0F0A07', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 }}>
                  Unlock My Stats
                </Text>
              </View>
            </Pressable>
          </Animated.View>

        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{
        title: viewedUserId && params.displayName ? `${params.displayName}'s Stats` : 'My Stats',
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }} />
      <RankedListModal
        title={rankedModal === 'artists'
          ? (artistView === 'listend' ? 'Most Listend Artists' : 'Highest Rated Artists')
          : rankedModal === 'genres'
            ? (genreView === 'listend' ? 'Most Listend Genres' : 'Highest Rated Genres')
            : null}
        items={rankedModal === 'artists' ? rankedArtistItems : rankedModal === 'genres' ? rankedGenreItems : []}
        showImages={rankedModal === 'artists'}
        searchPlaceholder={rankedModal === 'artists' ? 'Search artists' : undefined}
        onClose={() => setRankedModal(null)}
        themeColors={colors}
      />
      <AlbumListModal
        title={listModal?.title ?? null}
        albums={listModal?.albums ?? []}
        onClose={() => setListModal(null)}
        onAlbumPress={(album) => { setListModal(null); setTimeout(() => handleAlbumPress(album), 300); }}
        onTitlePress={listModal?.onTitlePress}
        themeColors={colors}
      />
      <ArtistListModal
        visible={artistModalOpen}
        albums={loggedAlbums}
        onClose={() => setArtistModalOpen(false)}
        onArtistPress={(artist, artistAlbums) => setListModal({ title: artist, albums: artistAlbums })}
        themeColors={colors}
      />

      {/* ── Main tab toggle (own stats only) ────────────────────────────── */}
      {!viewedUserId && (
        <View style={{ flexDirection: 'row', backgroundColor: colors.background, paddingHorizontal: 20, paddingVertical: 10, gap: 8 }}>
          {(['stats', 'compare'] as const).map(t => (
            <Pressable
              key={t}
              onPress={() => setMainTab(t)}
              style={{
                flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center',
                backgroundColor: mainTab === t ? colors.tint : colors.surface,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: mainTab === t ? colors.tint : colors.border,
              }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: mainTab === t ? '#fff' : colors.subtext }}>
                {t === 'stats' ? 'My Stats' : 'Compare'}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* ── Compare tab ──────────────────────────────────────────────────── */}
      {mainTab === 'compare' && !viewedUserId && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView
            style={[s.container, { backgroundColor: colors.background }]}
            contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 48 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">

            {/* Shared Albums Modal */}
            <Modal visible={sharedModal === 'albums'} animationType="slide" onRequestClose={() => setSharedModal(null)}>
              <View style={{ flex: 1, backgroundColor: colors.background }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: insets.top + 16 }}>
                  <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>{sharedAlbumList.length} Albums in Common</Text>
                  <Pressable onPress={() => setSharedModal(null)}><FontAwesome name="times" size={20} color={colors.subtext} /></Pressable>
                </View>
                <FlatList
                  data={sharedAlbumList}
                  keyExtractor={a => a.id}
                  contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 12 }}
                  renderItem={({ item }) => {
                    const myEntry = ownAlbums.find(a => a.id === item.id);
                    return (
                      <Pressable
                        onPress={() => { setSharedModal(null); setTimeout(() => handleAlbumPress(item), 300); }}
                        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.7 : 1 })}>
                        {item.artworkUrl
                          ? <ExpoImage source={{ uri: item.artworkUrl }} style={{ width: 48, height: 48, borderRadius: 6 }} contentFit="cover" />
                          : <View style={{ width: 48, height: 48, borderRadius: 6, backgroundColor: CARD_BG }} />}
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>{item.title}</Text>
                          <Text style={{ color: colors.subtext, fontSize: 12 }} numberOfLines={1}>{item.artist}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 2 }}>
                          {myEntry && effectiveRating(myEntry) > 0 ? <Text style={{ color: ACCENT, fontSize: 12, fontWeight: '700' }}>You: {effectiveRating(myEntry)}</Text> : null}
                          {effectiveRating(item) > 0 ? <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: '600' }}>Them: {effectiveRating(item)}</Text> : null}
                        </View>
                      </Pressable>
                    );
                  }}
                />
              </View>
            </Modal>

            {/* Shared Artists Modal */}
            <Modal visible={sharedModal === 'artists'} animationType="slide" onRequestClose={() => setSharedModal(null)}>
              <View style={{ flex: 1, backgroundColor: colors.background }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: insets.top + 16 }}>
                  <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>{sharedArtistList.length} Artists in Common</Text>
                  <Pressable onPress={() => setSharedModal(null)}><FontAwesome name="times" size={20} color={colors.subtext} /></Pressable>
                </View>
                <FlatList
                  data={sharedArtistList}
                  keyExtractor={a => a}
                  contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 8 }}
                  renderItem={({ item: artist }) => {
                    const myCount = ownAlbums.filter(a => a.artist.toLowerCase().trim() === artist).length;
                    const theirCount = friendAlbums.filter(a => a.artist.toLowerCase().trim() === artist).length;
                    const displayName = ownAlbums.find(a => a.artist.toLowerCase().trim() === artist)?.artist ?? artist;
                    return (
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
                        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', flex: 1 }} numberOfLines={1}>{displayName}</Text>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                          <Text style={{ color: ACCENT, fontSize: 12, fontWeight: '700' }}>You: {myCount}</Text>
                          <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: '600' }}>Them: {theirCount}</Text>
                        </View>
                      </View>
                    );
                  }}
                />
              </View>
            </Modal>

            {/* Search bar — suggestions appear as you type */}
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, paddingHorizontal: 12 }}>
              <FontAwesome name="search" size={14} color={colors.subtext} />
              <TextInput
                style={{ flex: 1, paddingHorizontal: 10, paddingVertical: 11, color: colors.text, fontSize: 15 }}
                placeholder="Search by name or @username"
                placeholderTextColor={colors.subtext}
                value={compareQuery}
                onChangeText={handleCompareQueryChange}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={() => { if (compareResults[0]) selectCompareFriend(compareResults[0]); }}
              />
              {compareSearching
                ? <ActivityIndicator size="small" color={colors.subtext} />
                : compareQuery.length > 0 && (
                  <Pressable onPress={clearCompareSearch} hitSlop={10} style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
                    <FontAwesome name="times-circle" size={16} color={colors.subtext} />
                  </Pressable>
                )}
            </View>

            {/* Live suggestions */}
            {!compareFriend && compareQuery.trim().length > 0 && compareResults.length > 0 && (
              <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border, padding: 0, overflow: 'hidden' }]}>
                {compareResults.map((person, i) => renderComparePersonRow(person, i))}
              </View>
            )}
            {!compareFriend && !compareSearching && compareError && compareQuery.trim().length > 0 && (
              <Text style={{ color: colors.subtext, fontSize: 14, textAlign: 'center', marginTop: 20 }}>{compareError}</Text>
            )}

            {/* Following list — shown while the search box is empty */}
            {!compareFriend && compareQuery.trim().length === 0 && followingList.length > 0 && (
              <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border, padding: 0, overflow: 'hidden' }]}>
                <Text style={[s.cardTitle, { color: colors.textMuted, paddingHorizontal: 18, paddingTop: 16, marginBottom: 0 }]}>PEOPLE YOU FOLLOW</Text>
                {followingList.map((person, i) => renderComparePersonRow(person, i))}
              </View>
            )}

            {/* Friend found but not Pro */}
            {compareFriend && !compareFriend.isPro && (
              <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border, alignItems: 'center', gap: 8 }]}>
                {compareFriend.avatarUrl
                  ? <ExpoImage source={{ uri: compareFriend.avatarUrl }} style={{ width: 56, height: 56, borderRadius: 28 }} contentFit="cover" />
                  : <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: CARD_BG, alignItems: 'center', justifyContent: 'center' }}><FontAwesome name="user" size={24} color={SUBTEXT} /></View>}
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>{compareFriend.displayName}</Text>
                {handleText(compareFriend.username, compareFriend.id)
                  ? <Text style={{ color: colors.subtext, fontSize: 13 }}>{handleText(compareFriend.username, compareFriend.id)}</Text>
                  : null}
                <View style={{ marginTop: 8, backgroundColor: colors.background, borderRadius: 10, padding: 14, alignItems: 'center', gap: 4 }}>
                  <Text style={{ color: ACCENT, fontSize: 15, fontWeight: '700' }}>Pro required</Text>
                  <Text style={{ color: colors.subtext, fontSize: 13, textAlign: 'center', lineHeight: 18 }}>This user doesn't have Pro — their stats aren't available for comparison.</Text>
                </View>
              </View>
            )}

            {/* Friend found and is Pro */}
            {compareFriend?.isPro && (
              <>
                {friendLoading
                  ? <ActivityIndicator color={colors.tint} style={{ marginTop: 20 }} />
                  : (() => {
                    const them = { name: compareFriend.displayName, avatarUrl: compareFriend.avatarUrl };
                    const cc = { text: colors.text, subtext: colors.subtext, muted: colors.textMuted, tint: colors.tint, cardBg: colors.surface, cardBorder: colors.border, background: colors.background };
                    const num = (v: unknown) => (typeof v === 'number' ? v : null);
                    return (
                      <>
                        <CompareHero
                          me={me} them={them}
                          compatibility={compatibility}
                          label={taste.label}
                          sharedAlbums={sharedAlbumList}
                          sharedArtists={sharedArtistList.length}
                          fallbackAlbums={[...ownAlbums, ...friendAlbums]}
                          colors={cc}
                        />

                        <HeadToHead me={me} them={them} colors={cc} rows={[
                          { icon: 'music',      label: 'Albums',         mine: String(ownAlbums.length), theirs: String(friendAlbums.length), mineN: ownAlbums.length, theirsN: friendAlbums.length },
                          { icon: 'headphones', label: 'Listening hrs',  mine: String(totalHours), theirs: String(friendHoursVal), mineN: num(totalHours), theirsN: num(friendHoursVal) },
                          { icon: 'users',      label: 'Artists',        mine: String(uniqueArtists), theirs: String(friendArtistCount), mineN: uniqueArtists, theirsN: friendArtistCount },
                          { icon: 'volume-up',  label: 'Avg rating',     mine: String(avgRating), theirs: String(friendAvgRating), mineN: num(Number(avgRating)), theirsN: num(Number(friendAvgRating)), rating: true },
                          { icon: 'pencil',     label: 'Reviews',        mine: String(myReviewCount), theirs: String(friendReviewCount), mineN: myReviewCount, theirsN: friendReviewCount },
                          { icon: 'repeat',     label: 'Re-listen rate', mine: `${myRelistenRate}%`, theirs: `${friendRelistenRate}%`, mineN: myRelistenRate, theirsN: friendRelistenRate },
                          { icon: 'calendar',   label: 'Avg era',        mine: String(myAvgEra ?? '—'), theirs: String(friendAvgEra ?? '—') },
                          { icon: 'fire',       label: 'Peak month',     mine: myActiveMonth, theirs: friendActiveMonth },
                        ]} />

                        <InCommon
                          albums={sharedAlbumsBest}
                          albumRatings={sharedAlbumRatings}
                          artists={sharedArtistNames}
                          artistImages={artistImages}
                          likedArtists={sharedLikedArtists.map(a => a.name)}
                          onAlbumPress={handleAlbumPress}
                          onSeeAlbums={() => setSharedModal('albums')}
                          onSeeArtists={() => setSharedModal('artists')}
                          colors={cc}
                        />

                        <RatingCompare mine={ownAlbums} theirs={friendAlbums} theirName={them.name} colors={cc} />

                        <GenreCompare mine={ownAlbums} theirs={friendAlbums} theirName={them.name} colors={cc} />

                        {(friendTop5Albums.length > 0 || friendTop5Artists.length > 0) && (
                          <Top5Overlap
                            theirName={them.name}
                            albums={friendTop5Albums}
                            artists={friendTop5Artists}
                            sharedAlbumIds={new Set(sharedTop5Albums.map(a => a.id))}
                            sharedArtistIds={new Set(sharedTop5Artists.map(a => a.id))}
                            colors={cc}
                          />
                        )}
                      </>
                    );
                  })()}
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* ── My Stats tab ─────────────────────────────────────────────────── */}
      {(mainTab === 'stats' || viewedUserId) && (
      <ScrollView
        style={[s.container, { backgroundColor: colors.background }]}
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}>

        {/* ── Hero: all-time count over your best covers, like the reviews ── */}
        <ReviewHero
          label="All time"
          albums={loggedAlbums}
          note={firstLogged ? `Since ${firstLogged}` : undefined}
          onPress={heroStats[0].onPress}
          cardBg={cardBg}
          cardBorder={cardBorder}
          tint={colors.tint}
          subtextColor={colors.subtext}
          mutedColor={colors.textMuted}
        />

        {/* ── The rest of the headline stats (the hero has the album count) ── */}
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <StatTile icon="headphones" value={totalHours} unit=" hrs" label="Listening"
              tint={colors.tint} textColor={colors.text} subtextColor={colors.subtext} bg={cardBg} border={cardBorder} />
            <StatTile icon="users" value={uniqueArtists} label="Artists" onPress={heroStats[2].onPress}
              tint={colors.tint} textColor={colors.text} subtextColor={colors.subtext} bg={cardBg} border={cardBorder} />
            <StatTile icon="volume-up" value={avgRating} unit=" /10" label="Avg rating"
              extra={avgRating !== '—' ? (
                <VolumeBars rating={Math.round(Number(avgRating))} activeColor={colors.tint} inactiveColor={cardBorder} />
              ) : undefined}
              tint={colors.tint} textColor={colors.text} subtextColor={colors.subtext} bg={cardBg} border={cardBorder} />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <StatTile icon="fire" value={longestStreak > 0 ? longestStreak : '—'} unit={longestStreak === 1 ? ' day' : ' days'} label="Best listening streak"
              tint={colors.tint} textColor={colors.text} subtextColor={colors.subtext} bg={cardBg} border={cardBorder} />
            <StatTile icon="random" value={flipStreak > 0 ? flipStreak : '—'} unit=" in a row" label="Best flip streak"
              tint={colors.tint} textColor={colors.text} subtextColor={colors.subtext} bg={cardBg} border={cardBorder} />
          </View>
        </View>

        {/* ── Year in Review + Monthly Stats cards ──────────────────────── */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <ReviewLink
            icon="calendar"
            title="Year in Review"
            sub={viewedUserId ? 'Deep dive into their year' : 'Deep dive into your year'}
            onPress={() => router.push(viewedUserId
              ? { pathname: '/year-in-review', params: { userId: viewedUserId, displayName: params.displayName ?? '', proTheme: params.proTheme ?? '' } } as any
              : '/year-in-review' as any)}
            tint={colors.tint} textColor={colors.text} subtextColor={colors.subtext} bg={cardBg}
          />
          <ReviewLink
            icon="bar-chart"
            title="Monthly Stats"
            sub="Browse past months"
            onPress={() => router.push(viewedUserId
              ? { pathname: '/month-in-review', params: { userId: viewedUserId, displayName: params.displayName ?? '', proTheme: params.proTheme ?? '' } } as any
              : '/month-in-review' as any)}
            tint={colors.tint} textColor={colors.text} subtextColor={colors.subtext} bg={cardBg}
          />
        </View>

        {/* ── Milestones ────────────────────────────────────────────────── */}
        <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={s.cardTitleRow}>
            <Text style={[s.cardTitle, { color: colors.textMuted, marginBottom: 0 }]}>MILESTONES</Text>
            {loggedAlbums.length > 0 && (
              <Text style={[s.cardTitleValue, { color: colors.text }]}>{loggedAlbums.length} logged</Text>
            )}
          </View>
          <StatsMilestones
            albums={loggedAlbums}
            onAlbumPress={handleAlbumPress}
            tint={colors.tint}
            textColor={colors.text}
            subtextColor={colors.subtext}
            borderColor={cardBorder}
            trackColor={cardBorder}
          />
        </View>

        {/* ── Year Chart ────────────────────────────────────────────────── */}
        <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <Text style={[s.cardTitle, { color: colors.textMuted }]}>BY RELEASE YEAR</Text>
          <YearChart loggedAlbums={loggedAlbums} onAlbumPress={handleAlbumPress} tint={colors.tint} textColor={colors.text} subtextColor={colors.subtext} borderColor={colors.border} themeColors={colors} ownerName={viewedUserId ? (params.displayName || undefined) : undefined} />
        </View>

        {/* ── Rating Breakdown ───────────────────────────────────────────── */}
        <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={s.cardTitleRow}>
            <Text style={[s.cardTitle, { color: colors.textMuted, marginBottom: 0 }]}>RATING BREAKDOWN</Text>
            {ratedAlbums.length > 0 && <Text style={[s.cardTitleValue, { color: colors.text }]}>{avgRating} avg</Text>}
          </View>
          {ratedAlbums.length > 0 ? (
            <RatingChart
              albums={ratedAlbums.map(a => ({ id: a.id, title: a.title, artist: a.artist, artworkUrl: a.artworkUrl, year: a.year, rating: effectiveRating(a), listenedAt: a.dateLogged, album: a }))}
              whose={viewedUserId ? 'their' : 'your'}
              onAlbumPress={r => handleAlbumPress(r.album)}
              colors={{ text: colors.text, subtext: colors.subtext, tint: colors.tint, border: cardBorder }}
            />
          ) : (
            <EmptyState text="Rate some albums to see your breakdown." />
          )}
        </View>

        {/* ── Rated Higher / Lower Than Average ─────────────────────────── */}
        {ratedAlbums.length > 0 && (
          <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Text style={[s.cardTitle, { color: colors.textMuted }]}>RATED VS COMMUNITY</Text>
            {!communityLoaded ? <CommunityLoading tint={colors.tint} color={colors.subtext} /> : <>
            {!hasComparison && (
              <EmptyState text={`${viewedUserId ? 'Their' : 'Your'} ratings will be compared to the community once enough listeners have rated the same albums.`} />
            )}

            {/* Rated Higher */}
            <View style={rl.section}>
              <View style={rl.sectionHeader}>
                <View style={[rl.sectionBadge, { backgroundColor: GROW_CLR }]}>
                  <FontAwesome name="arrow-up" size={9} color="#fff" />
                </View>
                <Text style={[rl.sectionTitle, { color: colors.text }]}>Rated Higher</Text>
                <Text style={[rl.sectionSub, { color: SUBTEXT }]}>{compHigher.length} above avg</Text>
              </View>
              {compHigher.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[rl.carousel, { paddingTop: 4 }]}>
                  {compHigher.map(({ album, communityAvg }) => (
                    <ComparisonCard key={album.id} album={album} communityAvg={communityAvg} onPress={() => handleAlbumPress(album)} tint={colors.tint} textColor={colors.text} subtextColor={colors.subtext} isDark={isDark} />
                  ))}
                </ScrollView>
              ) : (
                <EmptyState text="Ratings are revealed once more listeners have rated this album." />
              )}
            </View>

            {/* Rated Lower */}
            <View style={[rl.section, { marginTop: 8 }]}>
              <View style={rl.sectionHeader}>
                <View style={[rl.sectionBadge, { backgroundColor: FADE_CLR }]}>
                  <FontAwesome name="arrow-down" size={9} color="#fff" />
                </View>
                <Text style={[rl.sectionTitle, { color: colors.text }]}>Rated Lower</Text>
                <Text style={[rl.sectionSub, { color: SUBTEXT }]}>{compLower.length} below avg</Text>
              </View>
              {compLower.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[rl.carousel, { paddingTop: 4 }]}>
                  {compLower.map(({ album, communityAvg }) => (
                    <ComparisonCard key={album.id} album={album} communityAvg={communityAvg} onPress={() => handleAlbumPress(album)} tint={colors.tint} textColor={colors.text} subtextColor={colors.subtext} isDark={isDark} />
                  ))}
                </ScrollView>
              ) : (
                <EmptyState text="Ratings are revealed once more listeners have rated this album." />
              )}
            </View>
            </>}
          </View>
        )}

        {/* ── Most Listend Artists ───────────────────────────────────────── */}
        <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={s.cardTitleRow}>
            <Text style={[s.cardTitle, { color: colors.textMuted, marginBottom: 0 }]}>MOST LISTEND ARTISTS</Text>
            <View style={[yc.toggle, { backgroundColor: colors.border }]}>
              {(['listend', 'rated'] as const).map(v => (
                <Pressable key={v} onPress={() => setArtistView(v)} style={[yc.toggleBtn, artistView === v && { backgroundColor: colors.tint }]}>
                  <Text style={[yc.toggleText, { color: colors.subtext }, artistView === v && yc.toggleTextActive]}>
                    {v === 'listend' ? 'Most Listend' : 'Highest Rated'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          {(() => {
            // Floor ensures 3 cards + 2 gaps never exceed container width on any screen size
            const GAP = 10;
            const cardW = Math.floor((screenWidth - 40 - 36 - GAP * 2) / 3);
            const items: [string, string][] = artistView === 'listend'
              ? topArtists.map(([a, c]) => [a, `${c} album${c !== 1 ? 's' : ''}`])
              : topRatedArtists.map(([a, avg]) => [a, `${avg.toFixed(1)} avg`]);
            if (items.length === 0) {
              return <EmptyState text={artistView === 'listend' ? 'Log some albums to see your top artists.' : 'Rate at least 2 albums per artist to see ratings.'} />;
            }
            // Chunk into explicit rows of 3 so layout never wraps unexpectedly
            const rows: [string, string][][] = [];
            for (let i = 0; i < items.length; i += 3) rows.push(items.slice(i, i + 3));
            const total = artistView === 'listend' ? allArtistsByCount.length : allRatedArtists.length;
            return (
              <View style={{ gap: 16 }}>
                {rows.map((row, ri) => (
                  <View key={ri} style={{ flexDirection: 'row', gap: GAP }}>
                    {row.map(([artist, sub]) => (
                      <ArtistGridCard
                        key={artist}
                        artist={artist}
                        label={sub}
                        imageUrl={artistImages[artist]}
                        cardW={cardW}
                        textColor={colors.text}
                        subtextColor={colors.subtext}
                        onPress={() => openArtistAlbums(artist, artistView === 'rated')}
                      />
                    ))}
                  </View>
                ))}
                {total > items.length && (
                  <SeeAllButton label={`See all ${total} artists`} tint={colors.tint} onPress={() => setRankedModal('artists')} />
                )}
              </View>
            );
          })()}
        </View>

        {/* ── Artists vs Community ───────────────────────────────────────── */}
        {ratedAlbums.length > 0 && (
          <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Text style={[s.cardTitle, { color: colors.textMuted }]}>ARTISTS VS COMMUNITY</Text>
            {!communityLoaded ? <CommunityLoading tint={colors.tint} color={colors.subtext} /> : artistHigher.length === 0 && artistLower.length === 0 ? (
              <EmptyState text={`${viewedUserId ? 'Their' : 'Your'} artist ratings will be compared to the community once enough listeners have rated 2+ of the same artist's albums.`} />
            ) : (
              ([
                { key: 'higher', entries: artistHigher, label: 'Rated Higher', sub: `${artistHigher.length} above avg`, color: GROW_CLR, icon: 'arrow-up' },
                { key: 'lower',  entries: artistLower,  label: 'Rated Lower',  sub: `${artistLower.length} below avg`,  color: FADE_CLR, icon: 'arrow-down' },
              ] as const).filter(g => g.entries.length > 0).map((g, i) => (
                <View key={g.key} style={[rl.section, i > 0 && { marginTop: 8 }]}>
                  <View style={rl.sectionHeader}>
                    <View style={[rl.sectionBadge, { backgroundColor: g.color }]}>
                      <FontAwesome name={g.icon} size={9} color="#fff" />
                    </View>
                    <Text style={[rl.sectionTitle, { color: colors.text }]}>{g.label}</Text>
                    <Text style={[rl.sectionSub, { color: SUBTEXT }]}>{g.sub}</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[rl.carousel, { paddingTop: 4 }]}>
                    {g.entries.map(entry => (
                      <ArtistComparisonCard
                        key={entry.artist}
                        entry={entry}
                        imageUrl={artistImages[entry.artist]}
                        youLabel={viewedUserId ? (params.displayName || 'Them') : 'You'}
                        textColor={colors.text}
                        subtextColor={colors.subtext}
                        onPress={() => setListModal({
                          title: entry.artist,
                          albums: entry.albums,
                          onTitlePress: () => {
                            setListModal(null);
                            setTimeout(() => router.push({ pathname: '/artist-detail', params: { name: entry.artist, artworkUrl: artistImages[entry.artist] ?? '' } } as any), 300);
                          },
                        })}
                      />
                    ))}
                  </ScrollView>
                </View>
              ))
            )}
          </View>
        )}

        {/* ── Genres: a donut for the mix, volume meters for ratings ───────── */}
        <GenresCard
          albums={loggedAlbums}
          onShowAlbums={(title, albums) => setListModal({ title, albums })}
          onSeeAll={v => { setGenreView(v); setRankedModal('genres'); }}
          colors={{ tint: colors.tint, text: colors.text, subtext: colors.subtext, muted: colors.textMuted, cardBg, cardBorder, toggleBg: colors.border }}
        />

        {/* ── Re-Listend ─────────────────────────────────────────────────── */}
        {reListenedAlbums.length > 0 && (
          <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Text style={[s.cardTitle, { color: colors.textMuted }]}>RE-LISTEND</Text>

            {/* Stats strip */}
            <View style={[rl.strip, { borderColor: cardBorder }]}>
              <View style={rl.cell}>
                <Text style={[rl.val, { color: colors.text }]}>{totalReListens}</Text>
                <Text style={[rl.lbl, { color: colors.subtext }]}>Re-Listens</Text>
              </View>
              <View style={[rl.divider, { backgroundColor: cardBorder }]} />
              <View style={rl.cell}>
                <Text style={[rl.val, { color: evAvgDelta >= 0.5 ? GROW_CLR : evAvgDelta <= -0.5 ? FADE_CLR : colors.subtext }]}>
                  {evAvgDelta > 0 ? '+' : ''}{evAvgDelta.toFixed(1)}
                </Text>
                <Text style={[rl.lbl, { color: colors.subtext }]}>Avg Change</Text>
              </View>
              <View style={[rl.divider, { backgroundColor: cardBorder }]} />
              <View style={rl.cell}>
                <Text style={[rl.val, { color: colors.text }]}>{evFirstListenAvg > 0 ? evFirstListenAvg.toFixed(1) : '—'}</Text>
                <Text style={[rl.lbl, { color: colors.subtext }]}>First Listen</Text>
              </View>
              <View style={[rl.divider, { backgroundColor: cardBorder }]} />
              <View style={rl.cell}>
                <Text style={[rl.val, { color: evLongTermAvg > evFirstListenAvg ? GROW_CLR : evLongTermAvg < evFirstListenAvg ? FADE_CLR : colors.text }]}>
                  {evLongTermAvg > 0 ? evLongTermAvg.toFixed(1) : '—'}
                </Text>
                <Text style={[rl.lbl, { color: colors.subtext }]}>Long-Term</Text>
              </View>
            </View>

            {/* Growers */}
            {evGrowers.length > 0 && (
              <View style={rl.section}>
                <View style={rl.sectionHeader}>
                  <View style={[rl.sectionBadge, { backgroundColor: GROW_CLR }]}>
                    <FontAwesome name="arrow-up" size={9} color="#fff" />
                  </View>
                  <Text style={[rl.sectionTitle, { color: colors.text }]}>Growers</Text>
                  <Text style={[rl.sectionSub, { color: SUBTEXT }]}>{evGrowers.length} grew on you</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={rl.carousel}>
                  {evGrowers.map(entry => (
                    <EvolutionCard
                      key={entry.album.id}
                      entry={entry}
                      onPress={() => setListModal({ title: entry.album.title, albums: [entry.album] })}
                      textColor={colors.text}
                      subtextColor={colors.subtext}
                      surfaceColor={colors.surface}
                    />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Faders */}
            {evFaders.length > 0 && (
              <View style={rl.section}>
                <View style={rl.sectionHeader}>
                  <View style={[rl.sectionBadge, { backgroundColor: FADE_CLR }]}>
                    <FontAwesome name="arrow-down" size={9} color="#fff" />
                  </View>
                  <Text style={[rl.sectionTitle, { color: colors.text }]}>Faders</Text>
                  <Text style={[rl.sectionSub, { color: SUBTEXT }]}>{evFaders.length} faded over time</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={rl.carousel}>
                  {evFaders.map(entry => (
                    <EvolutionCard
                      key={entry.album.id}
                      entry={entry}
                      onPress={() => setListModal({ title: entry.album.title, albums: [entry.album] })}
                      textColor={colors.text}
                      subtextColor={colors.subtext}
                      surfaceColor={colors.surface}
                    />
                  ))}
                </ScrollView>
              </View>
            )}

            {evGrowers.length === 0 && evFaders.length === 0 && (
              <EmptyState text="Re-listen to albums and rate them to see how your opinion changes." />
            )}
          </View>
        )}

        {/* ── Songs (hidden under 10 song logs) ──────────────────────────── */}
        <SongStatsCard
          userId={viewedUserId}
          albums={loggedAlbums}
          colors={colors}
          onSongPress={song => openSongPage(router, { id: song.songId, title: song.title, artist: song.artist, artworkUrl: song.artworkUrl, albumId: song.albumId, albumTitle: song.albumTitle, durationMs: song.durationMs })}
        />

        {/* ── Playlist Progress ──────────────────────────────────────────── */}
        <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <Text style={[s.cardTitle, { color: colors.textMuted }]}>PLAYLIST PROGRESS</Text>
          {(() => {
            const COL = 3;
            const RING_GAP = 12;
            const cellW = Math.floor((screenWidth - 40 - 36 - RING_GAP * (COL - 1)) / COL);
            const INITIAL_ROWS = 3;
            const visible = showAllPlaylists ? playlistProgress : playlistProgress.slice(0, INITIAL_ROWS * COL);
            const rows: typeof playlistProgress[] = [];
            for (let i = 0; i < visible.length; i += COL) {
              rows.push(visible.slice(i, i + COL));
            }
            return (
              <View style={{ gap: 20 }}>
                {rows.map((row, ri) => (
                  <View key={ri} style={{ flexDirection: 'row', gap: RING_GAP }}>
                    {row.map(pl => (
                      <Pressable
                        key={pl.id}
                        style={({ pressed }) => ({ width: cellW, alignItems: 'center', gap: 6, opacity: pressed ? 0.65 : 1 })}
                        onPress={() => {
                          if (pl.id === 'flip-a-record') {
                            router.push('/flip-a-record' as any);
                          } else if (pl.kind === 'genre') {
                            router.push({ pathname: '/discover-genre-grid', params: { genre: pl.id } } as any);
                          } else if (pl.kind === 'decade') {
                            router.push({ pathname: '/discover-decade-grid', params: { decade: pl.id } } as any);
                          } else {
                            router.push({ pathname: '/discover-featured-playlist', params: { id: pl.id, name: pl.name } } as any);
                          }
                        }}>
                        <ProgressRing done={pl.done} total={pl.total} size={68} tint={colors.tint} trackColor={cardBorder} textColor={colors.text} bgColor={cardBg} />
                        <Text style={[pp.name, { color: colors.text }]} numberOfLines={2}>{pl.name}</Text>
                        <Text style={[pp.count, { color: colors.subtext }]}>
                          {pl.total > 0 ? `${pl.done} / ${pl.total}` : '—'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ))}
                {playlistProgress.length > INITIAL_ROWS * COL && (
                  <Pressable
                    onPress={() => setShowAllPlaylists(v => !v)}
                    style={({ pressed }) => ({ alignItems: 'center', paddingVertical: 4, opacity: pressed ? 0.6 : 1 })}>
                    <Text style={{ color: colors.tint, fontSize: 14, fontWeight: '600' }}>
                      {showAllPlaylists ? 'See less' : `See all ${playlistProgress.length} playlists`}
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })()}
        </View>

      </ScrollView>
      )}
    </>
  );
}

// ─── Playlist Progress ────────────────────────────────────────────────────────

const GENRE_LABELS = [
  'Hip-Hop / Rap', 'Pop', 'Rock', 'Reggaeton', 'Afrobeats',
  'R&B / Soul', 'Electronic', 'Indie / Alternative', 'Metal',
  'Country', 'Jazz', 'Classical', 'Blues', 'Folk / Singer-Songwriter', 'Reggae',
];

const DECADE_LABELS = ['1950s', '1960s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s'];

const FEATURED_PLAYLISTS = [
  { id: 'flip-a-record',    name: 'Flip a Record'    },
  { id: 'all-time-classics',name: 'All-Time Classics' },
  { id: 'late-night',       name: 'Late Night'        },
  { id: 'summer',           name: 'Summer'            },
  { id: 'heartbreak',       name: 'Heartbreak'        },
  { id: 'road-trip',        name: 'Road Trip'         },
  { id: 'chill',            name: 'Chill'             },
  { id: 'hidden-gems',      name: 'Hidden Gems'       },
  { id: 'essentials',       name: 'Essentials'        },
];

function ProgressRing({
  done,
  total,
  size = 72,
  tint = ACCENT,
  trackColor = BORDER,
  textColor = TEXT,
  bgColor = CARD_BG,
}: {
  done: number;
  total: number;
  size?: number;
  tint?: string;
  trackColor?: string;
  textColor?: string;
  bgColor?: string;
}) {
  const strokeWidth = 6;
  const pct = total > 0 ? done / total : 0;
  const fillDeg = pct * 360;
  const r = size / 2;
  const innerR = r - strokeWidth;
  const label = total > 0 ? `${Math.round(pct * 100)}%` : '0%';
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Track disc */}
      <View style={{ position: 'absolute', width: size, height: size, borderRadius: r, backgroundColor: trackColor }} />
      {/* Accent fill — solid half-discs pivoted at circle center */}
      <View style={{ position: 'absolute', width: size, height: size, borderRadius: r, overflow: 'hidden' }}>
        {/* Right half-disc: covers 0–180° of fill, pivot at circle center (left edge) */}
        <View style={{ position: 'absolute', left: r, top: 0, width: r, height: size, overflow: 'hidden' }}>
          <View style={{
            position: 'absolute', left: 0, top: 0,
            width: r, height: size,
            borderTopRightRadius: r, borderBottomRightRadius: r,
            backgroundColor: tint,
            transform: [
              { translateX: -(r / 2) },
              { rotate: `${Math.min(fillDeg, 180) - 180}deg` },
              { translateX: r / 2 },
            ],
          }} />
        </View>
        {/* Left half-disc: covers 180–360° of fill, pivot at circle center (right edge) */}
        {fillDeg > 180 && (
          <View style={{ position: 'absolute', left: 0, top: 0, width: r, height: size, overflow: 'hidden' }}>
            <View style={{
              position: 'absolute', left: 0, top: 0,
              width: r, height: size,
              borderTopLeftRadius: r, borderBottomLeftRadius: r,
              backgroundColor: tint,
              transform: [
                { translateX: r / 2 },
                { rotate: `${360 - fillDeg}deg` },
                { translateX: -(r / 2) },
              ],
            }} />
          </View>
        )}
      </View>
      {/* Centre punch-out to create ring appearance */}
      <View style={{
        position: 'absolute',
        width: innerR * 2, height: innerR * 2, borderRadius: innerR,
        backgroundColor: bgColor,
      }} />
      <Text style={{ color: textColor, fontSize: 13, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={s.emptyWrap}>
      <Text style={s.emptyText}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content:   { padding: 20, gap: 16 },

  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 18,
    flexShrink: 1,
  },

  cardTitleRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  cardTitleValue: { color: TEXT, fontSize: 15, fontWeight: '700' },

  footnote:  { color: SUBTEXT, fontSize: 12, marginTop: 6 },
  emptyWrap: { alignItems: 'center', paddingVertical: 16 },
  emptyText: { color: SUBTEXT, fontSize: 14, textAlign: 'center', lineHeight: 20 },
});

// ─── Community comparison card ────────────────────────────────────────────────

function ComparisonCard({ album, communityAvg, onPress, tint = ACCENT, textColor = TEXT, subtextColor = SUBTEXT, isDark = true }: {
  album: LoggedAlbum;
  communityAvg: number;
  onPress: () => void;
  tint?: string;
  textColor?: string;
  subtextColor?: string;
  isDark?: boolean;
}) {
  const delta    = effectiveRating(album) - communityAvg;
  const isHigher = delta > 0;
  const deltaColor = isHigher ? GROW_CLR : FADE_CLR;
  const sign       = isHigher ? '+' : '';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [cc.card, { opacity: pressed ? 0.75 : 1 }]}>
      {album.artworkUrl ? (
        <ExpoImage source={{ uri: album.artworkUrl }} style={cc.art} contentFit="cover" cachePolicy="disk" />
      ) : (
        <View style={[cc.art, { backgroundColor: CARD_BG, alignItems: 'center', justifyContent: 'center' }]}>
          <FontAwesome name="music" size={20} color="rgba(255,255,255,0.3)" />
        </View>
      )}
      <View style={[cc.deltaBadge, { backgroundColor: deltaColor }]}>
        <Text style={cc.deltaBadgeText}>{sign}{delta.toFixed(1)}</Text>
      </View>
      <Text style={[cc.title, { color: textColor }]} numberOfLines={2}>{album.title}</Text>
      <VolumeBadge rating={effectiveRating(album)} tint={tint} isDark={isDark} />
      <Text style={[cc.communityAvg, { color: subtextColor }]}>Community: {communityAvg.toFixed(1)}</Text>
    </Pressable>
  );
}

// ─── Artist comparison card ───────────────────────────────────────────────────

function ArtistComparisonCard({ entry, imageUrl, youLabel, onPress, textColor = TEXT, subtextColor = SUBTEXT }: {
  entry: ArtistCompEntry;
  imageUrl?: string;
  youLabel: string;
  onPress: () => void;
  textColor?: string;
  subtextColor?: string;
}) {
  const isHigher = entry.delta > 0;
  const initial  = entry.artist.trim().charAt(0).toUpperCase();
  const bgColor  = INITIAL_COLORS[entry.artist.charCodeAt(0) % INITIAL_COLORS.length];
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [cc.card, { opacity: pressed ? 0.75 : 1 }]}>
      {imageUrl ? (
        <ExpoImage source={{ uri: imageUrl }} style={[cc.art, { borderRadius: 55 }]} contentFit="cover" cachePolicy="disk" />
      ) : (
        <View style={[cc.art, { borderRadius: 55, backgroundColor: bgColor, alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ color: '#fff', fontSize: 34, fontWeight: '800' }}>{initial}</Text>
        </View>
      )}
      <View style={[cc.deltaBadge, { top: 2, right: 2, backgroundColor: isHigher ? GROW_CLR : FADE_CLR }]}>
        <Text style={cc.deltaBadgeText}>{isHigher ? '+' : ''}{entry.delta.toFixed(1)}</Text>
      </View>
      <Text style={[cc.title, { color: textColor, textAlign: 'center' }]} numberOfLines={2}>{entry.artist}</Text>
      <Text style={[cc.communityAvg, { color: textColor, textAlign: 'center' }]} numberOfLines={1}>{youLabel}: {entry.mine.toFixed(1)}</Text>
      <Text style={[cc.communityAvg, { color: subtextColor, textAlign: 'center' }]}>Community: {entry.community.toFixed(1)}</Text>
    </Pressable>
  );
}

const cc = StyleSheet.create({
  card:           { width: 110, gap: 5 },
  art:            { width: 110, height: 110, borderRadius: 10 },
  deltaBadge:     { position: 'absolute', top: 8, right: 8, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 },
  deltaBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  title:          { color: TEXT,    fontSize: 12, fontWeight: '600', lineHeight: 16 },
  communityAvg:   { color: SUBTEXT, fontSize: 11, fontWeight: '500' },
});

const pp = StyleSheet.create({
  name:  { color: TEXT,    fontSize: 11, fontWeight: '600', textAlign: 'center', lineHeight: 15 },
  count: { color: SUBTEXT, fontSize: 11, fontWeight: '500', textAlign: 'center' },
});

const rl = StyleSheet.create({
  strip:        { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', marginBottom: 4 },
  cell:         { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 3 },
  divider:      { width: StyleSheet.hairlineWidth, height: 32 },
  val:          { color: TEXT,    fontSize: 17, fontWeight: '700' },
  lbl:          { color: SUBTEXT, fontSize: 10, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.6, textAlign: 'center' },
  section:      { paddingTop: 16, gap: 10 },
  sectionHeader:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionBadge: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: TEXT },
  sectionSub:   { fontSize: 12, fontWeight: '500' },
  carousel:     { gap: 12, paddingBottom: 4 },
});
