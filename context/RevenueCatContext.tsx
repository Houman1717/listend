import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import Purchases, { CustomerInfo, LOG_LEVEL, Offerings, PurchasesPackage } from 'react-native-purchases';
import { useAuth } from './AuthContext';

const REVENUECAT_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';
const PRO_ENTITLEMENT_ID = 'pro';

interface RevenueCatContextValue {
  isPro: boolean;
  offerings: Offerings | null;
  purchasePackage: (pkg: PurchasesPackage) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  isLoading: boolean;
}

const RevenueCatContext = createContext<RevenueCatContextValue>({
  isPro: false,
  offerings: null,
  purchasePackage: async () => false,
  restorePurchases: async () => false,
  isLoading: true,
});

export function RevenueCatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [isPro,      setIsPro]      = useState(false);
  const [offerings,  setOfferings]  = useState<Offerings | null>(null);
  const [isLoading,  setIsLoading]  = useState(true);

  // Initialise SDK once on mount
  useEffect(() => {
    if (!REVENUECAT_IOS_KEY) {
      console.warn('[RevenueCat] EXPO_PUBLIC_REVENUECAT_IOS_KEY is not set');
      setIsLoading(false);
      return;
    }

    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }

    Purchases.configure({ apiKey: REVENUECAT_IOS_KEY });
    setIsLoading(false);
  }, []);

  // Sync entitlements whenever customer info changes
  const syncCustomerInfo = useCallback((info: CustomerInfo) => {
    const active = info.entitlements.active;
    setIsPro(PRO_ENTITLEMENT_ID in active);
  }, []);

  // Fetch offerings on mount
  useEffect(() => {
    Purchases.getOfferings()
      .then(setOfferings)
      .catch((e) => console.warn('[RevenueCat] getOfferings error:', e));
  }, []);

  // Listen for real-time entitlement changes (e.g. subscription expires mid-session)
  useEffect(() => {
    const listener = Purchases.addCustomerInfoUpdateListener(syncCustomerInfo);
    return () => listener.remove();
  }, [syncCustomerInfo]);

  // Log in / log out with Supabase user ID
  useEffect(() => {
    if (!REVENUECAT_IOS_KEY) return;

    if (user?.id) {
      Purchases.logIn(user.id)
        .then(({ customerInfo }) => syncCustomerInfo(customerInfo))
        .catch((e) => console.warn('[RevenueCat] logIn error:', e));
    } else {
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
    <RevenueCatContext.Provider value={{ isPro, offerings, purchasePackage, restorePurchases, isLoading }}>
      {children}
    </RevenueCatContext.Provider>
  );
}

export function useRevenueCat() {
  return useContext(RevenueCatContext);
}
