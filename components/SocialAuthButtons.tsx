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
import Svg, { Path, G, ClipPath, Rect, Defs } from 'react-native-svg';
import { signInWithApple } from '../lib/auth/appleAuth';
import {
  isGoogleSignInCancelledError,
  signInWithGoogle,
} from '../lib/auth/googleAuth';

// Pixel-accurate Google G logo at 18×18
function GoogleG({ size = 18 }: { size?: number }) {
  const s = size / 18;
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18">
      <Defs>
        <ClipPath id="g">
          <Rect width="18" height="18" />
        </ClipPath>
      </Defs>
      <G clipPath="url(#g)">
        {/* Blue — right arc */}
        <Path
          d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
          fill="#4285F4"
        />
        {/* Green — bottom arc */}
        <Path
          d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
          fill="#34A853"
        />
        {/* Yellow — left bottom arc */}
        <Path
          d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
          fill="#FBBC05"
        />
        {/* Red — top arc */}
        <Path
          d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
          fill="#EA4335"
        />
      </G>
    </Svg>
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
