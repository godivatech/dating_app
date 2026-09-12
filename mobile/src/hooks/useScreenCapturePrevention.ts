import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';
import { useSafetyStore } from '../stores/safety-store';

/**
 * Custom hook to enforce screenshot and screen recording protection on sensitive screens.
 * - Android: Employs native FLAG_SECURE to prevent screenshots and screen recordings at OS level.
 * - iOS: Listens for screenshot events and displays the branded Truelove privacy modal.
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
          useSafetyStore.getState().showScreenshotModal();
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
