import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { registerForPushNotifications, sendPushTokenToServer } from '@/lib/notifications';
import { getDatabase } from '@/lib/db';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5,
    },
  },
});

export default function RootLayout() {
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const loadSettings = useSettingsStore((state) => state.loadSettings);

  useEffect(() => {
    loadSettings();
    checkAuth();
    getDatabase();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      const registerPush = async () => {
        const token = await registerForPushNotifications();
        if (token) {
          const deviceId = `device_${Date.now()}`;
          await sendPushTokenToServer(token, deviceId);
        }
      };
      registerPush();
    }
  }, [isAuthenticated]);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="visit" />
      </Stack>
    </QueryClientProvider>
  );
}
