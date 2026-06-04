import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

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
  console.log('[Push] token:', tokenData.data);

  const { error } = await supabase.from('push_tokens').upsert(
    { user_id: userId, token: tokenData.data, platform: Platform.OS },
    { onConflict: 'user_id,token' },
  );
  console.log('[Push] upsert error:', error);
}
