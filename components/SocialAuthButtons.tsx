import * as AppleAuthentication from 'expo-apple-authentication';
import React from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { signInWithApple } from '../lib/auth/appleAuth';
import {
  isGoogleSignInCancelledError,
  signInWithGoogle,
} from '../lib/auth/googleAuth';

function GoogleG({ size = 18 }: { size?: number }) {
  return (
    <Text style={{ fontSize: size, fontWeight: '700', color: '#4285F4', lineHeight: size + 2 }}>G</Text>
  );
}

// ─── Google ──────────────────────────────────────────────────────────────────

export function GoogleSignInButton() {
  return (
    <Pressable
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
      onPress={async () => {
        try {
          await signInWithGoogle();
        } catch (err: unknown) {
          if (isGoogleSignInCancelledError(err)) return;
          console.error('Google sign-in error:', err);
          Alert.alert('Sign-in failed', 'Google sign-in could not be completed.');
        }
      }}
    >
      <GoogleG size={18} />
      <Text style={styles.btnText}>Continue with Google</Text>
    </Pressable>
  );
}

// ─── Apple ───────────────────────────────────────────────────────────────────

export function AppleAuthButton() {
  if (Platform.OS !== 'ios') return null;

  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE}
      cornerRadius={10}
      style={styles.appleBtn}
      onPress={async () => {
        try {
          await signInWithApple();
        } catch (err: unknown) {
          if (
            typeof err === 'object' &&
            err !== null &&
            'code' in err &&
            (err as any).code === 'ERR_REQUEST_CANCELED'
          ) {
            return;
          }
          console.error('Apple sign-in error:', err);
          Alert.alert('Sign-in failed', 'Apple sign-in could not be completed.');
        }
      }}
    />
  );
}

// ─── Composite ───────────────────────────────────────────────────────────────

export function SocialAuthButtons() {
  return (
    <View style={styles.container}>
      <GoogleSignInButton />
      <AppleAuthButton />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    gap: 10,
    width: '100%',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D1D1',
  },
  pressed: {
    opacity: 0.7,
  },
  btnText: {
    color: '#1A1A1A',
    fontSize: 16,
    fontWeight: '600',
  },
  appleBtn: {
    width: '100%',
    height: 44,
  },
});
