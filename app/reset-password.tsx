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
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

const ACCENT = '#D4A017';
const MIN_LENGTH = 8;

export default function ResetPasswordScreen() {
  const colorScheme = useColorScheme();
  const colors      = Colors[colorScheme ?? 'dark'];

  const router = useRouter();
  const { session, recoveryPending, recoveryError, endRecovery } = useAuth();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [show, setShow]         = useState(false);
  const [loading, setLoading]   = useState(false);

  async function handleSave() {
    if (password.length < MIN_LENGTH) {
      Alert.alert('Password too short', `Use at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      Alert.alert('Passwords don’t match', 'Please type the same password twice.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      Alert.alert('Couldn’t update password', error.message);
      return;
    }
    // The recovery session is already a full session, so leaving recovery mode
    // lets AuthGate drop the user straight into the app, signed in.
    endRecovery();
    Alert.alert('Password updated', 'You’re signed in.');
    router.replace('/(tabs)');
  }

  // Expo Router lands on this screen the moment the deep link arrives, which
  // is before the code has been swapped for a session. Wait that out rather
  // than flashing the failure state on every successful reset.
  if (recoveryPending) {
    return (
      <View style={[s.root, s.inner, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={[s.body, { color: colors.subtext }]}>Checking your link…</Text>
      </View>
    );
  }

  // The link failed to turn into a session — almost always because it was
  // opened on a different device from the one that requested it, or because it
  // had already been used or expired.
  if (recoveryError || !session) {
    return (
      <View style={[s.root, s.inner, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle-outline" size={56} color={ACCENT} />
        <Text style={[s.title, { color: colors.text }]}>This link didn't work</Text>
        <Text style={[s.body, { color: colors.subtext }]}>
          {recoveryError ??
            'Reset links expire and can only be used once, on the same device that asked for them.'}
        </Text>
        <Pressable
          style={({ pressed }) => [s.btn, { backgroundColor: ACCENT, opacity: pressed ? 0.85 : 1 }]}
          onPress={() => { endRecovery(); router.replace('/forgot-password'); }}>
          <Text style={s.btnText}>Send a New Link</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.inner}>
        <Ionicons name="key-outline" size={56} color={ACCENT} />
        <Text style={[s.title, { color: colors.text }]}>Set a new password</Text>
        <Text style={[s.body, { color: colors.subtext }]}>
          For {session.user.email}. At least {MIN_LENGTH} characters.
        </Text>

        <View style={s.form}>
          <View style={s.pwWrap}>
            <TextInput
              style={[s.input, s.pwInput, {
                backgroundColor: colors.surface,
                borderColor:     colors.border,
                color:           colors.text,
              }]}
              placeholder="New password"
              placeholderTextColor={colors.subtext}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!show}
              autoCapitalize="none"
              textContentType="newPassword"
            />
            <Pressable style={s.eyeBtn} onPress={() => setShow(v => !v)} hitSlop={8}>
              <Ionicons
                name={show ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={colors.subtext}
              />
            </Pressable>
          </View>

          <TextInput
            style={[s.input, {
              backgroundColor: colors.surface,
              borderColor:     colors.border,
              color:           colors.text,
            }]}
            placeholder="Confirm new password"
            placeholderTextColor={colors.subtext}
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry={!show}
            autoCapitalize="none"
            textContentType="newPassword"
          />

          <Pressable
            style={({ pressed }) => [s.btn, { backgroundColor: ACCENT, opacity: pressed ? 0.85 : 1 }]}
            onPress={handleSave}
            disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>Save Password</Text>}
          </Pressable>
        </View>
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
  pwWrap:  { position: 'relative', width: '100%' },
  pwInput: { paddingRight: 46 },
  eyeBtn:  {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 46,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btn: {
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 4,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
