import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const usePushSubscription = () => {
  const { user } = useAuth();

  const subscribe = useCallback(async () => {
    if (!user) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Push notifications not supported in this browser');
      return;
    }

    try {
      // Register the service worker
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // Get VAPID public key from edge function
      const { data, error } = await supabase.functions.invoke('get-vapid-public-key');
      if (error || !data?.publicKey) {
        console.error('Failed to get VAPID public key:', error);
        return;
      }

      // Check for existing subscription
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        // Request permission if needed
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          console.log('Push notification permission denied');
          return;
        }

        // Subscribe
        const applicationServerKey = urlBase64ToUint8Array(data.publicKey).buffer as ArrayBuffer;
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }

      const subJson = subscription.toJSON();
      if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
        console.error('Invalid push subscription');
        return;
      }

      // Save subscription to database (upsert by user_id + endpoint)
      const { error: upsertError } = await supabase
        .from('push_subscriptions' as any)
        .upsert(
          {
            user_id: user.id,
            endpoint: subJson.endpoint,
            p256dh: subJson.keys.p256dh,
            auth: subJson.keys.auth,
          },
          { onConflict: 'user_id,endpoint' }
        );

      if (upsertError) {
        console.error('Failed to save push subscription:', upsertError);
      } else {
        console.log('Push subscription registered successfully');
      }
    } catch (err) {
      console.error('Push subscription failed:', err);
    }
  }, [user]);

  useEffect(() => {
    subscribe();
  }, [subscribe]);
};
