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
 * Configure Android Notification Channels for Heads-Up Floating Banners
 * Following Tinder, Bumble, Anbe, and FRND system designs:
 * - Importance MUST be MAX (Level 5) to peek over other active apps (YouTube, Instagram, WhatsApp).
 * - Lockscreen visibility MUST be PUBLIC so user can preview their match on lockscreen.
 * - Vibration pattern and sound MUST be active for OS heads-up triggering.
 */
export async function setupNotificationChannelsAsync(NotificationsModule?: any): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    const Notifications = NotificationsModule || require('expo-notifications');
    if (!Notifications?.setNotificationChannelAsync) return;

    // 1. Chat Messages -> IMPORTANCE_MAX (Floating Heads-Up Popup)
    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Chat Messages',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 200, 100, 200],
      lightColor: '#FD5D65',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: false,
      enableLights: true,
    });

    // 2. New Matches & Likes -> IMPORTANCE_MAX (Floating Heads-Up Popup)
    await Notifications.setNotificationChannelAsync('matches', {
      name: 'New Matches & Likes',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FD5D65',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: false,
      enableLights: true,
    });

    // 3. General & System Updates -> IMPORTANCE_MAX
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Dating App Notifications',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FD5D65',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: false,
      enableLights: true,
    });

    console.log('[PUSH_CHANNELS] Android heads-up notification channels configured with IMPORTANCE_MAX');
  } catch (err: any) {
    console.log('[PUSH_CHANNELS_ERROR] Failed to configure Android channels:', err.message);
  }
}

/**
 * Configure Foreground Notification Presentation
 * Ensures notifications display banners, play custom sounds, and update badges
 * when the app is actively in use (Tinder/FRND behavior).
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

    // Pre-register Android channels at app launch so incoming background notifications
    // always find the MAX-importance channel registered in Android OS
    if (Platform.OS === 'android') {
      setupNotificationChannelsAsync(Notifications).catch((e) =>
        console.log('[PUSH_CHANNELS_BOOT_ERR]', e.message),
      );
    }
  } catch (err: any) {
    console.log('[PUSH_HANDLER_INIT] Foreground notification handler init error:', err.message);
  }
}

/**
 * Enterprise Push Notification Registration Service
 * Designed following Zomato/Swiggy/Tinder patterns:
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

    // Configure MAX-importance notification channels for Android heads-up peeking
    if (Platform.OS === 'android') {
      await setupNotificationChannelsAsync(Notifications);
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
 * Helper to dispatch smart deep-link navigation based on notification payload
 * Matches Tinder & Bumble patterns:
 * - NEW_MESSAGE: Opens directly into the specific chat room (/chat/[conversationId])
 * - NEW_MATCH: Opens the Matches screen (/matches) to see the celebratory match card
 * - LIKE_RECEIVED / DIRECT_NOTE: Opens Matches screen (/matches)
 * - FRESH_FEED: Opens Discovery swipe deck (/discovery)
 * - INCOMPLETE_PROFILE: Opens Profile editor (/profile)
 * - SAFETY / SYSTEM: Opens Notifications inbox (/notifications)
 */
function handleNotificationNavigation(
  data: any,
  onNavigate?: (screenPath: string) => void,
): void {
  if (!onNavigate || !data) return;

  // 1. New Message or Unreplied Chat reminder -> Direct Chat Room
  if (data.type === 'NEW_MESSAGE' || data.conversationId) {
    const conversationId = data.conversationId || data.referenceId;
    if (conversationId) {
      console.log('[PUSH_NAV] Navigating directly to chat:', `/chat/${conversationId}`);
      onNavigate(`/chat/${conversationId}`);
      return;
    }
  }

  // 2. New Match or Direct Note -> Matches Tab
  if (data.type === 'NEW_MATCH' || data.type === 'DIRECT_NOTE' || data.matchId) {
    console.log('[PUSH_NAV] Navigating to matches screen');
    onNavigate('/matches');
    return;
  }

  // 3. Like Received or Pending Likes Campaign -> Matches Tab
  if (data.type === 'LIKE_RECEIVED' || data.campaign === 'PENDING_LIKES') {
    console.log('[PUSH_NAV] Navigating to likes/matches');
    onNavigate('/matches');
    return;
  }

  // 4. Fresh Feed / Discovery Campaign -> Discovery Swipe Deck
  if (data.campaign === 'FRESH_FEED' || data.screen === '/discovery') {
    console.log('[PUSH_NAV] Navigating to discovery feed');
    onNavigate('/discovery');
    return;
  }

  // 5. Incomplete Profile Nudge -> Profile Editor
  if (data.campaign === 'INCOMPLETE_PROFILE' || data.screen === '/profile') {
    console.log('[PUSH_NAV] Navigating to profile');
    onNavigate('/profile');
    return;
  }

  // 6. Incoming Call -> Matches screen
  if (data.type === 'INCOMING_CALL') {
    onNavigate('/matches');
    return;
  }

  // 7. Explicit screen specified in payload
  if (data.screen) {
    onNavigate(data.screen);
    return;
  }

  // 8. General / Safety / System notifications
  if (data.type === 'SYSTEM' || data.type === 'SAFETY_WARNING' || data.type === 'SAFETY_UPDATE') {
    onNavigate('/notifications');
    return;
  }

  // Default fallback
  onNavigate('/matches');
}

/**
 * Enterprise Push Notification Listeners & Deep Link Handler
 * - Listens for incoming notifications in foreground -> refreshes unread count badge.
 * - Listens for user taps/clicks on notifications -> routes directly to the chat/match.
 * - Handles COLD START taps when the app was completely killed/closed!
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

    // 2. Notification Response (Tap / Click / Lock screen action) Listener (Warm start)
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response: any) => {
        const data = response?.notification?.request?.content?.data;
        console.log('[PUSH_INTERACTION_TAPPED]', data);
        handleNotificationNavigation(data, onNavigate);
      },
    );

    // 3. Cold Start Notification Tap Listener (When app was completely closed/killed)
    if (Notifications.getLastNotificationResponseAsync) {
      Notifications.getLastNotificationResponseAsync()
        .then((response: any) => {
          if (response) {
            const data = response.notification?.request?.content?.data;
            console.log('[PUSH_INTERACTION_COLD_START]', data);
            if (data && onNavigate) {
              // Give root router a brief moment to finish mounting before pushing the route
              setTimeout(() => {
                handleNotificationNavigation(data, onNavigate);
              }, 400);
            }
          }
        })
        .catch((e: any) => {
          console.log('[PUSH_COLD_START_ERR]', e.message);
        });
    }

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
