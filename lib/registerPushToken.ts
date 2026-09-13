import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

// The last token this device registered. Kept on disk so sign-out can remove it
// without asking Expo for the token again (which needs permission + network).
const TOKEN_KEY = 'listend.pushToken';

async function postWithTimeout(path: string, accessToken: string, body: object, ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function registerPushToken(userId: string) {
  console.log('[Push] registerPushToken called, isDevice:', Device.isDevice);
  if (!Device.isDevice) return;

  const { status: existing } = await Notifications.getPermissionsAsync();
  console.log('[Push] existing permission status:', existing);
  const { status } = existing === 'granted'
    ? { status: existing }
    : await Notifications.requestPermissionsAsync();

  console.log('[Push] final permission status:', status);
  if (status !== 'granted') return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: 'a2196642-8c1a-430d-b72c-33980cceb721',
  });
  const token = tokenData.data;
  console.log('[Push] token:', token);
  await AsyncStorage.setItem(TOKEN_KEY, token).catch(() => {});

  // Register through the backend: it also detaches this token from any other
  // account previously signed in on this device, which a client can't do
  // under RLS. Without that, a signed-out account's pushes keep arriving here.
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token && session.user.id === userId) {
    try {
      const res = await postWithTimeout('/api/push-token', session.access_token, { token, platform: Platform.OS }, 8000);
      if (res.ok) return;
      console.log('[Push] backend register failed:', res.status);
    } catch (e) {
      console.log('[Push] backend register error:', (e as Error)?.message);
    }
  }

  // Fallback so notifications still work if the backend is unreachable.
  const { error } = await supabase.from('push_tokens').upsert(
    { user_id: userId, token, platform: Platform.OS },
    { onConflict: 'user_id,token' },
  );
  console.log('[Push] upsert error:', error);
}

// Detach this device from the signed-in account. Must run before the session
// is cleared (the backend needs the access token). Best-effort and time-boxed
// so an offline sign-out never hangs — the next account to register on this
// device claims the token anyway.
export async function unregisterPushToken(accessToken: string | undefined) {
  if (!accessToken) return;
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) return;
    await postWithTimeout('/api/push-token/remove', accessToken, { token }, 3000);
  } catch (e) {
    console.log('[Push] unregister error:', (e as Error)?.message);
  }
}
