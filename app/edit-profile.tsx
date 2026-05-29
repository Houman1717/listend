import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useRouter, useNavigation } from 'expo-router';
import { useState, useEffect, useRef, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useColorScheme } from '@/context/ThemeContext';
import { usePro } from '@/context/ProContext';
import { getProTheme, themeToColors } from '@/lib/proThemes';

// ─── Constants ────────────────────────────────────────────────────────────────

const DARK_BG   = '#1c1410';
const CARD_BG   = '#2e2018';
const BORDER    = '#2a1e14';
const TEXT      = '#f5e6c8';
const SUBTEXT   = '#a07850';
const ACCENT    = '#D4A017';
const AVATAR_SIZE = 80;
const { width: SCREEN_W } = Dimensions.get('window');

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, visible }: { message: string; visible: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(1800),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Animated.View style={[t.wrap, { opacity }]} pointerEvents="none">
      <View style={t.pill}>
        <FontAwesome name="check-circle" size={14} color="#fff" />
        <Text style={t.text}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const t = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 40, left: 0, right: 0,
    alignItems: 'center',
    zIndex: 99,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2a1e14',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#3a2818',
  },
  text: { color: TEXT, fontSize: 14, fontWeight: '600' },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const API_URL = process.env.EXPO_PUBLIC_API_URL;

async function pickImage(): Promise<{ uri: string; base64: string } | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission needed', 'Please allow access to your photo library.');
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality: 0.85,
    base64: true,
  });
  if (result.canceled || !result.assets[0].base64) return null;
  return { uri: result.assets[0].uri, base64: result.assets[0].base64 };
}

async function uploadViaBackend(
  endpoint: 'upload-avatar' | 'upload-cover',
  userId: string,
  base64: string,
): Promise<string> {
  const url = `${API_URL}/api/${endpoint}`;
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ user_id: userId, image_base64: base64 }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `Upload failed (${res.status})`);
  return json.url;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function EditProfileScreen() {
  const router     = useRouter();
  const navigation = useNavigation();
  const { user }   = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { isPro, proTheme } = usePro();
  const proColors = (isPro && proTheme !== 'default') ? themeToColors(getProTheme(proTheme)) : null;

  // Dynamic colors — pro theme overrides dark/light defaults
  const bg      = proColors ? proColors.background : isDark ? DARK_BG  : '#FAF7F4';
  const cardBg  = proColors ? proColors.surface    : isDark ? CARD_BG  : '#FFFFFF';
  const border  = proColors ? proColors.border     : isDark ? BORDER   : '#e8ddd0';
  const text    = proColors ? proColors.text       : isDark ? TEXT     : '#1A0F0A';
  const subtext = proColors ? proColors.subtext    : isDark ? SUBTEXT  : '#7a5c3a';
  const accent  = proColors ? proColors.tint       : ACCENT;

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [username,    setUsername]    = useState('');
  const [bio,         setBio]         = useState('');



  const [avatarUri,    setAvatarUri]    = useState<string | null>(null);
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [toast,   setToast]   = useState(false);

  // ── Load existing profile ─────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('display_name, username, bio, avatar_url')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setDisplayName(data.display_name  ?? '');
          setUsername(   data.username      ?? '');
          setBio(        data.bio           ?? '');


          setAvatarUri(  data.avatar_url    ?? null);
        }
        setLoading(false);
      });
  }, [user]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!user) return;
    setSaving(true);

    try {
      let { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshed.session) {
          Alert.alert('Not authenticated', 'Your session has expired. Please sign in again.');
          setSaving(false);
          return;
        }
        session = refreshed.session;
      }

      let finalAvatarUrl = avatarUri;
      if (avatarBase64) {
        finalAvatarUrl = await uploadViaBackend('upload-avatar', user.id, avatarBase64);
      }

      const { error } = await supabase
        .from('profiles')
        .upsert(
          {
            id:              user.id,
            display_name:    displayName.trim(),
            username:        username.trim(),
            bio:             bio.trim(),


            avatar_url:      finalAvatarUrl,
          },
          { onConflict: 'id' },
        );

      if (error) throw error;

      if (finalAvatarUrl) setAvatarUri(finalAvatarUrl);
      setAvatarBase64(null);

      setToast(true);
      setTimeout(() => {
        setToast(false);
        router.back();
      }, 2400);
    } catch (err: any) {
      Alert.alert('Error saving profile', err?.message ?? 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  }, [user, displayName, username, bio, avatarUri, avatarBase64]);

  // ── Inject Save button into header ───────────────────────────────────────
  useEffect(() => {
    navigation.setOptions({
      headerStyle: { backgroundColor: bg },
      headerTintColor: text,
      headerShadowVisible: false,
      headerRight: () =>
        saving ? (
          <ActivityIndicator color={accent} style={{ marginRight: 16 }} />
        ) : (
          <Pressable
            onPress={handleSave}
            hitSlop={10}
            style={{ paddingHorizontal: 16 }}
          >
            <Text style={{ color: accent, fontSize: 16, fontWeight: '700' }}>Save</Text>
          </Pressable>
        ),
    });
  }, [navigation, handleSave, saving, bg, text, accent]);

  // ── Image pickers ─────────────────────────────────────────────────────────
  async function onPickAvatar() {
    const picked = await pickImage();
    if (picked) { setAvatarUri(picked.uri); setAvatarBase64(picked.base64); }
  }

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: bg }]}>
        <ActivityIndicator color={accent} size="large" />
      </View>
    );
  }

  const avatarInitial = (displayName || username || user?.email || '?')
    .charAt(0).toUpperCase();

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={88}>

        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {/* ── Avatar ─────────────────────────────────────────────────── */}
          <View style={s.photoBlock}>
            <Pressable
              style={[s.avatarWrap, { borderColor: bg, backgroundColor: isDark ? '#2a1e14' : '#e8ddd0' }]}
              onPress={onPickAvatar}
            >
              {avatarUri ? (
                <ExpoImage source={{ uri: avatarUri }} style={s.avatarImg} contentFit="cover" cachePolicy="disk" />
              ) : (
                <View style={[s.avatarPlaceholder, { backgroundColor: isDark ? '#2a1e14' : '#e8ddd0' }]}>
                  <Text style={[s.avatarInitial, { color: accent }]}>{avatarInitial}</Text>
                </View>
              )}
              <View style={[s.avatarEditBadge, { backgroundColor: accent }]}>
                <FontAwesome name="camera" size={10} color="#fff" />
              </View>
            </Pressable>
          </View>

          {/* ── Form fields ────────────────────────────────────────────── */}
          <View style={s.form}>

            {/* Display name */}
            <View style={s.fieldGroup}>
              <Text style={[s.label, { color: subtext }]}>DISPLAY NAME</Text>
              <TextInput
                style={[s.input, { backgroundColor: cardBg, borderColor: border, color: text }]}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your name"
                placeholderTextColor={subtext}
                autoCapitalize="words"
              />
            </View>

            {/* Username */}
            <View style={s.fieldGroup}>
              <Text style={[s.label, { color: subtext }]}>USERNAME</Text>
              <TextInput
                style={[s.input, { backgroundColor: cardBg, borderColor: border, color: text }]}
                value={username}
                onChangeText={setUsername}
                placeholder="username"
                placeholderTextColor={subtext}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Bio */}
            <View style={s.fieldGroup}>
              <View style={s.labelRow}>
                <Text style={[s.label, { color: subtext }]}>BIO</Text>
                <Text style={[s.charCount, { color: subtext }, bio.length > 140 && s.charCountWarn]}>
                  {bio.length}/150
                </Text>
              </View>
              <TextInput
                style={[s.input, s.inputMulti, { backgroundColor: cardBg, borderColor: border, color: text }]}
                value={bio}
                onChangeText={v => v.length <= 150 && setBio(v)}
                placeholder="Tell people about yourself…"
                placeholderTextColor={subtext}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>


          </View>

          <View style={{ height: 48 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <Toast message="Profile saved!" visible={toast} />
    </View>
  );
}

// ─── Link input row ───────────────────────────────────────────────────────────


// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:   { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingBottom: 16 },

  // ── Photo block ──────────────────────────────────────────────────────────
  photoBlock: {
    position: 'relative',
    marginBottom: 0,
  },
  avatarWrap: {
    alignSelf: 'center',
    marginTop: 20,
    marginBottom: 8,
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 3,
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: ACCENT, fontSize: 28, fontWeight: '700' },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Form ──────────────────────────────────────────────────────────────────
  form: { paddingHorizontal: 20, gap: 20 },
  fieldGroup: { gap: 6 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  charCount: { fontSize: 12 },
  charCountWarn: { color: '#FF6B6B' },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
  },
  inputMulti: {
    minHeight: 90,
    paddingTop: 13,
  },
  linkGroup: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    overflow: 'hidden',
  },
  linkSep: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 48,
  },
});
