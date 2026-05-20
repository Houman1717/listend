import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LoggedAlbum = {
  id: string;
  title: string;
  artist: string;
  year: number;
  rating: number;
  review?: string;
  dateLogged: string;
  artworkUrl?: string;
  coverColor: string;
  durationMs?: number;
  reListenCount?: number;
  isRelistened?: boolean;
  lastListenedAt?: string;
  lastRating?: number;
  lastReview?: string;
  genreTags?: string[];
};

export type PendingAlbum = {
  spotifyId: string;
  title: string;
  artist: string;
  year: number;
  artworkUrl: string;
};

export type TopAlbum = {
  id: string;
  title: string;
  artist: string;
  year: number;
  artworkUrl: string;
};

export type TopSong = {
  id: string;
  title: string;
  artist: string;
  artworkUrl: string;
  releaseDate?: string;
};

export type TopArtist = {
  id: string;
  name: string;
  artworkUrl: string;
};

export type WantToListenAlbum = {
  id: string;          // spotify_id
  title: string;
  artist: string;
  year: number;
  artworkUrl: string;
  dateAdded?: string;
  durationMs?: number;
};

export type Playlist = {
  id: string;
  name: string;
  description?: string;
  albumIds: string[];
  createdAt: string;
};

type AlbumsContextType = {
  loggedAlbums: LoggedAlbum[];
  pendingAlbum: PendingAlbum | null;
  setPendingAlbum: (album: PendingAlbum | null) => void;
  logAlbum: (rating: number, review: string) => void;
  reListenMode: boolean;
  setReListenMode: (v: boolean) => void;
  updateReview: (id: string, rating: number, review: string) => void;
  updateReListenReview: (id: string, rating: number, review: string) => void;
  updateDuration: (id: string, durationMs: number) => void;
  removeLoggedAlbum: (id: string) => void;
  removeReListenEntry: (albumId: string, listenedAt: string) => Promise<void>;
  undoLastReListenEntry: (albumId: string) => Promise<void>;
  topAlbums: (TopAlbum | null)[];
  topSongs: (TopSong | null)[];
  topArtists: (TopArtist | null)[];
  addTopAlbum: (album: TopAlbum) => void;
  addTopAlbumAtSlot: (index: number, album: TopAlbum) => void;
  removeTopAlbum: (id: string) => void;
  reorderTopAlbums: (albums: (TopAlbum | null)[]) => void;
  addTopSong: (song: TopSong) => void;
  addTopSongAtSlot: (index: number, song: TopSong) => void;
  removeTopSong: (id: string) => void;
  reorderTopSongs: (songs: (TopSong | null)[]) => void;
  addTopArtist: (artist: TopArtist) => void;
  addTopArtistAtSlot: (index: number, artist: TopArtist) => void;
  removeTopArtist: (id: string) => void;
  reorderTopArtists: (artists: (TopArtist | null)[]) => void;
  wantToListen: WantToListenAlbum[];
  addToWantToListen: (album: WantToListenAlbum) => void;
  removeFromWantToListen: (id: string) => void;
  playlists: Playlist[];
  createPlaylist: (name: string, description?: string) => string;
  deletePlaylist: (id: string) => void;
  addAlbumToPlaylist: (playlistId: string, albumId: string) => void;
  removeAlbumFromPlaylist: (playlistId: string, albumId: string) => void;
  isLoaded: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function padTo5<T>(arr: (T | null)[]): (T | null)[] {
  const out = arr.slice(0, 5).map(x => x ?? null);
  while (out.length < 5) out.push(null);
  return out;
}

// ─── User-scoped storage keys ─────────────────────────────────────────────────
// Each account gets its own cache so switching accounts never bleeds data.

function sk(base: string, uid: string) {
  return `${base}_${uid}`;
}

const KEY = {
  LOGGED:       '@listend:loggedAlbums_v2',
  TOP_ALBUMS:   '@listend:topAlbums_v2',
  TOP_SONGS:    '@listend:topSongs_v2',
  TOP_ARTISTS:  '@listend:topArtists_v2',
  WANT:         '@listend:wantToListen_v2',
  PLAYLISTS:    '@listend:playlists_v2',
};

const COVER_COLORS = [
  '#2d5a27', '#7a4a2e', '#1a3018', '#d4a017',
  '#7a3a1a', '#8b1a1a', '#1a5a5a', '#4a2818',
];

// ─── Context ──────────────────────────────────────────────────────────────────

const AlbumsContext = createContext<AlbumsContextType | null>(null);

export function AlbumsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  // Start empty — no INITIAL_ALBUMS seed (would show on every account)
  const [loggedAlbums, setLoggedAlbums] = useState<LoggedAlbum[]>([]);
  const [topAlbums,    setTopAlbums]    = useState<(TopAlbum | null)[]>(Array(5).fill(null));
  const [topSongs,     setTopSongs]     = useState<(TopSong | null)[]>(Array(5).fill(null));
  const [topArtists,   setTopArtists]   = useState<(TopArtist | null)[]>(Array(5).fill(null));
  const [wantToListen, setWantToListen] = useState<WantToListenAlbum[]>([]);
  const [playlists,    setPlaylists]    = useState<Playlist[]>([]);
  const [pendingAlbum,  setPendingAlbum]  = useState<PendingAlbum | null>(null);
  const [isLoaded,      setIsLoaded]      = useState(false);
  const [reListenMode,  setReListenMode]  = useState(false);

  // ── Load + sync whenever the signed-in user changes ───────────────────────
  // This single effect handles:
  //   1. Clearing stale state from the previous account
  //   2. Fast restore from user-scoped AsyncStorage cache
  //   3. Authoritative sync from Supabase (overwrites cache)
  useEffect(() => {
    // ── Step 1: Clear everything immediately ─────────────────────────────────
    setLoggedAlbums([]);
    setTopAlbums([]);
    setTopSongs([]);
    setTopArtists([]);
    setWantToListen([]);
    setPlaylists([]);
    setIsLoaded(false);

    if (!user) {
      console.log('[AlbumsContext] no user — state cleared');
      setIsLoaded(true);
      return;
    }

    const uid = user.id;
    console.log('[AlbumsContext] loading all data for user:', uid);

    // Guard against race conditions if the user changes before async ops finish
    let cancelled = false;

    (async () => {
      // ── Step 2: Fast restore from user-scoped AsyncStorage ─────────────────
      try {
        const [albumsStr, topAlbumsStr, topSongsStr, topArtistsStr, wantStr, playlistsStr] =
          await Promise.all([
            AsyncStorage.getItem(sk(KEY.LOGGED,     uid)),
            AsyncStorage.getItem(sk(KEY.TOP_ALBUMS,  uid)),
            AsyncStorage.getItem(sk(KEY.TOP_SONGS,   uid)),
            AsyncStorage.getItem(sk(KEY.TOP_ARTISTS, uid)),
            AsyncStorage.getItem(sk(KEY.WANT,        uid)),
            AsyncStorage.getItem(sk(KEY.PLAYLISTS,   uid)),
          ]);

        if (cancelled) return;

        if (albumsStr  !== null) setLoggedAlbums(JSON.parse(albumsStr));
        if (topAlbumsStr  !== null) setTopAlbums(padTo5(JSON.parse(topAlbumsStr)));
        if (topSongsStr   !== null) setTopSongs(padTo5(JSON.parse(topSongsStr)));
        if (topArtistsStr !== null) setTopArtists(padTo5(JSON.parse(topArtistsStr)));
        if (wantStr      !== null) setWantToListen(JSON.parse(wantStr));
        if (playlistsStr !== null) setPlaylists(JSON.parse(playlistsStr));
      } catch {
        // cache miss — no problem, Supabase will fill in below
      }

      setIsLoaded(true);

      // ── Step 3: Authoritative Supabase sync ──────────────────────────────────

      // 3a. Logged albums (+ latest re-listen rating per album)
      const [{ data: albumData, error: albumErr }, { data: reListenRatingData }] = await Promise.all([
        supabase
          .from('user_albums')
          .select('spotify_id, title, artist, artwork_url, year, rating, review, listened_at, duration_ms, re_listen_count, is_relistened, genre_tags')
          .eq('user_id', uid)
          .not('listened_at', 'is', null)
          .order('listened_at', { ascending: false }),
        supabase
          .from('re_listens')
          .select('spotify_id, rating, review, listened_at')
          .eq('user_id', uid)
          .order('listened_at', { ascending: false }),
      ]);

      // Build maps: spotify_id → most recent re-listen rating / most recent re-listen review / latest date
      // Each map is filled independently so a missing review on the newest re-listen
      // still finds the most recent re-listen that DID have a review.
      const latestReListenRating = new Map<string, number>();
      const latestReListenReview = new Map<string, string>();
      const latestReListenDate   = new Map<string, string>();
      for (const r of (reListenRatingData ?? []) as any[]) {
        if (!latestReListenDate.has(r.spotify_id) && r.listened_at)
          latestReListenDate.set(r.spotify_id, r.listened_at);
        if (!latestReListenRating.has(r.spotify_id) && r.rating)
          latestReListenRating.set(r.spotify_id, r.rating);
        if (!latestReListenReview.has(r.spotify_id) && r.review)
          latestReListenReview.set(r.spotify_id, r.review);
      }

      if (!cancelled) {
        if (albumErr) {
          console.error('[AlbumsContext] user_albums sync error:', albumErr.message);
        } else {
          const albums: LoggedAlbum[] = (albumData ?? []).map((row, i) => ({
            id:             row.spotify_id,
            title:          row.title         ?? '',
            artist:         row.artist        ?? '',
            year:           row.year          ?? 0,
            rating:         row.rating        ?? 0,
            review:         row.review        ?? undefined,
            dateLogged:     row.listened_at   ?? new Date().toISOString(),
            artworkUrl:     row.artwork_url   ?? undefined,
            coverColor:     COVER_COLORS[i % COVER_COLORS.length],
            durationMs:     row.duration_ms   ?? undefined,
            reListenCount:  row.re_listen_count ?? 0,
            isRelistened:   row.is_relistened   ?? false,
            lastRating:      row.is_relistened ? latestReListenRating.get(row.spotify_id) : undefined,
            lastReview:      row.is_relistened ? latestReListenReview.get(row.spotify_id) : undefined,
            lastListenedAt:  row.is_relistened ? latestReListenDate.get(row.spotify_id)   : undefined,
            genreTags:       row.genre_tags ?? [],
          }));
          // Merge: preserve local state that is newer than what the DB returned.
          // Two cases this guards against:
          //   1. Brand-new album logged while fetch was in-flight — not in DB yet,
          //      so it won't appear in `albums` at all (kept via localOnly).
          //   2. Re-logged album whose DB row still has an old listened_at — the
          //      fetch returns the stale date, which would drop it from thisYear.
          //      We keep the local dateLogged when it is more recent.
          const fetchedIds = new Set(albums.map(a => a.id));
          setLoggedAlbums(prev => {
            const prevMap = new Map(prev.map(a => [a.id, a]));
            // Only preserve local-only albums when the DB returned *some* rows.
            // If DB returned 0 rows (e.g. account was cleared), trust the DB
            // and don't resurrect stale local cache entries.
            const localOnly = albums.length > 0
              ? prev.filter(a => !fetchedIds.has(a.id))
              : [];
            const merged = albums.map(a => {
              const local = prevMap.get(a.id);
              if (local && local.dateLogged > a.dateLogged) {
                return { ...a, dateLogged: local.dateLogged };
              }
              return a;
            });
            const result = [...localOnly, ...merged]
              .sort((a, b) => b.dateLogged.localeCompare(a.dateLogged));
            AsyncStorage.setItem(sk(KEY.LOGGED, uid), JSON.stringify(result)).catch(() => {});
            return result;
          });
        }
      }

      // 3b. Playlists
      const { data: remotePlaylists, error: plErr } = await supabase
        .from('playlists')
        .select('id, name, description, created_at')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });

      if (!cancelled) {
        if (plErr) {
          console.error('[AlbumsContext] playlists sync error:', plErr.message);
        } else if (remotePlaylists && remotePlaylists.length > 0) {
          const playlistIds = remotePlaylists.map((p: any) => p.id);
          const { data: remoteAlbums } = await supabase
            .from('playlist_albums')
            .select('playlist_id, spotify_id, position')
            .in('playlist_id', playlistIds)
            .order('position', { ascending: true });

          if (!cancelled) {
            const synced: Playlist[] = remotePlaylists.map((p: any) => ({
              id:          p.id,
              name:        p.name,
              description: p.description ?? undefined,
              albumIds:    (remoteAlbums ?? [])
                .filter((a: any) => a.playlist_id === p.id)
                .map((a: any) => a.spotify_id),
              createdAt:   p.created_at,
            }));
            setPlaylists(synced);
            AsyncStorage.setItem(sk(KEY.PLAYLISTS, uid), JSON.stringify(synced)).catch(() => {});
          }
        } else {
          // No playlists — make sure state is empty
          if (!cancelled) setPlaylists([]);
        }
      }

      // 3c. Want to Listen
      const { data: wantData, error: wantErr } = await supabase
        .from('want_to_listen')
        .select('spotify_id, title, artist, year, artwork_url, created_at')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });

      if (!cancelled) {
        if (wantErr) {
          console.error('[AlbumsContext] want_to_listen sync error:', wantErr.message);
        } else {
          const want: WantToListenAlbum[] = (wantData ?? []).map((w: any) => ({
            id:         w.spotify_id,
            title:      w.title       ?? '',
            artist:     w.artist      ?? '',
            year:       w.year        ?? 0,
            artworkUrl: w.artwork_url ?? '',
            dateAdded:  w.created_at  ?? undefined,
          }));
          console.log('[AlbumsContext] want_to_listen loaded:', want.length, 'for user:', uid);
          setWantToListen(want);
          AsyncStorage.setItem(sk(KEY.WANT, uid), JSON.stringify(want)).catch(() => {});
        }
      }

      // 3d. Top Favourites from profiles JSONB columns
      const { data: profData, error: profErr } = await supabase
        .from('profiles')
        .select('top_albums, top_songs, top_artists')
        .eq('id', uid)
        .single();

      if (!cancelled) {
        if (profErr && profErr.code !== 'PGRST116') {
          console.error('[AlbumsContext] profiles top5 sync error:', profErr.message);
        } else if (profData) {
          console.log('[Top5] loading for user:', uid, profData);
          if (Array.isArray(profData.top_albums))  setTopAlbums(padTo5(profData.top_albums));
          if (Array.isArray(profData.top_songs))   setTopSongs(padTo5(profData.top_songs));
          if (Array.isArray(profData.top_artists)) setTopArtists(padTo5(profData.top_artists));

          AsyncStorage.setItem(sk(KEY.TOP_ALBUMS,  uid), JSON.stringify(profData.top_albums  ?? [])).catch(() => {});
          AsyncStorage.setItem(sk(KEY.TOP_SONGS,   uid), JSON.stringify(profData.top_songs   ?? [])).catch(() => {});
          AsyncStorage.setItem(sk(KEY.TOP_ARTISTS, uid), JSON.stringify(profData.top_artists ?? [])).catch(() => {});
        }
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id]);

  // ── Persist changes to user-scoped AsyncStorage ───────────────────────────
  // These run whenever a value changes AFTER the initial load.

  useEffect(() => {
    if (!isLoaded || !user?.id) return;
    AsyncStorage.setItem(sk(KEY.LOGGED, user.id), JSON.stringify(loggedAlbums)).catch(() => {});
  }, [loggedAlbums, isLoaded, user?.id]);

  useEffect(() => {
    if (!isLoaded || !user?.id) return;
    AsyncStorage.setItem(sk(KEY.TOP_ALBUMS, user.id), JSON.stringify(topAlbums)).catch(() => {});
  }, [topAlbums, isLoaded, user?.id]);

  useEffect(() => {
    if (!isLoaded || !user?.id) return;
    AsyncStorage.setItem(sk(KEY.TOP_SONGS, user.id), JSON.stringify(topSongs)).catch(() => {});
  }, [topSongs, isLoaded, user?.id]);

  useEffect(() => {
    if (!isLoaded || !user?.id) return;
    AsyncStorage.setItem(sk(KEY.TOP_ARTISTS, user.id), JSON.stringify(topArtists)).catch(() => {});
  }, [topArtists, isLoaded, user?.id]);

  useEffect(() => {
    if (!isLoaded || !user?.id) return;
    AsyncStorage.setItem(sk(KEY.WANT, user.id), JSON.stringify(wantToListen)).catch(() => {});
  }, [wantToListen, isLoaded, user?.id]);

  useEffect(() => {
    if (!isLoaded || !user?.id) return;
    AsyncStorage.setItem(sk(KEY.PLAYLISTS, user.id), JSON.stringify(playlists)).catch(() => {});
  }, [playlists, isLoaded, user?.id]);

  // ── Actions ───────────────────────────────────────────────────────────────

  function logAlbum(rating: number, review: string) {
    if (!pendingAlbum) return;

    if (reListenMode) {
      // Re-listen: insert new re_listens row, update user_albums rating+date+count
      const dateLogged = new Date().toISOString();
      const existingAlbum = loggedAlbums.find(a => a.id === pendingAlbum!.spotifyId);
      const newCount = (existingAlbum?.reListenCount ?? 0) + 1;

      // Update local state — preserve original dateLogged and rating; set lastRating/lastReview/lastListenedAt
      setLoggedAlbums(prev => prev.map(a =>
        a.id === pendingAlbum!.spotifyId
          ? { ...a, lastRating: rating, lastReview: review.trim() || undefined, reListenCount: newCount, isRelistened: true, lastListenedAt: dateLogged }
          : a
      ));
      setWantToListen(prev => prev.filter(a => a.id !== pendingAlbum!.spotifyId));
      setPendingAlbum(null);
      setReListenMode(false);

      if (user) {
        supabase.from('re_listens').insert({
          user_id:     user.id,
          spotify_id:  pendingAlbum!.spotifyId,
          title:       pendingAlbum!.title,
          artist:      pendingAlbum!.artist,
          artwork_url: pendingAlbum!.artworkUrl ?? null,
          year:        pendingAlbum!.year,
          rating,
          review:      review.trim() || null,
          listened_at: dateLogged,
        }).then(({ error }) => { if (error) console.error('[AlbumsContext] reListenAlbum error:', error.message); });

        supabase.from('user_albums').update({
          re_listen_count: newCount,
          is_relistened:   true,
        }).eq('user_id', user.id).eq('spotify_id', pendingAlbum!.spotifyId)
          .then(({ error }) => { if (error) console.error('[AlbumsContext] reListenAlbum update error:', error.message); });
      }
      return;
    }

    const dateLogged = new Date().toISOString();
    const colorIndex = loggedAlbums.length % COVER_COLORS.length;

    const newAlbum: LoggedAlbum = {
      id:         pendingAlbum.spotifyId,
      title:      pendingAlbum.title,
      artist:     pendingAlbum.artist,
      year:       pendingAlbum.year,
      rating,
      review:     review.trim() || undefined,
      dateLogged,
      artworkUrl: pendingAlbum.artworkUrl || undefined,
      coverColor: COVER_COLORS[colorIndex],
    };

    setLoggedAlbums((prev) => [newAlbum, ...prev]);
    setWantToListen((prev) => prev.filter((a) => a.id !== newAlbum.id));
    setPendingAlbum(null);

    if (user) {
      supabase
        .from('user_albums')
        .upsert({
          user_id:     user.id,
          spotify_id:  newAlbum.id,
          title:       newAlbum.title,
          artist:      newAlbum.artist,
          artwork_url: newAlbum.artworkUrl ?? null,
          year:        newAlbum.year,
          rating:      newAlbum.rating,
          review:      newAlbum.review ?? null,
          listened_at: dateLogged,
        }, { onConflict: 'user_id,spotify_id' })
        .then(({ error }) => {
          if (error) console.error('[AlbumsContext] logAlbum upsert error:', error.message);
        });

      supabase
        .from('want_to_listen')
        .delete()
        .match({ user_id: user.id, spotify_id: newAlbum.id })
        .then(({ error }) => {
          if (error) console.error('[AlbumsContext] logAlbum want_to_listen removal error:', error.message);
        });

      // Fetch genre tags fire-and-forget — stored for stats, not blocking UX
      const tagsUrl = `${API_URL}/album-tags?artist=${encodeURIComponent(newAlbum.artist)}&album=${encodeURIComponent(newAlbum.title)}&amId=${encodeURIComponent(newAlbum.id)}`;
      fetch(tagsUrl)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          const tags: string[] = data?.tags ?? [];
          if (tags.length === 0) return;
          supabase
            .from('user_albums')
            .update({ genre_tags: tags })
            .eq('user_id', user.id)
            .eq('spotify_id', newAlbum.id)
            .then(({ error }) => { if (error) console.error('[AlbumsContext] genre_tags update error:', error.message); });
          setLoggedAlbums(prev => prev.map(a => a.id === newAlbum.id ? { ...a, genreTags: tags } : a));
        })
        .catch(() => {});
    }
  }

  function updateReview(id: string, rating: number, review: string) {
    setLoggedAlbums((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, rating, review: review.trim() || undefined } : a
      )
    );

    if (user) {
      supabase
        .from('user_albums')
        .update({ rating, review: review.trim() || null })
        .match({ user_id: user.id, spotify_id: id })
        .then(({ error }) => {
          if (error) console.error('[AlbumsContext] updateReview error:', error.message);
        });
    }
  }

  function updateReListenReview(id: string, rating: number, review: string) {
    const trimmedReview = review.trim() || null;

    // Optimistic local update so My Listend and Re-listend tab reflect immediately
    setLoggedAlbums(prev => prev.map(a =>
      a.id === id ? { ...a, lastRating: rating, lastReview: trimmedReview ?? undefined } : a
    ));

    if (!user) return;

    // Use the server endpoint (service-role key) so the update bypasses RLS.
    supabase.auth.getSession().then(({ data: { session } }) => {
      const token = session?.access_token;
      if (!token) return;
      fetch(`${API_URL}/api/re-listens`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ spotify_id: id, rating, review: trimmedReview }),
      }).then(r => {
        if (!r.ok) r.json().then(e => console.error('[AlbumsContext] updateReListenReview server error:', e));
      }).catch(e => console.error('[AlbumsContext] updateReListenReview fetch error:', e));
    });
  }

  function updateDuration(id: string, durationMs: number) {
    setLoggedAlbums((prev) =>
      prev.map((a) => (a.id === id ? { ...a, durationMs } : a))
    );
    setWantToListen((prev) =>
      prev.map((a) => (a.id === id ? { ...a, durationMs } : a))
    );

    if (user) {
      supabase
        .from('user_albums')
        .update({ duration_ms: durationMs })
        .match({ user_id: user.id, spotify_id: id })
        .then(({ error }) => {
          if (error) console.warn('[AlbumsContext] updateDuration error:', error.message);
        });
    }
  }

  function addTopAlbum(album: TopAlbum) {
    setTopAlbums((prev) => {
      if (prev.some(a => a?.id === album.id)) return prev;
      const next = [...prev];
      const slot = next.findIndex(a => a === null);
      if (slot === -1) return prev;
      next[slot] = album;
      if (user) supabase.from('profiles').upsert({ id: user.id, top_albums: next }, { onConflict: 'id' }).then(({ error }) => { if (error) console.error('[AlbumsContext] addTopAlbum error:', error.message); });
      return next;
    });
  }

  function addTopAlbumAtSlot(index: number, album: TopAlbum) {
    setTopAlbums((prev) => {
      if (prev.some(a => a?.id === album.id)) return prev;
      const next = [...prev];
      next[index] = album;
      if (user) supabase.from('profiles').upsert({ id: user.id, top_albums: next }, { onConflict: 'id' }).then(({ error }) => { if (error) console.error('[AlbumsContext] addTopAlbumAtSlot error:', error.message); });
      return next;
    });
  }

  function removeTopAlbum(id: string) {
    setTopAlbums((prev) => {
      const next = prev.map(a => (a?.id === id ? null : a));
      if (user) supabase.from('profiles').upsert({ id: user.id, top_albums: next }, { onConflict: 'id' }).then(({ error }) => { if (error) console.error('[AlbumsContext] removeTopAlbum error:', error.message); });
      return next;
    });
  }

  function addTopSong(song: TopSong) {
    setTopSongs((prev) => {
      if (prev.some(s => s?.id === song.id)) return prev;
      const next = [...prev];
      const slot = next.findIndex(s => s === null);
      if (slot === -1) return prev;
      next[slot] = song;
      if (user) supabase.from('profiles').upsert({ id: user.id, top_songs: next }, { onConflict: 'id' }).then(({ error }) => { if (error) console.error('[AlbumsContext] addTopSong error:', error.message); });
      return next;
    });
  }

  function addTopSongAtSlot(index: number, song: TopSong) {
    setTopSongs((prev) => {
      if (prev.some(s => s?.id === song.id)) return prev;
      const next = [...prev];
      next[index] = song;
      if (user) supabase.from('profiles').upsert({ id: user.id, top_songs: next }, { onConflict: 'id' }).then(({ error }) => { if (error) console.error('[AlbumsContext] addTopSongAtSlot error:', error.message); });
      return next;
    });
  }

  function removeTopSong(id: string) {
    setTopSongs((prev) => {
      const next = prev.map(s => (s?.id === id ? null : s));
      if (user) supabase.from('profiles').upsert({ id: user.id, top_songs: next }, { onConflict: 'id' }).then(({ error }) => { if (error) console.error('[AlbumsContext] removeTopSong error:', error.message); });
      return next;
    });
  }

  function addTopArtist(artist: TopArtist) {
    setTopArtists((prev) => {
      if (prev.some(a => a?.id === artist.id)) return prev;
      const next = [...prev];
      const slot = next.findIndex(a => a === null);
      if (slot === -1) return prev;
      next[slot] = artist;
      if (user) supabase.from('profiles').upsert({ id: user.id, top_artists: next }, { onConflict: 'id' }).then(({ error }) => { if (error) console.error('[AlbumsContext] addTopArtist error:', error.message); });
      return next;
    });
  }

  function addTopArtistAtSlot(index: number, artist: TopArtist) {
    setTopArtists((prev) => {
      if (prev.some(a => a?.id === artist.id)) return prev;
      const next = [...prev];
      next[index] = artist;
      if (user) supabase.from('profiles').upsert({ id: user.id, top_artists: next }, { onConflict: 'id' }).then(({ error }) => { if (error) console.error('[AlbumsContext] addTopArtistAtSlot error:', error.message); });
      return next;
    });
  }

  function removeTopArtist(id: string) {
    setTopArtists((prev) => {
      const next = prev.map(a => (a?.id === id ? null : a));
      if (user) supabase.from('profiles').upsert({ id: user.id, top_artists: next }, { onConflict: 'id' }).then(({ error }) => { if (error) console.error('[AlbumsContext] removeTopArtist error:', error.message); });
      return next;
    });
  }

  function reorderTopAlbums(albums: (TopAlbum | null)[]) {
    const ordered = padTo5(albums);
    setTopAlbums(ordered);
    if (user) {
      supabase.from('profiles').upsert({ id: user.id, top_albums: ordered }, { onConflict: 'id' })
        .then(({ error }) => { if (error) console.error('[AlbumsContext] reorderTopAlbums error:', error.message); });
    }
  }

  function reorderTopSongs(songs: (TopSong | null)[]) {
    const ordered = padTo5(songs);
    setTopSongs(ordered);
    if (user) {
      supabase.from('profiles').upsert({ id: user.id, top_songs: ordered }, { onConflict: 'id' })
        .then(({ error }) => { if (error) console.error('[AlbumsContext] reorderTopSongs error:', error.message); });
    }
  }

  function reorderTopArtists(artists: (TopArtist | null)[]) {
    const ordered = padTo5(artists);
    setTopArtists(ordered);
    if (user) {
      supabase.from('profiles').upsert({ id: user.id, top_artists: ordered }, { onConflict: 'id' })
        .then(({ error }) => { if (error) console.error('[AlbumsContext] reorderTopArtists error:', error.message); });
    }
  }

  function addToWantToListen(album: WantToListenAlbum) {
    const dateAdded = new Date().toISOString();
    setWantToListen((prev) => {
      if (prev.find((a) => a.id === album.id)) return prev;
      return [{ ...album, dateAdded }, ...prev];
    });

    // Confirm the auth user is present before attempting any DB write.
    if (!user) {
      console.warn('[WantToListen] addToWantToListen called with no authenticated user — skipping insert');
      return;
    }

    const payload = {
      // id is omitted — Supabase generates it via gen_random_uuid()
      spotify_id:  album.id,
      user_id:     user.id,
      title:       album.title,
      artist:      album.artist,
      year:        album.year,
      artwork_url: album.artworkUrl || null,
      created_at:  dateAdded,
    };

    console.log('[WantToListen] inserting:', JSON.stringify(payload));

    supabase
      .from('want_to_listen')
      .insert(payload)
      .select()               // returns the inserted row — proves it landed in the DB
      .then(({ data, error }) => {
        if (error) {
          // Log every error including 23505 (duplicate) so nothing is swallowed silently.
          console.error('[WantToListen] insert error — code:', error.code, 'message:', error.message, 'details:', error.details, 'hint:', error.hint);
        } else {
          console.log('[WantToListen] insert result:', JSON.stringify(data));
        }
      });
  }

  function removeLoggedAlbum(id: string) {
    setLoggedAlbums((prev) => prev.filter((a) => a.id !== id));

    if (user) {
      supabase
        .from('user_albums')
        .delete()
        .match({ spotify_id: id, user_id: user.id })
        .then(({ error }) => {
          if (error) console.error('[AlbumsContext] removeLoggedAlbum error:', error.message);
        });
    }
  }

  async function removeReListenEntry(albumId: string, listenedAt: string) {
    if (!user) return;

    await supabase
      .from('re_listens')
      .delete()
      .eq('user_id', user.id)
      .eq('spotify_id', albumId)
      .eq('listened_at', listenedAt);

    // Fetch remaining re-listens to get new count and new latest rating/review
    const { data: remaining } = await supabase
      .from('re_listens')
      .select('rating, review')
      .eq('user_id', user.id)
      .eq('spotify_id', albumId)
      .order('listened_at', { ascending: false });

    const newCount = (remaining ?? []).length;
    const newLast  = remaining?.[0];

    await supabase
      .from('user_albums')
      .update({ re_listen_count: newCount, is_relistened: newCount > 0 })
      .eq('user_id', user.id)
      .eq('spotify_id', albumId);

    setLoggedAlbums(prev => prev.map(a => {
      if (a.id !== albumId) return a;
      return {
        ...a,
        reListenCount: newCount,
        isRelistened:  newCount > 0,
        lastRating:    newCount > 0 ? (newLast?.rating ?? undefined) : undefined,
        lastReview:    newCount > 0 ? (newLast?.review ?? undefined) : undefined,
      };
    }));
  }

  async function undoLastReListenEntry(albumId: string) {
    if (!user) return;

    // Fetch all re-listens newest-first so we know which to delete and what the new latest is
    const { data: all } = await supabase
      .from('re_listens')
      .select('rating, review, listened_at')
      .eq('user_id', user.id)
      .eq('spotify_id', albumId)
      .order('listened_at', { ascending: false });

    if (!all || all.length === 0) return;

    const latest = all[0];

    await supabase
      .from('re_listens')
      .delete()
      .eq('user_id', user.id)
      .eq('spotify_id', albumId)
      .eq('listened_at', latest.listened_at);

    const newCount = all.length - 1;
    const newLast  = all[1]; // second-most-recent becomes the new latest (undefined if none)

    await supabase
      .from('user_albums')
      .update({ re_listen_count: newCount, is_relistened: newCount > 0 })
      .eq('user_id', user.id)
      .eq('spotify_id', albumId);

    setLoggedAlbums(prev => prev.map(a => {
      if (a.id !== albumId) return a;
      return {
        ...a,
        reListenCount: newCount,
        isRelistened:  newCount > 0,
        lastRating:    newCount > 0 ? (newLast?.rating ?? undefined) : undefined,
        lastReview:    newCount > 0 ? (newLast?.review ?? undefined) : undefined,
      };
    }));
  }

  function removeFromWantToListen(id: string) {
    setWantToListen((prev) => prev.filter((a) => a.id !== id));

    if (user) {
      supabase
        .from('want_to_listen')
        .delete()
        .match({ spotify_id: id, user_id: user.id })
        .then(({ error }) => {
          if (error) console.error('[AlbumsContext] removeFromWantToListen error:', error.message);
        });
    }
  }

  function createPlaylist(name: string, description?: string): string {
    const id = uuidv4();
    const createdAt = new Date().toISOString();
    const newPlaylist: Playlist = {
      id,
      name: name.trim(),
      description: description?.trim() || undefined,
      albumIds: [],
      createdAt,
    };
    setPlaylists((prev) => [newPlaylist, ...prev]);

    if (user) {
      supabase
        .from('playlists')
        .insert({ id, user_id: user.id, name: newPlaylist.name, description: newPlaylist.description ?? null, created_at: createdAt })
        .then(({ error }) => { if (error) console.error('[AlbumsContext] createPlaylist error:', error.message); });
    }

    return id;
  }

  function deletePlaylist(id: string) {
    setPlaylists((prev) => prev.filter((p) => p.id !== id));

    if (user) {
      supabase
        .from('playlists')
        .delete()
        .eq('id', id)
        .then(({ error }) => { if (error) console.error('[AlbumsContext] deletePlaylist error:', error.message); });
    }
  }

  function addAlbumToPlaylist(playlistId: string, albumId: string) {
    setPlaylists((prev) =>
      prev.map((p) => {
        if (p.id !== playlistId || p.albumIds.includes(albumId)) return p;
        const updated = { ...p, albumIds: [...p.albumIds, albumId] };

        if (user) {
          supabase
            .from('playlist_albums')
            .upsert(
              { playlist_id: playlistId, spotify_id: albumId, position: updated.albumIds.length - 1 },
              { onConflict: 'playlist_id,spotify_id' }
            )
            .then(({ error }) => { if (error) console.error('[AlbumsContext] addAlbumToPlaylist error:', error.message); });
        }

        return updated;
      })
    );
  }

  function removeAlbumFromPlaylist(playlistId: string, albumId: string) {
    setPlaylists((prev) =>
      prev.map((p) =>
        p.id === playlistId
          ? { ...p, albumIds: p.albumIds.filter((id) => id !== albumId) }
          : p
      )
    );

    if (user) {
      supabase
        .from('playlist_albums')
        .delete()
        .match({ playlist_id: playlistId, spotify_id: albumId })
        .then(({ error }) => { if (error) console.error('[AlbumsContext] removeAlbumFromPlaylist error:', error.message); });
    }
  }

  return (
    <AlbumsContext.Provider value={{
      loggedAlbums, pendingAlbum, setPendingAlbum, logAlbum, reListenMode, setReListenMode, updateReview, updateReListenReview, updateDuration, removeLoggedAlbum, removeReListenEntry, undoLastReListenEntry,
      topAlbums, topSongs, topArtists,
      addTopAlbum, addTopAlbumAtSlot, removeTopAlbum, reorderTopAlbums,
      addTopSong, addTopSongAtSlot, removeTopSong, reorderTopSongs,
      addTopArtist, addTopArtistAtSlot, removeTopArtist, reorderTopArtists,
      wantToListen, addToWantToListen, removeFromWantToListen,
      playlists, createPlaylist, deletePlaylist, addAlbumToPlaylist, removeAlbumFromPlaylist,
      isLoaded,
    }}>
      {children}
    </AlbumsContext.Provider>
  );
}

export function useAlbums() {
  const ctx = useContext(AlbumsContext);
  if (!ctx) throw new Error('useAlbums must be used within AlbumsProvider');
  return ctx;
}
