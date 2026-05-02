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
  Image,
  Animated,
  Dimensions,
} from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { useState, useEffect, useRef, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase'; // still used for profile read/upsert

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

/** Pick an avatar from the library (free crop). */
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


/**
 * Upload an image via the Railway backend (which uses the Supabase service-role
 * key to bypass Storage RLS). Returns the public URL.
 */
async function uploadViaBackend(
  endpoint: 'upload-avatar' | 'upload-cover',
  userId: string,
  base64: string,
): Promise<string> {
  const url = `${API_URL}/api/${endpoint}`;
  console.log(`[EditProfile] POST ${url} user_id=${userId} base64_len=${base64.length}`);

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ user_id: userId, image_base64: base64 }),
  });

  const json = await res.json();
  if (!res.ok) {
    console.log('FULL ERROR:', JSON.stringify(json));
    throw new Error(json.error ?? `Upload failed (${res.status})`);
  }
  console.log(`[EditProfile] upload success → ${json.url}`);
  return json.url;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function EditProfileScreen() {
  const router     = useRouter();
  const navigation = useNavigation();
  const { user }   = useAuth();

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [username,    setUsername]    = useState('');
  const [bio,         setBio]         = useState('');
  const [website,     setWebsite]     = useState('');
  const [instagram,   setInstagram]   = useState('');
  const [tiktok,      setTiktok]      = useState('');
  const [twitter,     setTwitter]     = useState('');

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
      .select('display_name, username, bio, website_url, instagram_url, tiktok_url, twitter_url, avatar_url')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setDisplayName(data.display_name  ?? '');
          setUsername(   data.username      ?? '');
          setBio(        data.bio           ?? '');
          setWebsite(    data.website_url   ?? '');
          setInstagram(  data.instagram_url ?? '');
          setTiktok(     data.tiktok_url    ?? '');
          setTwitter(    data.twitter_url   ?? '');
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
      // ── 1. Confirm the session is live before writing ──────────────────────
      let { data: { session } } = await supabase.auth.getSession();

      console.log('[EditProfile] session token:', session?.access_token ?? 'NULL — not authenticated');

      // If the cached session has expired or wasn't loaded yet, force a refresh
      if (!session) {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshed.session) {
          Alert.alert('Not authenticated', 'Your session has expired. Please sign in again.');
          setSaving(false);
          return;
        }
        session = refreshed.session;
        console.log('[EditProfile] session refreshed, token:', session.access_token);
      }

      // ── 2. Upload images via backend if the user picked new ones ──────────
      let finalAvatarUrl = avatarUri;
      if (avatarBase64) {
        finalAvatarUrl = await uploadViaBackend('upload-avatar', user.id, avatarBase64);
      }

      // ── 3. Upsert — inserts if the row doesn't exist, updates if it does ───
      //    onConflict:'id' means: if a row with this id already exists, update it.
      const { error } = await supabase
        .from('profiles')
        .upsert(
          {
            id:              user.id,
            display_name:    displayName.trim(),
            username:        username.trim(),
            bio:             bio.trim(),
            website_url:     website.trim(),
            instagram_url:   instagram.trim(),
            tiktok_url:      tiktok.trim(),
            twitter_url:     twitter.trim(),
            avatar_url:      finalAvatarUrl,
          },
          { onConflict: 'id' },
        );

      if (error) throw error;

      // Update preview URIs to the returned public URLs and clear base64 buffers
      if (finalAvatarUrl) setAvatarUri(finalAvatarUrl);
      setAvatarBase64(null);

      setToast(true);
      setTimeout(() => {
        setToast(false);
        router.back();
      }, 2400);
    } catch (err: any) {
      console.log('FULL ERROR:', JSON.stringify(err));
      Alert.alert('Error saving profile', err?.message ?? 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  }, [user, displayName, username, bio, website, instagram, tiktok, twitter, avatarUri, avatarBase64]);

  // ── Inject Save button into header ───────────────────────────────────────
  useEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        saving ? (
          <ActivityIndicator color={ACCENT} style={{ marginRight: 16 }} />
        ) : (
          <Pressable onPress={handleSave} style={{ marginRight: 16 }} hitSlop={10}>
            <Text style={{ color: ACCENT, fontSize: 16, fontWeight: '700' }}>Save</Text>
          </Pressable>
        ),
    });
  }, [navigation, handleSave, saving]);

  // ── Image pickers ─────────────────────────────────────────────────────────
  async function onPickAvatar() {
    const picked = await pickImage();
    if (picked) { setAvatarUri(picked.uri); setAvatarBase64(picked.base64); }
  }


  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={ACCENT} size="large" />
      </View>
    );
  }

  const avatarInitial = (displayName || username || user?.email || '?')
    .charAt(0).toUpperCase();

  return (
    <View style={s.root}>
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
            <Pressable style={s.avatarWrap} onPress={onPickAvatar}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={s.avatarImg} resizeMode="cover" />
              ) : (
                <View style={s.avatarPlaceholder}>
                  <Text style={s.avatarInitial}>{avatarInitial}</Text>
                </View>
              )}
              <View style={s.avatarEditBadge}>
                <FontAwesome name="camera" size={10} color="#fff" />
              </View>
            </Pressable>
          </View>

          {/* ── Form fields ────────────────────────────────────────────── */}
          <View style={s.form}>

            {/* Display name */}
            <View style={s.fieldGroup}>
              <Text style={s.label}>DISPLAY NAME</Text>
              <TextInput
                style={s.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your name"
                placeholderTextColor={SUBTEXT}
                autoCapitalize="words"
              />
            </View>

            {/* Username */}
            <View style={s.fieldGroup}>
              <Text style={s.label}>USERNAME</Text>
              <TextInput
                style={s.input}
                value={username}
                onChangeText={setUsername}
                placeholder="username"
                placeholderTextColor={SUBTEXT}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Bio */}
            <View style={s.fieldGroup}>
              <View style={s.labelRow}>
                <Text style={s.label}>BIO</Text>
                <Text style={[s.charCount, bio.length > 140 && s.charCountWarn]}>
                  {bio.length}/150
                </Text>
              </View>
              <TextInput
                style={[s.input, s.inputMulti]}
                value={bio}
                onChangeText={t => t.length <= 150 && setBio(t)}
                placeholder="Tell people about yourself…"
                placeholderTextColor={SUBTEXT}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Links section */}
            <Text style={[s.label, { marginTop: 8, marginBottom: 12 }]}>LINKS</Text>

            <View style={s.linkGroup}>
              <LinkInput
                icon="globe"
                placeholder="Website URL"
                value={website}
                onChangeText={setWebsite}
              />
              <View style={s.linkSep} />
              <LinkInput
                icon="instagram"
                placeholder="Instagram URL"
                value={instagram}
                onChangeText={setInstagram}
              />
              <View style={s.linkSep} />
              <LinkInput
                icon="music"
                placeholder="TikTok URL"
                value={tiktok}
                onChangeText={setTiktok}
              />
              <View style={s.linkSep} />
              <LinkInput
                icon="twitter"
                placeholder="Twitter / X URL"
                value={twitter}
                onChangeText={setTwitter}
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

function LinkInput({
  icon,
  placeholder,
  value,
  onChangeText,
}: {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
}) {
  return (
    <View style={li.row}>
      <FontAwesome name={icon} size={16} color={SUBTEXT} style={li.icon} />
      <TextInput
        style={li.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={SUBTEXT}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />
    </View>
  );
}

const li = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 2,
  },
  icon: { width: 22, textAlign: 'center', marginRight: 12 },
  input: {
    flex: 1,
    color: TEXT,
    fontSize: 15,
    paddingVertical: 12,
  },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: DARK_BG },
  center: { flex: 1, backgroundColor: DARK_BG, alignItems: 'center', justifyContent: 'center' },
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
    borderColor: DARK_BG,
    overflow: 'hidden',
    backgroundColor: '#2a1e14',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarPlaceholder: {
    flex: 1,
    backgroundColor: '#2a1e14',
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
    color: SUBTEXT,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  charCount: { color: SUBTEXT, fontSize: 12 },
  charCountWarn: { color: '#FF6B6B' },
  input: {
    backgroundColor: CARD_BG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    color: TEXT,
    fontSize: 15,
  },
  inputMulti: {
    minHeight: 90,
    paddingTop: 13,
  },
  linkGroup: {
    backgroundColor: CARD_BG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    borderRadius: 12,
    overflow: 'hidden',
  },
  linkSep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
    marginLeft: 48,
  },
});
