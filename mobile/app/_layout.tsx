import React, { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../src/stores/auth-store';

import { IncomingCallModal } from '../src/components/calling/IncomingCallModal';
import { ActiveCallModal } from '../src/components/calling/ActiveCallModal';

import { setupAutoUpdateListener } from '../src/services/update.service';
import {
  initPushNotificationHandler,
  setupPushNotificationListeners,
  registerForPushNotificationsAsync,
} from '../src/services/push-notification.service';

// Initialize foreground notification handler (Zomato/Swiggy standard)
initPushNotificationHandler();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

export default function RootLayout() {
  const router = useRouter();
  const checkSession = useAuthStore((state) => state.checkSession);
  const status = useAuthStore((state) => state.status);

  useEffect(() => {
    // Check existing stored session on initial app boot
    checkSession();

    // Setup automatic background OTA updates (launch + app resume)
    const updateCleanup = setupAutoUpdateListener();

    // Setup push notification tap deep-linking & in-app badge updates
    const pushCleanup = setupPushNotificationListeners((route) => {
      try {
        router.push(route as any);
      } catch (e) {
        console.warn('Push navigation failed:', e);
      }
    });

    return () => {
      updateCleanup();
      pushCleanup();
    };
  }, [checkSession, router]);

  useEffect(() => {
    // When user is authenticated, register push notification token with backend
    if (status === 'AUTHENTICATED') {
      registerForPushNotificationsAsync();
    }
  }, [status]);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'fade',
          }}
        />
        <IncomingCallModal />
        <ActiveCallModal />
        <StatusBar style="dark" />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
