import { useEffect, useState, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import { 
  registerForPushNotifications, 
  sendPushTokenToServer, 
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
  scheduleLocalNotification,
  cancelNotification,
} from '@/lib/notifications';

export function useNotifications() {
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);

  useEffect(() => {
    const receivedSubscription = addNotificationReceivedListener((notification) => {
      setNotification(notification);
    });

    const responseSubscription = addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
    });

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, []);

  const register = useCallback(async () => {
    const token = await registerForPushNotifications();
    if (token) {
      setPushToken(token);
      const deviceId = `device_${Date.now()}`;
      await sendPushTokenToServer(token, deviceId);
    }
    return token;
  }, []);

  const scheduleReminder = useCallback(async (
    title: string,
    body: string,
    triggerDate: Date
  ) => {
    return await scheduleLocalNotification(title, body, triggerDate);
  }, []);

  const cancelReminder = useCallback(async (notificationId: string) => {
    await cancelNotification(notificationId);
  }, []);

  return {
    pushToken,
    notification,
    register,
    scheduleReminder,
    cancelReminder,
  };
}
