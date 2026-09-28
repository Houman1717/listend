import { useEffect } from 'react';
import { useAlbums } from '@/context/AlbumsContext';
import { useAuth } from '@/context/AuthContext';
import { scheduleMonthlyRecapNotification, cancelMonthlyRecapNotification } from '@/lib/monthlyRecapNotification';

/**
 * Books the "your month is ready" nudge for 9am on the 1st, re-running on every
 * launch — expo-notifications can't repeat monthly across both platforms, and
 * re-running is also what keeps the real counts in the copy up to date.
 *
 * Renders nothing; lives inside AlbumsProvider so it can see the library.
 */
export function MonthlyRecapScheduler() {
  const { user } = useAuth();
  const { loggedAlbums, isLoaded } = useAlbums();

  useEffect(() => {
    if (!user) { cancelMonthlyRecapNotification().catch(() => {}); return; }
    if (!isLoaded) return;

    const now = new Date();
    const thisMonth = loggedAlbums.filter(a => {
      const d = new Date(a.dateLogged);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });

    if (thisMonth.length === 0) {
      scheduleMonthlyRecapNotification(null).catch(() => {});
      return;
    }

    // Matches how the recap screen itself reports hours, so the notification
    // can't promise a number the screen then contradicts.
    const totalMs = thisMonth.reduce((sum, a) => sum + (a.durationMs ?? 0), 0);

    scheduleMonthlyRecapNotification({
      albums: thisMonth.length,
      hours: Math.round(totalMs / 3_600_000),
    }).catch(() => {});
  }, [user?.id, isLoaded, loggedAlbums]);

  return null;
}
