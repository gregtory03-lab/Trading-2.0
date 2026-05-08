import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useBrowserNotifications } from '@/hooks/useBrowserNotifications';
import { useNotificationSound } from '@/hooks/useNotificationSound';
import { useToast } from '@/hooks/use-toast';
import { usePushSubscription } from '@/hooks/usePushSubscription';

/**
 * Global component that listens for admin support messages
 * and shows browser notifications regardless of which page the user is on.
 */
const GlobalNotificationListener = () => {
  const { user } = useAuth();
  const { showNotification } = useBrowserNotifications();
  const { play: playNotification } = useNotificationSound();
  const { toast } = useToast();

  // Register for Web Push notifications
  usePushSubscription();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('global_support_notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const msg = payload.new as { sender_type: string; message: string; session_id: string };
          
          if (msg.sender_type === 'admin') {
            // Always show browser notification (works when tab is backgrounded)
            showNotification(
              'New Support Message',
              msg.message.substring(0, 120),
              () => {
                window.location.href = '/dashboard/support';
              }
            );

            // Show in-app toast + sound if user is on a different page
            const onSupportPage = window.location.pathname.includes('/support');
            if (!onSupportPage) {
              playNotification();
              toast({
                title: "💬 New Support Message",
                description: msg.message.substring(0, 80),
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, showNotification, playNotification, toast]);

  return null;
};

export default GlobalNotificationListener;
