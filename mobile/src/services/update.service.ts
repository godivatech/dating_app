import * as Updates from 'expo-updates';

/**
 * Service to handle Over-The-Air (OTA) updates smoothly and reliably.
 * In production/preview standalone APKs, this checks for new JS updates
 * in the background and applies them automatically.
 */
export async function checkForAppUpdates(): Promise<boolean> {
  // In development/Expo Go, Updates.checkForUpdateAsync is not supported
  if (__DEV__) {
    return false;
  }

  try {
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      console.log('[OTA Updates] New update available. Fetching...');
      await Updates.fetchUpdateAsync();
      console.log('[OTA Updates] Update fetched successfully. Reloading app...');
      await Updates.reloadAsync();
      return true;
    }
  } catch (error) {
    // Gracefully ignore update errors (e.g. offline, network timeout)
    console.warn('[OTA Updates] Failed to check or fetch update:', error);
  }

  return false;
}
