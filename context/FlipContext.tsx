import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/context/AuthContext';
import { FLIP_POOL } from '@/constants/FlipPool';

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
  flip: () => void;
  markLogged: (id: string) => void;
  markDidntListen: (id: string) => void;
};

// ─── Constants ────────────────────────────────────────────────────────────────

// Storage key is user-scoped so switching accounts never shares flip history.
const flipKey = (uid: string) => `@listend:flipData_v1_${uid}`;

const COOLDOWN_MS  = 1 * 60 * 1000; // TEMP: 1 min for testing — change back to 12 * 60 * 60 * 1000 for production

// ─── Context ──────────────────────────────────────────────────────────────────

const FlipContext = createContext<FlipContextType | null>(null);

export function FlipProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

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
          // DEV: always start with fresh cooldown so testing isn't blocked
          // by a stale timestamp written when COOLDOWN_MS was 12 h.
          setCooldownUntil(__DEV__ ? null : (data.cooldownUntil ?? null));
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

  // IDs excluded from future flips: pending or logged (not didnt_listen — those return to pool)
  const excludedIds = new Set(
    history.filter(r => r.status === 'pending' || r.status === 'logged').map(r => r.id)
  );

  const poolExhausted = FLIP_POOL.filter(a => !excludedIds.has(a.id)).length === 0;

  // ── Actions ───────────────────────────────────────────────────────────────

  function flip() {
    const available = FLIP_POOL.filter(a => !excludedIds.has(a.id));
    if (available.length === 0) return;

    const album = available[Math.floor(Math.random() * available.length)];
    const record: FlippedRecord = {
      id:          album.id,
      title:       album.title,
      artist:      album.artist,
      year:        album.year,
      coverColor:  album.coverColor,
      genre:       album.genre,
      flippedAt:   Date.now(),
      status:      'pending',
    };

    setHistory(prev => [record, ...prev]);
    setCooldownUntil(Date.now() + COOLDOWN_MS);
  }

  function markLogged(id: string) {
    setHistory(prev =>
      prev.map(r => r.id === id && r.status === 'pending' ? { ...r, status: 'logged' } : r)
    );
  }

  function markDidntListen(id: string) {
    // Status update only — cooldown stays active until it naturally expires
    setHistory(prev =>
      prev.map(r => r.id === id && r.status === 'pending' ? { ...r, status: 'didnt_listen' } : r)
    );
    // Clear cooldown so the user can flip again immediately
    setCooldownUntil(null);
  }

  return (
    <FlipContext.Provider value={{
      history, cooldownUntil, currentFlip, poolExhausted, isLoaded,
      flip, markLogged, markDidntListen,
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
