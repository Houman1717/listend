import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIF_ID_KEY = '@listend:monthlyRecapNotifId';
const SIGNATURE_KEY = '@listend:monthlyRecapSignature';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export type RecapStats = { albums: number; hours: number };

/**
 * The next 9am-on-the-1st that hasn't happened yet.
 *
 * Deliberately not "the 1st of next month": opening the app at 8am on the 1st
 * would then re-book for a month later and cancel the notification an hour
 * before it fires. This keeps today's when it's still ahead of us.
 */
function nextRecapDate(from: Date): Date {
  const thisMonth = new Date(from.getFullYear(), from.getMonth(), 1, 9, 0, 0, 0);
  return thisMonth > from
    ? thisMonth
    : new Date(from.getFullYear(), from.getMonth() + 1, 1, 9, 0, 0, 0);
}

/**
 * When the next recap fires and which month it covers — always the month that
 * just ended, derived from the fire date rather than from "now". The scheduler
 * calls this too, so the counts it gathers are always for the month the copy
 * names, including in the 8am-on-the-1st window where those differ.
 */
export function recapTarget(now: Date = new Date()): { fireAt: Date; year: number; month: number } {
  const fireAt = nextRecapDate(now);
  const covered = new Date(fireAt.getFullYear(), fireAt.getMonth() - 1, 1);
  return { fireAt, year: covered.getFullYear(), month: covered.getMonth() };
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

  const { fireAt, year, month } = recapTarget();
  const signature = `${fireAt.toISOString()}|${stats.albums}|${stats.hours}`;

  const existing = await AsyncStorage.getItem(SIGNATURE_KEY);
  if (existing === signature) return;

  await cancelMonthlyRecapNotification();

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: `Your ${MONTH_NAMES[month]} is ready`,
      body: buildBody(stats),
      data: { type: 'month_in_review', year, month },
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
