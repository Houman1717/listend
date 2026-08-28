import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

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
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  needsOnboarding: false,
  clearNeedsOnboarding: () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        // Stale or revoked refresh token — clear it and force re-login
        supabase.auth.signOut();
        setSession(null);
      } else {
        setSession(session);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setSession(null);
      } else {
        setSession(session);
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

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
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
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
