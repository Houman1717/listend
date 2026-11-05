import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { fetchSuggestedFollows, type SuggestedUser } from '@/lib/growth';
import { SuggestionCard, useFollowSuggestions } from '@/components/FollowSuggestions';

// Home "People to Follow" strip, for accounts following fewer than 3 people
// (most of them: only ~13% follow anyone). Sits under Friends Recent Listend,
// which is empty for exactly these accounts. Dismissal hides it for two weeks.

const DISMISS_KEY  = 'peopleToFollowDismissedAt';
const DISMISS_DAYS = 14;
const SHOW_BELOW   = 3;

export function PeopleToFollowSection({
  userId,
  colors,
}: {
  userId: string;
  colors: { text: string; subtext: string; card: string; border: string; tint: string; background: string };
}) {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<SuggestedUser[] | null>(null);
  const [hidden, setHidden] = useState(true);
  const { status, follow } = useFollowSuggestions('home');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rawAt = await AsyncStorage.getItem(DISMISS_KEY).catch(() => null);
        const at = rawAt ? Number(rawAt) : 0;
        if (at && Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000) return;

        const { count, error } = await supabase
          .from('follows')
          .select('id', { count: 'exact', head: true })
          .eq('follower_id', userId);
        // A failed count is "we couldn't tell" — stay hidden rather than guess.
        if (error || count == null || count >= SHOW_BELOW) return;

        const rows = await fetchSuggestedFollows(userId, 20);
        if (cancelled || !rows.length) return;
        setSuggestions(rows);
        setHidden(false);
      } catch {
        // stay hidden
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  if (hidden || !suggestions?.length) return null;

  function dismiss() {
    setHidden(true);
    AsyncStorage.setItem(DISMISS_KEY, String(Date.now())).catch(() => {});
  }

  return (
    <View style={s.section}>
      <View style={s.headerRow}>
        <Text style={[s.label, { color: colors.text }]}>People to Follow</Text>
        <Pressable onPress={dismiss} hitSlop={12} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
          <FontAwesome name="times" size={15} color={colors.subtext} />
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
        {suggestions.slice(0, 10).map(u => (
          <SuggestionCard
            key={u.id}
            user={u}
            status={status[u.id] ?? 'idle'}
            onFollow={() => follow(u)}
            onOpen={() => router.push({ pathname: '/user-profile', params: { userId: u.id } })}
            colors={colors}
          />
        ))}
        <Pressable
          onPress={() => router.push('/find-people?mode=browse')}
          style={({ pressed }) => [
            s.more,
            { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
          ]}>
          <Text style={[s.moreText, { color: colors.text }]}>See{'\n'}All</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  section:   { gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  label:     { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  row:       { paddingHorizontal: 16, gap: 12, alignItems: 'stretch' },
  more:      { width: 100, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  moreText:  { fontSize: 13, fontWeight: '700', textAlign: 'center', letterSpacing: -0.2 },
});
