import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Vibration,
  AppState,
  AppStateStatus,
} from 'react-native';
import { Stack, useRouter, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/theme/colors';
import { useAuthStore } from '../src/stores/auth-store';
import { useNotificationsStore } from '../src/stores/notifications-store';
import { useCallStore } from '../src/stores/call-store';
import { chatSocket } from '../src/services/chat-socket.service';
import { callSocket } from '../src/services/call-socket.service';
import { MatchCelebrationModal, MatchedUserInfo } from '../src/components/MatchCelebrationModal';

import { IncomingCallModal } from '../src/components/calling/IncomingCallModal';
import { ActiveCallModal } from '../src/components/calling/ActiveCallModal';
import { PaywallModal } from '../src/components/PaywallModal';
import { ScreenshotBlockedModal } from '../src/components/ScreenshotBlockedModal';
import { useSafetyStore } from '../src/stores/safety-store';
import { useBillingStore } from '../src/stores/billing-store';

import { setupAutoUpdateListener } from '../src/services/update.service';
import {
  initPushNotificationHandler,
  setupPushNotificationListeners,
  registerForPushNotificationsAsync,
} from '../src/services/push-notification.service';

// Initialize foreground notification handler (Zomato/Swiggy standard)
initPushNotificationHandler();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const checkSession = useAuthStore((state) => state.checkSession);
  const status = useAuthStore((state) => state.status);
  const isScreenshotModalVisible = useSafetyStore((state) => state.isScreenshotModalVisible);
  const hideScreenshotModal = useSafetyStore((state) => state.hideScreenshotModal);

  // Match celebration state
  const [matchCelebration, setMatchCelebration] = useState<{
    visible: boolean;
    matchedUser: MatchedUserInfo | null;
  }>({ visible: false, matchedUser: null });

  // In-app interactive notification toast state (Likes, Matches, Messages)
  const [inAppToast, setInAppToast] = useState<{
    visible: boolean;
    type: 'like' | 'message' | 'match';
    title: string;
    subtitle: string;
    route?: string;
  }>({ visible: false, type: 'like', title: '', subtitle: '' });

  const toastTranslateY = useRef(new Animated.Value(-120)).current;
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotificationToast = (
    type: 'like' | 'message' | 'match',
    title: string,
    subtitle: string,
    route?: string,
  ) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setInAppToast({ visible: true, type, title, subtitle, route });
    Animated.spring(toastTranslateY, {
      toValue: 0,
      friction: 6,
      tension: 40,
      useNativeDriver: true,
    }).start();

    toastTimeoutRef.current = setTimeout(() => {
      Animated.timing(toastTranslateY, {
        toValue: -120,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setInAppToast({ visible: false, type: 'like', title: '', subtitle: '' });
      });
    }, 4500);
  };

  useEffect(() => {
    // Check existing stored session on initial app boot
    checkSession();

    // Setup automatic background OTA updates (launch + app resume)
    const updateCleanup = setupAutoUpdateListener();

    // Setup push notification tap deep-linking & in-app badge updates
    const pushCleanup = setupPushNotificationListeners((route) => {
      try {
        router.push(route as any);
      } catch (e) {
        console.warn('Push navigation failed:', e);
      }
    });

    return () => {
      updateCleanup();
      pushCleanup();
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, [checkSession, router]);

  useEffect(() => {
    if (status === 'AUTHENTICATED') {
      // Register push notifications
      registerForPushNotificationsAsync();

      // Connect real-time WebSockets
      chatSocket.connect();
      useCallStore.getState().initCallSocket();

      // Hydrate billing status and coin wallet balance on startup
      useBillingStore.getState().fetchBillingStatus();
      useBillingStore.getState().fetchCreditBalance();

      // Listen for real-time incoming likes
      const unsubLike = chatSocket.onLikeReceived((data) => {
        try {
          Vibration.vibrate(35);
        } catch {}
        useNotificationsStore.getState().fetchUnreadCount();
        const title = data.hasNote ? 'New Note' : 'New Like';
        const subtitle = data.note
          ? `"${data.note.slice(0, 50)}${data.note.length > 50 ? '...' : ''}"`
          : `${data.actorDisplayName} liked your profile!`;
        showNotificationToast('like', title, subtitle, '/matches');
      });

      // Listen for real-time incoming messages
      const unsubMessage = chatSocket.onMessageCreated((data) => {
        const currentUserId = useAuthStore.getState().user?.id;
        // Strictly exclude own messages: check senderUserId and isMine flag
        const isFromMe =
          (currentUserId && data.message.senderUserId === currentUserId) ||
          data.message.senderUserId === 'me' ||
          data.message.isMine === true;

        if (isFromMe) {
          return; // Sender must NEVER receive a notification/toast/vibration for their own message!
        }

        // Do not display banner toast if user is already inside this specific chat screen
        const currentPath = pathnameRef.current || '';
        if (currentPath.includes(data.conversationId)) {
          return;
        }

        try {
          Vibration.vibrate([0, 60, 40, 60]);
        } catch {}
        useNotificationsStore.getState().fetchUnreadCount();
        const title = 'New Message';
        const subtitle = data.message.body?.slice(0, 60) || 'Sent you a message';
        showNotificationToast(
          'message',
          title,
          subtitle,
          `/chat/${data.conversationId}`,
        );
      });

      // Listen for real-time matches formed
      const unsubMatch = chatSocket.onMatchFormed((data) => {
        try {
          Vibration.vibrate([0, 60, 80, 120]);
        } catch {}
        setMatchCelebration({
          visible: true,
          matchedUser: data.matchedUser,
        });
      });

      // Listen for app coming to foreground (resuming from background / screen lock)
      const handleAppStateChange = (nextAppState: AppStateStatus) => {
        if (nextAppState === 'active') {
          console.log('[APP_LIFECYCLE] App active: verifying call and chat sockets...');
          callSocket.ensureConnected();
          chatSocket.ensureConnected();
          useBillingStore.getState().fetchBillingStatus();
          useBillingStore.getState().fetchCreditBalance();
        }
      };
      const appStateSub = AppState.addEventListener('change', handleAppStateChange);

      return () => {
        unsubLike();
        unsubMessage();
        unsubMatch();
        appStateSub.remove();
      };
    } else if (status === 'UNAUTHENTICATED') {
      chatSocket.disconnect();
      callSocket.disconnect();
    }
  }, [status]);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors.primary },
          }}
        />

        {/* Global In-App Notification Toast */}
        {inAppToast.visible && (
          <Animated.View
            style={[
              styles.toastBanner,
              { transform: [{ translateY: toastTranslateY }] },
            ]}
          >
            <TouchableOpacity
              style={styles.toastInner}
              activeOpacity={0.9}
              onPress={() => {
                const targetRoute = inAppToast.route || '/matches';
                setInAppToast({ visible: false, type: 'like', title: '', subtitle: '' });
                router.push(targetRoute as any);
              }}
            >
              <View
                style={[
                  styles.toastIconBox,
                  inAppToast.type === 'message' && { backgroundColor: '#E6F4FE' },
                ]}
              >
                <Ionicons
                  name={inAppToast.type === 'message' ? 'chatbubble-ellipses' : 'heart'}
                  size={18}
                  color={inAppToast.type === 'message' ? '#007AFF' : Colors.primary}
                />
              </View>
              <View style={styles.toastTextBox}>
                <Text style={styles.toastTitle}>{inAppToast.title}</Text>
                <Text style={styles.toastSubtitle} numberOfLines={1}>
                  {inAppToast.subtitle}
                </Text>
              </View>
              <Text
                style={[
                  styles.toastActionText,
                  inAppToast.type === 'message' && { color: '#007AFF' },
                ]}
              >
                {inAppToast.type === 'message' ? 'Reply' : 'View'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Celebratory Match Modal */}
        <MatchCelebrationModal
          visible={matchCelebration.visible}
          matchedUser={matchCelebration.matchedUser}
          onClose={() =>
            setMatchCelebration({ visible: false, matchedUser: null })
          }
        />

        <IncomingCallModal />
        <ActiveCallModal />
        <PaywallModal />
        <ScreenshotBlockedModal
          visible={isScreenshotModalVisible}
          onClose={hideScreenshotModal}
        />
        <StatusBar style="dark" />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  toastBanner: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 9999,
  },
  toastInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  toastIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  toastTextBox: {
    flex: 1,
    marginRight: 8,
  },
  toastTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  toastSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  toastActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
    marginLeft: 6,
  },
});

