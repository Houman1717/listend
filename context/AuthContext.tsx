import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// Returns true when this call filled in a missing username — either because
// the profile row didn't exist yet, or because it existed with no username
// (e.g. a DB trigger pre-created a bare row on signup before this ran). The
// caller uses this to route accounts still missing a username to onboarding
// instead of the home tabs.
async function ensureProfile(user: User): Promise<boolean> {
  const { data: existing } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .eq('id', user.id)
    .maybeSingle();
  if (existing?.username) return false;

  const meta = user.user_metadata ?? {};

  const emailPrefix = (user.email ?? '').split('@')[0].replace(/[^a-z0-9_]/gi, '_').toLowerCase();
  const suffix = user.id.replace(/-/g, '').slice(-12);
  const fallbackUsername = emailPrefix ? `${emailPrefix}_${suffix}` : `user_${suffix}`;

  // Prefer the username the user chose at email signup (stashed in metadata);
  // fall back to a generated handle for OAuth (Google/Apple) sign-ups.
  const username: string = meta.username ?? fallbackUsername;

  const displayName: string =
    existing?.display_name ?? meta.display_name ?? meta.full_name ?? meta.name ?? username;

  // Only fill in the missing username (and other fields if this is a brand
  // new row) — don't clobber anything a bare pre-existing row already had.
  await supabase.from('profiles').upsert(
    {
      id:           user.id,
      username,
      display_name: displayName,
      avatar_url:   existing?.avatar_url ?? meta.avatar_url ?? meta.picture ?? null,
    },
    { onConflict: 'id' }
  );
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
        if (event === 'SIGNED_IN' && session?.user) {
          ensureProfile(session.user)
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
