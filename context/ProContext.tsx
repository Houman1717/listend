import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import type { ProThemeKey } from '@/lib/proThemes';
import { capture } from '@/lib/analytics';

interface ProContextValue {
  isPro: boolean;
  /** False until the profile row has been read. Upsell UI must wait on this,
   *  otherwise a paying user is treated as free for the length of the query. */
  proLoaded: boolean;
  proTheme: ProThemeKey;
  setProTheme: (theme: ProThemeKey) => Promise<void>;
  paywallVisible: boolean;
  showPaywall: () => void;
  hidePaywall: () => void;
  refreshPro: () => void;
  markProActive: () => void;
}

const ProContext = createContext<ProContextValue>({
  isPro: false,
  proLoaded: false,
  proTheme: 'default',
  setProTheme: async () => {},
  paywallVisible: false,
  showPaywall: () => {},
  hidePaywall: () => {},
  refreshPro: () => {},
  markProActive: () => {},
});

export function ProProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [isPro,           setIsPro]           = useState(false);
  const [proLoaded,       setProLoaded]       = useState(false);
  const [proTheme,        setProThemeState]   = useState<ProThemeKey>('default');
  const [paywallVisible,  setPaywallVisible]  = useState(false);
  const loadedFor = useRef<string | null>(null);

  const loadPro = useCallback(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('is_pro, pro_theme')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setIsPro(data.is_pro ?? false);
          setProThemeState((data.pro_theme as ProThemeKey) ?? 'default');
          loadedFor.current = user.id;
        }
        // Mark loaded even when the row is missing or the query failed, so a
        // free user isn't left staring at permanently suppressed upsells.
        setProLoaded(true);
      });
  }, [user?.id]);

  useEffect(() => {
    // Auth restores the stored session asynchronously, so `user` is null for a
    // moment on every cold start. Treating that as "signed out" marked Pro as
    // loaded-and-false and flashed the upsells at paying users.
    if (authLoading) return;
    // Genuinely signed out — nothing to wait for.
    if (!user) { setProLoaded(true); return; }
    if (loadedFor.current !== user.id) loadPro();
  }, [user?.id, authLoading, loadPro]);

  async function setProTheme(theme: ProThemeKey) {
    if (!user) return;
    setProThemeState(theme);
    await supabase.from('profiles').update({ pro_theme: theme }).eq('id', user.id);
  }

  return (
    <ProContext.Provider value={{
      isPro,
      proLoaded,
      proTheme,
      setProTheme,
      paywallVisible,
      showPaywall:  () => { capture('paywall_shown'); setPaywallVisible(true); },
      hidePaywall:  () => setPaywallVisible(false),
      refreshPro:   loadPro,
      // RevenueCat's own purchase/restore result is already ground truth —
      // set it immediately instead of racing the fire-and-forget Supabase
      // mirror write that syncCustomerInfo kicks off in RevenueCatContext.
      markProActive: () => { loadedFor.current = user?.id ?? null; setIsPro(true); setProLoaded(true); },
    }}>
      {children}
    </ProContext.Provider>
  );
}

export function usePro() {
  return useContext(ProContext);
}

export function useProGate(): () => boolean {
  const { isPro, showPaywall } = usePro();
  return () => {
    if (!isPro) { showPaywall(); return false; }
    return true;
  };
}
