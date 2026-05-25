import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import type { ProThemeKey } from '@/lib/proThemes';

interface ProContextValue {
  isPro: boolean;
  proTheme: ProThemeKey;
  setProTheme: (theme: ProThemeKey) => Promise<void>;
  paywallVisible: boolean;
  showPaywall: () => void;
  hidePaywall: () => void;
  refreshPro: () => void;
}

const ProContext = createContext<ProContextValue>({
  isPro: false,
  proTheme: 'default',
  setProTheme: async () => {},
  paywallVisible: false,
  showPaywall: () => {},
  hidePaywall: () => {},
  refreshPro: () => {},
});

export function ProProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [isPro,           setIsPro]           = useState(false);
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
      });
  }, [user?.id]);

  useEffect(() => {
    if (user && loadedFor.current !== user.id) loadPro();
  }, [user?.id, loadPro]);

  async function setProTheme(theme: ProThemeKey) {
    if (!user) return;
    setProThemeState(theme);
    await supabase.from('profiles').update({ pro_theme: theme }).eq('id', user.id);
  }

  return (
    <ProContext.Provider value={{
      isPro,
      proTheme,
      setProTheme,
      paywallVisible,
      showPaywall:  () => setPaywallVisible(true),
      hidePaywall:  () => setPaywallVisible(false),
      refreshPro:   loadPro,
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
