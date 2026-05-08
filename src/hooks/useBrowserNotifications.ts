import { useEffect, useCallback, useRef } from 'react';

export const useBrowserNotifications = () => {
  const permissionRef = useRef<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) {
      permissionRef.current = Notification.permission;
      if (Notification.permission === 'default') {
        Notification.requestPermission().then((perm) => {
          permissionRef.current = perm;
        });
      }
    }
  }, []);

  const showNotification = useCallback((title: string, body: string, onClick?: () => void) => {
    if (!('Notification' in window)) return;
    if (permissionRef.current !== 'granted') return;

    // Only show browser notification when tab is not focused
    if (document.hidden || !document.hasFocus()) {
      const notification = new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: 'support-message', // prevents duplicate notifications
      });

      if (onClick) {
        notification.onclick = () => {
          window.focus();
          onClick();
          notification.close();
        };
      }

      // Auto-close after 8 seconds
      setTimeout(() => notification.close(), 8000);
    }
  }, []);

  return { showNotification };
};
