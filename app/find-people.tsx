import { useEffect, useState } from 'react';
import {
  StyleSheet, View, Text, TextInput, Pressable, FlatList, ActivityIndicator,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { usePro } from '@/context/ProContext';
import { useAuth } from '@/context/AuthContext';
import { getProTheme, themeToColors } from '@/lib/proThemes';
import {
  fetchSuggestedFollows, claimInviter, INVITE_WINDOW_MS,
  type SuggestedUser, type InviteResult,
} from '@/lib/growth';
import { SuggestionRow, useFollowSuggestions } from '@/components/FollowSuggestions';
import { capture } from '@/lib/analytics';

// Last onboarding step (after username + profile): say who invited you, and
// follow a few people. Accounts that follow someone are far likelier to still
// be logging a month later, and Home's friend sections are empty without it.
// Skippable — the Home "People to Follow" card catches anyone who skips.

const INVITE_MESSAGES: Record<Exclude<InviteResult, 'following' | 'requested'>, string> = {
  not_found:       "We couldn't find that username.",
  self:            "That's you!",
  already_claimed: "You've already told us who invited you.",
  too_late:        'Invites can only be added in your first two weeks.',
  error:           'Something went wrong. Try again.',
};

export default function FindPeopleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const { isPro, proTheme } = usePro();
  const colors = (isPro && proTheme && proTheme !== 'default')
    ? themeToColors(getProTheme(proTheme))
    : Colors[colorScheme ?? 'dark'];
  const { user } = useAuth();
  // mode=browse: opened from Home's "See All", so a normal pushed screen.
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const browsing = mode === 'browse';

  const [suggestions, setSuggestions] = useState<SuggestedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const { status, follow, followedCount } = useFollowSuggestions('onboarding');

  const createdAt = user?.created_at ? new Date(user.created_at).getTime() : 0;
  const canClaimInvite = !!createdAt && Date.now() - createdAt < INVITE_WINDOW_MS;
  const [inviteName, setInviteName] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteMsg,  setInviteMsg]  = useState<{ text: string; ok: boolean } | null>(null);
  const [inviteDone, setInviteDone] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    fetchSuggestedFollows(user.id, 25)
      .then(rows => { if (!cancelled) setSuggestions(rows); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user?.id]);

  async function submitInvite() {
    const name = inviteName.trim().replace(/^@/, '');
    if (!name || inviteBusy) return;
    setInviteBusy(true);
    setInviteMsg(null);
    const result = await claimInviter(name);
    setInviteBusy(false);
    if (result === 'following' || result === 'requested') {
      setInviteDone(true);
      setInviteMsg({
        text: result === 'following'
          ? `You're following @${name}. We've let them know you joined.`
          : `Follow request sent to @${name}. We've let them know you joined.`,
        ok: true,
      });
      setSuggestions(list => list.filter(u => u.username.toLowerCase() !== name.toLowerCase()));
      capture('invite_claimed', { result });
    } else {
      if (result === 'already_claimed' || result === 'too_late') setInviteDone(true);
      setInviteMsg({ text: INVITE_MESSAGES[result], ok: false });
    }
  }

  function finish() {
    capture('find_people_done', { followed: followedCount, invite: inviteDone, source: browsing ? 'home' : 'onboarding' });
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  }

  const header = (
    <View style={s.header}>
      <Text style={[s.title, { color: colors.text }]}>Follow a few people</Text>
      <Text style={[s.lead, { color: colors.subtext }]}>
        Your Home feed fills up with what the people you follow are listening to and rating.
      </Text>

      {canClaimInvite && (
        <View style={[s.inviteBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.inviteTitle, { color: colors.text }]}>Did a friend invite you?</Text>
          {!inviteDone && (
            <View style={s.inviteRow}>
              <TextInput
                value={inviteName}
                onChangeText={t => { setInviteName(t); setInviteMsg(null); }}
                placeholder="Their username"
                placeholderTextColor={colors.subtext}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={submitInvite}
                style={[s.inviteInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              />
              <Pressable
                onPress={submitInvite}
                disabled={!inviteName.trim() || inviteBusy}
                style={({ pressed }) => [
                  s.inviteBtn,
                  { backgroundColor: colors.tint, opacity: !inviteName.trim() ? 0.4 : pressed ? 0.75 : 1 },
                ]}>
                {inviteBusy
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={s.inviteBtnText}>Add</Text>}
              </Pressable>
            </View>
          )}
          {inviteMsg && (
            <View style={s.inviteMsgRow}>
              <FontAwesome
                name={inviteMsg.ok ? 'check-circle' : 'info-circle'}
                size={13}
                color={inviteMsg.ok ? colors.tint : colors.subtext}
              />
              <Text style={[s.inviteMsg, { color: inviteMsg.ok ? colors.text : colors.subtext }]}>
                {inviteMsg.text}
              </Text>
            </View>
          )}
        </View>
      )}

      <Text style={[s.sectionLabel, { color: colors.subtext }]}>SUGGESTED FOR YOU</Text>
    </View>
  );

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{
        title: 'Find People',
        // Onboarding: no back (beats the iOS 26 JS back button too) — Skip/Continue
        // is the way out. Browsing from Home: an ordinary back button.
        ...(browsing ? { gestureEnabled: true } : { headerBackVisible: false, headerLeft: () => null }),
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }} />

      <FlatList
        data={suggestions}
        keyExtractor={u => u.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <SuggestionRow
            user={item}
            status={status[item.id] ?? 'idle'}
            onFollow={() => follow(item)}
            onOpen={() => router.push({ pathname: '/user-profile', params: { userId: item.id } })}
            colors={colors}
          />
        )}
        ListEmptyComponent={
          loading
            ? <ActivityIndicator color={colors.tint} style={{ marginTop: 32 }} />
            : <Text style={[s.empty, { color: colors.subtext }]}>
                No suggestions right now. You can find people from Search any time.
              </Text>
        }
        contentContainerStyle={{ paddingBottom: 24 }}
      />

      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 16), borderTopColor: colors.border, backgroundColor: colors.background }]}>
        <Pressable
          onPress={finish}
          style={({ pressed }) => [
            s.doneBtn,
            browsing || followedCount > 0 || inviteDone
              ? { backgroundColor: colors.tint }
              : { borderWidth: 1, borderColor: colors.border },
            { opacity: pressed ? 0.8 : 1 },
          ]}>
          <Text style={[s.doneText, { color: browsing || followedCount > 0 || inviteDone ? '#fff' : colors.text }]}>
            {browsing ? 'Done' : followedCount > 0 || inviteDone ? 'Continue' : 'Skip for now'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1 },
  header:      { paddingHorizontal: 16, paddingTop: 8 },
  title:       { fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  lead:        { fontSize: 14, lineHeight: 20, marginTop: 6 },
  inviteBox:   { marginTop: 18, padding: 14, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  inviteTitle: { fontSize: 14.5, fontWeight: '700' },
  inviteRow:   { flexDirection: 'row', gap: 8, marginTop: 10 },
  inviteInput: { flex: 1, height: 40, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, fontSize: 15 },
  inviteBtn:   { width: 64, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  inviteBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  inviteMsgRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  inviteMsg:     { fontSize: 13, flex: 1, lineHeight: 18 },
  sectionLabel: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.8, marginTop: 22, marginBottom: 4 },
  empty:       { textAlign: 'center', marginTop: 32, paddingHorizontal: 32, fontSize: 14, lineHeight: 20 },
  footer:      { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  doneBtn:     { height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  doneText:    { fontSize: 16, fontWeight: '700' },
});
