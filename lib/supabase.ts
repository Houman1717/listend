import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { reportBackendFailure, reportBackendSuccess } from '@/lib/backendHealth';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Every Supabase request passes through here, so this is the one place that
// reliably sees whether the backend is answering — including hard network
// rejections, which never reach a .then() at the call site.
//
// A 4xx is the server answering correctly (401 on a bad token, 409 on a
// conflict) and must NOT count as an outage. Only transport failures and 5xx
// (including Cloudflare 52x, which is what the 2026-08-28 Supabase incident
// served) mean "we can't reach our data".
const healthTrackingFetch: typeof fetch = async (input, init) => {
  try {
    const res = await fetch(input, init);
    if (res.status >= 500) reportBackendFailure();
    else reportBackendSuccess();
    return res;
  } catch (err) {
    reportBackendFailure();
    throw err;
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: healthTrackingFetch },
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});
