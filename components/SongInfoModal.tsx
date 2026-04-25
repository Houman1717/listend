import {
  Modal,
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { useEffect, useState } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

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
}: {
  song:           SongInfo | null;
  onClose:        () => void;
  onArtistPress?: (name: string) => void;
  onAlbumPress?:  (params: AlbumNavParams) => void;
}) {
  const colorScheme = useColorScheme();
  const isDark      = colorScheme === 'dark';
  const [fetchedDate,       setFetchedDate]       = useState<string>('');
  const [fetchedAlbumId,    setFetchedAlbumId]    = useState<string>('');
  const [fetchedAlbumTitle, setFetchedAlbumTitle] = useState<string>('');

  useEffect(() => {
    setFetchedDate('');
    setFetchedAlbumId('');
    setFetchedAlbumTitle('');
    if (!song) return;
    if ((song.releaseDate && song.albumId && song.albumTitle) || !song.id) return;
    let cancelled = false;
    fetch(`${API_URL}/spotify/track/${song.id}`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (cancelled) return;
        if (data?.releaseDate) setFetchedDate(data.releaseDate);
        if (data?.albumId)     setFetchedAlbumId(data.albumId);
        if (data?.albumTitle)  setFetchedAlbumTitle(data.albumTitle);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [song?.id, song?.releaseDate, song?.albumId, song?.albumTitle]);

  const displayDate       = formatReleaseDate(song?.releaseDate || fetchedDate || '');
  const displayAlbumId    = song?.albumId    || fetchedAlbumId;
  const displayAlbumTitle = song?.albumTitle || fetchedAlbumTitle;

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
            backgroundColor: isDark ? '#1a1a1a' : '#fff',
            borderColor:      isDark ? '#2a2a2a' : '#e8e8e8',
          },
        ]}
      >
        {/* Drag handle */}
        <View style={[s.handle, { backgroundColor: isDark ? '#444' : '#ddd' }]} />

        {/* Content */}
        <View style={s.content}>
          {song?.artworkUrl ? (
            <Image source={{ uri: song.artworkUrl }} style={s.art} />
          ) : (
            <View style={[s.artPlaceholder, { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0' }]}>
              <FontAwesome name="music" size={28} color="#FF3CAC" />
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
                  artist:     song?.artist ?? '',
                  year:       (song?.releaseDate || fetchedDate || '').slice(0, 4),
                  artworkUrl: song?.artworkUrl ?? '',
                });
              }}
            >
              <Text
                style={[s.title, { color: isDark ? '#f0f0f0' : '#111' }, displayAlbumId ? s.titleTappable : null]}
                numberOfLines={2}
              >
                {song?.title}
              </Text>
            </Pressable>

            {/* Artist — tappable, navigation handled by parent */}
            <Pressable
              hitSlop={8}
              onPress={() => {
                if (!song?.artist) return;
                onClose();
                onArtistPress?.(song.artist);
              }}
              style={s.artistRow}
            >
              <Text style={[s.artist, { color: '#FF3CAC' }]} numberOfLines={1}>
                {song?.artist}
              </Text>
              <FontAwesome name="chevron-right" size={10} color="#FF3CAC" />
            </Pressable>

            {/* Release date */}
            {displayDate ? (
              <View style={s.dateRow}>
                <FontAwesome name="calendar-o" size={11} color={isDark ? '#666' : '#aaa'} />
                <Text style={[s.date, { color: isDark ? '#666' : '#aaa' }]}>
                  {displayDate}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Close button */}
        <Pressable
          onPress={onClose}
          hitSlop={12}
          style={[s.closeBtn, { backgroundColor: isDark ? '#2a2a2a' : '#f4f4f4' }]}
        >
          <Text style={[s.closeBtnText, { color: isDark ? '#ccc' : '#555' }]}>Done</Text>
        </Pressable>
      </View>
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
