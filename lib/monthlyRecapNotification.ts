import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIF_ID_KEY = '@listend:monthlyRecapNotifId';
const SIGNATURE_KEY = '@listend:monthlyRecapSignature';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export type RecapStats = { albums: number; hours: number };

/** 9am local on the 1st of the month after `from`. */
function nextFirstOfMonth(from: Date): Date {
  return new Date(from.getFullYear(), from.getMonth() + 1, 1, 9, 0, 0, 0);
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** "24 albums, 61 hours. See how your month sounded." */
function buildBody({ albums, hours }: RecapStats): string {
  const counts = hours > 0
    ? `${plural(albums, 'album')}, ${plural(hours, 'hour')}`
    : plural(albums, 'album');
  return `${counts}. See how your month sounded.`;
}

/**
 * Schedule the "your month is ready" nudge for 9am on the 1st.
 *
 * expo-notifications has no cross-platform monthly repeat — CALENDAR triggers
 * are iOS-only — so this books a single DATE trigger and is called again on
 * every app open, which rolls it forward month to month.
 *
 * The body carries the month's real counts. Those can only change while the
 * app is open (you can't log an album otherwise), so re-booking on each launch
 * keeps the copy accurate right up to the moment it fires. The signature check
 * means we only actually re-book when the date or the numbers moved.
 *
 * Pass null when nothing was logged this month — no recap worth promising.
 */
export async function scheduleMonthlyRecapNotification(stats: RecapStats | null) {
  if (!stats || stats.albums === 0) {
    await cancelMonthlyRecapNotification();
    return;
  }

  const now = new Date();
  const fireAt = nextFirstOfMonth(now);
  const signature = `${fireAt.toISOString()}|${stats.albums}|${stats.hours}`;

  const existing = await AsyncStorage.getItem(SIGNATURE_KEY);
  if (existing === signature) return;

  await cancelMonthlyRecapNotification();

  // The month being recapped is the one we're in now, not the one we fire in.
  const monthName = MONTH_NAMES[now.getMonth()];

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: `Your ${monthName} is ready`,
      body: buildBody(stats),
      data: { type: 'month_in_review', year: now.getFullYear(), month: now.getMonth() },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireAt,
    },
  });

  await AsyncStorage.multiSet([[NOTIF_ID_KEY, id], [SIGNATURE_KEY, signature]]);
}

export async function cancelMonthlyRecapNotification() {
  const id = await AsyncStorage.getItem(NOTIF_ID_KEY);
  if (id) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  }
  await AsyncStorage.multiRemove([NOTIF_ID_KEY, SIGNATURE_KEY]);
}
