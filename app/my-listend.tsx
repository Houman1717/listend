import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  Modal,
  Platform,
  SafeAreaView,
  KeyboardAvoidingView,
  useWindowDimensions,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { usePro } from '@/context/ProContext';
import { getProTheme, themeToColors } from '@/lib/proThemes';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAlbums, LoggedAlbum } from '@/context/AlbumsContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { SortBar, SortSheet, applySort, SortKey } from '@/components/SortSheet';
import { ReviewComment, CommentsSection, avatarColor } from '@/components/ReviewComments';
import { AlbumReviewModal } from '@/components/AlbumReviewModal';
import { navigateToProfile } from '@/lib/navigateToProfile';
import { navigateToAlbum } from '@/lib/navigateToAlbum';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PADDING = 16;
const GAP     = 12;
const COLS    = 3;

const COVER_COLORS = ['#2d5a27','#7a4a2e','#1a3018','#d4a017','#7a3a1a','#8b1a1a','#1a5a5a','#4a2818'];

// ─── Volume + bars badge ──────────────────────────────────────────────────────

function VolumeBadge({ rating, showNumber, isDark, tint = '#D4A017' }: { rating: number; showNumber?: boolean; isDark?: boolean; tint?: string }) {
  const inactive = isDark ? '#2a1e14' : '#e0e0e0';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <FontAwesome name="volume-up" size={9} color={tint} />
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 1 }}>
        {Array.from({ length: 10 }, (_, i) => {
          const h = Math.round(3 + i * 1);
          return (
            <View
              key={i}
              style={{ width: 2, height: h, borderRadius: 1, backgroundColor: i + 1 <= rating ? tint : inactive }}
            />
          );
        })}
      </View>
      {showNumber && (
        <Text style={{ color: tint, fontSize: 10, fontWeight: '700' }}>{rating}</Text>
      )}
    </View>
  );
}


// ─── Album card ───────────────────────────────────────────────────────────────

function AlbumCard({
  album,
  cardWidth,
  colors,
  isDark,
  onPress,
}: {
  album: LoggedAlbum;
  cardWidth: number;
  colors: any;
  isDark: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.card, { width: cardWidth, opacity: pressed ? 0.7 : 1 }]}>
      {album.artworkUrl ? (
        <ExpoImage
          source={{ uri: album.artworkUrl }}
          style={{ width: cardWidth, height: cardWidth, borderRadius: 8 }}
          contentFit="cover"
          cachePolicy="disk"
          transition={200}
        />
      ) : (
        <View style={[s.fallback, { width: cardWidth, height: cardWidth, backgroundColor: album.coverColor }]}>
          <Text style={[s.fallbackText, { fontSize: cardWidth * 0.32 }]}>{album.title.charAt(0)}</Text>
        </View>
      )}
      <Text style={[s.cardTitle,  { color: colors.text    }]} numberOfLines={1}>{album.title}</Text>
      <Text style={[s.cardArtist, { color: colors.subtext }]} numberOfLines={1}>{album.artist}</Text>
      {((album.lastRating ?? album.rating) > 0 || album.isRelistened) && (
        <View style={{ marginTop: 3, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          {(album.lastRating ?? album.rating) > 0 && (
            <VolumeBadge rating={album.lastRating ?? album.rating} showNumber isDark={isDark} tint={colors.tint} />
          )}
          {!!(album.lastReview ?? album.review) && (
            <FontAwesome name="quote-left" size={8} color={colors.tint} />
          )}
          {!!album.isRelistened && (
            <FontAwesome name="repeat" size={8} color={colors.tint} />
          )}
        </View>
      )}
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MyListendScreen() {
  const { width } = useWindowDimensions();
  const cardWidth = (width - PADDING * 2 - GAP * (COLS - 1)) / COLS;
  const colorScheme = useColorScheme();
  const { isPro, proTheme: ownProTheme } = usePro();
  const { userId: paramUserId, username: paramUsername, proTheme: paramProTheme } = useLocalSearchParams<{ userId?: string; username?: string; proTheme?: string }>();
  const _themeKey = !paramUserId ? ownProTheme : (paramProTheme ?? 'default');
  const colors = ((!paramUserId ? isPro : !!paramProTheme) && _themeKey !== 'default')
    ? themeToColors(getProTheme(_themeKey))
    : Colors[colorScheme ?? 'dark'];
  const isDark = colors.isDark;
  const router = useRouter();
  const { loggedAlbums, removeLoggedAlbum, updateDuration, undoLastReListenEntry } = useAlbums();
  const { user } = useAuth();

  const viewingOther = paramUserId || null;
  const [otherAlbums, setOtherAlbums] = useState<LoggedAlbum[]>([]);
  const [sortKey, setSortKey]       = useState<SortKey>('date_new');
  const [shuffled, setShuffled]     = useState<LoggedAlbum[] | null>(null);
  const [sheetOpen, setSheetOpen]   = useState(false);
  const [query, setQuery]           = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<import('react-native').TextInput>(null);

  // Review modal state
  const [selectedAlbum,  setSelectedAlbum]  = useState<LoggedAlbum | null>(null);
  const [profileUsername, setProfileUsername] = useState<string>(paramUsername ?? '');

  // Fetch the profile username for author row in the modal
  useEffect(() => {
    const uid = viewingOther || user?.id;
    if (!uid || profileUsername) return;
    supabase
      .from('profiles')
      .select('username')
      .eq('id', uid)
      .single()
      .then(({ data }) => { if (data?.username) setProfileUsername(data.username); });
  }, [viewingOther, user?.id]);

  useEffect(() => {
    if (!viewingOther) return;
    Promise.all([
      supabase
        .from('user_albums')
        .select('spotify_id, title, artist, artwork_url, year, rating, review, listened_at, duration_ms')
        .eq('user_id', viewingOther)
        .not('listened_at', 'is', null)
        .order('listened_at', { ascending: false }),
      supabase
        .from('re_listens')
        .select('spotify_id, rating, review, listened_at')
        .eq('user_id', viewingOther)
        .order('listened_at', { ascending: false }),
    ]).then(([{ data: albums }, { data: reListens }]) => {
      if (!albums) return;

      // Build per-album re-listen summary (rows already ordered newest-first)
      type RLSummary = { count: number; lastRating: number; lastReview?: string };
      const rlMap = new Map<string, RLSummary>();
      for (const r of (reListens ?? []) as any[]) {
        const existing = rlMap.get(r.spotify_id);
        if (!existing) {
          rlMap.set(r.spotify_id, { count: 1, lastRating: r.rating ?? 0, lastReview: r.review ?? undefined });
        } else {
          existing.count++;
        }
      }

      setOtherAlbums(albums.map((a, i) => {
        const rl = rlMap.get(a.spotify_id);
        return {
          id:            a.spotify_id,
          title:         a.title      ?? '',
          artist:        a.artist     ?? '',
          year:          a.year       ?? 0,
          rating:        a.rating     ?? 0,
          review:        a.review     ?? undefined,
          dateLogged:    a.listened_at ?? new Date().toISOString(),
          artworkUrl:    a.artwork_url ?? undefined,
          coverColor:    COVER_COLORS[i % COVER_COLORS.length],
          durationMs:    a.duration_ms ?? undefined,
          isRelistened:  !!rl,
          reListenCount: rl?.count,
          lastRating:    rl?.lastRating,
          lastReview:    rl?.lastReview,
        };
      }));
    });
  }, [viewingOther]);

  const sourceAlbums = viewingOther ? otherAlbums : loggedAlbums;

  // Fetch durations for any album in the list that doesn't have one yet
  useEffect(() => {
    const missing = sourceAlbums.filter(a => !a.durationMs).map(a => a.id);
    if (missing.length === 0) return;
    const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';
    fetch(`${API_URL}/api/album-durations?ids=${missing.join(',')}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((data: Record<string, number>) => {
        Object.entries(data).forEach(([id, ms]) => {
          if (viewingOther) {
            setOtherAlbums(prev => prev.map(a => a.id === id ? { ...a, durationMs: ms } : a));
          } else {
            updateDuration(id, ms);
          }
        });
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceAlbums.length, viewingOther]);

  const displayAlbums = useMemo(() => {
    const sorted = shuffled ?? applySort(sourceAlbums, sortKey);
    if (!query.trim()) return sorted;
    const q = query.toLowerCase();
    return sorted.filter(a =>
      a.title.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q)
    );
  }, [sourceAlbums, sortKey, shuffled, query]);

  function handleSelectSort(key: SortKey) {
    if (key === 'shuffle') {
      setShuffled([...sourceAlbums].sort(() => Math.random() - 0.5));
    } else {
      setShuffled(null);
    }
    setSortKey(key);
  }

  function handleAlbumNavigate(album: LoggedAlbum) {
    navigateToAlbum(router, album);
  }

  function handleAlbumPress(album: LoggedAlbum) {
    setSelectedAlbum(album);
  }

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }} />
      <SortBar
        sortKey={sortKey}
        count={sourceAlbums.length}
        noun="albums"
        isDark={isDark}
        onPress={() => setSheetOpen(true)}
        onSearchPress={() => {
          const next = !searchOpen;
          setSearchOpen(next);
          if (!next) setQuery('');
          else setTimeout(() => searchInputRef.current?.focus(), 50);
        }}
        searchActive={searchOpen}
        tint={colors.tint}
        bg={colors.background}
        surface={colors.surface}
        border={colors.border}
        subtext={colors.subtext}
        labelColor={colors.text}
      />
      {searchOpen && (
        <View style={[s.searchBar, { borderBottomColor: colors.border }]}>
          <FontAwesome name="search" size={14} color={colors.subtext} />
          <TextInput
            ref={searchInputRef}
            style={[s.searchInput, { color: colors.text }]}
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
      <ScrollView contentContainerStyle={s.gridWrap} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {displayAlbums.length === 0 ? (
          <Text style={[s.emptyText, { color: colors.subtext }]}>
            {query.trim() ? `No albums matching "${query}"` : 'No albums logged yet — head to Search!'}
          </Text>
        ) : (
          <View style={s.grid}>
            {displayAlbums.map((album, index) => (
              <AlbumCard
                key={`${album.id}-${index}`}
                album={album}
                cardWidth={cardWidth}
                colors={colors}
                isDark={isDark}
                onPress={() => handleAlbumPress(album)}

              />
            ))}
          </View>
        )}
      </ScrollView>

      <SortSheet
        visible={sheetOpen}
        activeKey={sortKey}
        onSelect={handleSelectSort}
        onClose={() => setSheetOpen(false)}
        isDark={isDark}
        tint={colors.tint}
      />

      {selectedAlbum && (
        <AlbumReviewModal
          album={selectedAlbum}
          username={profileUsername}
          onClose={() => setSelectedAlbum(null)}
          onAlbumPress={() => {
            const a = selectedAlbum;
            setSelectedAlbum(null);
            handleAlbumNavigate(a!);
          }}
          onUsernamePress={viewingOther
            ? (username) => { setSelectedAlbum(null); navigateToProfile(username, router); }
            : undefined}
          isDark={isDark}
          colors={colors}
          isOwner={!viewingOther}
          onDelete={() => {
            const id = selectedAlbum.id;
            setSelectedAlbum(null);
            Alert.alert(
              'Remove from Listend',
              'This will permanently delete this album and its review.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: () => removeLoggedAlbum(id) },
              ],
            );
          }}
          onUndoReListen={selectedAlbum.isRelistened ? () => {
            const id = selectedAlbum.id;
            setSelectedAlbum(null);
            undoLastReListenEntry(id);
          } : undefined}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:    { flex: 1 },
  gridWrap:{ padding: PADDING, paddingBottom: 48 },
  grid:    { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  card:    { gap: 0 },
  fallback:     { borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  fallbackText: { color: 'rgba(255,255,255,0.5)', fontWeight: '700' },
  cardTitle:    { marginTop: 5, fontSize: 11, fontWeight: '600', lineHeight: 14 },
  cardArtist:   { fontSize: 10, lineHeight: 13, marginTop: 1 },
  emptyText:    { textAlign: 'center', marginTop: 80, fontSize: 15 },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, fontSize: 15, height: 36 },
});

// ─── Modal styles ─────────────────────────────────────────────────────────────

const ml = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 16, fontWeight: '700' },

  body: { padding: 20 },

  albumRow: { flexDirection: 'row', gap: 14, marginBottom: 20 },
  art:      { width: 80, height: 80, borderRadius: 10 },
  albumTitle:  { fontSize: 16, fontWeight: '700' },
  albumArtist: { fontSize: 13 },
  ratingRow:   { flexDirection: 'row', alignItems: 'center', marginTop: 4 },

  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  avatar:    { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  avatarLetter: { color: '#fff', fontWeight: '700', fontSize: 14 },
  username:     { color: '#D4A017', fontWeight: '600', fontSize: 14 },
  listenedDate: { fontSize: 12 },

  reviewText: { fontSize: 15, lineHeight: 22, fontStyle: 'italic', marginBottom: 20 },

  likeCommentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10, marginBottom: 16,
  },
  likeBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  likeCount: { fontSize: 14, fontWeight: '600' },

  commentsToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, marginBottom: 12,
  },
  commentsToggleText: { fontSize: 14, fontWeight: '500' },

  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 24, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, borderColor: '#8B1A1A',
  },
  deleteBtnText: { color: '#8B1A1A', fontWeight: '600', fontSize: 14 },

  undoRelistenBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 24, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, borderColor: '#8B1A1A',
  },
  undoRelistenBtnText: { color: '#8B1A1A', fontWeight: '600', fontSize: 14 },
});
