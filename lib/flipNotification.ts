import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIF_ID_KEY = '@listend:flipCooldownNotifId';

export async function scheduleFlipCooldownNotification(cooldownUntil: number) {
  await cancelFlipCooldownNotification();

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Time to flip!',
      body: "Your cooldown is over — go find your next record.",
      data: { type: 'flip_cooldown' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(cooldownUntil),
    },
  });

  await AsyncStorage.setItem(NOTIF_ID_KEY, id);
}

export async function cancelFlipCooldownNotification() {
  const id = await AsyncStorage.getItem(NOTIF_ID_KEY);
  if (id) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    await AsyncStorage.removeItem(NOTIF_ID_KEY);
  }
}
