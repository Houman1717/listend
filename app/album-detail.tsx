import {
  StyleSheet,
  View,
  Text,
  Image,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useRef, useEffect } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAlbums } from '@/context/AlbumsContext';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<a[^>]*>.*?<\/a>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function formatListeners(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M listeners`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K listeners`;
  return `${n} listeners`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Track = {
  number: number;
  id: string;
  title: string;
  durationMs: number;
  featuredArtists: string[];
};

type LastfmAlbum = {
  listeners: number;
  description: string;
  tags: string[];
};

type GeniusCredits = {
  producers: string[] | null;
  writers:   string[] | null;
  credits:   { label: string; artists: string[] }[];
};

// ─── Rating bar ───────────────────────────────────────────────────────────────

const RATING_LABELS: Record<number, string> = {
  1: 'Skip', 2: 'Dust Collector', 3: 'Static', 4: 'Passable',
  5: 'In the Rotation', 6: 'Keeper', 7: 'Mainstay', 8: 'Daily Spin',
  9: 'Total Fixation', 10: 'Timeless / No Skips',
};
const BAR_HEIGHTS = [6, 9, 12, 15, 18, 22, 26, 30, 34, 38];

function RatingPicker({ rating, onChange, isDark }: { rating: number; onChange: (r: number) => void; isDark: boolean }) {
  const barsWidth = useRef(0);
  const activeColor = '#FF3CAC';
  const inactiveColor = isDark ? '#2e2e2e' : '#e0e0e0';
  function ratingFromX(x: number) {
    return Math.max(1, Math.min(10, Math.ceil((x / barsWidth.current) * 10)));
  }
  return (
    <View style={s.ratingContainer}>
      <View style={s.ratingRow}>
        <FontAwesome name="volume-up" size={22} color={rating > 0 ? activeColor : inactiveColor} />
        <View
          style={s.barsTrack}
          onLayout={e => { barsWidth.current = e.nativeEvent.layout.width; }}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={e => onChange(ratingFromX(e.nativeEvent.locationX))}
          onResponderMove={e => onChange(ratingFromX(e.nativeEvent.locationX))}>
          {BAR_HEIGHTS.map((h, i) => (
            <View key={i} style={[s.bar, { height: h, backgroundColor: i + 1 <= rating ? activeColor : inactiveColor }]} />
          ))}
        </View>
      </View>
      <Text style={[s.ratingHint, { color: isDark ? '#888' : '#999' }]}>
        {rating > 0 ? RATING_LABELS[rating] : ' '}
      </Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AlbumDetailScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  const params = useLocalSearchParams<{
    id: string; title?: string; artist?: string; year?: string; artworkUrl?: string;
  }>();

  const {
    loggedAlbums, updateReview, playlists, addAlbumToPlaylist, removeAlbumFromPlaylist,
    wantToListen, addToWantToListen, removeFromWantToListen,
    setPendingAlbum,
  } = useAlbums();

  const loggedAlbum = loggedAlbums.find(a => a.id === params.id);

  // Resolve album display data from params or logged context
  const albumId       = params.id ?? '';
  const albumTitle    = params.title    ?? loggedAlbum?.title    ?? '';
  const albumArtist   = params.artist   ?? loggedAlbum?.artist   ?? '';
  const albumYear     = params.year ? parseInt(params.year, 10) : (loggedAlbum?.year ?? 0);
  const albumArtwork  = params.artworkUrl ?? loggedAlbum?.artworkUrl ?? '';
  const albumCoverColor = loggedAlbum?.coverColor ?? '#1a1a1a';

  // Editor state (only used when logged)
  const [rating, setRating]       = useState(loggedAlbum?.rating ?? 0);
  const [review, setReview]       = useState(loggedAlbum?.review ?? '');
  const [showPlaylists, setShowPlaylists] = useState(false);

  // Remote data
  const [tracks, setTracks]           = useState<Track[] | null>(null);
  const [tracksLoading, setTracksLoading] = useState(true);
  const [lastfm, setLastfm]           = useState<LastfmAlbum | null>(null);
  const [genius, setGenius]           = useState<GeniusCredits | null>(null);
  const [bioExpanded, setBioExpanded] = useState(false);

  const isLogged  = !!loggedAlbum;
  const isWanted  = wantToListen.some(a => a.id === albumId);
  const dirty     = isLogged && (rating !== loggedAlbum!.rating || review !== (loggedAlbum!.review ?? ''));

  // ── Fetch tracklist + Last.fm in parallel ──────────────────────────────────
  useEffect(() => {
    if (!albumId) return;
    let cancelled = false;

    // Tracklist
    const tracksUrl = `${API_URL}/spotify/album/${albumId}/tracks`;
    console.log('[album-detail] fetching tracklist:', tracksUrl);
    fetch(tracksUrl)
      .then(r => {
        console.log('[album-detail] tracklist status:', r.status);
        return r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`);
      })
      .then(data => {
        console.log('[album-detail] tracklist received:', Array.isArray(data) ? `${data.length} tracks` : data);
        if (!cancelled) setTracks(data);
      })
      .catch(err => {
        console.warn('[album-detail] tracklist error:', err);
        if (!cancelled) setTracks([]);
      })
      .finally(() => { if (!cancelled) setTracksLoading(false); });

    // Last.fm album info — use query params to avoid path-encoding issues
    if (albumArtist && albumTitle) {
      const lastfmUrl = `${API_URL}/lastfm/album?artist=${encodeURIComponent(albumArtist)}&album=${encodeURIComponent(albumTitle)}`;
      console.log('[album-detail] fetching Last.fm:', lastfmUrl);
      fetch(lastfmUrl)
        .then(r => {
          console.log('[album-detail] Last.fm status:', r.status);
          return r.ok ? r.json() : r.json().then(body => Promise.reject(`HTTP ${r.status}: ${JSON.stringify(body)}`));
        })
        .then(data => {
          console.log('[album-detail] Last.fm data:', JSON.stringify(data).slice(0, 200));
          if (cancelled) return;
          const desc = stripHtml(data.description ?? '');
          setLastfm({
            listeners: data.listeners ?? 0,
            description: desc,
            tags: data.tags ?? [],
          });
        })
        .catch(err => console.warn('[album-detail] Last.fm error:', err));
    } else {
      console.log('[album-detail] skipping Last.fm — albumArtist:', albumArtist, 'albumTitle:', albumTitle);
    }

    return () => { cancelled = true; };
  }, [albumId, albumArtist, albumTitle]);

  // ── Fetch Genius credits when tracks are known ──────────────────────────────
  useEffect(() => {
    if (!tracks || tracks.length === 0 || !albumArtist) return;
    let cancelled = false;
    const candidateTracks = tracks.slice(0, 3);
    const trackParams = candidateTracks.map(t => `tracks=${encodeURIComponent(t.title)}`).join('&');
    const geniusUrl = `${API_URL}/genius/credits?artist=${encodeURIComponent(albumArtist)}&${trackParams}`;
    console.log('[album-detail] fetching Genius:', geniusUrl);
    fetch(geniusUrl)
      .then(r => {
        console.log('[album-detail] Genius status:', r.status);
        return r.ok ? r.json() : r.json().then(body => Promise.reject(`HTTP ${r.status}: ${JSON.stringify(body)}`));
      })
      .then(data => {
        console.log('[album-detail] Genius data:', JSON.stringify(data).slice(0, 200));
        if (!cancelled) {
          const hasCreds = (data.producers?.length || data.writers?.length);
          setGenius(hasCreds ? data : null);
        }
      })
      .catch(err => console.warn('[album-detail] Genius error:', err));
    return () => { cancelled = true; };
  }, [tracks, albumArtist]);

  // ── Actions ────────────────────────────────────────────────────────────────
  function handleSave() {
    updateReview(albumId, rating, review);
    router.back();
  }

  function handleLog() {
    setPendingAlbum({ spotifyId: albumId, title: albumTitle, artist: albumArtist, year: albumYear, artworkUrl: albumArtwork });
    router.push('/log-album');
  }

  function handleWantToListen() {
    if (isWanted) {
      removeFromWantToListen(albumId);
    } else {
      addToWantToListen({ id: albumId, title: albumTitle, artist: albumArtist, year: albumYear, artworkUrl: albumArtwork });
    }
  }

  function handleArtistPress() {
    router.push({ pathname: '/artist-detail', params: { name: albumArtist } });
  }

  const cardBg     = isDark ? '#141414' : '#fff';
  const sectionBg  = isDark ? '#111' : '#f5f5f5';
  const borderColor = isDark ? '#222' : '#e8e8e8';
  const mutedText  = isDark ? '#666' : '#bbb';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={s.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        {/* ── 1. Header ─────────────────────────────────────────────────────── */}
        {albumArtwork ? (
          <Image source={{ uri: albumArtwork }} style={s.artwork} />
        ) : (
          <View style={[s.artwork, s.artworkPlaceholder, { backgroundColor: albumCoverColor }]}>
            <Text style={s.artworkInitial}>{albumTitle.charAt(0)}</Text>
          </View>
        )}

        <Text style={[s.title, { color: colors.text }]} numberOfLines={2}>{albumTitle}</Text>

        <Pressable onPress={handleArtistPress}>
          <Text style={[s.artist, { color: '#FF3CAC' }]}>
            {albumArtist}{albumYear > 0 ? ` · ${albumYear}` : ''}
          </Text>
        </Pressable>

        {/* Genre pills + listener count */}
        {(lastfm?.tags?.length || lastfm?.listeners) ? (
          <View style={s.metaRow}>
            {lastfm?.tags?.slice(0, 4).map(tag => (
              <View key={tag} style={[s.pill, { backgroundColor: isDark ? '#2a2a2a' : '#ebebeb' }]}>
                <Text style={[s.pillText, { color: colors.subtext }]}>{tag}</Text>
              </View>
            ))}
            {lastfm?.listeners > 0 && (
              <Text style={[s.listeners, { color: colors.subtext }]}>
                {formatListeners(lastfm.listeners)}
              </Text>
            )}
          </View>
        ) : null}

        {/* Date logged (only if logged) */}
        {isLogged && (
          <Text style={[s.dateLogged, { color: colors.subtext }]}>
            Logged {loggedAlbum!.dateLogged}
          </Text>
        )}

        {/* ── 2. CTA buttons ───────────────────────────────────────────────── */}
        {isLogged ? (
          <>
            <Text style={[s.sectionLabel, { color: colors.subtext }]}>Rating</Text>
            <RatingPicker rating={rating} onChange={setRating} isDark={isDark} />

            <Text style={[s.sectionLabel, { color: colors.subtext, marginTop: 24 }]}>
              Review <Text style={{ fontWeight: '400' }}>(optional)</Text>
            </Text>
            <TextInput
              style={[s.reviewInput, { color: colors.text, backgroundColor: isDark ? '#1e1e1e' : '#f2f2f2', borderColor: isDark ? '#333' : '#e0e0e0' }]}
              placeholder="What did you think?"
              placeholderTextColor={colors.subtext}
              value={review}
              onChangeText={setReview}
              multiline
              textAlignVertical="top"
              maxLength={500}
            />
            {review.length > 0 && (
              <Text style={[s.charCount, { color: colors.subtext }]}>{review.length}/500</Text>
            )}
            <Pressable
              style={[s.primaryBtn, { backgroundColor: dirty ? '#FF3CAC' : (isDark ? '#2a2a2a' : '#ddd') }]}
              onPress={handleSave}
              disabled={!dirty}>
              <Text style={[s.primaryBtnText, { color: dirty ? '#fff' : colors.subtext }]}>Save</Text>
            </Pressable>
          </>
        ) : (
          <View style={s.ctaRow}>
            <Pressable style={[s.primaryBtn, s.ctaFlex, { backgroundColor: '#FF3CAC' }]} onPress={handleLog}>
              <FontAwesome name="plus" size={14} color="#fff" />
              <Text style={[s.primaryBtnText, { color: '#fff' }]}>Log Album</Text>
            </Pressable>
            <Pressable
              style={[s.secondaryBtn, s.ctaFlex, { borderColor: isDark ? '#333' : '#ddd' }]}
              onPress={handleWantToListen}>
              <FontAwesome name={isWanted ? 'bookmark' : 'bookmark-o'} size={14} color={isWanted ? '#FF3CAC' : colors.subtext} />
              <Text style={[s.secondaryBtnText, { color: isWanted ? '#FF3CAC' : colors.subtext }]}>
                {isWanted ? 'Saved' : 'Want to Listen'}
              </Text>
            </Pressable>
          </View>
        )}

        {/* ── 3. About this album ───────────────────────────────────────────── */}
        {lastfm?.description ? (
          <View style={[s.section, { backgroundColor: sectionBg, borderColor }]}>
            <Text style={[s.sectionLabel, { color: colors.subtext, marginTop: 0 }]}>About This Album</Text>
            <Text
              style={[s.bioText, { color: colors.text }]}
              numberOfLines={bioExpanded ? undefined : 3}>
              {lastfm.description}
            </Text>
            <Pressable onPress={() => setBioExpanded(v => !v)}>
              <Text style={s.bioToggle}>{bioExpanded ? 'Show less' : 'Read more'}</Text>
            </Pressable>
          </View>
        ) : null}

        {/* ── 4. Tracklist ──────────────────────────────────────────────────── */}
        <View style={[s.section, { backgroundColor: sectionBg, borderColor }]}>
          <Text style={[s.sectionLabel, { color: colors.subtext, marginTop: 0 }]}>Tracklist</Text>
          {tracksLoading ? (
            <ActivityIndicator size="small" color="#FF3CAC" style={{ marginVertical: 16 }} />
          ) : tracks && tracks.length > 0 ? (
            tracks.map(track => (
              <View key={track.id} style={[s.trackRow, { borderBottomColor: borderColor }]}>
                <Text style={[s.trackNumber, { color: mutedText }]}>{track.number}</Text>
                <View style={s.trackInfo}>
                  <Text style={[s.trackTitle, { color: colors.text }]} numberOfLines={1}>
                    {track.title}
                  </Text>
                  {track.featuredArtists.length > 0 && (
                    <Text style={[s.trackFeat, { color: colors.subtext }]} numberOfLines={1}>
                      feat. {track.featuredArtists.join(', ')}
                    </Text>
                  )}
                </View>
                <Text style={[s.trackDuration, { color: colors.subtext }]}>
                  {formatDuration(track.durationMs)}
                </Text>
              </View>
            ))
          ) : (
            <Text style={[s.emptyText, { color: mutedText }]}>No tracks available</Text>
          )}
        </View>

        {/* ── 5. Credits ────────────────────────────────────────────────────── */}
        {genius && (genius.credits?.length || genius.producers?.length || genius.writers?.length) ? (() => {
          // Prefer structured credits from custom_performances; fall back to flat arrays.
          const rows: { label: string; artists: string[] }[] =
            genius.credits?.length
              ? genius.credits
              : [
                  ...(genius.producers?.length ? [{ label: 'Produced by', artists: genius.producers }] : []),
                  ...(genius.writers?.length   ? [{ label: 'Written by',  artists: genius.writers   }] : []),
                ];
          return (
            <View style={[s.section, { backgroundColor: sectionBg, borderColor }]}>
              <Text style={[s.sectionLabel, { color: colors.subtext, marginTop: 0 }]}>Credits</Text>
              {rows.map((row, i) => (
                <View key={i} style={[s.creditRow, i < rows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: borderColor }]}>
                  <Text style={[s.creditLabel, { color: colors.subtext }]}>{row.label}</Text>
                  <Text style={[s.creditValue, { color: colors.text }]}>{row.artists.join(', ')}</Text>
                </View>
              ))}
            </View>
          );
        })() : null}

        {/* ── Add to Playlist (logged albums only) ──────────────────────────── */}
        {isLogged && (
          <Pressable
            style={[s.playlistBtn, { borderColor: isDark ? '#2e2e2e' : '#e0e0e0' }]}
            onPress={() => setShowPlaylists(true)}>
            <FontAwesome name="list" size={15} color="#FF3CAC" />
            <Text style={s.playlistBtnText}>Add to Playlist</Text>
            <FontAwesome name="chevron-right" size={12} color={colors.subtext} />
          </Pressable>
        )}

      </ScrollView>

      {/* ── Playlist picker modal ─────────────────────────────────────────────── */}
      <Modal visible={showPlaylists} transparent animationType="slide" onRequestClose={() => setShowPlaylists(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowPlaylists(false)} />
          <View style={[s.modalSheet, { backgroundColor: isDark ? '#141414' : '#fff' }]}>
            <View style={s.modalHandle} />
            <Text style={[s.modalTitle, { color: colors.text }]}>Add to Playlist</Text>
            {playlists.length === 0 ? (
              <View style={s.modalEmpty}>
                <Text style={[s.modalEmptyText, { color: colors.subtext }]}>
                  No playlists yet. Create one from the Playlists tab.
                </Text>
              </View>
            ) : (
              playlists.map(playlist => {
                const inPlaylist = playlist.albumIds.includes(albumId);
                return (
                  <Pressable
                    key={playlist.id}
                    onPress={() => { inPlaylist ? removeAlbumFromPlaylist(playlist.id, albumId) : addAlbumToPlaylist(playlist.id, albumId); }}
                    style={({ pressed }) => [s.playlistRow, { borderBottomColor: isDark ? '#1f1f1f' : '#f0f0f0', opacity: pressed ? 0.6 : 1 }]}>
                    <View style={s.playlistRowText}>
                      <Text style={[s.playlistRowName, { color: colors.text }]} numberOfLines={1}>{playlist.name}</Text>
                      <Text style={[s.playlistRowCount, { color: colors.subtext }]}>{playlist.albumIds.length} albums</Text>
                    </View>
                    <View style={[s.checkBox, inPlaylist && s.checkBoxActive]}>
                      {inPlaylist && <FontAwesome name="check" size={11} color="#fff" />}
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { alignItems: 'center', paddingTop: 36, paddingHorizontal: 20, paddingBottom: 48 },

  // Header
  artwork: { width: 180, height: 180, borderRadius: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 20 },
  artworkPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  artworkInitial: { color: 'rgba(255,255,255,0.7)', fontSize: 60, fontWeight: '700' },
  title: { marginTop: 20, fontSize: 20, fontWeight: '700', textAlign: 'center', letterSpacing: -0.5 },
  artist: { marginTop: 4, fontSize: 14, fontWeight: '500', textAlign: 'center' },
  dateLogged: { marginTop: 4, fontSize: 12, textAlign: 'center' },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 12 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  pillText: { fontSize: 11, fontWeight: '500' },
  listeners: { fontSize: 12, alignSelf: 'center' },

  // Section label
  sectionLabel: { marginTop: 24, alignSelf: 'flex-start', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10 },

  // Rating
  ratingContainer: { width: '100%', marginTop: 10 },
  ratingRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  barsTrack: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 4, paddingBottom: 2 },
  bar: { flex: 1, borderRadius: 2 },
  ratingHint: { marginTop: 10, fontSize: 13, textAlign: 'center', height: 18 },

  // Review
  reviewInput: { width: '100%', minHeight: 90, marginTop: 10, borderRadius: 10, borderWidth: 1, padding: 12, fontSize: 15, lineHeight: 22 },
  charCount: { alignSelf: 'flex-end', fontSize: 12, marginTop: 4 },

  // Buttons
  ctaRow: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 20 },
  ctaFlex: { flex: 1, marginTop: 0 },
  primaryBtn: { marginTop: 20, width: '100%', height: 50, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  primaryBtnText: { fontSize: 16, fontWeight: '600' },
  secondaryBtn: { height: 50, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, borderWidth: 1 },
  secondaryBtnText: { fontSize: 15, fontWeight: '500' },

  // Content sections
  section: { width: '100%', marginTop: 20, borderRadius: 14, padding: 16, borderWidth: StyleSheet.hairlineWidth },

  // About
  bioText: { fontSize: 14, lineHeight: 22 },
  bioToggle: { color: '#FF3CAC', fontSize: 13, fontWeight: '500', marginTop: 8 },

  // Tracklist
  trackRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  trackNumber: { width: 24, fontSize: 13, textAlign: 'right', marginRight: 12 },
  trackInfo: { flex: 1, gap: 2 },
  trackTitle: { fontSize: 14, fontWeight: '500' },
  trackFeat: { fontSize: 12 },
  trackDuration: { fontSize: 13, marginLeft: 12 },
  emptyText: { fontSize: 13, textAlign: 'center', paddingVertical: 16 },

  // Credits
  creditRow: { marginBottom: 8 },
  creditLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  creditValue: { fontSize: 14 },

  // Playlist button
  playlistBtn: { marginTop: 14, width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1 },
  playlistBtnText: { flex: 1, color: '#FF3CAC', fontSize: 15, fontWeight: '500' },

  // Playlist modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 12, paddingBottom: 40 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#444', alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: '700', paddingHorizontal: 20, marginBottom: 12 },
  modalEmpty: { paddingHorizontal: 20, paddingVertical: 24 },
  modalEmptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  playlistRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  playlistRowText: { flex: 1, gap: 2 },
  playlistRowName: { fontSize: 15, fontWeight: '500' },
  playlistRowCount: { fontSize: 12 },
  checkBox: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#555', alignItems: 'center', justifyContent: 'center' },
  checkBoxActive: { backgroundColor: '#FF3CAC', borderColor: '#FF3CAC' },
});
