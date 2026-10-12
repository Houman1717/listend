import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useEffect, useState } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { VOLUME_EMPTY_DARK, VOLUME_EMPTY_LIGHT } from '@/constants/Colors';
import VolumeBars from '@/components/VolumeBars';
import { SongReviewModal } from '@/components/SongReviewModal';
import { AddToSongPlaylistSheet } from '@/components/AddToSongPlaylistSheet';
import { useSongReviews } from '@/context/SongReviewsContext';
import { fetchSongCommunityRatings, withOwnRating, type SongRatingStats } from '@/lib/songReviews';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SongInfo = {
  id?:          string;
  title:        string;
  artist:       string;
  artworkUrl?:  string;
  albumId?:     string;
  albumTitle?:  string;
  releaseDate?: string;
};

export type AlbumNavParams = {
  id:         string;
  title:      string;
  artist:     string;
  year:       string;
  artworkUrl: string;
};

function formatReleaseDate(raw: string): string {
  if (!raw) return '';
  // Accept "YYYY", "YYYY-MM", "YYYY-MM-DD"
  const parts = raw.split('-');
  if (parts.length === 1) return parts[0];
  const year = parts[0];
  const month = parseInt(parts[1], 10);
  const day = parts[2] ? parseInt(parts[2], 10) : null;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  if (isNaN(month) || month < 1 || month > 12) return year;
  return day ? `${months[month - 1]} ${day}, ${year}` : `${months[month - 1]} ${year}`;
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function SongInfoModal({
  song,
  onClose,
  onArtistPress,
  onAlbumPress,
  onUserPress,
  colors: colorsProp,
}: {
  song:           SongInfo | null;
  onClose:        () => void;
  onArtistPress?: (name: string) => void;
  onAlbumPress?:  (params: AlbumNavParams) => void;
  /** Tapping a reviewer in the rate/review screen. */
  onUserPress?:   (userId: string) => void;
  colors?:        any;
}) {
  const colorScheme = useColorScheme();
  const isDark      = colorScheme === 'dark';
  const [fetchedDate,       setFetchedDate]       = useState<string>('');
  const [fetchedAlbumId,    setFetchedAlbumId]    = useState<string>('');
  const [fetchedAlbumTitle, setFetchedAlbumTitle] = useState<string>('');
  const [fetchedArtist,     setFetchedArtist]     = useState<string>('');
  const [reviewing,         setReviewing]         = useState(false);
  const [addingToPlaylist,  setAddingToPlaylist]  = useState(false);
  const [ratingStats,       setRatingStats]       = useState<SongRatingStats | undefined>(undefined);
  const { getSongReview } = useSongReviews();

  useEffect(() => {
    setReviewing(false);
    setAddingToPlaylist(false);
    setRatingStats(undefined);
    if (!song?.id) return;
    let cancelled = false;
    fetchSongCommunityRatings([song.id]).then(m => {
      if (!cancelled && m) setRatingStats(m.get(song.id!));
    });
    return () => { cancelled = true; };
  }, [song?.id]);

  useEffect(() => {
    setFetchedDate('');
    setFetchedAlbumId('');
    setFetchedAlbumTitle('');
    setFetchedArtist('');
    if (!song) return;
    if ((song.releaseDate && song.albumId && song.albumTitle && song.artist) || !song.id) return;
    let cancelled = false;
    fetch(`${API_URL}/catalog/track/${song.id}`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (cancelled) return;
        if (data?.releaseDate) setFetchedDate(data.releaseDate);
        if (data?.albumId)     setFetchedAlbumId(data.albumId);
        if (data?.albumTitle)  setFetchedAlbumTitle(data.albumTitle);
        if (data?.artist)      setFetchedArtist(data.artist);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [song?.id, song?.releaseDate, song?.albumId, song?.albumTitle, song?.artist]);

  const displayDate       = formatReleaseDate(song?.releaseDate || fetchedDate || '');
  const displayAlbumId    = song?.albumId    || fetchedAlbumId;
  const displayAlbumTitle = song?.albumTitle || fetchedAlbumTitle;
  const displayArtist     = song?.artist     || fetchedArtist;

  const mine      = song?.id ? getSongReview(song.id) : undefined;
  const community = withOwnRating(ratingStats, mine?.rating);
  const subtext   = colorsProp ? colorsProp.subtext : isDark ? '#7a5535' : '#a07850';
  const inactive  = isDark ? VOLUME_EMPTY_DARK : VOLUME_EMPTY_LIGHT;

  return (
    <Modal
      visible={!!song}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Pressable style={s.backdrop} onPress={onClose} />

      {/* Sheet */}
      <View
        style={[
          s.sheet,
          {
            backgroundColor: colorsProp ? colorsProp.surface  : isDark ? '#2e2018' : '#fff',
            borderColor:     colorsProp ? colorsProp.border   : isDark ? '#2a1e14' : '#e8e8e8',
          },
        ]}
      >
        {/* Drag handle */}
        <View style={[s.handle, { backgroundColor: colorsProp ? colorsProp.border : isDark ? '#4a3020' : '#ddd' }]} />

        {/* Content */}
        <View style={s.content}>
          {song?.artworkUrl ? (
            <ExpoImage source={{ uri: song.artworkUrl }} style={s.art} contentFit="cover" cachePolicy="disk" transition={200} />
          ) : (
            <View style={[s.artPlaceholder, { backgroundColor: colorsProp ? colorsProp.elevated : isDark ? '#2a1e14' : '#f5e6c8' }]}>
              <FontAwesome name="music" size={28} color={colorsProp ? colorsProp.tint : '#D4A017'} />
            </View>
          )}

          <View style={s.info}>
            <Pressable
              hitSlop={6}
              disabled={!displayAlbumId}
              onPress={() => {
                if (!displayAlbumId) return;
                onClose();
                onAlbumPress?.({
                  id:         displayAlbumId,
                  title:      displayAlbumTitle,
                  artist:     displayArtist,
                  year:       (song?.releaseDate || fetchedDate || '').slice(0, 4),
                  artworkUrl: song?.artworkUrl ?? '',
                });
              }}
            >
              <Text
                style={[s.title, { color: colorsProp ? colorsProp.text : isDark ? '#f5e6c8' : '#1c1410' }, displayAlbumId ? s.titleTappable : null]}
                numberOfLines={2}
              >
                {song?.title}
              </Text>
            </Pressable>

            {/* Artist — tappable, navigation handled by parent */}
            <Pressable
              hitSlop={8}
              onPress={() => {
                if (!displayArtist) return;
                onClose();
                onArtistPress?.(displayArtist);
              }}
              style={s.artistRow}
            >
              <Text style={[s.artist, { color: colorsProp ? colorsProp.tint : '#D4A017' }]} numberOfLines={1}>
                {displayArtist}
              </Text>
              <FontAwesome name="chevron-right" size={10} color={colorsProp ? colorsProp.tint : '#D4A017'} />
            </Pressable>

            {/* Release date */}
            {displayDate ? (
              <View style={s.dateRow}>
                <FontAwesome name="calendar-o" size={11} color={colorsProp ? colorsProp.subtext : isDark ? '#7a5535' : '#a07850'} />
                <Text style={[s.date, { color: colorsProp ? colorsProp.subtext : isDark ? '#7a5535' : '#a07850' }]}>
                  {displayDate}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Ratings + rate/review */}
        {song?.id ? (
          <View style={s.rateBlock}>
            <View style={s.rateStats}>
              {mine && mine.rating > 0 ? (
                <View style={s.rateStat}>
                  <Text style={[s.rateStatLabel, { color: subtext }]}>You</Text>
                  <FontAwesome name="volume-up" size={10} color="#D4A017" />
                  <VolumeBars rating={mine.rating} activeColor="#D4A017" inactiveColor={inactive} />
                  <Text style={s.rateStatNum}>{mine.rating}</Text>
                  {mine.isFavorite && <Ionicons name="trophy" size={12} color="#D4A017" />}
                </View>
              ) : mine ? (
                <Text style={[s.rateStatLabel, { color: subtext }]}>Listened</Text>
              ) : null}
              <Text style={[s.rateStatLabel, { color: subtext }]}>
                {community ? `Listend avg ${community.avg.toFixed(1)} (${community.count})` : 'No ratings yet'}
              </Text>
            </View>
            <View style={s.rateBtnRow}>
              <Pressable
                onPress={() => setReviewing(true)}
                style={({ pressed }) => [s.rateBtn, { flex: 1, opacity: pressed ? 0.8 : 1 }]}>
                <FontAwesome name={mine ? 'pencil' : 'volume-up'} size={13} color="#fff" />
                <Text style={s.rateBtnText}>{mine ? 'Edit your rating' : 'Rate & Review'}</Text>
              </Pressable>
              <Pressable
                onPress={() => setAddingToPlaylist(true)}
                accessibilityLabel="Add to playlist"
                style={({ pressed }) => [s.playlistBtn, {
                  borderColor: colorsProp ? colorsProp.tint : '#D4A017',
                  opacity: pressed ? 0.7 : 1,
                }]}>
                <FontAwesome name="list" size={13} color={colorsProp ? colorsProp.tint : '#D4A017'} />
                <FontAwesome name="plus" size={9} color={colorsProp ? colorsProp.tint : '#D4A017'} />
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Close button */}
        <Pressable
          onPress={onClose}
          hitSlop={12}
          style={[s.closeBtn, { backgroundColor: colorsProp ? colorsProp.elevated : isDark ? '#2a1e14' : '#f4f4f4' }]}
        >
          <Text style={[s.closeBtnText, { color: colorsProp ? colorsProp.subtext : isDark ? '#a07850' : '#7a5535' }]}>Done</Text>
        </Pressable>
      </View>

      {song?.id ? (
        <AddToSongPlaylistSheet
          song={{
            id:         song.id,
            title:      song.title,
            artist:     displayArtist,
            albumId:    displayAlbumId || undefined,
            albumTitle: displayAlbumTitle || undefined,
            artworkUrl: song.artworkUrl,
          }}
          visible={addingToPlaylist}
          onClose={() => setAddingToPlaylist(false)}
          isDark={isDark}
          colors={{
            text:    colorsProp ? colorsProp.text    : isDark ? '#f5e6c8' : '#1c1410',
            subtext: colorsProp ? colorsProp.subtext : isDark ? '#a07850' : '#7a5535',
            border:  colorsProp ? colorsProp.border  : isDark ? '#2a1e14' : '#e8e8e8',
            tint:    colorsProp ? colorsProp.tint    : '#D4A017',
          }}
        />
      ) : null}

      {/* Nested so iOS presents it on top of this sheet rather than racing its dismissal. */}
      <SongReviewModal
        song={reviewing && song?.id ? {
          id:         song.id,
          title:      song.title,
          artist:     displayArtist,
          albumId:    displayAlbumId || undefined,
          albumTitle: displayAlbumTitle || undefined,
          artworkUrl: song.artworkUrl,
        } : null}
        isDark={isDark}
        colors={colorsProp}
        onClose={() => setReviewing(false)}
        onUserPress={onUserPress ? (userId) => { setReviewing(false); onClose(); onUserPress(userId); } : undefined}
      />
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius:  20,
    borderTopRightRadius: 20,
    borderTopWidth:    StyleSheet.hairlineWidth,
    borderLeftWidth:   StyleSheet.hairlineWidth,
    borderRightWidth:  StyleSheet.hairlineWidth,
    paddingBottom:     Platform.OS === 'ios' ? 34 : 20,
    paddingHorizontal: 20,
    paddingTop:        10,
    gap: 18,
  },
  handle: {
    alignSelf:    'center',
    width:        36,
    height:       4,
    borderRadius: 2,
    marginBottom: 4,
  },
  content: {
    flexDirection: 'row',
    alignItems:    'center',
    gap: 14,
  },
  art: {
    width:        72,
    height:       72,
    borderRadius: 10,
  },
  artPlaceholder: {
    width:          72,
    height:         72,
    borderRadius:   10,
    justifyContent: 'center',
    alignItems:     'center',
  },
  info: {
    flex: 1,
    gap:  5,
  },
  title: {
    fontSize:   17,
    fontWeight: '700',
    lineHeight: 22,
  },
  titleTappable: {
    textDecorationLine: 'underline',
  },
  artistRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap: 5,
  },
  artist: {
    fontSize:   14,
    fontWeight: '600',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap: 5,
    marginTop: 2,
  },
  date: {
    fontSize: 12,
  },
  rateBlock: {
    gap: 12,
  },
  rateStats: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    flexWrap:       'wrap',
    gap: 8,
  },
  rateStat: {
    flexDirection: 'row',
    alignItems:    'center',
    gap: 5,
  },
  rateStatLabel: {
    fontSize: 12,
  },
  rateStatNum: {
    color:      '#D4A017',
    fontSize:   11,
    fontWeight: '700',
  },
  rateBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  playlistBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap: 3,
    width:          56,
    borderRadius:   10,
    borderWidth:    1.5,
  },
  rateBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap: 8,
    backgroundColor: '#D4A017',
    borderRadius:    10,
    paddingVertical: 12,
  },
  rateBtnText: {
    color:      '#fff',
    fontSize:   15,
    fontWeight: '700',
  },
  closeBtn: {
    borderRadius:    10,
    paddingVertical: 12,
    alignItems:      'center',
  },
  closeBtnText: {
    fontSize:   15,
    fontWeight: '600',
  },
});
