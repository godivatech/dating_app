import { create } from 'zustand';
import { apiClient } from '../services/api-client';
import {
  SafeNotification,
  NotificationsListResponse,
  UnreadCountResponse,
  RegisterDeviceDto,
  DevicePlatform,
} from '../../../shared/src/types';

interface NotificationsState {
  notifications: SafeNotification[];
  unreadCount: number;
  isLoading: boolean;
  isFetchingMore: boolean;
  nextCursor: string | null;
  hasMore: boolean;
  error: string | null;

  fetchNotifications: (refresh?: boolean) => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  registerDeviceToken: (token: string, platform: DevicePlatform, deviceModel?: string) => Promise<void>;
  unregisterDeviceToken: (token: string) => Promise<void>;
  reset: () => void;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  isFetchingMore: false,
  nextCursor: null,
  hasMore: false,
  error: null,

  fetchNotifications: async (refresh = false) => {
    if (refresh) {
      set({ isLoading: true, error: null });
    } else {
      if (get().isLoading || get().isFetchingMore || (!get().hasMore && get().notifications.length > 0)) {
        return;
      }
      set({ isFetchingMore: true, error: null });
    }

    try {
      const cursor = refresh ? undefined : get().nextCursor || undefined;
      const res = await apiClient.get<NotificationsListResponse>('/notifications', {
        params: { cursor, limit: 20 },
      });

      set((state) => ({
        notifications: refresh
          ? res.data.notifications
          : [...state.notifications, ...res.data.notifications],
        unreadCount: res.data.unreadCount,
        nextCursor: res.data.nextCursor,
        hasMore: res.data.hasMore,
        isLoading: false,
        isFetchingMore: false,
      }));
    } catch (err: any) {
      set({
        isLoading: false,
        isFetchingMore: false,
        error: err.response?.data?.message || 'Failed to load notifications.',
      });
    }
  },

  fetchUnreadCount: async () => {
    try {
      const res = await apiClient.get<UnreadCountResponse>('/notifications/unread-count');
      set({ unreadCount: res.data.unreadCount });
    } catch {
      // Non-critical background counter update failure
    }
  },

  markAsRead: async (notificationId: string) => {
    // Optimistic UI update
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === notificationId ? { ...n, isRead: true } : n,
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));

    try {
      await apiClient.patch(`/notifications/${notificationId}/read`);
    } catch {
      // Re-fetch accurate count on error
      get().fetchUnreadCount();
    }
  },

  markAllAsRead: async () => {
    // Optimistic UI update
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    }));

    try {
      await apiClient.post('/notifications/read-all');
    } catch {
      get().fetchNotifications(true);
    }
  },

  registerDeviceToken: async (token: string, platform: DevicePlatform, deviceModel?: string) => {
    try {
      const payload: RegisterDeviceDto = { token, platform, deviceModel };
      await apiClient.post('/notifications/device-token', payload);
    } catch {
      // Ignore background push registration failures
    }
  },

  unregisterDeviceToken: async (token: string) => {
    try {
      await apiClient.delete('/notifications/device-token', { data: { token } });
    } catch {
      // Ignore background push unregistration failures
    }
  },

  reset: () => {
    set({
      notifications: [],
      unreadCount: 0,
      isLoading: false,
      isFetchingMore: false,
      nextCursor: null,
      hasMore: false,
      error: null,
    });
  },
}));
