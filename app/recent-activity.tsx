import {
  StyleSheet,
  View,
  Text,
  Image,
  Pressable,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState, useEffect } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useAlbums } from '@/context/AlbumsContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

// ─── Palette ──────────────────────────────────────────────────────────────────

const DARK_BG = '#0d0d0d';
const BORDER   = '#1e1e1e';
const TEXT     = '#f0f0f0';
const SUBTEXT  = '#777';

const TYPE_META = {
  reviewed:     { label: 'Reviewed',       color: '#818cf8', icon: 'pencil'     },
  rated:        { label: 'Rated',           color: '#c084fc', icon: 'star'       },
  listened:     { label: 'Listened',        color: '#FF3CAC', icon: 'headphones' },
  wantToListen: { label: 'Want to Listen',  color: '#34d399', icon: 'bookmark'   },
} as const;

const TOP5_CATEGORY_LABEL: Record<string, string> = {
  albums:  'Top 5 Albums',
  songs:   'Top 5 Songs',
  artists: 'Top 5 Artists',
};

type ActivityType = keyof typeof TYPE_META;

// ─── Types ────────────────────────────────────────────────────────────────────

type ActivityItem = {
  key:        string;
  type:       ActivityType;
  id:         string;
  title:      string;
  artist:     string;
  year:       number;
  artworkUrl: string | undefined;
  coverColor: string | undefined;
  dateMs:     number | null;
  dateLabel:  string;
  rating:     number;
};

type FollowItem = {
  key:        string;
  followedId: string;
  name:       string;
  username:   string | null;
  avatarUrl:  string | null;
  dateMs:     number;
  dateLabel:  string;
};

type Top5ChangeItem = {
  key:          string;
  category:     string; // 'albums' | 'songs' | 'artists'
  itemId:       string;
  itemName:     string;
  itemArtist:   string | null;
  itemImageUrl: string | null;
  position:     number;
  dateMs:       number;
  dateLabel:    string;
};

type FeedItem =
  | { kind: 'activity'; data: ActivityItem }
  | { kind: 'follow';   data: FollowItem }
  | { kind: 'top5';     data: Top5ChangeItem };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BAR_HEIGHTS = [3, 4, 5, 6, 7, 9, 11, 13, 15, 17];

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const MONTH_MAP: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

function parseDate(s: string): number | null {
  if (!s) return null;
  let ms = new Date(s).getTime();
  if (!isNaN(ms)) return ms;
  // "Mar 24, 2026" — toLocaleDateString format; Hermes can't parse this directly
  const m = s.match(/^(\w{3})\s+(\d{1,2}),\s+(\d{4})$/);
  if (m && MONTH_MAP[m[1]] !== undefined) {
    ms = new Date(parseInt(m[3], 10), MONTH_MAP[m[1]], parseInt(m[2], 10)).getTime();
    if (!isNaN(ms)) return ms;
  }
  return null;
}

/** Fetch the 20 most-recent people a user has followed + resolve their profiles. */
async function fetchFollowsForUser(uid: string): Promise<FollowItem[]> {
  const { data: followRows, error } = await supabase
    .from('follows')
    .select('following_id, created_at')
    .eq('follower_id', uid)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error || !followRows || followRows.length === 0) return [];

  const ids = followRows.map((r: any) => r.following_id);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, username, avatar_url')
    .in('id', ids);

  if (!profiles) return [];

  return followRows.map((r: any): FollowItem => {
    const prof = profiles.find((p: any) => p.id === r.following_id);
    const ms = new Date(r.created_at).getTime();
    return {
      key:        `follow-${r.following_id}`,
      followedId: r.following_id,
      name:       prof?.display_name || prof?.username || 'User',
      username:   prof?.username    ?? null,
      avatarUrl:  prof?.avatar_url  ?? null,
      dateMs:     ms,
      dateLabel:  new Date(r.created_at).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      }),
    };
  });
}

/** Fetch another user's logged albums + want-to-listen from Supabase. */
async function fetchActivityForUser(uid: string): Promise<ActivityItem[]> {
  const items: ActivityItem[] = [];

  // Logged albums from user_albums (per-user Supabase table)
  const { data: logged } = await supabase
    .from('user_albums')
    .select('spotify_id, title, artist, year, artwork_url, rating, review, listened_at')
    .eq('user_id', uid)
    .order('listened_at', { ascending: false });

  if (logged) {
    for (const a of logged) {
      const type: ActivityType = a.review ? 'reviewed' : a.rating > 0 ? 'rated' : 'listened';
      items.push({
        key:        `logged-${a.spotify_id}`,
        type,
        id:         a.spotify_id,
        title:      a.title      ?? '',
        artist:     a.artist     ?? '',
        year:       a.year       ?? 0,
        artworkUrl: a.artwork_url ?? undefined,
        coverColor: undefined,
        dateMs:     a.listened_at ? new Date(a.listened_at).getTime() : null,
        dateLabel:  a.listened_at ? formatDateLabel(a.listened_at) : '',
        rating:     a.rating     ?? 0,
      });
    }
  }

  // Want-to-listen
  const { data: want } = await supabase
    .from('want_to_listen')
    .select('spotify_id, title, artist, year, artwork_url, created_at')
    .eq('user_id', uid)
    .order('created_at', { ascending: false });

  if (want) {
    for (const w of want) {
      items.push({
        key:        `want-${w.spotify_id}`,
        type:       'wantToListen',
        id:         w.spotify_id,
        title:      w.title      ?? '',
        artist:     w.artist     ?? '',
        year:       w.year       ?? 0,
        artworkUrl: w.artwork_url ?? undefined,
        coverColor: undefined,
        dateMs:     w.created_at ? new Date(w.created_at).getTime() : null,
        dateLabel:  w.created_at ? formatDateLabel(w.created_at) : '',
        rating:     0,
      });
    }
  }

  return items;
}

/** Fetch Top 5 change events for a user. */
async function fetchTop5ChangesForUser(uid: string): Promise<Top5ChangeItem[]> {
  const { data, error } = await supabase
    .from('top5_changes')
    .select('id, category, item_id, item_name, item_image_url, position, changed_at')
    .eq('user_id', uid)
    .order('changed_at', { ascending: false })
    .limit(30);

  if (error || !data) return [];

  return data.map((r: any): Top5ChangeItem => ({
    key:          `top5-${r.id}`,
    category:     r.category,
    itemId:       r.item_id,
    itemName:     r.item_name,
    itemArtist:   null,           // not in schema — omitted
    itemImageUrl: r.item_image_url ?? null,
    position:     r.position,
    dateMs:       new Date(r.changed_at).getTime(),
    dateLabel:    formatDateLabel(r.changed_at),
  }));
}

// ─── Row components ───────────────────────────────────────────────────────────

function ActivityRow({ item, onPress }: { item: ActivityItem; onPress: () => void }) {
  const meta = TYPE_META[item.type];
  return (
    <Pressable
      style={({ pressed }) => [s.row, { opacity: pressed ? 0.72 : 1 }]}
      onPress={onPress}>

      {item.artworkUrl ? (
        <Image source={{ uri: item.artworkUrl }} style={s.art} />
      ) : (
        <View style={[s.art, { backgroundColor: item.coverColor ?? '#2a2a2a', justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={s.artInitial}>{item.title.charAt(0)}</Text>
        </View>
      )}

      <View style={s.info}>
        <Text style={s.title} numberOfLines={1}>{item.title}</Text>
        <Text style={s.artist} numberOfLines={1}>{item.artist}{item.year ? ` · ${item.year}` : ''}</Text>
        <View style={s.meta}>
          <View style={[s.typePill, { borderColor: meta.color }]}>
            <FontAwesome name={meta.icon as any} size={9} color={meta.color} />
            <Text style={[s.typeLabel, { color: meta.color }]}>{meta.label}</Text>
          </View>
          {item.dateLabel ? <Text style={s.date}>{item.dateLabel}</Text> : null}
        </View>
      </View>

      {item.type === 'rated' && item.rating > 0 && (
        <View style={s.bars}>
          {BAR_HEIGHTS.map((h, i) => (
            <View
              key={i}
              style={[s.bar, { height: h, backgroundColor: i + 1 <= item.rating ? '#c084fc' : '#252525' }]}
            />
          ))}
        </View>
      )}
    </Pressable>
  );
}

function FollowRow({ item, onPress }: { item: FollowItem; onPress: () => void }) {
  const initial = item.name.charAt(0).toUpperCase();
  return (
    <Pressable
      style={({ pressed }) => [s.row, { opacity: pressed ? 0.72 : 1 }]}
      onPress={onPress}>
      {item.avatarUrl ? (
        <Image source={{ uri: item.avatarUrl }} style={s.followAvatar} />
      ) : (
        <View style={[s.followAvatar, s.followAvatarFallback]}>
          <Text style={s.followInitial}>{initial}</Text>
        </View>
      )}
      <View style={s.info}>
        <Text style={s.title} numberOfLines={1}>{item.name}</Text>
        {item.username ? <Text style={s.artist} numberOfLines={1}>@{item.username}</Text> : null}
        <View style={s.meta}>
          <View style={[s.typePill, { borderColor: '#38bdf8' }]}>
            <FontAwesome name="user-plus" size={9} color="#38bdf8" />
            <Text style={[s.typeLabel, { color: '#38bdf8' }]}>Followed</Text>
          </View>
          {item.dateLabel ? <Text style={s.date}>{item.dateLabel}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

const TOP5_COLOR = '#f59e0b';

function Top5Row({ item, onPress }: { item: Top5ChangeItem; onPress: () => void }) {
  const catLabel = TOP5_CATEGORY_LABEL[item.category] ?? 'Top 5';
  return (
    <Pressable
      style={({ pressed }) => [s.row, { opacity: pressed ? 0.72 : 1 }]}
      onPress={onPress}>
      {item.itemImageUrl ? (
        <Image
          source={{ uri: item.itemImageUrl }}
          style={[s.art, item.category === 'artists' ? s.artCircle : null]}
        />
      ) : (
        <View style={[s.art, { backgroundColor: '#2a2a2a', justifyContent: 'center', alignItems: 'center' },
          item.category === 'artists' ? s.artCircle : null]}>
          <Text style={s.artInitial}>{item.itemName.charAt(0)}</Text>
        </View>
      )}
      <View style={s.info}>
        <Text style={s.title} numberOfLines={1}>{item.itemName}</Text>
        {item.itemArtist ? (
          <Text style={s.artist} numberOfLines={1}>{item.itemArtist}</Text>
        ) : null}
        <View style={s.meta}>
          <View style={[s.typePill, { borderColor: TOP5_COLOR }]}>
            <FontAwesome name="list-ol" size={9} color={TOP5_COLOR} />
            <Text style={[s.typeLabel, { color: TOP5_COLOR }]}>
              {`Updated ${catLabel} · #${item.position}`}
            </Text>
          </View>
          {item.dateLabel ? <Text style={s.date}>{item.dateLabel}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function RecentActivityScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { loggedAlbums, wantToListen } = useAlbums();
  const { userId: paramUserId } = useLocalSearchParams<{ userId?: string }>();

  // If a userId param is present and it isn't ours, we're viewing someone else.
  const viewingOther = paramUserId || null;

  // ── Own-feed follow items (fetched from Supabase for current user) ───────────
  const [ownFollowItems,   setOwnFollowItems]   = useState<FollowItem[]>([]);
  const [ownTop5Items,     setOwnTop5Items]     = useState<Top5ChangeItem[]>([]);
  // ── Other-user feed (activity + follows, fetched from Supabase) ─────────────
  const [otherActivity,    setOtherActivity]    = useState<ActivityItem[]>([]);
  const [otherFollows,     setOtherFollows]     = useState<FollowItem[]>([]);
  const [otherTop5Items,   setOtherTop5Items]   = useState<Top5ChangeItem[]>([]);
  const [loadingOther,     setLoadingOther]     = useState(false);

  // Fetch current user's recent follows + top5 changes
  useEffect(() => {
    if (!user || viewingOther) return;
    fetchFollowsForUser(user.id).then(setOwnFollowItems);
    fetchTop5ChangesForUser(user.id).then(setOwnTop5Items);
  }, [user?.id, viewingOther]);

  // Fetch another user's full activity + follows + top5 changes
  useEffect(() => {
    if (!viewingOther) return;
    setLoadingOther(true);
    Promise.all([
      fetchActivityForUser(viewingOther),
      fetchFollowsForUser(viewingOther),
      fetchTop5ChangesForUser(viewingOther),
    ]).then(([activity, follows, top5]) => {
      setOtherActivity(activity);
      setOtherFollows(follows);
      setOtherTop5Items(top5);
      setLoadingOther(false);
    });
  }, [viewingOther]);

  // ── Build own-user feed from AlbumsContext ────────────────────────────────────
  const ownActivityItems = useMemo((): ActivityItem[] => {
    if (viewingOther) return [];
    const items: ActivityItem[] = [];

    for (const a of loggedAlbums) {
      const type: ActivityType = a.review ? 'reviewed' : a.rating > 0 ? 'rated' : 'listened';
      items.push({
        key:        `logged-${a.id}`,
        type,
        id:         a.id,
        title:      a.title,
        artist:     a.artist,
        year:       a.year,
        artworkUrl: a.artworkUrl,
        coverColor: a.coverColor,
        dateMs:     parseDate(a.dateLogged),
        dateLabel:  formatDateLabel(a.dateLogged),
        rating:     a.rating,
      });
    }

    for (const w of wantToListen) {
      const dateMs = w.dateAdded ? new Date(w.dateAdded).getTime() : null;
      items.push({
        key:        `want-${w.id}`,
        type:       'wantToListen',
        id:         w.id,
        title:      w.title,
        artist:     w.artist,
        year:       w.year,
        artworkUrl: w.artworkUrl,
        coverColor: undefined,
        dateMs,
        dateLabel:  w.dateAdded
          ? new Date(w.dateAdded).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : '',
        rating:     0,
      });
    }

    return items;
  }, [loggedAlbums, wantToListen, viewingOther]);

  // ── Merge into final sorted feed ──────────────────────────────────────────────
  const feed = useMemo((): FeedItem[] => {
    const activityItems = viewingOther ? otherActivity   : ownActivityItems;
    const followItems   = viewingOther ? otherFollows    : ownFollowItems;
    const top5Items     = viewingOther ? otherTop5Items  : ownTop5Items;

    const combined: FeedItem[] = [
      ...activityItems.map(d => ({ kind: 'activity' as const, data: d })),
      ...followItems.map(d   => ({ kind: 'follow'   as const, data: d })),
      ...top5Items.map(d     => ({ kind: 'top5'     as const, data: d })),
    ];

    combined.sort((a, b) => {
      const msA = a.data.dateMs;
      const msB = b.data.dateMs;
      if (msA === null && msB === null) return 0;
      if (msA === null) return 1;
      if (msB === null) return -1;
      return msB - msA;
    });

    return combined;
  }, [ownActivityItems, otherActivity, ownFollowItems, otherFollows, ownTop5Items, otherTop5Items, viewingOther]);

  // ── Loading spinner (other-user fetch only) ───────────────────────────────────
  if (loadingOther) {
    return (
      <View style={s.loadingWrap}>
        <ActivityIndicator color="#FF3CAC" size="large" />
      </View>
    );
  }

  if (feed.length === 0) {
    return (
      <View style={s.emptyWrap}>
        <View style={s.emptyRing}>
          <FontAwesome name="clock-o" size={36} color="#FF3CAC" />
        </View>
        <Text style={s.emptyTitle}>No activity yet</Text>
        <Text style={s.emptySub}>
          {viewingOther
            ? 'This user has no public activity yet.'
            : 'Log your first album to see\nyour activity here.'}
        </Text>
      </View>
    );
  }

  function handleTop5Press(item: Top5ChangeItem) {
    if (item.category === 'albums') {
      router.push({ pathname: '/album-detail', params: { id: item.itemId } });
    } else if (item.category === 'artists') {
      router.push({ pathname: '/artist-detail', params: { id: item.itemId, name: item.itemName } });
    } else {
      // songs — navigate to artist detail using artist name
      router.push({ pathname: '/artist-detail', params: { name: item.itemArtist ?? item.itemName } });
    }
  }

  return (
    <FlatList
      data={feed}
      keyExtractor={item => item.data.key}
      style={s.container}
      contentContainerStyle={s.list}
      showsVerticalScrollIndicator={false}
      ItemSeparatorComponent={() => <View style={s.sep} />}
      renderItem={({ item }) => {
        if (item.kind === 'follow') {
          return (
            <FollowRow
              item={item.data}
              onPress={() =>
                router.push({ pathname: '/user-profile', params: { userId: item.data.followedId } })
              }
            />
          );
        }
        if (item.kind === 'top5') {
          return (
            <Top5Row
              item={item.data}
              onPress={() => handleTop5Press(item.data)}
            />
          );
        }
        return (
          <ActivityRow
            item={item.data}
            onPress={() =>
              router.push({ pathname: '/album-detail', params: { id: item.data.id } })
            }
          />
        );
      }}
    />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_BG },
  list:      { paddingVertical: 8, paddingBottom: 48 },

  loadingWrap: {
    flex: 1, backgroundColor: DARK_BG,
    alignItems: 'center', justifyContent: 'center',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 13,
    gap: 13,
  },
  art:        { width: 52, height: 52, borderRadius: 8, flexShrink: 0 },
  artCircle:  { borderRadius: 26 },
  artInitial: { color: 'rgba(255,255,255,0.45)', fontSize: 18, fontWeight: '700' },

  info:   { flex: 1, gap: 3 },
  title:  { color: TEXT, fontSize: 14, fontWeight: '600' },
  artist: { color: SUBTEXT, fontSize: 12 },

  meta:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3, flexWrap: 'wrap' },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  typeLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  date:      { color: SUBTEXT, fontSize: 11 },

  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 1.5, flexShrink: 0 },
  bar:  { width: 2.5, borderRadius: 1 },

  sep: { height: StyleSheet.hairlineWidth, backgroundColor: BORDER, marginLeft: 83 },

  // Follow row
  followAvatar:        { width: 52, height: 52, borderRadius: 26, flexShrink: 0 },
  followAvatarFallback:{ backgroundColor: '#1e1e1e', alignItems: 'center', justifyContent: 'center' },
  followInitial:       { color: 'rgba(255,255,255,0.45)', fontSize: 18, fontWeight: '700' },

  emptyWrap: {
    flex: 1,
    backgroundColor: DARK_BG,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyRing: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: '#1a0d14',
    borderWidth: 1, borderColor: '#3a1a2a',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: { color: TEXT,    fontSize: 18, fontWeight: '700', marginBottom: 10 },
  emptySub:   { color: SUBTEXT, fontSize: 14, lineHeight: 21,    textAlign: 'center' },
});
