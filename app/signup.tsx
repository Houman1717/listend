import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { SocialAuthButtons } from '@/components/SocialAuthButtons';
import { LegalConsent } from '@/components/LegalConsent';
import { capture } from '@/lib/analytics';

const ACCENT = '#D4A017';

export default function SignUpScreen() {
  const colorScheme = useColorScheme();
  const colors      = Colors[colorScheme ?? 'dark'];

  const router = useRouter();
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [username, setUsername]         = useState('');
  const [loading, setLoading]           = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  async function handleSignUp() {
    if (!email.trim() || !password || !username.trim()) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    setLoading(true);

    const trimmedUsername = username.trim();

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      // Stash the chosen username in user metadata so it survives email
      // confirmation — ensureProfile (AuthContext) reads it on first sign-in,
      // falling back to the username for display_name too (set properly on
      // the mandatory edit-profile screen that follows right after).
      options: { data: { username: trimmedUsername } },
    });

    if (error) {
      setLoading(false);
      Alert.alert('Sign up failed', error.message);
      return;
    }

    if (data.user) {
      capture('sign_up', { method: 'email' });
    }

    setLoading(false);

    // Email confirmation is currently off, so signUp() already returns a live
    // session — ensureProfile (AuthContext) creates the profiles row on the
    // resulting SIGNED_IN event and AuthGate redirects into the app. Only
    // show the "check your email" screen if a session wasn't issued (i.e.
    // confirmation is required).
    if (!data.session) {
      setAwaitingConfirmation(true);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

      <View style={s.inner}>
        <Image source={require('@/assets/images/listend-logo.png')} style={s.logo} />

        {awaitingConfirmation ? (
          <View style={s.confirmBox}>
            <Ionicons name="mail-unread-outline" size={52} color={ACCENT} style={{ marginBottom: 16 }} />
            <Text style={[s.confirmTitle, { color: colors.text }]}>Check your email</Text>
            <Text style={[s.confirmText, { color: colors.subtext }]}>
              We've sent a confirmation link to{' '}
              <Text style={{ color: colors.text, fontWeight: '600' }}>{email.trim()}</Text>.
              {'\n'}Tap it to verify your account, then sign in.
            </Text>
            <Pressable
              style={({ pressed }) => [s.btn, { backgroundColor: ACCENT, opacity: pressed ? 0.85 : 1, width: '100%' }]}
              onPress={() => router.back()}>
              <Text style={s.btnText}>Back to Sign In</Text>
            </Pressable>
            <Text style={[s.confirmHint, { color: colors.subtext }]}>
              Didn't get it? Check your spam folder.
            </Text>
          </View>
        ) : (
          <>
            <Text style={[s.subtitle, { color: colors.subtext }]}>Create your account</Text>

            <View style={s.form}>
              <TextInput
                style={[s.input, {
                  backgroundColor: colors.surface,
                  borderColor:     colors.border,
                  color:           colors.text,
                }]}
                placeholder="Username"
                placeholderTextColor={colors.subtext}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                textContentType="username"
              />
              <TextInput
                style={[s.input, {
                  backgroundColor: colors.surface,
                  borderColor:     colors.border,
                  color:           colors.text,
                }]}
                placeholder="Email"
                placeholderTextColor={colors.subtext}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                textContentType="emailAddress"
              />
              <View style={s.pwWrap}>
                <TextInput
                  style={[s.input, s.pwInput, {
                    backgroundColor: colors.surface,
                    borderColor:     colors.border,
                    color:           colors.text,
                  }]}
                  placeholder="Password"
                  placeholderTextColor={colors.subtext}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  textContentType="newPassword"
                />
                <Pressable
                  style={s.eyeBtn}
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={8}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.subtext}
                  />
                </Pressable>
              </View>

              <Pressable
                style={({ pressed }) => [s.btn, { backgroundColor: ACCENT, opacity: pressed ? 0.85 : 1 }]}
                onPress={handleSignUp}
                disabled={loading}>
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.btnText}>Sign Up</Text>}
              </Pressable>
            </View>

            <View style={s.dividerRow}>
              <View style={[s.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[s.dividerLabel, { color: colors.subtext }]}>or</Text>
              <View style={[s.dividerLine, { backgroundColor: colors.border }]} />
            </View>

            <SocialAuthButtons />

            <LegalConsent verb="signing up" color={colors.subtext} />

            <Pressable onPress={() => router.back()} style={s.switchRow}>
              <Text style={[s.switchText, { color: colors.subtext }]}>Already have an account? </Text>
              <Text style={[s.switchText, { color: ACCENT }]}>Sign In</Text>
            </Pressable>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 24,
    marginBottom: 8,
  },
  title:    { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 15, marginBottom: 24 },
  form:     { width: '100%', gap: 12 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  pwWrap: { width: '100%', justifyContent: 'center' },
  pwInput: { paddingRight: 48 },
  eyeBtn: {
    position: 'absolute',
    right: 6,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  btn: {
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  btnText:    { color: '#fff', fontSize: 16, fontWeight: '700' },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 20,
    gap: 10,
  },
  dividerLine:  { flex: 1, height: StyleSheet.hairlineWidth },
  dividerLabel: { fontSize: 13 },
  switchRow:  { flexDirection: 'row', marginTop: 20 },
  switchText: { fontSize: 14 },

  // Email-confirmation screen
  confirmBox: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  confirmTitle: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5, marginBottom: 10 },
  confirmText:  { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  confirmHint:  { fontSize: 13, textAlign: 'center', marginTop: 16 },
});
