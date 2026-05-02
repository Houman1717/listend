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
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

const ACCENT = '#D4A017';
const GRADIENT: [string, string, string] = ['#D4A017', '#B8880F', '#D4A017'];

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
        {/* Logo mark */}
        <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.logo}>
          <Text style={s.logoText}>L</Text>
        </LinearGradient>
        <Text style={[s.title, { color: colors.text }]}>Listend</Text>
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
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  logoText: { color: '#fff', fontSize: 32, fontWeight: '800' },
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
  switchRow: { flexDirection: 'row', marginTop: 24 },
  switchText: { fontSize: 14 },
});
