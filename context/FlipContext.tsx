import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/context/AuthContext';
import { useAlbums } from '@/context/AlbumsContext';
import { usePro } from '@/context/ProContext';
import { FLIP_POOL } from '@/constants/FlipPool';
import { scheduleFlipCooldownNotification, cancelFlipCooldownNotification } from '@/lib/flipNotification';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FlipStatus = 'pending' | 'logged' | 'didnt_listen';

export type FlippedRecord = {
  id: string;
  title: string;
  artist: string;
  year: number;
  coverColor: string;
  genre?: string; // optional for backward-compat with stored records
  flippedAt: number; // Unix ms
  status: FlipStatus;
};

type FlipContextType = {
  history: FlippedRecord[];
  cooldownUntil: number | null; // Unix ms; null = no active cooldown
  currentFlip: FlippedRecord | null; // most recent pending record
  poolExhausted: boolean;
  isLoaded: boolean;
  libraryLoggedIds: Set<string>; // pool IDs already in the user's library
  flip: () => void;
  markLogged: (id: string) => void;
  markDidntListen: (id: string) => void;
};

// ─── Constants ────────────────────────────────────────────────────────────────

// Storage key is user-scoped so switching accounts never shares flip history.
const flipKey = (uid: string) => `@listend:flipData_v1_${uid}`;

const COOLDOWN_MS_FREE = 12 * 60 * 60 * 1000; // 12 hours for free users
const COOLDOWN_MS_PRO  =  1 * 60 * 60 * 1000; //  1 hour  for pro users

// ─── Context ──────────────────────────────────────────────────────────────────

const FlipContext = createContext<FlipContextType | null>(null);

export function FlipProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { loggedAlbums } = useAlbums();
  const { isPro } = usePro();

  const [history, setHistory]           = useState<FlippedRecord[]>([]);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [isLoaded, setIsLoaded]         = useState(false);

  // ── Reload whenever the signed-in user changes ────────────────────────────
  // Clears current state first so Account A's history never bleeds to Account B.
  useEffect(() => {
    setHistory([]);
    setCooldownUntil(null);
    setIsLoaded(false);

    if (!user) {
      setIsLoaded(true);
      return;
    }

    const uid = user.id;
    AsyncStorage.getItem(flipKey(uid))
      .then(raw => {
        if (raw) {
          const data = JSON.parse(raw);
          setHistory(data.history ?? []);
          // Pro users have no cooldown; ignore any stored timestamp.
          const stored: number | null = __DEV__ ? null : (data.cooldownUntil ?? null);
          setCooldownUntil(stored);
          // Cancel stale notification if cooldown has already passed
          if (!stored || stored < Date.now()) {
            cancelFlipCooldownNotification().catch(() => {});
          }
        }
      })
      .catch(() => {})
      .finally(() => setIsLoaded(true));
  }, [user?.id]);

  // ── Persist on change ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded || !user?.id) return;
    AsyncStorage.setItem(flipKey(user.id), JSON.stringify({ history, cooldownUntil })).catch(() => {});
  }, [history, cooldownUntil, isLoaded, user?.id]);

  // ── Derived values ────────────────────────────────────────────────────────

  // The most recent flip that is still unresolved
  const currentFlip = history.find(r => r.status === 'pending') ?? null;

  // IDs excluded from future flips: pending or logged via flip history
  const excludedByHistory = useMemo(() => new Set(
    history.filter(r => r.status === 'pending' || r.status === 'logged').map(r => r.id)
  ), [history]);

  // Pool IDs that match albums already in the user's Listend library (by title)
  const libraryLoggedIds = useMemo(() => {
    const loggedTitles = new Set(loggedAlbums.map(a => a.title.toLowerCase().trim()));
    const ids = new Set<string>();
    for (const a of FLIP_POOL) {
      if (loggedTitles.has(a.title.toLowerCase().trim())) ids.add(a.id);
    }
    return ids;
  }, [loggedAlbums]);

  const poolExhausted = FLIP_POOL.filter(
    a => !excludedByHistory.has(a.id) && !libraryLoggedIds.has(a.id)
  ).length === 0;

  // ── Actions ───────────────────────────────────────────────────────────────

  function flip() {
    const available = FLIP_POOL.filter(
      a => !excludedByHistory.has(a.id) && !libraryLoggedIds.has(a.id)
    );
    if (available.length === 0) return;

    const album = available[Math.floor(Math.random() * available.length)];
    const now = Date.now();
    const record: FlippedRecord = {
      id:          album.id,
      title:       album.title,
      artist:      album.artist,
      year:        album.year,
      coverColor:  album.coverColor,
      genre:       album.genre,
      flippedAt:   now,
      status:      'pending',
    };

    const cooldownUntilMs = now + (isPro ? COOLDOWN_MS_PRO : COOLDOWN_MS_FREE);
    setHistory(prev => [record, ...prev]);
    setCooldownUntil(cooldownUntilMs);
    if (!__DEV__) {
      scheduleFlipCooldownNotification(cooldownUntilMs).catch(() => {});
    }
  }

  function markLogged(id: string) {
    setHistory(prev =>
      prev.map(r => r.id === id && r.status === 'pending' ? { ...r, status: 'logged' } : r)
    );
  }

  function markDidntListen(id: string) {
    setHistory(prev =>
      prev.map(r => r.id === id && r.status === 'pending' ? { ...r, status: 'didnt_listen' } : r)
    );
  }

  return (
    <FlipContext.Provider value={{
      history, cooldownUntil, currentFlip, poolExhausted, isLoaded,
      libraryLoggedIds, flip, markLogged, markDidntListen,
    }}>
      {children}
    </FlipContext.Provider>
  );
}

export function useFlip() {
  const ctx = useContext(FlipContext);
  if (!ctx) throw new Error('useFlip must be used within FlipProvider');
  return ctx;
}
