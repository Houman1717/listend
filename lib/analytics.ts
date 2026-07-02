import PostHog from 'posthog-react-native';

// Configured via EXPO_PUBLIC_ vars (same pattern as Supabase/RevenueCat keys).
// EXPO_PUBLIC_POSTHOG_KEY  — Project API Key (starts with phc_)
// EXPO_PUBLIC_POSTHOG_HOST — e.g. https://eu.i.posthog.com or https://us.i.posthog.com
const API_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '';
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';

// Only create a real client when a key is set, so dev builds without the key
// (and the very first run before the env is configured) are harmless no-ops.
export const posthog = API_KEY ? new PostHog(API_KEY, { host: HOST }) : null;

/** Track a product event. Safe to call anywhere — no-ops if analytics is off. */
export function capture(event: string, properties?: Record<string, any>) {
  try {
    posthog?.capture(event, properties);
  } catch {
    // never let analytics break the app
  }
}

/** Tie events to a logged-in user. */
export function identifyUser(distinctId: string, properties?: Record<string, any>) {
  try {
    posthog?.identify(distinctId, properties);
  } catch {}
}

/** Clear the identity on logout. */
export function resetAnalytics() {
  try {
    posthog?.reset();
  } catch {}
}
