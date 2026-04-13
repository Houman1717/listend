import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/lib/supabase';

type NotificationsContextType = {
  unreadCount: number;
  markAllRead: () => Promise<void>;
  /** Mark all unread 'message' notifications from a specific actor as read. */
  markMessagesRead: (actorId: string) => Promise<void>;
  refresh: () => void;
};

const NotificationsContext = createContext<NotificationsContextType>({
  unreadCount: 0,
  markAllRead: async () => {},
  markMessagesRead: async () => {},
  refresh: () => {},
});

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  async function fetchUnreadCount(uid: string) {
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', uid)
      .eq('read', false);
    setUnreadCount(count ?? 0);
  }

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    const uid = user.id;
    fetchUnreadCount(uid);

    // Realtime: bump badge whenever a new notification arrives
    const channel = supabase
      .channel(`notifications-badge-${uid}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
        () => fetchUnreadCount(uid),
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [user?.id]);

  async function markAllRead() {
    if (!user) return;
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false);
    setUnreadCount(0);
  }

  async function markMessagesRead(actorId: string) {
    if (!user) return;
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('type', 'message')
      .eq('actor_id', actorId)
      .eq('read', false);
    // Refresh the badge count after marking read
    fetchUnreadCount(user.id);
  }

  return (
    <NotificationsContext.Provider value={{
      unreadCount,
      markAllRead,
      markMessagesRead,
      refresh: () => user && fetchUnreadCount(user.id),
    }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext);
}
