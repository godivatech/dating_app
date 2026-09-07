import { Platform } from 'react-native';
import { DevicePlatform } from '../../../shared/src/types';
import { useNotificationsStore } from '../stores/notifications-store';

/**
 * Enterprise Push Notification Registration Service
 * Designed following Zomato/Swiggy patterns:
 * 1. Safe detection: Works gracefully whether running on Expo Go, physical Android, or iOS.
 * 2. Dynamic token capture without crashing if notifications package is optional.
 * 3. Automatic channel configuration (Vibration, High Priority, Heads-up popup).
 * 4. Syncs with backend `/notifications/device-token` on successful login.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Push notifications require a physical mobile device
  if (Platform.OS === 'web') {
    return null;
  }

  try {
    // Dynamically require expo-notifications if available to prevent bundle crashes
    let Notifications: any;
    try {
      Notifications = require('expo-notifications');
    } catch {
      console.log('[PUSH_REGISTRATION] expo-notifications module not present in current runtime.');
      return null;
    }

    if (!Notifications) return null;

    // Configure high-importance notification channel for Android (Zomato/Swiggy standard)
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Dating App Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF2D55',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });

      await Notifications.setNotificationChannelAsync('matches', {
        name: 'New Matches & Likes',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 200, 100, 200],
        lightColor: '#FF2D55',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });

      await Notifications.setNotificationChannelAsync('messages', {
        name: 'Chat Messages',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 150, 100, 150],
        lightColor: '#FF2D55',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
    }

    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[PUSH_REGISTRATION] User did not grant push notification permission.');
      return null;
    }

    // Get Expo Push Token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'd4c09e6f-f682-43c9-a1b4-86cb8a7c5f58',
    });

    const token = tokenData?.data;
    if (token) {
      console.log('[PUSH_REGISTRATION] Successfully acquired push token:', token);
      const platform = Platform.OS === 'ios' ? DevicePlatform.IOS : DevicePlatform.ANDROID;
      
      // Register with backend
      await useNotificationsStore.getState().registerDeviceToken(token, platform);
      return token;
    }
  } catch (error: any) {
    console.warn('[PUSH_REGISTRATION] Failed to register push token:', error.message);
  }

  return null;
}
