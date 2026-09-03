import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import Purchases, { CustomerInfo, LOG_LEVEL, Offerings, PurchasesPackage } from 'react-native-purchases';
import { useAuth } from './AuthContext';
import { supabase } from '@/lib/supabase';

// Each store has its own public SDK key and the SDK rejects the other one, so
// an iOS `appl_` key on Android means offerings never load — which the paywall
// renders as its "Coming Soon" empty state. Both env vars are referenced
// statically so Expo can inline them at build time.
const REVENUECAT_KEY = Platform.select({
  ios:     process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
}) ?? '';
const REVENUECAT_KEY_VAR = Platform.OS === 'android'
  ? 'EXPO_PUBLIC_REVENUECAT_ANDROID_KEY'
  : 'EXPO_PUBLIC_REVENUECAT_IOS_KEY';
const PRO_ENTITLEMENT_ID = 'pro';

interface RevenueCatContextValue {
  isPro: boolean;
  offerings: Offerings | null;
  purchasePackage: (pkg: PurchasesPackage) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  isLoading: boolean;
  offeringsError: string | null;
}

const RevenueCatContext = createContext<RevenueCatContextValue>({
  isPro: false,
  offerings: null,
  purchasePackage: async () => false,
  restorePurchases: async () => false,
  isLoading: true,
  offeringsError: null,
});

export function RevenueCatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [isPro,      setIsPro]      = useState(false);
  const [offerings,  setOfferings]  = useState<Offerings | null>(null);
  const [isLoading,  setIsLoading]  = useState(true);
  const [offeringsError, setOfferingsError] = useState<string | null>(null);
  const [configured, setConfigured] = useState(false);

  // Initialise SDK once on mount
  useEffect(() => {
    if (!REVENUECAT_KEY) {
      console.warn(`[RevenueCat] ${REVENUECAT_KEY_VAR} is not set`);
      setOfferingsError(`${REVENUECAT_KEY_VAR} is not set in this build`);
      setIsLoading(false);
      return;
    }

    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }

    Purchases.configure({ apiKey: REVENUECAT_KEY });
    setConfigured(true);
  }, []);

  // Tracks the last confirmed Pro state so we can tell a real downgrade apart
  // from a stale/incomplete CustomerInfo snapshot (RevenueCat's listener often
  // fires with cached data right as the app resumes from background, before
  // it's re-validated with Apple — trusting that blindly would wrongly wipe
  // out a real subscriber's Pro status).
  const lastKnownProRef = useRef(false);

  // Tracks whether we've called Purchases.logIn() this session, so the
  // log-out effect doesn't fire on an already-anonymous user.
  const loggedInRef = useRef(false);

  // Sync entitlements whenever customer info changes — also writes to Supabase
  // so ProContext (which reads profiles.is_pro) stays in sync.
  const syncCustomerInfo = useCallback(async (info: CustomerInfo) => {
    const active = info.entitlements.active;
    let proActive = PRO_ENTITLEMENT_ID in active;

    // Never trust a "just went inactive" signal at face value — force a fresh,
    // server-verified re-check first. If that also fails, keep the previous
    // state rather than risk a false downgrade.
    if (!proActive && lastKnownProRef.current) {
      try {
        await Purchases.invalidateCustomerInfoCache();
        const fresh = await Purchases.getCustomerInfo();
        proActive = PRO_ENTITLEMENT_ID in fresh.entitlements.active;
      } catch (e) {
        console.warn('[RevenueCat] confirmatory re-check failed, keeping previous Pro state:', e);
        return;
      }
    }

    lastKnownProRef.current = proActive;
    setIsPro(proActive);

    // Mirror to Supabase so the rest of the app (ProContext, other-user views) reflects reality
    if (user?.id) {
      supabase
        .from('profiles')
        .update({ is_pro: proActive })
        .eq('id', user.id)
        .then(({ error }) => {
          if (error) console.warn('[RevenueCat] Supabase is_pro sync error:', error.message);
        });
    }
  }, [user?.id]);

  // Fetch offerings once the SDK is configured
  useEffect(() => {
    if (!configured) return;

    Purchases.getOfferings()
      .then((fetched) => {
        setOfferings(fetched);
        if (!fetched.current) {
          console.warn('[RevenueCat] getOfferings succeeded but there is no "current" offering — set one in the RevenueCat dashboard');
          setOfferingsError('No offering is marked Current in RevenueCat');
        } else if (fetched.current.availablePackages.length === 0) {
          // Packages exist but hold no product for THIS store — the usual cause
          // is an offering whose packages were only ever given the other
          // platform's product.
          console.warn(`[RevenueCat] offering "${fetched.current.identifier}" returned 0 packages for ${Platform.OS} — check its packages contain a ${Platform.OS === 'android' ? 'Play Store' : 'App Store'} product`);
          setOfferingsError(`Offering "${fetched.current.identifier}" has no ${Platform.OS === 'android' ? 'Play Store' : 'App Store'} products`);
        } else {
          setOfferingsError(null);
        }
      })
      .catch((e) => {
        console.warn('[RevenueCat] getOfferings error:', e);
        setOfferingsError(`${Platform.OS}: ${e?.message ?? 'failed to load offerings'}`);
      })
      .finally(() => setIsLoading(false));
  }, [configured]);

  // Listen for real-time entitlement changes (e.g. subscription expires mid-session)
  useEffect(() => {
    if (!REVENUECAT_KEY) return;
    const listener = Purchases.addCustomerInfoUpdateListener(syncCustomerInfo);
    return () => listener?.remove();
  }, [syncCustomerInfo]);

  // Log in / log out with Supabase user ID
  useEffect(() => {
    if (!REVENUECAT_KEY) return;

    if (user?.id) {
      Purchases.logIn(user.id)
        .then(({ customerInfo }) => syncCustomerInfo(customerInfo))
        .catch((e) => console.warn('[RevenueCat] logIn error:', e));
      loggedInRef.current = true;
    } else if (loggedInRef.current) {
      // Only log out if we previously logged in — the SDK already starts
      // anonymous, and calling logOut() on an anonymous user throws.
      loggedInRef.current = false;
      Purchases.logOut()
        .then((info) => syncCustomerInfo(info))
        .catch((e) => console.warn('[RevenueCat] logOut error:', e));
    }
  }, [user?.id, syncCustomerInfo]);

  const purchasePackage = useCallback(async (pkg: PurchasesPackage): Promise<boolean> => {
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      syncCustomerInfo(customerInfo);
      return PRO_ENTITLEMENT_ID in customerInfo.entitlements.active;
    } catch (e: any) {
      if (!e.userCancelled) {
        console.warn('[RevenueCat] purchasePackage error:', e);
      }
      return false;
    }
  }, [syncCustomerInfo]);

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    try {
      const info = await Purchases.restorePurchases();
      syncCustomerInfo(info);
      return PRO_ENTITLEMENT_ID in info.entitlements.active;
    } catch (e) {
      console.warn('[RevenueCat] restorePurchases error:', e);
      return false;
    }
  }, [syncCustomerInfo]);

  return (
    <RevenueCatContext.Provider value={{ isPro, offerings, purchasePackage, restorePurchases, isLoading, offeringsError }}>
      {children}
    </RevenueCatContext.Provider>
  );
}

export function useRevenueCat() {
  return useContext(RevenueCatContext);
}
