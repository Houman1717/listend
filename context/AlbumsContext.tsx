import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
};

export type WantToListenAlbum = {
  id: string;
  title: string;
  artist: string;
  year: number;
  artworkUrl: string;
};

type AlbumsContextType = {
  loggedAlbums: LoggedAlbum[];
  pendingAlbum: PendingAlbum | null;
  setPendingAlbum: (album: PendingAlbum | null) => void;
  logAlbum: (rating: number, review: string) => void;
  updateReview: (id: string, rating: number, review: string) => void;
  topAlbums: TopAlbum[];
  topSongs: TopSong[];
  addTopAlbum: (album: TopAlbum) => void;
  removeTopAlbum: (id: string) => void;
  addTopSong: (song: TopSong) => void;
  removeTopSong: (id: string) => void;
  wantToListen: WantToListenAlbum[];
  addToWantToListen: (album: WantToListenAlbum) => void;
  removeFromWantToListen: (id: string) => void;
  isLoaded: boolean;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEYS = {
  LOGGED: '@listend:loggedAlbums_v1',
  TOP_ALBUMS: '@listend:topAlbums_v1',
  TOP_SONGS: '@listend:topSongs_v1',
  WANT_TO_LISTEN: '@listend:wantToListen_v1',
};

const COVER_COLORS = [
  '#2d5a27', '#7a4a2e', '#1e3a5f', '#d4a017',
  '#5c2d82', '#8b1a1a', '#1a5a5a', '#4a2d7a',
];

const INITIAL_ALBUMS: LoggedAlbum[] = [
  { id: '1', title: 'To Pimp a Butterfly', artist: 'Kendrick Lamar', year: 2015, rating: 5, dateLogged: 'Mar 24, 2026', coverColor: '#2d5a27' },
  { id: '2', title: 'Fetch the Bolt Cutters', artist: 'Fiona Apple', year: 2020, rating: 5, dateLogged: 'Mar 21, 2026', coverColor: '#7a4a2e' },
  { id: '3', title: 'In Rainbows', artist: 'Radiohead', year: 2007, rating: 4, dateLogged: 'Mar 18, 2026', coverColor: '#1e3a5f' },
  { id: '4', title: 'Blonde', artist: 'Frank Ocean', year: 2016, rating: 5, dateLogged: 'Mar 15, 2026', coverColor: '#d4a017' },
  { id: '5', title: 'Javelin', artist: 'Sufjan Stevens', year: 2023, rating: 4, dateLogged: 'Mar 10, 2026', coverColor: '#5c2d82' },
  { id: '6', title: 'Ctrl', artist: 'SZA', year: 2017, rating: 4, dateLogged: 'Mar 5, 2026', coverColor: '#8b1a1a' },
];

// ─── Context ──────────────────────────────────────────────────────────────────

const AlbumsContext = createContext<AlbumsContextType | null>(null);

export function AlbumsProvider({ children }: { children: ReactNode }) {
  const [loggedAlbums, setLoggedAlbums] = useState<LoggedAlbum[]>(INITIAL_ALBUMS);
  const [topAlbums, setTopAlbums] = useState<TopAlbum[]>([]);
  const [topSongs, setTopSongs] = useState<TopSong[]>([]);
  const [wantToListen, setWantToListen] = useState<WantToListenAlbum[]>([]);
  const [pendingAlbum, setPendingAlbum] = useState<PendingAlbum | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // ── Load persisted data on mount ──────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [albumsStr, topAlbumsStr, topSongsStr, wantStr] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.LOGGED),
          AsyncStorage.getItem(STORAGE_KEYS.TOP_ALBUMS),
          AsyncStorage.getItem(STORAGE_KEYS.TOP_SONGS),
          AsyncStorage.getItem(STORAGE_KEYS.WANT_TO_LISTEN),
        ]);
        if (albumsStr !== null) setLoggedAlbums(JSON.parse(albumsStr));
        if (topAlbumsStr !== null) setTopAlbums(JSON.parse(topAlbumsStr));
        if (topSongsStr !== null) setTopSongs(JSON.parse(topSongsStr));
        if (wantStr !== null) setWantToListen(JSON.parse(wantStr));
      } catch {
        // Fallback to initial state
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  // ── Persist on every change (after initial load) ──────────────────────────
  useEffect(() => {
    if (!isLoaded) return;
    AsyncStorage.setItem(STORAGE_KEYS.LOGGED, JSON.stringify(loggedAlbums)).catch(() => {});
  }, [loggedAlbums, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    AsyncStorage.setItem(STORAGE_KEYS.TOP_ALBUMS, JSON.stringify(topAlbums)).catch(() => {});
  }, [topAlbums, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    AsyncStorage.setItem(STORAGE_KEYS.TOP_SONGS, JSON.stringify(topSongs)).catch(() => {});
  }, [topSongs, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    AsyncStorage.setItem(STORAGE_KEYS.WANT_TO_LISTEN, JSON.stringify(wantToListen)).catch(() => {});
  }, [wantToListen, isLoaded]);

  // ── Actions ───────────────────────────────────────────────────────────────

  function logAlbum(rating: number, review: string) {
    if (!pendingAlbum) return;

    const today = new Date();
    const dateLogged = today.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
    const colorIndex = loggedAlbums.length % COVER_COLORS.length;

    const newAlbum: LoggedAlbum = {
      id: pendingAlbum.spotifyId,
      title: pendingAlbum.title,
      artist: pendingAlbum.artist,
      year: pendingAlbum.year,
      rating,
      review: review.trim() || undefined,
      dateLogged,
      artworkUrl: pendingAlbum.artworkUrl || undefined,
      coverColor: COVER_COLORS[colorIndex],
    };

    setLoggedAlbums((prev) => [newAlbum, ...prev]);
    setPendingAlbum(null);
  }

  function updateReview(id: string, rating: number, review: string) {
    setLoggedAlbums((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, rating, review: review.trim() || undefined } : a
      )
    );
  }

  function addTopAlbum(album: TopAlbum) {
    setTopAlbums((prev) => {
      if (prev.find((a) => a.id === album.id)) return prev;
      return [...prev, album].slice(0, 5);
    });
  }

  function removeTopAlbum(id: string) {
    setTopAlbums((prev) => prev.filter((a) => a.id !== id));
  }

  function addTopSong(song: TopSong) {
    setTopSongs((prev) => {
      if (prev.find((s) => s.id === song.id)) return prev;
      return [...prev, song].slice(0, 5);
    });
  }

  function removeTopSong(id: string) {
    setTopSongs((prev) => prev.filter((s) => s.id !== id));
  }

  function addToWantToListen(album: WantToListenAlbum) {
    setWantToListen((prev) => {
      if (prev.find((a) => a.id === album.id)) return prev;
      return [album, ...prev];
    });
  }

  function removeFromWantToListen(id: string) {
    setWantToListen((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <AlbumsContext.Provider value={{
      loggedAlbums, pendingAlbum, setPendingAlbum, logAlbum, updateReview,
      topAlbums, topSongs, addTopAlbum, removeTopAlbum, addTopSong, removeTopSong,
      wantToListen, addToWantToListen, removeFromWantToListen,
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
