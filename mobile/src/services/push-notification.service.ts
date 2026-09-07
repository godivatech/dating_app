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
// Keep track of cached token in memory for clean unregistration on logout
let cachedPushToken: string | null = null;

/**
 * Configure Foreground Notification Presentation
 * Ensures notifications display banners, play custom sounds, and update badges
 * when the app is actively in use (Swiggy/Zomato behavior).
 */
export function initPushNotificationHandler(): void {
  if (Platform.OS === 'web') return;

  try {
    const Notifications = require('expo-notifications');
    if (Notifications?.setNotificationHandler) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
    }
  } catch (err: any) {
    console.log('[PUSH_HANDLER_INIT] Foreground notification handler init error:', err.message);
  }
}

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

    // Configure high-importance notification channels for Android (Zomato/Swiggy standard)
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
      cachedPushToken = token;
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

/**
 * Enterprise Push Notification Listeners & Deep Link Handler
 * - Listens for incoming notifications in foreground -> refreshes unread count badge.
 * - Listens for user taps/clicks on notifications -> routes directly to the chat/match.
 */
export function setupPushNotificationListeners(
  onNavigate?: (screenPath: string) => void,
): () => void {
  if (Platform.OS === 'web') return () => {};

  try {
    const Notifications = require('expo-notifications');
    if (!Notifications) return () => {};

    // 1. Foreground Notification Received Listener
    const receivedSubscription = Notifications.addNotificationReceivedListener(
      (notification: any) => {
        console.log('[PUSH_RECEIVED_FOREGROUND]', notification.request?.content?.title);
        // Synchronize in-app unread count badge
        useNotificationsStore.getState().fetchUnreadCount();
      },
    );

    // 2. Notification Response (Tap / Click / Lock screen action) Listener
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response: any) => {
        const data = response?.notification?.request?.content?.data;
        console.log('[PUSH_INTERACTION_TAPPED]', data);

        if (!onNavigate || !data) return;

        // Smart deep link routing (Zomato/Swiggy patterns)
        if (data.type === 'NEW_MATCH' && data.matchId) {
          onNavigate(`/chat/${data.matchId}`);
        } else if (data.type === 'NEW_MESSAGE' && data.conversationId) {
          onNavigate(`/chat/${data.conversationId}`);
        } else if (data.type === 'INCOMING_CALL') {
          onNavigate('/matches');
        } else if (data.type === 'SYSTEM' || data.type === 'SAFETY_WARNING') {
          onNavigate('/notifications');
        } else if (data.screen) {
          onNavigate(data.screen);
        }
      },
    );

    return () => {
      receivedSubscription?.remove();
      responseSubscription?.remove();
    };
  } catch (err: any) {
    console.log('[PUSH_LISTENERS_ERROR] Could not attach notification listeners:', err.message);
    return () => {};
  }
}

/**
 * Unregister device token upon user logout
 * Prevents privacy leaks and dead token accumulation.
 */
export async function unregisterForPushNotificationsAsync(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const Notifications = require('expo-notifications');
    if (Notifications?.setBadgeCountAsync) {
      await Notifications.setBadgeCountAsync(0);
    }

    if (cachedPushToken) {
      await useNotificationsStore.getState().unregisterDeviceToken(cachedPushToken);
      cachedPushToken = null;
    }
  } catch (err: any) {
    console.log('[PUSH_UNREGISTER_ERROR] Failed to unregister token on logout:', err.message);
  }
}
