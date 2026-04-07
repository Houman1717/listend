import {
  StyleSheet,
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useAlbums, LoggedAlbum, WantToListenAlbum } from '@/context/AlbumsContext';

// ─── Palette ──────────────────────────────────────────────────────────────────

const DARK_BG = '#0d0d0d';
const CARD_BG  = '#111';
const BORDER   = '#1e1e1e';
const TEXT     = '#f0f0f0';
const SUBTEXT  = '#777';

// One accent per activity type
const COLORS = {
  listened:     { pill: '#FF3CAC', dim: '#1a0810' }, // pink
  rated:        { pill: '#c084fc', dim: '#150d1e' }, // purple
  reviewed:     { pill: '#818cf8', dim: '#0e1020' }, // indigo
  wantToListen: { pill: '#34d399', dim: '#061812' }, // emerald
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BAR_HEIGHTS = [3, 4, 5, 6, 7, 9, 11, 13, 15, 17];

function sortByDate(albums: LoggedAlbum[]): LoggedAlbum[] {
  return [...albums].sort((a, b) => {
    const ta = new Date(a.dateLogged).getTime();
    const tb = new Date(b.dateLogged).getTime();
    return (isNaN(tb) ? 0 : tb) - (isNaN(ta) ? 0 : ta);
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypePill({ label, color }: { label: string; color: string }) {
  return (
    <View style={[tp.pill, { borderColor: color }]}>
      <Text style={[tp.text, { color }]}>{label}</Text>
    </View>
  );
}
const tp = StyleSheet.create({
  pill: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  text: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
});

function RatingMini({ rating }: { rating: number }) {
  if (!rating) return null;
  return (
    <View style={rm.wrap}>
      <FontAwesome name="volume-up" size={9} color={COLORS.rated.pill} />
      <View style={rm.bars}>
        {BAR_HEIGHTS.map((h, i) => (
          <View
            key={i}
            style={[rm.bar, { height: h, backgroundColor: i + 1 <= rating ? COLORS.rated.pill : '#2e2e2e' }]}
          />
        ))}
      </View>
      <Text style={rm.num}>{rating}</Text>
    </View>
  );
}
const rm = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 1.5 },
  bar:  { width: 2.5, borderRadius: 1 },
  num:  { color: COLORS.rated.pill, fontSize: 9, fontWeight: '700', lineHeight: 14 },
});

// Artwork or colour-initial fallback
function AlbumThumb({ artworkUrl, coverColor, title }: {
  artworkUrl?: string;
  coverColor?: string;
  title: string;
}) {
  if (artworkUrl) {
    return <Image source={{ uri: artworkUrl }} style={s.art} />;
  }
  return (
    <View style={[s.art, { backgroundColor: coverColor ?? '#2a2a2a', justifyContent: 'center', alignItems: 'center' }]}>
      <Text style={s.artInitial}>{title.charAt(0)}</Text>
    </View>
  );
}

// Section header
function SectionHead({ icon, label, count, color }: {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  label: string;
  count: number;
  color: string;
}) {
  return (
    <View style={sh.row}>
      <View style={[sh.iconWrap, { backgroundColor: color + '22' }]}>
        <FontAwesome name={icon} size={13} color={color} />
      </View>
      <Text style={sh.label}>{label}</Text>
      <View style={[sh.countBadge, { backgroundColor: color + '22' }]}>
        <Text style={[sh.countText, { color }]}>{count}</Text>
      </View>
    </View>
  );
}
const sh = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 12,
  },
  iconWrap: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  label: { color: TEXT, fontSize: 15, fontWeight: '700', flex: 1 },
  countBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  countText: { fontSize: 12, fontWeight: '700' },
});

// ─── Row variants ─────────────────────────────────────────────────────────────

function ListenedRow({ album, onPress }: { album: LoggedAlbum; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [s.row, { opacity: pressed ? 0.7 : 1 }]} onPress={onPress}>
      <AlbumThumb artworkUrl={album.artworkUrl} coverColor={album.coverColor} title={album.title} />
      <View style={s.info}>
        <Text style={s.title} numberOfLines={1}>{album.title}</Text>
        <Text style={s.artist} numberOfLines={1}>{album.artist}{album.year ? ` · ${album.year}` : ''}</Text>
        <Text style={s.date}>{album.dateLogged}</Text>
      </View>
      <TypePill label="LISTENED" color={COLORS.listened.pill} />
    </Pressable>
  );
}

function RatedRow({ album, onPress }: { album: LoggedAlbum; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [s.row, { opacity: pressed ? 0.7 : 1 }]} onPress={onPress}>
      <AlbumThumb artworkUrl={album.artworkUrl} coverColor={album.coverColor} title={album.title} />
      <View style={s.info}>
        <Text style={s.title} numberOfLines={1}>{album.title}</Text>
        <Text style={s.artist} numberOfLines={1}>{album.artist}</Text>
        <Text style={s.date}>{album.dateLogged}</Text>
      </View>
      <RatingMini rating={album.rating} />
    </Pressable>
  );
}

function ReviewedRow({ album, onPress }: { album: LoggedAlbum; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [s.row, s.reviewRow, { opacity: pressed ? 0.7 : 1 }]} onPress={onPress}>
      <AlbumThumb artworkUrl={album.artworkUrl} coverColor={album.coverColor} title={album.title} />
      <View style={s.info}>
        <Text style={s.title} numberOfLines={1}>{album.title}</Text>
        <Text style={s.artist} numberOfLines={1}>{album.artist}</Text>
        {album.review ? (
          <Text style={s.reviewSnippet} numberOfLines={2}>{album.review}</Text>
        ) : null}
      </View>
      <TypePill label="REVIEW" color={COLORS.reviewed.pill} />
    </Pressable>
  );
}

function WantRow({ album, onPress }: { album: WantToListenAlbum; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [s.row, { opacity: pressed ? 0.7 : 1 }]} onPress={onPress}>
      <AlbumThumb artworkUrl={album.artworkUrl} title={album.title} />
      <View style={s.info}>
        <Text style={s.title} numberOfLines={1}>{album.title}</Text>
        <Text style={s.artist} numberOfLines={1}>{album.artist}{album.year ? ` · ${album.year}` : ''}</Text>
      </View>
      <TypePill label="SAVED" color={COLORS.wantToListen.pill} />
    </Pressable>
  );
}

// ─── Section card wrapper ─────────────────────────────────────────────────────

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <View style={s.card}>
      {children}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function RecentActivityScreen() {
  const router = useRouter();
  const { loggedAlbums, wantToListen } = useAlbums();

  const reviewed     = useMemo(() => sortByDate(loggedAlbums.filter(a => !!a.review)),   [loggedAlbums]);
  const rated        = useMemo(() => sortByDate(loggedAlbums.filter(a => a.rating > 0)), [loggedAlbums]);
  const listened     = useMemo(() => sortByDate(loggedAlbums),                            [loggedAlbums]);
  const totalItems   = reviewed.length + rated.length + listened.length + wantToListen.length;

  function goAlbum(id: string) {
    router.push({ pathname: '/album-detail', params: { id } });
  }

  if (totalItems === 0) {
    return (
      <View style={s.emptyWrap}>
        <View style={s.emptyIconRing}>
          <FontAwesome name="clock-o" size={36} color="#FF3CAC" />
        </View>
        <Text style={s.emptyTitle}>No activity yet</Text>
        <Text style={s.emptySub}>Log your first album to see{'\n'}your activity here.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}>

      {/* ── Recent Reviews ───────────────────────────────────────────────────── */}
      {reviewed.length > 0 && (
        <>
          <SectionHead
            icon="pencil"
            label="Recent Reviews"
            count={reviewed.length}
            color={COLORS.reviewed.pill}
          />
          <SectionCard>
            {reviewed.map((album, i) => (
              <View key={album.id}>
                <ReviewedRow album={album} onPress={() => goAlbum(album.id)} />
                {i < reviewed.length - 1 && <View style={s.sep} />}
              </View>
            ))}
          </SectionCard>
        </>
      )}

      {/* ── Recent Ratings ───────────────────────────────────────────────────── */}
      {rated.length > 0 && (
        <>
          <SectionHead
            icon="star"
            label="Recent Ratings"
            count={rated.length}
            color={COLORS.rated.pill}
          />
          <SectionCard>
            {rated.map((album, i) => (
              <View key={album.id}>
                <RatedRow album={album} onPress={() => goAlbum(album.id)} />
                {i < rated.length - 1 && <View style={s.sep} />}
              </View>
            ))}
          </SectionCard>
        </>
      )}

      {/* ── Recent Listened ──────────────────────────────────────────────────── */}
      {listened.length > 0 && (
        <>
          <SectionHead
            icon="headphones"
            label="Recent Listened"
            count={listened.length}
            color={COLORS.listened.pill}
          />
          <SectionCard>
            {listened.map((album, i) => (
              <View key={album.id}>
                <ListenedRow album={album} onPress={() => goAlbum(album.id)} />
                {i < listened.length - 1 && <View style={s.sep} />}
              </View>
            ))}
          </SectionCard>
        </>
      )}

      {/* ── Recent Want to Listen ────────────────────────────────────────────── */}
      {wantToListen.length > 0 && (
        <>
          <SectionHead
            icon="bookmark"
            label="Recent Want to Listen"
            count={wantToListen.length}
            color={COLORS.wantToListen.pill}
          />
          <SectionCard>
            {wantToListen.map((album, i) => (
              <View key={album.id}>
                <WantRow album={album} onPress={() => goAlbum(album.id)} />
                {i < wantToListen.length - 1 && <View style={s.sep} />}
              </View>
            ))}
          </SectionCard>
        </>
      )}

    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_BG },
  content:   { paddingBottom: 48 },

  card: {
    marginHorizontal: 16,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    overflow: 'hidden',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  reviewRow: { alignItems: 'flex-start' },

  art:        { width: 48, height: 48, borderRadius: 7, flexShrink: 0 },
  artInitial: { color: 'rgba(255,255,255,0.45)', fontSize: 17, fontWeight: '700' },

  info:          { flex: 1, gap: 2 },
  title:         { color: TEXT, fontSize: 14, fontWeight: '600' },
  artist:        { color: SUBTEXT, fontSize: 12 },
  date:          { color: SUBTEXT, fontSize: 11, marginTop: 2 },
  reviewSnippet: { color: '#aaa', fontSize: 12, lineHeight: 17, marginTop: 3 },

  sep: { height: StyleSheet.hairlineWidth, backgroundColor: BORDER, marginLeft: 76 },

  emptyWrap: {
    flex: 1,
    backgroundColor: DARK_BG,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIconRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#1a0d14',
    borderWidth: 1,
    borderColor: '#3a1a2a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: { color: TEXT, fontSize: 18, fontWeight: '700', marginBottom: 10 },
  emptySub:   { color: SUBTEXT, fontSize: 14, lineHeight: 21, textAlign: 'center' },
});
