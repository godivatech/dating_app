import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';
import { useSafetyStore } from '../stores/safety-store';

/**
 * Module-level reference counter for active screen capture locks.
 * Prevents child modals or overlapping screens from prematurely clearing FLAG_SECURE
 * on Android when another protected view is still active.
 */
let activeLocksCount = 0;

/**
 * Custom hook to enforce screenshot and screen recording protection on sensitive screens.
 * - Android: Employs native FLAG_SECURE to prevent screenshots and screen recordings at OS level.
 * - iOS: Listens for screenshot events and displays the branded Truelove privacy modal.
 */
export function useScreenCapturePrevention(enabled: boolean = true) {
  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return;

    activeLocksCount += 1;
    if (activeLocksCount === 1) {
      ScreenCapture.preventScreenCaptureAsync().catch(() => {});
    }

    let subscription: ScreenCapture.Subscription | null = null;
    try {
      subscription = ScreenCapture.addScreenshotListener(() => {
        useSafetyStore.getState().showScreenshotModal();
      });
    } catch {
      // Non-blocking fallback for environments without capture listener
    }

    return () => {
      if (subscription) {
        subscription.remove();
      }

      activeLocksCount = Math.max(0, activeLocksCount - 1);
      if (activeLocksCount === 0) {
        ScreenCapture.allowScreenCaptureAsync().catch(() => {});
      }
    };
  }, [enabled]);
}
