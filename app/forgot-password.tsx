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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

const ACCENT = '#D4A017';

// Must be present in Supabase → Authentication → URL Configuration → Redirect URLs.
// In a standalone build this resolves to listend://reset-password.
export const RESET_REDIRECT_URL = Linking.createURL('reset-password');

export default function ForgotPasswordScreen() {
  const colorScheme = useColorScheme();
  const colors      = Colors[colorScheme ?? 'dark'];

  const router = useRouter();
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);

  async function handleSend() {
    if (!email.trim()) {
      Alert.alert('Missing email', 'Enter the email address on your account.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: RESET_REDIRECT_URL,
    });
    setLoading(false);

    // Supabase deliberately returns success for unknown addresses so this
    // screen can't be used to probe which emails have accounts — mirror that
    // and show the same confirmation either way.
    if (error && !/rate|too many/i.test(error.message)) {
      console.warn('[forgot-password] resetPasswordForEmail:', error.message);
    }
    if (error && /rate|too many/i.test(error.message)) {
      Alert.alert('Too many requests', 'Please wait a minute and try again.');
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <View style={[s.root, s.inner, { backgroundColor: colors.background }]}>
        <Ionicons name="mail-outline" size={56} color={ACCENT} />
        <Text style={[s.title, { color: colors.text }]}>Check your email</Text>
        <Text style={[s.body, { color: colors.subtext }]}>
          If there's a Listend account for {email.trim()}, we've sent it a link to set a
          new password. Open the link on this device and it'll take you straight back
          into the app.
        </Text>
        <Text style={[s.body, { color: colors.subtext }]}>
          Signed up with Apple or Google? You can still set a password here — or just
          use the same button you originally signed up with.
        </Text>
        <Pressable
          style={({ pressed }) => [s.btn, { backgroundColor: ACCENT, opacity: pressed ? 0.85 : 1 }]}
          onPress={() => router.replace('/login')}>
          <Text style={s.btnText}>Back to Sign In</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.inner}>
        <Ionicons name="lock-open-outline" size={56} color={ACCENT} />
        <Text style={[s.title, { color: colors.text }]}>Forgot your password?</Text>
        <Text style={[s.body, { color: colors.subtext }]}>
          Enter the email on your account and we'll send you a link to set a new one.
          Your reviews and album collection stay exactly where they are.
        </Text>

        <View style={s.form}>
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
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <Pressable
            style={({ pressed }) => [s.btn, { backgroundColor: ACCENT, opacity: pressed ? 0.85 : 1 }]}
            onPress={handleSend}
            disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>Send Reset Link</Text>}
          </Pressable>
        </View>

        <Pressable onPress={() => router.back()} style={s.switchRow}>
          <Text style={[s.switchText, { color: colors.subtext }]}>Remembered it? </Text>
          <Text style={[s.switchText, { color: ACCENT }]}>Sign In</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:  { flex: 1 },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  title: { fontSize: 24, fontWeight: '700', marginTop: 8 },
  body:  { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  form:  { width: '100%', gap: 12, marginTop: 12 },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  btn: {
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 4,
  },
  btnText:    { color: '#fff', fontSize: 16, fontWeight: '600' },
  switchRow:  { flexDirection: 'row', marginTop: 16 },
  switchText: { fontSize: 14 },
});
