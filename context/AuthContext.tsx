import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

async function ensureProfile(user: User) {
  const meta = user.user_metadata ?? {};

  const emailPrefix = (user.email ?? '').split('@')[0].replace(/[^a-z0-9_]/gi, '_').toLowerCase();
  const suffix = user.id.replace(/-/g, '').slice(-12);
  const fallbackUsername = emailPrefix ? `${emailPrefix}_${suffix}` : `user_${suffix}`;

  // Prefer the username the user chose at email signup (stashed in metadata);
  // fall back to a generated handle for OAuth (Google/Apple) sign-ups.
  const username: string = meta.username ?? fallbackUsername;

  const displayName: string =
    meta.display_name ?? meta.full_name ?? meta.name ?? username;

  await supabase.from('profiles').upsert(
    {
      id:           user.id,
      username,
      display_name: displayName,
      avatar_url:   meta.avatar_url ?? meta.picture ?? null,
    },
    { onConflict: 'id', ignoreDuplicates: true }
  );
}

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

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
          ensureProfile(session.user).catch((e) =>
            console.warn('[Auth] ensureProfile error:', e)
          );
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
