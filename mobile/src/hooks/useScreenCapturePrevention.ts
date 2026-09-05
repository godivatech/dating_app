import { useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';

/**
 * Custom hook to enforce screenshot and screen recording protection on sensitive screens.
 * - Android: Employs native FLAG_SECURE to prevent screenshots and screen recordings at OS level.
 * - iOS: Listens for screenshot events and alerts the user about member safety standards.
 */
export function useScreenCapturePrevention(enabled: boolean = true) {
  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return;

    let subscription: ScreenCapture.Subscription | null = null;

    const setupCaptureProtection = async () => {
      try {
        await ScreenCapture.preventScreenCaptureAsync();
      } catch {
        // Safe non-blocking fallback on unsupported platforms
      }

      try {
        subscription = ScreenCapture.addScreenshotListener(() => {
          Alert.alert(
            'Screenshots Prohibited 🛡️',
            'To protect our members’ privacy and safety, taking screenshots or screen recordings is not permitted on Spark.',
            [{ text: 'I Understand', style: 'default' }],
          );
        });
      } catch {
        // Non-blocking fallback
      }
    };

    setupCaptureProtection();

    return () => {
      if (subscription) {
        subscription.remove();
      }
      ScreenCapture.allowScreenCaptureAsync().catch(() => {});
    };
  }, [enabled]);
}
