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
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { SocialAuthButtons } from '@/components/SocialAuthButtons';

const ACCENT = '#D4A017';

export default function LoginScreen() {
  const colorScheme = useColorScheme();
  const colors      = Colors[colorScheme ?? 'dark'];

  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      Alert.alert('Sign in failed', error.message);
    }
    // On success, AuthContext updates session → _layout.tsx redirects to (tabs)
  }

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

      <View style={s.inner}>
        <Image source={require('@/assets/images/listend-logo.png')} style={s.logo} />
        <Text style={[s.subtitle, { color: colors.subtext }]}>Sign in to your account</Text>

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
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <TextInput
            style={[s.input, {
              backgroundColor: colors.surface,
              borderColor:     colors.border,
              color:           colors.text,
            }]}
            placeholder="Password"
            placeholderTextColor={colors.subtext}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
          />

          <Pressable
            style={({ pressed }) => [s.btn, { backgroundColor: ACCENT, opacity: pressed ? 0.85 : 1 }]}
            onPress={handleSignIn}
            disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>Sign In</Text>}
          </Pressable>
        </View>

        <View style={s.dividerRow}>
          <View style={[s.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[s.dividerLabel, { color: colors.subtext }]}>or</Text>
          <View style={[s.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        <SocialAuthButtons />

        <Pressable onPress={() => router.push('/signup')} style={s.switchRow}>
          <Text style={[s.switchText, { color: colors.subtext }]}>Don't have an account? </Text>
          <Text style={[s.switchText, { color: ACCENT }]}>Sign Up</Text>
        </Pressable>
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
  btn: {
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  btnText:   { color: '#fff', fontSize: 16, fontWeight: '700' },
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
});
