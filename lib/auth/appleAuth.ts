import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '../supabase';

export async function signInWithApple(): Promise<void> {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  const { identityToken, fullName } = credential;
  if (!identityToken) throw new Error('Apple sign-in: no identity token returned');

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: identityToken,
  });
  if (error) throw error;

  // fullName is only populated on the very first sign-in; save it to user metadata
  if (fullName?.givenName || fullName?.familyName) {
    const displayName = [fullName.givenName, fullName.familyName]
      .filter(Boolean)
      .join(' ');
    await supabase.auth.updateUser({ data: { full_name: displayName } });
  }
}
