import {
  StyleSheet,
  View,
  Text,
  Pressable,
  FlatList,
  Modal,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useCallback, useEffect, useRef } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Stack } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAlbums, LoggedAlbum } from '@/context/AlbumsContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { navigateToAlbum } from '@/lib/navigateToAlbum';

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT   = '#D4A017';
const GROW_CLR = '#4caf50';
const FADE_CLR = '#e05252';
const CARD_BG  = '#2E2018';
const BORDER   = '#2a1e14';
const TEXT     = '#f5e6c8';
const SUBTEXT  = '#A08060';

// ─── Types ────────────────────────────────────────────────────────────────────

type EvolutionEntry = {
  album:       LoggedAlbum;
  firstRating: number;
  latestRating: number;
  delta:       number;
};

type SessionEntry = {
  listenedAt: string;
  rating: number;
  review?: string;
  isOriginal: boolean;
  reListenIndex?: number;
};

type HistoryModalData = {
  album: LoggedAlbum;
  entries: SessionEntry[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(raw: string): string {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Album row item ───────────────────────────────────────────────────────────

function ReListenedAlbumRow({
  album,
  isDark,
  colors,
  onPress,
}: {
  album: LoggedAlbum;
  isDark: boolean;
  colors: any;
  onPress: () => void;
}) {
  const totalListens = (album.reListenCount ?? 0) + 1;
  return (
    <Pressable
      style={({ pressed }) => [s.albumRow, { borderBottomColor: isDark ? '#2a1e14' : '#e8e8e8', opacity: pressed ? 0.7 : 1 }]}
      onPress={onPress}>
      {album.artworkUrl ? (
        <ExpoImage
          source={{ uri: album.artworkUrl }}
          style={s.albumArt}
          contentFit="cover"
          cachePolicy="disk"
        />
      ) : (
        <View style={[s.albumArt, { backgroundColor: album.coverColor ?? '#2E2018', justifyContent: 'center', alignItems: 'center' }]}>
          <FontAwesome name="music" size={20} color="rgba(255,255,255,0.4)" />
        </View>
      )}
      <View style={s.albumInfo}>
        <Text style={[s.albumTitle, { color: colors.text }]} numberOfLines={1}>{album.title}</Text>
        <Text style={[s.albumArtist, { color: colors.subtext }]} numberOfLines={1}>{album.artist}{album.year > 0 ? ` · ${album.year}` : ''}</Text>
        <View style={s.listenCountRow}>
          <FontAwesome name="repeat" size={11} color="#D4A017" />
          <Text style={s.listenCountText}>{totalListens} listen{totalListens !== 1 ? 's' : ''}</Text>
        </View>
      </View>
      <FontAwesome name="chevron-right" size={12} color={colors.subtext} />
    </Pressable>
  );
}

// ─── History Modal ─────────────────────────────────────────────────────────────

function HistoryModal({
  data,
  isDark,
  colors,
  onClose,
  onAlbumPress,
  onDeleteEntry,
}: {
  data: HistoryModalData;
  isDark: boolean;
  colors: any;
  onClose: () => void;
  onAlbumPress: () => void;
  onDeleteEntry?: (entry: SessionEntry) => void;
}) {
  const insets = useSafeAreaInsets();
  const border = isDark ? '#2a1e14' : '#e5e5e5';
  const { album, entries } = data;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }}>
        {/* Header */}
        <View style={[hm.header, { borderBottomColor: border }]}>
          <Pressable onPress={onClose} hitSlop={12}>
            <FontAwesome name="chevron-down" size={16} color={isDark ? '#A08060' : '#6B4C35'} />
          </Pressable>
          <Text style={[hm.headerTitle, { color: colors.text }]}>Listen History</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={hm.body} showsVerticalScrollIndicator={false}>
          {/* Album header */}
          <Pressable
            style={({ pressed }) => [hm.albumRow, { opacity: pressed ? 0.7 : 1 }]}
            onPress={onAlbumPress}>
            {album.artworkUrl ? (
              <ExpoImage source={{ uri: album.artworkUrl }} style={hm.art} contentFit="cover" cachePolicy="disk" />
            ) : (
              <View style={[hm.art, { backgroundColor: album.coverColor ?? '#2E2018', justifyContent: 'center', alignItems: 'center' }]}>
                <FontAwesome name="music" size={24} color="rgba(255,255,255,0.4)" />
              </View>
            )}
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[hm.albumTitle, { color: colors.text }]} numberOfLines={2}>{album.title}</Text>
              <Text style={[hm.albumArtist, { color: isDark ? '#A08060' : '#6B4C35' }]} numberOfLines={1}>
                {album.artist}{album.year > 0 ? ` · ${album.year}` : ''}
              </Text>
              <View style={hm.listenCountBadge}>
                <FontAwesome name="repeat" size={11} color="#D4A017" />
                <Text style={hm.listenCountBadgeText}>{entries.length} listen{entries.length !== 1 ? 's' : ''} total</Text>
              </View>
            </View>
          </Pressable>

          {/* Session entries */}
          <View style={[hm.entriesContainer, { borderColor: border }]}>
            {entries.map((entry, idx) => (
              <View
                key={idx}
                style={[hm.entryRow, idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border }]}>
                <View style={[hm.entryIconWrap, { backgroundColor: entry.isOriginal ? '#D4A017' : (isDark ? '#2E2018' : '#f0ede8') }]}>
                  <FontAwesome
                    name={entry.isOriginal ? 'headphones' : 'repeat'}
                    size={13}
                    color={entry.isOriginal ? '#fff' : '#D4A017'}
                  />
                </View>
                <View style={hm.entryInfo}>
                  <Text style={[hm.entryLabel, { color: colors.text }]}>
                    {entry.isOriginal ? 'First listen' : `Re-listen #${entry.reListenIndex}`}
                  </Text>
                  <Text style={[hm.entryDate, { color: isDark ? '#A08060' : '#6B4C35' }]}>
                    {formatDate(entry.listenedAt)}
                  </Text>
                  {entry.review ? (
                    <Text style={[hm.entryReview, { color: isDark ? '#a07850' : '#7a5535' }]} numberOfLines={3}>
                      "{entry.review}"
                    </Text>
                  ) : null}
                </View>
                {entry.rating > 0 && (
                  <View style={[hm.entryRating, { borderColor: '#D4A017' }]}>
                    <Text style={hm.entryRatingText}>{entry.rating}</Text>
                  </View>
                )}
                {!entry.isOriginal && onDeleteEntry && (
                  <Pressable
                    onPress={() => onDeleteEntry(entry)}
                    hitSlop={10}
                    style={({ pressed }) => [hm.trashBtn, { opacity: pressed ? 0.5 : 1 }]}>
                    <FontAwesome name="trash" size={13} color="#8B1A1A" />
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const hm = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  body: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 48, gap: 20 },
  albumRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  art: { width: 80, height: 80, borderRadius: 10, flexShrink: 0 },
  albumTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  albumArtist: { fontSize: 13 },
  listenCountBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  listenCountBadgeText: { color: '#D4A017', fontSize: 12, fontWeight: '600' },
  entriesContainer: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  entryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  entryIconWrap: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 },
  entryInfo: { flex: 1, gap: 3 },
  entryLabel: { fontSize: 14, fontWeight: '600' },
  entryDate: { fontSize: 12 },
  entryReview: { fontSize: 13, fontStyle: 'italic', marginTop: 4, lineHeight: 18 },
  entryRating: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 2 },
  entryRatingText: { color: '#D4A017', fontSize: 12, fontWeight: '700' },
  trashBtn: { padding: 4, alignSelf: 'flex-start', marginTop: 4 },
});

// ─── Evolution card (Growers / Faders carousel) ───────────────────────────────

function EvolutionCard({
  entry,
  onPress,
}: {
  entry: EvolutionEntry;
  onPress: () => void;
}) {
  const { album, firstRating, latestRating, delta } = entry;
  const isGrow = delta > 0;
  const deltaColor = isGrow ? GROW_CLR : FADE_CLR;
  const sign       = isGrow ? '+' : '';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [ec.card, { opacity: pressed ? 0.75 : 1 }]}>
      {album.artworkUrl ? (
        <ExpoImage source={{ uri: album.artworkUrl }} style={ec.art} contentFit="cover" cachePolicy="disk" />
      ) : (
        <View style={[ec.art, { backgroundColor: CARD_BG, alignItems: 'center', justifyContent: 'center' }]}>
          <FontAwesome name="music" size={22} color="rgba(255,255,255,0.3)" />
        </View>
      )}
      {/* Delta badge */}
      <View style={[ec.deltaBadge, { backgroundColor: deltaColor }]}>
        <Text style={ec.deltaBadgeText}>{sign}{delta}</Text>
      </View>
      <Text style={ec.title} numberOfLines={2}>{album.title}</Text>
      <View style={ec.ratingRow}>
        <Text style={ec.ratingOld}>{firstRating}</Text>
        <FontAwesome name={isGrow ? 'arrow-up' : 'arrow-down'} size={10} color={deltaColor} />
        <Text style={[ec.ratingNew, { color: deltaColor }]}>{latestRating}</Text>
      </View>
    </Pressable>
  );
}

const ec = StyleSheet.create({
  card:          { width: 110, gap: 6 },
  art:           { width: 110, height: 110, borderRadius: 10 },
  deltaBadge:    { position: 'absolute', top: 8, right: 8, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  deltaBadgeText:{ color: '#fff', fontSize: 12, fontWeight: '800' },
  title:         { color: TEXT,    fontSize: 12, fontWeight: '600', lineHeight: 16 },
  ratingRow:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ratingOld:     { color: SUBTEXT, fontSize: 12, fontWeight: '600' },
  ratingNew:     { fontSize: 12, fontWeight: '700' },
});

// ─── Analytics header (shown above album list) ────────────────────────────────

function AnalyticsHeader({
  growers,
  faders,
  avgDelta,
  firstListenAvg,
  longTermAvg,
  totalRelistens,
  isDark,
  colors,
  onCardPress,
}: {
  growers:       EvolutionEntry[];
  faders:        EvolutionEntry[];
  avgDelta:      number;
  firstListenAvg: number;
  longTermAvg:   number;
  totalRelistens: number;
  isDark:        boolean;
  colors:        any;
  onCardPress:   (album: LoggedAlbum) => void;
}) {
  const border = isDark ? BORDER : '#e5e5e5';
  const cardBg = isDark ? CARD_BG : colors.card;
  const hasEvolution = growers.length > 0 || faders.length > 0;

  const deltaSign   = avgDelta > 0 ? '+' : '';
  const deltaColor  = avgDelta >= 0.5 ? GROW_CLR : avgDelta <= -0.5 ? FADE_CLR : SUBTEXT;

  if (!hasEvolution && totalRelistens === 0) return null;

  return (
    <View style={[ah.wrap, { borderBottomColor: border }]}>

      {/* ── Stats strip ── */}
      <View style={[ah.statsStrip, { backgroundColor: cardBg, borderColor: border }]}>
        <View style={ah.statCell}>
          <Text style={ah.statVal}>{totalRelistens}</Text>
          <Text style={ah.statLbl}>Re-Listens</Text>
        </View>
        <View style={[ah.statDivider, { backgroundColor: border }]} />
        <View style={ah.statCell}>
          <Text style={[ah.statVal, { color: deltaColor }]}>{deltaSign}{avgDelta.toFixed(1)}</Text>
          <Text style={ah.statLbl}>Avg Change</Text>
        </View>
        <View style={[ah.statDivider, { backgroundColor: border }]} />
        <View style={ah.statCell}>
          <Text style={ah.statVal}>{firstListenAvg > 0 ? firstListenAvg.toFixed(1) : '—'}</Text>
          <Text style={ah.statLbl}>First Listen</Text>
        </View>
        <View style={[ah.statDivider, { backgroundColor: border }]} />
        <View style={ah.statCell}>
          <Text style={[ah.statVal, { color: longTermAvg > firstListenAvg ? GROW_CLR : longTermAvg < firstListenAvg ? FADE_CLR : TEXT }]}>
            {longTermAvg > 0 ? longTermAvg.toFixed(1) : '—'}
          </Text>
          <Text style={ah.statLbl}>Long-Term</Text>
        </View>
      </View>

      {/* ── Growers ── */}
      {growers.length > 0 && (
        <View style={ah.section}>
          <View style={ah.sectionHeader}>
            <View style={[ah.sectionBadge, { backgroundColor: GROW_CLR }]}>
              <FontAwesome name="arrow-up" size={10} color="#fff" />
            </View>
            <Text style={[ah.sectionTitle, { color: colors.text }]}>Growers</Text>
            <Text style={[ah.sectionSub, { color: SUBTEXT }]}>{growers.length} album{growers.length !== 1 ? 's' : ''} that grew on you</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ah.carousel}>
            {growers.map(entry => (
              <EvolutionCard key={entry.album.id} entry={entry} onPress={() => onCardPress(entry.album)} />
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Faders ── */}
      {faders.length > 0 && (
        <View style={ah.section}>
          <View style={ah.sectionHeader}>
            <View style={[ah.sectionBadge, { backgroundColor: FADE_CLR }]}>
              <FontAwesome name="arrow-down" size={10} color="#fff" />
            </View>
            <Text style={[ah.sectionTitle, { color: colors.text }]}>Faders</Text>
            <Text style={[ah.sectionSub, { color: SUBTEXT }]}>{faders.length} album{faders.length !== 1 ? 's' : ''} that faded over time</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ah.carousel}>
            {faders.map(entry => (
              <EvolutionCard key={entry.album.id} entry={entry} onPress={() => onCardPress(entry.album)} />
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Section label for album list below ── */}
      <View style={[ah.listLabel, { borderTopColor: border }]}>
        <Text style={[ah.listLabelText, { color: SUBTEXT }]}>ALL RE-LISTENS</Text>
      </View>
    </View>
  );
}

const ah = StyleSheet.create({
  wrap:         { paddingBottom: 0 },
  statsStrip:   {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 2,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  statCell:     { flex: 1, alignItems: 'center', paddingVertical: 14, gap: 3 },
  statDivider:  { width: StyleSheet.hairlineWidth, height: 36 },
  statVal:      { color: TEXT,    fontSize: 18, fontWeight: '700' },
  statLbl:      { color: SUBTEXT, fontSize: 10, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.6, textAlign: 'center' },

  section:      { paddingTop: 18, gap: 10 },
  sectionHeader:{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  sectionBadge: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  sectionSub:   { fontSize: 12, fontWeight: '500' },
  carousel:     { paddingHorizontal: 16, gap: 12, paddingBottom: 4 },

  listLabel:    { marginTop: 20, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  listLabelText:{ fontSize: 11, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

const COVER_COLORS = ['#2d5a27','#7a4a2e','#1a3018','#d4a017','#7a3a1a','#8b1a1a','#1a5a5a','#4a2818'];

export default function ReListenedScreen() {
  const colorScheme = useColorScheme();
  const colors      = Colors[colorScheme ?? 'light'];
  const isDark      = colorScheme === 'dark';
  const router      = useRouter();
  const { user }    = useAuth();
  const { loggedAlbums, removeReListenEntry } = useAlbums();
  const params      = useLocalSearchParams<{ userId?: string }>();

  const viewingOther = params.userId && params.userId !== user?.id ? params.userId : null;

  // For own profile: derive from context. For other user: fetch from Supabase.
  const [otherAlbums,    setOtherAlbums]    = useState<LoggedAlbum[]>([]);
  const [otherLoading,   setOtherLoading]   = useState(false);
  const [searchOpen,     setSearchOpen]     = useState(false);
  const [query,          setQuery]          = useState('');
  const searchRef = useRef<TextInput>(null);

  // Re-listen evolution data (growers / faders)
  const [allReLists, setAllReLists] = useState<Map<string, { rating: number; listenedAt: string }[]>>(new Map());

  useEffect(() => {
    if (!viewingOther) return;
    setOtherLoading(true);
    supabase
      .from('user_albums')
      .select('spotify_id, title, artist, artwork_url, year, rating, review, listened_at, re_listen_count')
      .eq('user_id', viewingOther)
      .eq('is_relistened', true)
      .not('listened_at', 'is', null)
      .then(({ data }) => {
        if (!data) { setOtherLoading(false); return; }
        // Fetch latest re-listen date per album
        supabase
          .from('re_listens')
          .select('spotify_id, listened_at')
          .eq('user_id', viewingOther)
          .order('listened_at', { ascending: false })
          .then(({ data: reData }) => {
            const latestReListenDate = new Map<string, string>();
            for (const r of (reData ?? []) as any[]) {
              if (!latestReListenDate.has(r.spotify_id)) {
                latestReListenDate.set(r.spotify_id, r.listened_at);
              }
            }
            const albums: LoggedAlbum[] = data.map((a, i) => ({
              id:             a.spotify_id,
              title:          a.title ?? '',
              artist:         a.artist ?? '',
              year:           a.year ?? 0,
              rating:         a.rating ?? 0,
              review:         a.review ?? undefined,
              dateLogged:     a.listened_at ?? new Date().toISOString(),
              artworkUrl:     a.artwork_url ?? undefined,
              coverColor:     COVER_COLORS[i % COVER_COLORS.length],
              reListenCount:  a.re_listen_count ?? 0,
              isRelistened:   true,
              lastListenedAt: latestReListenDate.get(a.spotify_id),
            }));
            albums.sort((a, b) => {
              const da = new Date(a.lastListenedAt ?? a.dateLogged).getTime();
              const db = new Date(b.lastListenedAt ?? b.dateLogged).getTime();
              return db - da;
            });
            setOtherAlbums(albums);
            setOtherLoading(false);
          });
      });
  }, [viewingOther]);

  // Fetch all re-listen rows once so we can compute growers/faders without opening each album
  useEffect(() => {
    if (viewingOther || !user?.id) return;
    supabase
      .from('re_listens')
      .select('spotify_id, rating, listened_at')
      .eq('user_id', user.id)
      .order('listened_at', { ascending: true })
      .then(({ data }) => {
        const map = new Map<string, { rating: number; listenedAt: string }[]>();
        for (const r of data ?? []) {
          if (!map.has(r.spotify_id)) map.set(r.spotify_id, []);
          map.get(r.spotify_id)!.push({ rating: r.rating ?? 0, listenedAt: r.listened_at ?? '' });
        }
        setAllReLists(map);
      });
  }, [user?.id, viewingOther]);

  const reListenedAlbums = viewingOther
    ? otherAlbums
    : [...loggedAlbums.filter(a => a.isRelistened === true)].sort((a, b) => {
        const da = new Date(a.lastListenedAt ?? a.dateLogged).getTime();
        const db = new Date(b.lastListenedAt ?? b.dateLogged).getTime();
        return db - da;
      });

  // ── Growers / Faders derivation ──────────────────────────────────────────────
  const growers: EvolutionEntry[] = [];
  const faders:  EvolutionEntry[] = [];
  let sumFirstRating = 0, sumLatestRating = 0, countRated = 0, totalRelistens = 0;
  for (const album of reListenedAlbums) {
    totalRelistens += album.reListenCount ?? 0;
    if (viewingOther) continue; // only compute for own profile where we have allReLists
    const lists = allReLists.get(album.id);
    if (!lists || lists.length === 0) continue;
    const latestRated = [...lists].reverse().find(r => r.rating > 0);
    const latestRating = latestRated?.rating ?? 0;
    const firstRating  = album.rating; // user_albums.rating = original listen rating
    if (firstRating <= 0 || latestRating <= 0) continue;
    const delta = latestRating - firstRating;
    sumFirstRating  += firstRating;
    sumLatestRating += latestRating;
    countRated++;
    if (delta >= 2)  growers.push({ album, firstRating, latestRating, delta });
    if (delta <= -2) faders.push({ album, firstRating, latestRating, delta });
  }
  growers.sort((a, b) => b.delta - a.delta);
  faders.sort((a, b) => a.delta - b.delta); // most negative first
  const avgDelta      = countRated > 0 ? (sumLatestRating - sumFirstRating) / countRated : 0;
  const firstListenAvg = countRated > 0 ? sumFirstRating  / countRated : 0;
  const longTermAvg    = countRated > 0 ? sumLatestRating / countRated : 0;

  const displayAlbums = query.trim()
    ? reListenedAlbums.filter(a =>
        a.title.toLowerCase().includes(query.toLowerCase()) ||
        a.artist.toLowerCase().includes(query.toLowerCase())
      )
    : reListenedAlbums;

  const targetUserId     = viewingOther ?? user?.id ?? '';

  const [historyData,    setHistoryData]    = useState<HistoryModalData | null>(null);
  const [loadingAlbumId, setLoadingAlbumId] = useState<string | null>(null);

  const handleAlbumPress = useCallback(async (album: LoggedAlbum) => {
    if (!targetUserId) return;
    setLoadingAlbumId(album.id);

    try {
      const [{ data: userAlbumData }, { data: reListenData }] = await Promise.all([
        supabase
          .from('user_albums')
          .select('rating, review, listened_at')
          .eq('user_id', targetUserId)
          .eq('spotify_id', album.id)
          .single(),
        supabase
          .from('re_listens')
          .select('rating, review, listened_at')
          .eq('user_id', targetUserId)
          .eq('spotify_id', album.id)
          .order('listened_at', { ascending: true }),
      ]);

      const entries: SessionEntry[] = [];

      // Find the earliest date to mark as "First listen"
      // The original first listen is stored in user_albums with the earliest listened_at
      // Re-listens are in re_listens table, sorted ascending
      const allDates: { listenedAt: string; rating: number; review?: string; isReListen: boolean }[] = [];

      if (userAlbumData) {
        allDates.push({
          listenedAt: userAlbumData.listened_at ?? new Date().toISOString(),
          rating:     userAlbumData.rating ?? 0,
          review:     userAlbumData.review ?? undefined,
          isReListen: false,
        });
      }

      if (reListenData) {
        const seenDates = new Set<string>();
        for (const r of reListenData) {
          const key = r.listened_at ?? '';
          if (seenDates.has(key)) continue;
          seenDates.add(key);
          allDates.push({
            listenedAt: r.listened_at ?? new Date().toISOString(),
            rating:     r.rating ?? 0,
            review:     r.review ?? undefined,
            isReListen: true,
          });
        }
      }

      // Sort all by date ascending to determine first listen
      allDates.sort((a, b) => new Date(a.listenedAt).getTime() - new Date(b.listenedAt).getTime());

      let reListenIndex = 0;
      const firstDate = allDates[0]?.listenedAt;

      for (const entry of allDates) {
        const isOriginal = entry.listenedAt === firstDate && !entry.isReListen;
        if (!isOriginal) reListenIndex++;
        entries.push({
          listenedAt:    entry.listenedAt,
          rating:        entry.rating,
          review:        entry.review,
          isOriginal,
          reListenIndex: isOriginal ? undefined : reListenIndex,
        });
      }

      // Sort descending for display (most recent first)
      entries.sort((a, b) => new Date(b.listenedAt).getTime() - new Date(a.listenedAt).getTime());

      // Re-number reListenIndex in descending order
      let descIndex = entries.filter(e => !e.isOriginal).length;
      for (const entry of entries) {
        if (!entry.isOriginal) {
          entry.reListenIndex = descIndex--;
        }
      }

      setHistoryData({ album, entries });
    } catch (err) {
      console.error('[ReListened] fetch history error:', err);
    } finally {
      setLoadingAlbumId(null);
    }
  }, [user]);

  const listHeader = (
    <>
      {/* Analytics — only shown for own profile with re-listens */}
      {!viewingOther && reListenedAlbums.length > 0 && (
        <AnalyticsHeader
          growers={growers}
          faders={faders}
          avgDelta={avgDelta}
          firstListenAvg={firstListenAvg}
          longTermAvg={longTermAvg}
          totalRelistens={totalRelistens}
          isDark={isDark}
          colors={colors}
          onCardPress={handleAlbumPress}
        />
      )}
      {/* Count + search bar */}
      {reListenedAlbums.length > 0 && (
        <View style={[ss.countRow, { borderBottomColor: colors.border }]}>
          <Text style={[ss.countText, { color: colors.subtext }]}>{reListenedAlbums.length} album{reListenedAlbums.length !== 1 ? 's' : ''}</Text>
          <Pressable
            onPress={() => {
              const next = !searchOpen;
              setSearchOpen(next);
              if (!next) setQuery('');
              else setTimeout(() => searchRef.current?.focus(), 50);
            }}
            hitSlop={10}
            style={[ss.searchToggle, searchOpen && { backgroundColor: ACCENT }]}>
            <FontAwesome name="search" size={13} color={searchOpen ? '#fff' : ACCENT} />
          </Pressable>
        </View>
      )}
      {reListenedAlbums.length > 0 && searchOpen && (
        <View style={[ss.searchBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <FontAwesome name="search" size={14} color={colors.subtext} />
          <TextInput
            ref={searchRef}
            style={[ss.searchInput, { color: colors.text }]}
            value={query}
            onChangeText={setQuery}
            placeholder="Search albums…"
            placeholderTextColor={colors.subtext}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
      )}
    </>
  );

  return (
    <>
      <Stack.Screen options={{ title: 'Re-listend', headerBackTitle: 'Back' }} />
      <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={displayAlbums}
        keyExtractor={item => item.id}
        style={{ flex: 1 }}
        ListHeaderComponent={listHeader}
        contentContainerStyle={(displayAlbums.length === 0 && !otherLoading) ? s.emptyContainer : { paddingBottom: 40 }}
        ListEmptyComponent={
          <View style={s.emptyInner}>
            <FontAwesome name="repeat" size={40} color={isDark ? '#3a2818' : '#ddd'} />
            <Text style={[s.emptyTitle, { color: colors.text }]}>
              {query.trim() ? 'No albums found' : 'No re-listens yet'}
            </Text>
            {!query.trim() && (
              <Text style={[s.emptySubtext, { color: colors.subtext }]}>
                Tap "Re-listen" on any album you've already logged to record another listen.
              </Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View>
            <ReListenedAlbumRow
              album={item}
              isDark={isDark}
              colors={colors}
              onPress={() => handleAlbumPress(item)}
            />
            {loadingAlbumId === item.id && (
              <ActivityIndicator
                size="small"
                color={ACCENT}
                style={StyleSheet.absoluteFill}
              />
            )}
          </View>
        )}
      />
      </View>

      {historyData && (
        <HistoryModal
          data={historyData}
          isDark={isDark}
          colors={colors}
          onClose={() => setHistoryData(null)}
          onAlbumPress={() => {
            const album = historyData.album;
            setHistoryData(null);
            navigateToAlbum(router, album);
          }}
          onDeleteEntry={!viewingOther ? (entry) => {
            Alert.alert(
              'Delete Re-listen',
              'Remove this re-listen entry? This can\'t be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    await removeReListenEntry(historyData.album.id, entry.listenedAt);
                    setHistoryData(prev => {
                      if (!prev) return null;
                      const remaining = prev.entries.filter(e => e.listenedAt !== entry.listenedAt);
                      if (remaining.length === 0) return null;
                      // Re-number re-listen indices descending
                      let idx = remaining.filter(e => !e.isOriginal).length;
                      const renumbered = remaining.map(e => e.isOriginal ? e : { ...e, reListenIndex: idx-- });
                      return { ...prev, entries: renumbered };
                    });
                  },
                },
              ]
            );
          } : undefined}
        />
      )}
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  albumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  albumArt: {
    width: 52,
    height: 52,
    borderRadius: 8,
    flexShrink: 0,
  },
  albumInfo: {
    flex: 1,
    gap: 3,
  },
  albumTitle:  { fontSize: 15, fontWeight: '600' },
  albumArtist: { fontSize: 13 },
  listenCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  listenCountText: {
    color: '#D4A017',
    fontSize: 12,
    fontWeight: '600',
  },

  // Empty state
  emptyContainer: {
    flex: 1,
  },
  emptyInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 100,
    gap: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

const ss = StyleSheet.create({
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  countText: { fontSize: 13, fontWeight: '600' },
  searchToggle: {
    width: 28, height: 28, borderRadius: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, fontSize: 15, height: 36 },
});
