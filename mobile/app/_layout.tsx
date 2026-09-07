import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../src/stores/auth-store';

import { IncomingCallModal } from '../src/components/calling/IncomingCallModal';
import { ActiveCallModal } from '../src/components/calling/ActiveCallModal';

import { setupAutoUpdateListener } from '../src/services/update.service';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

export default function RootLayout() {
  const checkSession = useAuthStore((state) => state.checkSession);

  useEffect(() => {
    // Check existing stored session on initial app boot
    checkSession();
    // Setup automatic background OTA updates (launch + app resume)
    const cleanup = setupAutoUpdateListener();
    return cleanup;
  }, [checkSession]);

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
