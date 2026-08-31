import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

/**
 * Root layout for the dating app.
 *
 * This is the top-level layout that wraps all routes.
 * It configures the root Stack navigator.
 *
 * Future phases will add:
 * - Authentication state provider
 * - Theme provider
 * - TanStack Query provider
 * - Zustand store initialization
 */
export default function RootLayout() {
  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
      <StatusBar style="auto" />
    </>
  );
}
