import {
  StyleSheet,
  View,
  Text,
  Image,
  Pressable,
  FlatList,
  ScrollView,
  Alert,
} from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAlbums, LoggedAlbum, TopAlbum, TopSong } from '@/context/AlbumsContext';

const GRADIENT: [string, string, string] = ['#FF3CAC', '#784BA0', '#2B86C5'];
const MAX = 5;

// ─── Shared ───────────────────────────────────────────────────────────────────

function Stars({ rating, color }: { rating: number; color: string }) {
  return (
    <View style={s.stars}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Text key={n} style={[s.star, { color: n <= rating ? '#FF3CAC' : color }]}>★</Text>
      ))}
    </View>
  );
}

// ─── Albums Tab ───────────────────────────────────────────────────────────────

function AlbumRow({ album, colors, onPress }: { album: LoggedAlbum; colors: typeof Colors.light; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [s.albumRow, { opacity: pressed ? 0.7 : 1 }]}
      onPress={onPress}>
      {album.artworkUrl ? (
        <Image source={{ uri: album.artworkUrl }} style={s.albumArt} />
      ) : (
        <View style={[s.albumArt, { backgroundColor: album.coverColor, justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={s.albumInitial}>{album.title.charAt(0)}</Text>
        </View>
      )}
      <View style={s.albumInfo}>
        <Text style={[s.albumTitle, { color: colors.text }]} numberOfLines={1}>{album.title}</Text>
        <Text style={[s.albumArtist, { color: colors.subtext }]} numberOfLines={1}>
          {album.artist} · {album.year}
        </Text>
        <View style={s.ratingRow}>
          <Stars rating={album.rating} color={colors.subtext} />
          <Text style={[s.dateLogged, { color: colors.subtext }]}>{album.dateLogged}</Text>
        </View>
        {album.review ? (
          <Text style={[s.reviewSnippet, { color: colors.subtext }]} numberOfLines={2}>{album.review}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

// ─── Top 5 Tab ────────────────────────────────────────────────────────────────

function TopSlot({
  rank, title, subtitle, artworkUrl,
  colors, isDark, onAdd, onRemove, addLabel,
}: {
  rank: number;
  title?: string;
  subtitle?: string;
  artworkUrl?: string;
  colors: typeof Colors.light;
  isDark: boolean;
  onAdd: () => void;
  onRemove: () => void;
  addLabel: string;
}) {
  return (
    <View style={s.slotRow}>
      <Text style={[s.slotRank, { color: colors.subtext }]}>{rank}</Text>
      {title ? (
        <Pressable style={[s.filledSlot, { backgroundColor: colors.card }]} onPress={onRemove}>
          {artworkUrl ? (
            <Image source={{ uri: artworkUrl }} style={s.slotArt} />
          ) : (
            <View style={[s.slotArt, { backgroundColor: '#333' }]} />
          )}
          <View style={s.slotText}>
            <Text style={[s.slotTitle, { color: colors.text }]} numberOfLines={1}>{title}</Text>
            {subtitle ? <Text style={[s.slotSub, { color: colors.subtext }]} numberOfLines={1}>{subtitle}</Text> : null}
          </View>
          <Text style={[s.removeIcon, { color: colors.subtext }]}>✕</Text>
        </Pressable>
      ) : (
        <Pressable
          style={[s.emptySlot, { backgroundColor: isDark ? '#1a1a1a' : '#f0f0f0', borderColor: isDark ? '#2a2a2a' : '#e0e0e0' }]}
          onPress={onAdd}>
          <Text style={[s.addLabel, { color: '#FF3CAC' }]}>{addLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

function Top5Tab({ colors, isDark }: { colors: typeof Colors.light; isDark: boolean }) {
  const router = useRouter();
  const { topAlbums, topSongs, removeTopAlbum, removeTopSong } = useAlbums();

  function confirmRemove(id: string, title: string, type: 'album' | 'song') {
    Alert.alert('Remove', `Remove "${title}" from your Top 5?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: () => type === 'album' ? removeTopAlbum(id) : removeTopSong(id),
      },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={s.top5Container} showsVerticalScrollIndicator={false}>
      <Text style={[s.sectionTitle, { color: colors.text }]}>Top 5 Albums</Text>
      {Array.from({ length: MAX }).map((_, i) => {
        const a: TopAlbum | undefined = topAlbums[i];
        return (
          <TopSlot
            key={i} rank={i + 1}
            title={a?.title}
            subtitle={a ? `${a.artist} · ${a.year}` : undefined}
            artworkUrl={a?.artworkUrl}
            colors={colors} isDark={isDark}
            addLabel="+ Add album"
            onAdd={() => router.push({ pathname: '/pick-item', params: { type: 'album' } })}
            onRemove={() => a && confirmRemove(a.id, a.title, 'album')}
          />
        );
      })}

      <View style={[s.divider, { backgroundColor: isDark ? '#2a2a2a' : '#e5e5e5' }]} />

      <Text style={[s.sectionTitle, { color: colors.text }]}>Top 5 Songs</Text>
      {Array.from({ length: MAX }).map((_, i) => {
        const song: TopSong | undefined = topSongs[i];
        return (
          <TopSlot
            key={i} rank={i + 1}
            title={song?.title}
            subtitle={song?.artist}
            artworkUrl={song?.artworkUrl}
            colors={colors} isDark={isDark}
            addLabel="+ Add song"
            onAdd={() => router.push({ pathname: '/pick-item', params: { type: 'song' } })}
            onRemove={() => song && confirmRemove(song.id, song.title, 'song')}
          />
        );
      })}
    </ScrollView>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

type Tab = 'albums' | 'top5';

export default function ListendScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { loggedAlbums } = useAlbums();
  const [activeTab, setActiveTab] = useState<Tab>('albums');

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>

      {/* Inner tab bar */}
      <View style={[s.innerTabBar, { backgroundColor: isDark ? '#111' : '#fff', borderBottomColor: isDark ? '#222' : '#e5e5e5' }]}>
        {(['albums', 'top5'] as Tab[]).map((tab) => {
          const label = tab === 'albums' ? `Albums (${loggedAlbums.length})` : 'Top 5';
          const active = activeTab === tab;
          return (
            <Pressable key={tab} style={s.innerTab} onPress={() => setActiveTab(tab)}>
              <Text style={[s.innerTabText, { color: active ? '#FF3CAC' : colors.subtext }]}>
                {label}
              </Text>
              {active && (
                <LinearGradient
                  colors={GRADIENT}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.tabIndicator}
                />
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Tab content */}
      {activeTab === 'albums' ? (
        <FlatList
          data={loggedAlbums}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.listContent}
          ItemSeparatorComponent={() => (
            <View style={[s.separator, { backgroundColor: isDark ? '#222' : '#eee' }]} />
          )}
          ListEmptyComponent={() => (
            <Text style={[s.emptyText, { color: colors.subtext }]}>
              No albums logged yet — head to Search!
            </Text>
          )}
          renderItem={({ item }) => (
            <AlbumRow
              album={item}
              colors={colors}
              onPress={() => router.push({ pathname: '/album-detail', params: { id: item.id } })}
            />
          )}
        />
      ) : (
        <Top5Tab colors={colors} isDark={isDark} />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1 },

  innerTabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  innerTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  innerTabText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    height: 2,
    borderRadius: 1,
  },

  listContent: { paddingBottom: 40 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 90 },
  emptyText: { textAlign: 'center', marginTop: 48, fontSize: 15 },

  albumRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  albumArt: { width: 60, height: 60, borderRadius: 4, flexShrink: 0 },
  albumInitial: { color: 'rgba(255,255,255,0.7)', fontSize: 22, fontWeight: '700' },
  albumInfo: { flex: 1, marginLeft: 14, gap: 3 },
  albumTitle: { fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
  albumArtist: { fontSize: 13 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  stars: { flexDirection: 'row', gap: 1 },
  star: { fontSize: 13 },
  dateLogged: { fontSize: 12 },
  reviewSnippet: { fontSize: 13, lineHeight: 18, marginTop: 4, fontStyle: 'italic' },

  top5Container: { padding: 16, paddingBottom: 40, gap: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3, marginBottom: 4, marginTop: 8 },
  divider: { height: 1, marginVertical: 16 },

  slotRow: { flexDirection: 'row', alignItems: 'center' },
  slotRank: { width: 22, fontSize: 13, fontWeight: '700', textAlign: 'right', marginRight: 10 },
  filledSlot: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10,
  },
  slotArt: { width: 44, height: 44, borderRadius: 4 },
  slotText: { flex: 1, marginLeft: 10, gap: 2 },
  slotTitle: { fontSize: 14, fontWeight: '600' },
  slotSub: { fontSize: 12 },
  removeIcon: { fontSize: 12, marginLeft: 8 },
  emptySlot: {
    flex: 1, height: 60, borderRadius: 10,
    borderWidth: 1, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center',
  },
  addLabel: { fontSize: 14, fontWeight: '500' },
});
