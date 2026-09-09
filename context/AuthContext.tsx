import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

// Force-clears the local Supabase auth session no matter what state it's in.
// supabase.auth.signOut() (default scope 'global') makes a network call to
// revoke the token — if the refresh token is already invalid ("Already Used" /
// revoked), that call fails and older behaviour left the dead session sitting
// in storage, so the user was stuck: every read 401s and Sign Out does nothing.
// This always ends with no session on disk and no session in React state.
async function hardClearSession(setSession: (s: Session | null) => void) {
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch (e) {
    console.warn('[Auth] signOut(local) failed, clearing storage directly:', (e as Error)?.message);
  }
  try {
    const keys = await AsyncStorage.getAllKeys();
    const authKeys = keys.filter(k => k.startsWith('sb-') || k.includes('supabase.auth') || k.includes('-auth-token'));
    if (authKeys.length) await AsyncStorage.multiRemove(authKeys);
  } catch {}
  setSession(null);
}

// Distinguishes "the server rejected this token" from "we couldn't reach the
// server". Only the former may log anyone out — a flaky connection must not.
function isTokenRejection(err: { status?: number; message?: string } | null): boolean {
  if (!err) return false;
  const status = (err as any).status;
  return status === 401 || status === 403 ||
    /jwt|token|session|expired|invalid|missing/i.test(err.message ?? '');
}

// Returns true when this call filled in a genuinely-missing username, so the
// caller can route the account to onboarding.
//
// SAFETY — this is the code that clobbered real profiles. Rules:
//   • NEVER overwrite an existing row's display_name / avatar_url / bio.
//   • On a plain app reopen (INITIAL_SESSION), only heal a username that is
//     demonstrably NULL on a row we could actually read. A null/empty read is
//     treated as "transient failure", not "no profile" — so we do nothing.
//   • Only create a brand-new profile row on a fresh SIGNED_IN.
async function ensureProfile(user: User, isFreshLogin: boolean): Promise<boolean> {
  const { data: existing, error: lookupErr } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('id', user.id)
    .maybeSingle();

  if (lookupErr) {
    console.warn('[ensureProfile] profile lookup failed, skipping:', lookupErr.message);
    return false;
  }

  // Row exists and already has a username — the overwhelmingly common path.
  if (existing?.username) return false;

  const meta = user.user_metadata ?? {};
  const emailPrefix = (user.email ?? '').split('@')[0].replace(/[^a-z0-9_]/gi, '_').toLowerCase();
  const suffix = user.id.replace(/-/g, '').slice(-12);
  const fallbackUsername = emailPrefix ? `${emailPrefix}_${suffix}` : `user_${suffix}`;
  const username: string = meta.username ?? fallbackUsername;

  if (existing) {
    // Row exists, username is null — patch ONLY the username column.
    const { error: patchErr } = await supabase
      .from('profiles').update({ username }).eq('id', user.id).is('username', null);
    if (patchErr) { console.error('[ensureProfile] username patch error:', patchErr.message); return false; }
    return true;
  }

  // No readable row. On a reopen this is almost certainly a transient read
  // failure, not a missing profile — do nothing. Only actually create on a
  // fresh sign-in.
  if (!isFreshLogin) {
    console.warn('[ensureProfile] no profile row on reopen — treating as transient, not creating');
    return false;
  }

  const displayName: string = meta.display_name ?? meta.full_name ?? meta.name ?? username;
  const { error: insertErr } = await supabase.from('profiles').insert({
    id:           user.id,
    username,
    display_name: displayName,
    avatar_url:   meta.avatar_url ?? meta.picture ?? null,
  });
  if (insertErr) {
    // 23505 = a row already exists (DB trigger pre-created it). Heal only a
    // still-null username; never touch the rest.
    if (insertErr.code === '23505') {
      const { data: row } = await supabase
        .from('profiles').select('username').eq('id', user.id).maybeSingle();
      if (row && !row.username) {
        const { error: patchErr } = await supabase
          .from('profiles').update({ username }).eq('id', user.id).is('username', null);
        return !patchErr;
      }
      return false;
    }
    console.error('[ensureProfile] insert error:', insertErr.message);
    return false;
  }
  return true;
}

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  needsOnboarding: boolean;
  clearNeedsOnboarding: () => void;
  signOut: () => Promise<void>;
  // A password-reset link is being handled. The session that a recovery link
  // mints looks exactly like a normal one, so without this flag AuthGate would
  // whisk the user into the app before they ever set a new password.
  recoveryMode: boolean;
  // True while the one-time code from the link is still being swapped for a
  // session. Expo Router routes to /reset-password the instant the deep link
  // lands, which is before the swap finishes — without this the screen would
  // flash its "link didn't work" state on every successful reset.
  recoveryPending: boolean;
  recoveryError: string | null;
  startRecovery: () => void;
  resolveRecovery: (error?: string | null) => void;
  endRecovery: () => void;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  needsOnboarding: false,
  clearNeedsOnboarding: () => {},
  signOut: async () => {},
  recoveryMode: false,
  recoveryPending: false,
  recoveryError: null,
  startRecovery: () => {},
  resolveRecovery: () => {},
  endRecovery: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [recoveryMode, setRecoveryMode]       = useState(false);
  const [recoveryPending, setRecoveryPending] = useState(false);
  const [recoveryError, setRecoveryError]     = useState<string | null>(null);

  useEffect(() => {
    let done = false;
    (async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          await hardClearSession(setSession);
        } else if (session) {
          // getSession() reads from storage and does NOT prove the session is
          // still valid server-side. Validate with getUser() (a real API call);
          // if the token is *rejected*, wipe it so the user lands on login
          // instead of a logged-in-looking shell where every read 401s. A plain
          // network failure must NOT log the user out — keep the session and let
          // autoRefreshToken sort it out when connectivity returns.
          const { error: userErr } = await supabase.auth.getUser();
          if (isTokenRejection(userErr)) {
            console.warn('[Auth] stored session rejected by server — clearing:', userErr!.message);
            await hardClearSession(setSession);
          } else if (!done) {
            setSession(session);
          }
        } else if (!done) {
          setSession(null);
        }
      } catch (e) {
        // Likely a network error — don't log the user out over it. The
        // onAuthStateChange INITIAL_SESSION event will still set a valid stored
        // session; a truly dead token surfaces later as a failed refresh.
        console.warn('[Auth] session bootstrap error (keeping session):', (e as Error)?.message);
      } finally {
        if (!done) setLoading(false);
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Refresh failed (revoked / "Already Used" refresh token) — get the user
      // fully out rather than looping on a dead token.
      if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
        // Don't take this at face value. A refresh of a STALE token left in
        // storage by an earlier session fails on its own schedule — often about
        // half a second after launch, which is exactly when someone is finishing
        // a fresh sign-in. supabase-js reports that failure as a sign-out, and
        // clearing here dragged the brand-new session down with it: the first
        // sign-in after opening the app bounced straight back to /login, while
        // the second worked, because the first failure had already flushed the
        // dead token.
        //
        // So ask the server who we are. A live session means this event was
        // about a token we no longer care about — ignore it. Only a genuine
        // rejection clears; a network error leaves the session alone.
        (async () => {
          try {
            const { error: userErr } = await supabase.auth.getUser();
            if (!isTokenRejection(userErr)) return;
          } catch (e) {
            // Couldn't ask. Staying signed in is the safe direction — a truly
            // dead token surfaces again on the next refresh.
            console.warn('[Auth] sign-out check failed, keeping session:', (e as Error)?.message);
            return;
          }
          setRecoveryMode(false);
          setRecoveryPending(false);
          setRecoveryError(null);
          hardClearSession(setSession);
        })();
      } else {
        // Emitted when a recovery link is consumed. The deep-link handler
        // usually sets this first; this covers the flows where it doesn't.
        if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
        // Never let an event that carries no session tear down one we already
        // hold — only SIGNED_OUT and a failed refresh (handled above) should log
        // anyone out. supabase-js can emit a null-session INITIAL_SESSION just
        // after a fast sign-in, which used to drop the user back on the login
        // screen half a second after they got in.
        setSession((prev) => session ?? prev);
        // OAuth (Google/Apple) sign-ups don't create a profiles row the way the
        // email signup screen does — make sure one exists on every fresh sign-in.
        // Also runs on INITIAL_SESSION (a normal app reopen with an already-logged-in
        // session, not just a fresh SIGNED_IN) so an account still missing a
        // username gets self-healed and redirected to edit-profile without the
        // user needing to sign out and back in.
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
          ensureProfile(session.user, event === 'SIGNED_IN')
            .then((isNew) => { if (isNew) setNeedsOnboarding(true); })
            .catch((e) => console.warn('[Auth] ensureProfile error:', e));
        }
      }
    });

    return () => { done = true; subscription.unsubscribe(); };
  }, []);

  async function signOut() {
    await hardClearSession(setSession);
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        needsOnboarding,
        clearNeedsOnboarding: () => setNeedsOnboarding(false),
        signOut,
        recoveryMode,
        recoveryPending,
        recoveryError,
        startRecovery: () => {
          setRecoveryError(null);
          setRecoveryPending(true);
          setRecoveryMode(true);
        },
        resolveRecovery: (error = null) => {
          setRecoveryError(error);
          setRecoveryPending(false);
        },
        endRecovery: () => {
          setRecoveryMode(false);
          setRecoveryPending(false);
          setRecoveryError(null);
        },
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
