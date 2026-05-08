import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useNotificationSound } from '@/hooks/useNotificationSound';

// Shared global state so all hook instances stay in sync
let globalUnreadCount = 0;
const listeners = new Set<(count: number) => void>();

function setGlobalUnreadCount(count: number) {
  globalUnreadCount = count;
  listeners.forEach(fn => fn(count));
}

function getLastViewedTimestamp(userId: string): number {
  try {
    const stored = localStorage.getItem(`support_last_viewed_${userId}`);
    return stored ? parseInt(stored, 10) : 0;
  } catch {
    return 0;
  }
}

function setLastViewedTimestamp(userId: string) {
  try {
    localStorage.setItem(`support_last_viewed_${userId}`, Date.now().toString());
  } catch {
    // ignore
  }
}

export const useUnreadSupportMessages = () => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(globalUnreadCount);
  const { toast } = useToast();
  const { play: playNotification } = useNotificationSound();

  // Subscribe to global state changes
  useEffect(() => {
    const handler = (count: number) => setUnreadCount(count);
    listeners.add(handler);
    setUnreadCount(globalUnreadCount);
    return () => { listeners.delete(handler); };
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;

    const lastViewed = getLastViewedTimestamp(user.id);

    const { data: adminMessages } = await supabase
      .from('chat_messages')
      .select('id, created_at')
      .eq('user_id', user.id)
      .eq('sender_type', 'admin')
      .order('created_at', { ascending: false });

    if (!adminMessages || adminMessages.length === 0) {
      setGlobalUnreadCount(0);
      return;
    }

    // Count admin messages that arrived after the user last viewed the inbox
    let unread = 0;
    for (const msg of adminMessages) {
      const msgTime = new Date(msg.created_at).getTime();
      if (msgTime > lastViewed) {
        unread++;
      }
    }

    setGlobalUnreadCount(unread);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setGlobalUnreadCount(0);
      return;
    }

    fetchUnreadCount();

    const channel = supabase
      .channel('unread_support_count')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          if (payload.new.sender_type === 'admin') {
            setGlobalUnreadCount(globalUnreadCount + 1);
            playNotification();
            toast({
              title: "📩 New message from Support",
              description: "You have a new reply in your Support Inbox.",
            });
          }
          // User's own messages don't affect unread count
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchUnreadCount, playNotification, toast]);

  const markAsRead = useCallback(() => {
    if (!user) return;
    setLastViewedTimestamp(user.id);
    setGlobalUnreadCount(0);
  }, [user]);

  return { unreadCount, markAsRead };
};
