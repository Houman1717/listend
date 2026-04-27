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

const DARK_BG = '#1c1410';
const CARD_BG = '#2e2018';
const BORDER = '#2a1e14';
const TEXT = '#f5e6c8';
const SUBTEXT = '#a07850';
const ACCENT = '#e8963a';
const GRADIENT: [string, string, string] = ['#e8963a', '#c8722a', '#e8963a'];

export default function SignUpScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignUp() {
    if (!email.trim() || !password || !username.trim()) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (error) {
      setLoading(false);
      Alert.alert('Sign up failed', error.message);
      return;
    }

    const userId = data.user?.id;
    if (userId) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({ id: userId, username: username.trim(), display_name: username.trim() });

      if (profileError) {
        console.warn('[SignUp] profile insert error:', profileError.message);
      }
    }

    setLoading(false);
    // AuthContext picks up the new session → _layout.tsx redirects to (tabs)
  }

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

      <LinearGradient
        colors={['#e8963a18', '#c8722a12', '#e8963a08']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={s.inner}>
        {/* Logo mark */}
        <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.logo}>
          <Text style={s.logoText}>L</Text>
        </LinearGradient>
        <Text style={s.title}>Listend</Text>
        <Text style={s.subtitle}>Create your account</Text>

        <View style={s.form}>
          <TextInput
            style={s.input}
            placeholder="Username"
            placeholderTextColor={SUBTEXT}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            textContentType="username"
          />
          <TextInput
            style={s.input}
            placeholder="Email"
            placeholderTextColor={SUBTEXT}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <TextInput
            style={s.input}
            placeholder="Password"
            placeholderTextColor={SUBTEXT}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="newPassword"
          />

          <Pressable
            style={({ pressed }) => [s.btn, { opacity: pressed ? 0.85 : 1 }]}
            onPress={handleSignUp}
            disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>Sign Up</Text>}
          </Pressable>
        </View>

        <Pressable onPress={() => router.back()} style={s.switchRow}>
          <Text style={s.switchText}>Already have an account? </Text>
          <Text style={[s.switchText, { color: ACCENT }]}>Sign In</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: DARK_BG },
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
  title: { color: TEXT, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: SUBTEXT, fontSize: 15, marginBottom: 24 },
  form: { width: '100%', gap: 12 },
  input: {
    backgroundColor: CARD_BG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: TEXT,
    fontSize: 16,
  },
  btn: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  switchRow: {
    flexDirection: 'row',
    marginTop: 24,
  },
  switchText: { color: SUBTEXT, fontSize: 14 },
});
