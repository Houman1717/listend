// Mandatory username step for accounts that never picked one.
//
// Email/password sign-up asks for a username up front, but Apple/Google
// sign-in doesn't — ensureProfile (context/AuthContext.tsx) invents one from
// the email prefix, and with Apple's private relay that prefix is itself
// random ("@s6hpjrhf7r_eb990498399b"). This screen catches those accounts on
// their first launch and asks for a real handle before they go anywhere else.
//
// Accounts that already have a genuine username skip straight through to
// edit-profile, so the sign-up flow is unchanged for them.
//
// The same screen serves the nudge on an existing account's own profile
// (mode="settings"): there it is dismissible and returns where it came from,
// rather than continuing into the rest of onboarding.
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import {
  isAutoUsername,
  normalizeUsername,
  validateUsername,
  checkUsernameAvailable,
  USERNAME_MIN,
  USERNAME_MAX,
} from '@/lib/userHandle';

const ACCENT = '#D4A017';

/** Turn "Jaden(JJ)" into a plausible starting point like "jadenjj". */
function suggestFrom(displayName: string): string {
  const base = displayName.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, USERNAME_MAX);
  return base.length >= USERNAME_MIN ? base : '';
}

export default function ChooseUsernameScreen() {
  const colorScheme = useColorScheme();
  const colors      = Colors[colorScheme ?? 'dark'];
  const router      = useRouter();
  const { user }    = useAuth();
  const { mode }    = useLocalSearchParams<{ mode?: string }>();
  // Onboarding must not be escapable; the profile nudge must be.
  const isOnboarding = mode !== 'settings';

  /** Where to go once there's nothing left to do here. */
  function leave() {
    if (isOnboarding) router.replace('/edit-profile');
    else router.back();
  }

  const [username, setUsername] = useState('');
  const [checking, setChecking] = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  // This screen must not be dismissible — there is no back button, and on
  // Android the hardware back button is a no-op until a username is saved.
  useEffect(() => {
    if (!isOnboarding) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [isOnboarding]);

  // Load the current profile. An account that already picked a real username
  // has nothing to do here, so send it on to the rest of onboarding.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    supabase
      .from('profiles')
      .select('username, display_name')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (cancelled) return;
        // A failed read is not proof the username is missing — don't trap
        // someone on this screen because the network blipped.
        if (err || !data || !isAutoUsername(data.username, user.id)) {
          leave();
          return;
        }
        setUsername(suggestFrom(data.display_name ?? ''));
        setChecking(false);
      });
    return () => { cancelled = true; };
  }, [user?.id]);

  async function handleSave() {
    const name = normalizeUsername(username.trim());
    const invalid = validateUsername(name);
    if (invalid) { setError(invalid); return; }
    if (!user?.id) return;

    setSaving(true);
    setError(null);

    const unavailable = await checkUsernameAvailable(name, user.id);
    if (unavailable) {
      setSaving(false);
      setError(unavailable);
      return;
    }

    const { error: saveErr } = await supabase
      .from('profiles')
      .update({ username: name })
      .eq('id', user.id);

    setSaving(false);
    if (saveErr) {
      // 23505 = someone claimed the same name between the check and the write.
      setError(saveErr.code === '23505'
        ? 'That username was just taken. Try another.'
        : "Couldn't save that username. Try again.");
      return;
    }
    leave();
  }

  if (checking) {
    return (
      <View style={[s.container, s.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={ACCENT} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[s.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.inner}>
        <Text style={[s.title, { color: colors.text }]}>Pick a username</Text>
        <Text style={[s.subtitle, { color: colors.subtext }]}>
          This is your public handle — it's how people find you in search. You can change
          it later in Edit Profile.
        </Text>

        <View style={[s.inputRow, { backgroundColor: colors.surface, borderColor: error ? '#c0392b' : colors.border }]}>
          <Text style={[s.at, { color: colors.subtext }]}>@</Text>
          <TextInput
            style={[s.input, { color: colors.text }]}
            placeholder="username"
            placeholderTextColor={colors.subtext}
            value={username}
            onChangeText={(t) => { setUsername(normalizeUsername(t)); setError(null); }}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={USERNAME_MAX}
            textContentType="username"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />
        </View>

        <Text style={[s.hint, { color: error ? '#c0392b' : colors.subtext }]}>
          {error ?? `${USERNAME_MIN}–${USERNAME_MAX} characters — letters, numbers and underscores.`}
        </Text>

        <Pressable
          style={({ pressed }) => [s.btn, { backgroundColor: ACCENT, opacity: pressed || saving ? 0.85 : 1 }]}
          onPress={handleSave}
          disabled={saving}>
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnText}>{isOnboarding ? 'Continue' : 'Save'}</Text>}
        </Pressable>

        {!isOnboarding && (
          <Pressable onPress={() => router.back()} hitSlop={8} style={s.cancelBtn}>
            <Text style={[s.cancelText, { color: colors.subtext }]}>Not now</Text>
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center:    { alignItems: 'center', justifyContent: 'center' },
  inner:     { flex: 1, justifyContent: 'center', paddingHorizontal: 28, gap: 10 },
  title:     { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  subtitle:  { fontSize: 15, lineHeight: 21, marginBottom: 18 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  at:    { fontSize: 16, marginRight: 2 },
  input: { flex: 1, paddingVertical: 14, fontSize: 16 },
  hint:  { fontSize: 13, marginTop: 2, marginBottom: 14 },
  btn: {
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn:  { alignItems: 'center', paddingVertical: 14 },
  cancelText: { fontSize: 15, fontWeight: '600' },
});
