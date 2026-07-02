import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '../supabase';

// Ensures the in-app browser session is dismissed when the app is brought
// back to the foreground after a successful OAuth redirect.
WebBrowser.maybeCompleteAuthSession();

export function configureGoogleSignIn(): void {
  // No-op — native SDK no longer used. Kept so the call in _layout.tsx compiles.
}

export async function signInWithGoogle(): Promise<void> {
  const redirectTo = Linking.createURL('/');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;
  if (!data.url) throw new Error('Google sign-in: no OAuth URL returned');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type !== 'success') return; // user cancelled — swallow silently

  // Pull the PKCE auth code out of the redirect URL — exchangeCodeForSession
  // expects the code itself, not the full URL.
  const { queryParams } = Linking.parse(result.url);
  if (queryParams?.error_description) {
    throw new Error(String(queryParams.error_description));
  }
  const code = queryParams?.code;
  if (!code || typeof code !== 'string') {
    throw new Error('Google sign-in: no authorization code returned');
  }

  const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
  if (sessionError) throw sessionError;
}

// Cancellation is now handled by result.type check inside signInWithGoogle.
// Kept so SocialAuthButtons.tsx compiles without changes.
export function isGoogleSignInCancelledError(_err: unknown): boolean {
  return false;
}
