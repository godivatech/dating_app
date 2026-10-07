import { PermissionsAndroid, Platform } from 'react-native';
import { toast } from '../stores/toast-store';

/**
 * Requests necessary hardware permissions for real-time audio and video calling,
 * including microphone, camera (if video), and Bluetooth routing (Android 12+).
 */
export async function requestCallingPermissions(isVideo: boolean = false): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    const permissions: Array<(typeof PermissionsAndroid.PERMISSIONS)[keyof typeof PermissionsAndroid.PERMISSIONS]> = [
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    ];

    if (isVideo) {
      permissions.push(PermissionsAndroid.PERMISSIONS.CAMERA);
    }

    // Android 12 (API 31+) requires runtime permission for Bluetooth headset discovery and routing
    const androidVersion = typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10);
    if (androidVersion >= 31) {
      if ((PermissionsAndroid.PERMISSIONS as any).BLUETOOTH_CONNECT) {
        permissions.push((PermissionsAndroid.PERMISSIONS as any).BLUETOOTH_CONNECT);
      }
      if ((PermissionsAndroid.PERMISSIONS as any).BLUETOOTH_SCAN) {
        permissions.push((PermissionsAndroid.PERMISSIONS as any).BLUETOOTH_SCAN);
      }
    }

    const statuses = await PermissionsAndroid.requestMultiple(permissions);

    const audioStatus = statuses[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
    const isAudioGranted = audioStatus === PermissionsAndroid.RESULTS.GRANTED;

    if (!isAudioGranted) {
      toast.error(
        'Please allow microphone access in your device settings to make and receive calls.',
        'Microphone Required',
      );
      return false;
    }

    if (isVideo) {
      const cameraStatus = statuses[PermissionsAndroid.PERMISSIONS.CAMERA];
      if (cameraStatus !== PermissionsAndroid.RESULTS.GRANTED) {
        toast.error(
          'Please allow camera access in your device settings for video calls.',
          'Camera Required',
        );
        return false;
      }
    }

    return true;
  } catch (error) {
    console.warn('[CALL_PERMISSIONS] Failed to request permissions:', error);
    return false;
  }
}
