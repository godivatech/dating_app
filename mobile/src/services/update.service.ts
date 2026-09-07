import * as Updates from 'expo-updates';
import { AppState, AppStateStatus } from 'react-native';

/**
 * Service to handle Over-The-Air (OTA) updates smoothly and reliably.
 * 
 * Best Practices implemented:
 * 1. Checks on app launch.
 * 2. Checks whenever app resumes from background (AppState -> 'active').
 * 3. Fetches update silently in background to avoid disrupting active user interactions.
 * 4. When update is ready, applies it seamlessly on next resume or when user is idle.
 */
let isChecking = false;
let updateReadyToApply = false;

export async function checkAndFetchUpdateSilently(): Promise<boolean> {
  if (__DEV__ || !Updates.isEnabled) {
    return false;
  }

  if (isChecking) {
    return false;
  }

  try {
    isChecking = true;
    const check = await Updates.checkForUpdateAsync();
    
    if (check.isAvailable) {
      console.log('[OTA Updates] New update found. Downloading in background...');
      const fetchResult = await Updates.fetchUpdateAsync();
      
      if (fetchResult.isNew) {
        console.log('[OTA Updates] Update downloaded successfully and ready to apply.');
        updateReadyToApply = true;
        return true;
      }
    }
  } catch (error) {
    // Network offline, timeout, or server unreachable - fails silently without breaking UX
    console.warn('[OTA Updates] Silent check/fetch skipped:', error);
  } finally {
    isChecking = false;
  }

  return false;
}

/**
 * Initialize automatic update listeners:
 * - Checks immediately on app launch.
 * - Checks every time user re-opens / resumes the app.
 * - Applies any downloaded bundle smoothly on resume.
 */
export function setupAutoUpdateListener(): () => void {
  // Check immediately on startup
  checkAndFetchUpdateSilently();

  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active') {
      // If we previously downloaded a bundle while user was active or in background, reload smoothly now!
      if (updateReadyToApply) {
        console.log('[OTA Updates] Applying downloaded update on app resume...');
        try {
          await Updates.reloadAsync();
          return;
        } catch (e) {
          console.warn('[OTA Updates] Reload error:', e);
        }
      }

      // Check again whenever user switches back to the app
      checkAndFetchUpdateSilently();
    }
  };

  const subscription = AppState.addEventListener('change', handleAppStateChange);

  return () => {
    subscription.remove();
  };
}
