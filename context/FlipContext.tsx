import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/context/AuthContext';
import { useAlbums } from '@/context/AlbumsContext';
import { usePro } from '@/context/ProContext';
import { supabase } from '@/lib/supabase';
import { FLIP_POOL } from '@/constants/FlipPool';
import { scheduleFlipCooldownNotification, cancelFlipCooldownNotification } from '@/lib/flipNotification';
import { capture } from '@/lib/analytics';
import { communityStatsKey } from '@/lib/communityStats';

const FLIP_POOL_BY_ID = new Map(FLIP_POOL.map(a => [a.id, a]));

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

// Legacy AsyncStorage key — history used to live only here. Kept around solely
// to migrate any pre-existing local history into Supabase on first load.
const flipKey = (uid: string) => `@listend:flipData_v1_${uid}`;

// Apple Music search often returns an edition/remaster suffix in parens or
// brackets ("Led Zeppelin (Remastered)") that the pool's plain title doesn't
// have — strip a trailing one before matching so those still count as logged.
function stripEdition(title: string): string {
  return title.replace(/\s*[([][^()[\]]*[)\]]\s*$/, '').trim();
}

function rowToRecord(row: any): FlippedRecord {
  const pool = FLIP_POOL_BY_ID.get(row.pool_id);
  return {
    id:         row.pool_id,
    title:      row.album_title,
    artist:     row.album_artist,
    year:       row.album_year,
    coverColor: pool?.coverColor ?? '#6B4C35',
    genre:      pool?.genre,
    flippedAt:  new Date(row.flipped_at).getTime(),
    status:     row.status,
  };
}

const COOLDOWN_MS_FREE = 12 * 60 * 60 * 1000; // 12 hours for free users
const COOLDOWN_MS_PRO  =  1 * 60 * 60 * 1000; //  1 hour  for pro users

// ─── Context ──────────────────────────────────────────────────────────────────

const FlipContext = createContext<FlipContextType | null>(null);

export function FlipProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { loggedAlbums } = useAlbums();
  const { isPro } = usePro();

  const [history, setHistory]           = useState<FlippedRecord[]>([]);
  const [isLoaded, setIsLoaded]         = useState(false);

  // ── Reload whenever the signed-in user changes ────────────────────────────
  // Clears current state first so Account A's history never bleeds to Account B.
  // Source of truth is Supabase (flip_records) so history survives logout,
  // reinstalls, and new devices. A local-only legacy history is migrated up
  // once, the first time this account is ever loaded post-migration.
  useEffect(() => {
    setHistory([]);
    setIsLoaded(false);

    if (!user) {
      setIsLoaded(true);
      return;
    }

    const uid = user.id;

    (async () => {
      const { data, error } = await supabase
        .from('flip_records')
        .select('pool_id, album_title, album_artist, album_year, status, flipped_at, cooldown_until')
        .eq('user_id', uid)
        .not('pool_id', 'is', null)
        .order('flipped_at', { ascending: false });

      if (!error && data && data.length > 0) {
        setHistory(data.map(rowToRecord));
        setIsLoaded(true);
        return;
      }

      // No Supabase history yet — check for a pre-migration local-only history
      // and upload it once so it isn't lost for existing users.
      try {
        const raw = await AsyncStorage.getItem(flipKey(uid));
        if (raw) {
          const legacy = JSON.parse(raw);
          const legacyHistory: FlippedRecord[] = legacy.history ?? [];
          if (legacyHistory.length > 0) {
            await supabase.from('flip_records').insert(legacyHistory.map(r => ({
              user_id:      uid,
              pool_id:      r.id,
              album_title:  r.title,
              album_artist: r.artist,
              album_year:   r.year,
              status:       r.status,
              flipped_at:   new Date(r.flippedAt).toISOString(),
            })));
            setHistory(legacyHistory);
          }
        }
      } catch (e) {
        console.error('[Flip] legacy migration error:', e);
      }
      setIsLoaded(true);
    })();
  }, [user?.id]);

  // ── Derived values ────────────────────────────────────────────────────────

  // The most recent flip that is still unresolved
  const currentFlip = history.find(r => r.status === 'pending') ?? null;

  // The cooldown is DERIVED from the last flip every render — never read back
  // from the stored `cooldown_until` column. Freezing it at flip time meant a
  // Pro user who tapped before ProContext had finished reading
  // `profiles.is_pro` (cold start, or a query that simply failed) was locked
  // into the free 12h window for that flip, permanently. Deriving it also
  // means a cooldown that started while free shortens to 1h the moment a
  // subscription lands, instead of holding the user for another 11 hours.
  const lastFlipAt = useMemo(
    () => history.reduce((max, r) => Math.max(max, r.flippedAt), 0),
    [history]
  );

  // Pro state resolves asynchronously, so assume free until it does: a Pro
  // user briefly sees the longer countdown before it corrects itself, which is
  // the harmless direction to be wrong in.
  const cooldownUntil = useMemo(() => {
    if (__DEV__ || !lastFlipAt) return null;
    return lastFlipAt + (isPro ? COOLDOWN_MS_PRO : COOLDOWN_MS_FREE);
  }, [lastFlipAt, isPro]);

  // Keep the scheduled "time to flip" reminder in step with that derived
  // value — scheduling once at flip time would leave a Pro user with a
  // notification 11 hours late whenever Pro resolved after the tap.
  useEffect(() => {
    if (!isLoaded) return;
    if (cooldownUntil && cooldownUntil > Date.now()) {
      scheduleFlipCooldownNotification(cooldownUntil).catch(() => {});
    } else {
      cancelFlipCooldownNotification().catch(() => {});
    }
  }, [cooldownUntil, isLoaded]);

  // IDs excluded from future flips: pending or logged via flip history
  const excludedByHistory = useMemo(() => new Set(
    history.filter(r => r.status === 'pending' || r.status === 'logged').map(r => r.id)
  ), [history]);

  // Pool IDs that match albums already in the user's Listend library — matched
  // by title+artist (not title alone), otherwise unrelated albums that just
  // share a pool title (e.g. Pop Smoke's "Faith" vs George Michael's "Faith")
  // get falsely treated as already logged.
  const libraryLoggedIds = useMemo(() => {
    const loggedKeys = new Set(loggedAlbums.map(a => communityStatsKey(stripEdition(a.title), a.artist)));
    const ids = new Set<string>();
    for (const a of FLIP_POOL) {
      if (loggedKeys.has(communityStatsKey(stripEdition(a.title), a.artist))) ids.add(a.id);
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
    capture('flip', { genre: album.genre, year: album.year });
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

    // Recorded on the row for history/debugging only — the app never reads it
    // back, it derives the live cooldown from `flipped_at` instead.
    const cooldownUntilMs = now + (isPro ? COOLDOWN_MS_PRO : COOLDOWN_MS_FREE);
    setHistory(prev => [record, ...prev]);

    if (user) {
      supabase.from('flip_records').insert({
        user_id:       user.id,
        pool_id:       album.id,
        album_title:   album.title,
        album_artist:  album.artist,
        album_year:    album.year,
        status:        'pending',
        flipped_at:    new Date(now).toISOString(),
        cooldown_until: new Date(cooldownUntilMs).toISOString(),
      }).then(({ error }) => {
        if (error) {
          console.error('[Flip] insert error:', error.message);
          setHistory(prev => prev.filter(r => r.flippedAt !== now));
        }
      });
    }
  }

  function markLogged(id: string) {
    setHistory(prev =>
      prev.map(r => r.id === id && r.status === 'pending' ? { ...r, status: 'logged' } : r)
    );
    if (!user) return;
    supabase.from('flip_records')
      .update({ status: 'logged' })
      .eq('user_id', user.id)
      .eq('pool_id', id)
      .eq('status', 'pending')
      .then(({ error }) => { if (error) console.error('[Flip] markLogged error:', error.message); });
  }

  function markDidntListen(id: string) {
    setHistory(prev =>
      prev.map(r => r.id === id && r.status === 'pending' ? { ...r, status: 'didnt_listen' } : r)
    );
    if (!user) return;
    supabase.from('flip_records')
      .update({ status: 'didnt_listen' })
      .eq('user_id', user.id)
      .eq('pool_id', id)
      .eq('status', 'pending')
      .then(({ error }) => { if (error) console.error('[Flip] markDidntListen error:', error.message); });
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
