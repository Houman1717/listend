import { StyleSheet, View, Text, Pressable, Share, Platform, ScrollView } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { usePro } from '@/context/ProContext';
import { useAuth } from '@/context/AuthContext';
import { getProTheme, themeToColors } from '@/lib/proThemes';
import { isAutoUsername } from '@/lib/userHandle';
import { QRCode } from '@/components/QRCode';

// Instagram-style "Share profile": a QR card plus the share sheet. Built only
// from core RN + JS so it ships over OTA. Copy link / save image need native
// modules (expo-clipboard, react-native-view-shot) and wait for the next build.

const ACCENT   = '#D4A017';
const CARD_INK = '#1A0F0A';
const QR_SIZE  = 220;
const AVATAR   = 64;

function profileShareUrl(username: string) {
  return `https://listend.uk/u/${encodeURIComponent(username)}`;
}

export default function ShareProfileScreen() {
  const colorScheme = useColorScheme();
  const { isPro, proTheme } = usePro();
  const colors = (isPro && proTheme && proTheme !== 'default')
    ? themeToColors(getProTheme(proTheme))
    : Colors[colorScheme ?? 'dark'];
  const router = useRouter();
  const { user } = useAuth();
  const { username = '', displayName = '', avatarUrl = '' } =
    useLocalSearchParams<{ username?: string; displayName?: string; avatarUrl?: string }>();

  const hasHandle = !!username && !isAutoUsername(username, user?.id);
  const url = hasHandle ? profileShareUrl(username) : '';
  const initial = (displayName || username || '?').charAt(0).toUpperCase();

  async function handleShare() {
    if (!url) return;
    try {
      await Share.share(
        Platform.OS === 'ios'
          ? { message: 'Find me on Listend', url }
          : { message: `Find me on Listend: ${url}` },
      );
    } catch {}
  }

  const header = (
    <Stack.Screen options={{
      title: 'Share Profile',
      headerStyle: { backgroundColor: colors.background },
      headerTintColor: colors.text,
      headerShadowVisible: false,
    }} />
  );

  if (!hasHandle) {
    return (
      <View style={[s.container, s.center, { backgroundColor: colors.background }]}>
        {header}
        <FontAwesome name="at" size={36} color={ACCENT} />
        <Text style={[s.emptyTitle, { color: colors.text }]}>Pick a username first</Text>
        <Text style={[s.emptySub, { color: colors.subtext }]}>
          Your profile link and QR code use your username.
        </Text>
        <Pressable
          onPress={() => router.replace('/choose-username?mode=settings')}
          style={({ pressed }) => [s.primaryBtn, { opacity: pressed ? 0.8 : 1 }]}>
          <Text style={s.primaryBtnText}>Choose username</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={s.content}>
      {header}

      <View style={s.card}>
        <View style={s.avatarWrap}>
          {avatarUrl
            ? <ExpoImage source={{ uri: avatarUrl }} style={s.avatarImg} contentFit="cover" cachePolicy="disk" />
            : <View style={s.avatarFallback}><Text style={s.avatarInitial}>{initial}</Text></View>}
        </View>

        <QRCode value={url} size={QR_SIZE} color={CARD_INK} />

        <Text style={s.handle} numberOfLines={1}>@{username}</Text>
        {displayName && displayName !== username
          ? <Text style={s.name} numberOfLines={1}>{displayName}</Text>
          : null}

        <View style={s.brandRow}>
          <FontAwesome name="music" size={11} color="#A08060" />
          <Text style={s.brand}>LISTEND</Text>
        </View>
      </View>

      <Text style={[s.hint, { color: colors.subtext }]}>
        Friends can scan this or open your link to find your profile.
      </Text>

      <Pressable
        onPress={handleShare}
        style={({ pressed }) => [s.primaryBtn, { opacity: pressed ? 0.8 : 1 }]}>
        <FontAwesome name="share" size={15} color="#fff" />
        <Text style={s.primaryBtnText}>Share profile</Text>
      </Pressable>

      <Text style={[s.link, { color: colors.textMuted }]} selectable>
        {url.replace('https://', '')}
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  content: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 48, paddingBottom: 40 },

  card: {
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingTop: AVATAR / 2 + 20,
    paddingBottom: 20,
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  avatarWrap: {
    position: 'absolute',
    top: -AVATAR / 2,
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: '#2a1e14',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: ACCENT, fontSize: 26, fontWeight: '700' },

  handle: { color: ACCENT, fontSize: 20, fontWeight: '800', marginTop: 16, letterSpacing: -0.2 },
  name:   { color: '#6B4C35', fontSize: 14, marginTop: 2 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  brand:  { color: '#A08060', fontSize: 11, fontWeight: '800', letterSpacing: 2 },

  hint: { fontSize: 13, textAlign: 'center', marginTop: 24, marginBottom: 20, maxWidth: 280 },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ACCENT,
    borderRadius: 24,
    paddingVertical: 13,
    paddingHorizontal: 40,
    marginTop: 4,
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  link: { fontSize: 12, marginTop: 14 },

  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 14 },
  emptySub:   { fontSize: 14, textAlign: 'center', marginTop: 6, marginBottom: 20 },
});
