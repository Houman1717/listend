import {
  Modal,
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SongInfo = {
  title:        string;
  artist:       string;
  artworkUrl?:  string;
  releaseDate?: string;
};

// ─── Modal ────────────────────────────────────────────────────────────────────

export function SongInfoModal({
  song,
  onClose,
  onArtistPress,
}: {
  song:           SongInfo | null;
  onClose:        () => void;
  onArtistPress?: (name: string) => void;
}) {
  const colorScheme = useColorScheme();
  const isDark      = colorScheme === 'dark';

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
            <Text
              style={[s.title, { color: isDark ? '#f0f0f0' : '#111' }]}
              numberOfLines={2}
            >
              {song?.title}
            </Text>

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
            {song?.releaseDate ? (
              <View style={s.dateRow}>
                <FontAwesome name="calendar-o" size={11} color={isDark ? '#666' : '#aaa'} />
                <Text style={[s.date, { color: isDark ? '#666' : '#aaa' }]}>
                  {song.releaseDate}
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
