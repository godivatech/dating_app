import { create } from 'zustand';
import { apiClient, setOnAuthFailure, API_BASE_URL } from '../services/api-client';
import { SecureStorage } from '../services/secure-storage';
import { unregisterForPushNotificationsAsync } from '../services/push-notification.service';

export type AuthStatus =
  | 'IDLE'
  | 'CHECKING_SESSION'
  | 'AUTHENTICATED'
  | 'UNAUTHENTICATED'
  | 'VERIFYING';

export interface SafeUser {
  id: string;
  phoneNumber: string;
  phoneVerifiedAt: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'DEACTIVATED';
  createdAt: string;
  lastLoginAt: string | null;
}

interface AuthState {
  status: AuthStatus;
  user: SafeUser | null;
  challengeId: string | null;
  pendingPhone: string | null;
  expiresIn: number | null;
  isNewUser: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  checkSession: () => Promise<void>;
  checkPhone: (phoneNumber: string) => Promise<{ exists: boolean; hasPin: boolean }>;
  loginWithPin: (phoneNumber: string, pin: string) => Promise<boolean>;
  deleteAccount: (reason?: string) => Promise<boolean>;
  requestOtp: (phoneNumber: string) => Promise<boolean>;
  verifyOtp: (otp: string) => Promise<boolean>;
  quickLogin: (phoneNumber: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
  resetToUnauthenticated: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => {
  // Wire up the API client failure callback to auto-reset auth state on refresh failure
  setOnAuthFailure(() => {
    set({
      status: 'UNAUTHENTICATED',
      user: null,
      challengeId: null,
      pendingPhone: null,
      error: 'Session expired. Please log in again.',
    });
  });

  return {
    status: 'IDLE',
    user: null,
    challengeId: null,
    pendingPhone: null,
    expiresIn: null,
    isNewUser: false,
    isLoading: false,
    error: null,

    checkSession: async () => {
      set({ status: 'CHECKING_SESSION', isLoading: true, error: null });

      const token = await SecureStorage.getAccessToken();
      const refreshToken = await SecureStorage.getRefreshToken();

      if (!token && !refreshToken) {
        set({ status: 'UNAUTHENTICATED', user: null, isLoading: false });
        return;
      }

      try {
        const response = await apiClient.get<SafeUser>('/auth/me', { timeout: 15000 });
        set({
          status: 'AUTHENTICATED',
          user: response.data,
          isLoading: false,
          error: null,
        });
      } catch (error: any) {
        // ONLY clear tokens if the backend explicitly returned a 401 Unauthorized (refresh failed/invalid)
        if (error.response?.status === 401) {
          console.warn('[AUTH_CHECK] Unauthorized session (401); clearing stored tokens');
          await SecureStorage.clearTokens();
          set({
            status: 'UNAUTHENTICATED',
            user: null,
            isLoading: false,
          });
        } else {
          // If offline / network error / timeout, KEEP the user logged in!
          console.warn('[AUTH_CHECK] Network or offline during session check. Preserving session:', error.message);
          set({
            status: 'AUTHENTICATED',
            user: get().user || {
              id: 'cached_user',
              phoneNumber: '',
              phoneVerifiedAt: null,
              status: 'ACTIVE',
              createdAt: new Date().toISOString(),
              lastLoginAt: new Date().toISOString(),
            },
            isLoading: false,
            error: null,
          });
        }
      }
    },

    checkPhone: async (phoneNumber: string) => {
      set({ isLoading: true, error: null });
      try {
        const response = await apiClient.post<{ exists: boolean; hasPin: boolean }>(
          '/auth/check-phone',
          { phoneNumber },
        );
        const isNew = !response.data.exists || !response.data.hasPin;
        set({
          pendingPhone: phoneNumber,
          isNewUser: isNew,
          isLoading: false,
          error: null,
        });
        return response.data;
      } catch (err: any) {
        const message =
          err.response?.data?.message ||
          (err.message === 'Network Error' || err.code === 'ECONNABORTED'
            ? `Unable to connect to server at ${API_BASE_URL}. Please check your connection.`
            : 'Failed to verify phone number. Please try again.');
        set({
          error: typeof message === 'string' ? message : message[0],
          isLoading: false,
        });
        throw err;
      }
    },

    loginWithPin: async (phoneNumber: string, pin: string) => {
      set({ isLoading: true, error: null });
      try {
        const response = await apiClient.post<{
          user: SafeUser;
          accessToken: string;
          refreshToken: string;
          expiresIn: number;
        }>('/auth/pin-login', {
          phoneNumber,
          pin,
        });

        const { user, accessToken, refreshToken } = response.data;
        await SecureStorage.setAccessToken(accessToken);
        await SecureStorage.setRefreshToken(refreshToken);

        set({
          status: 'AUTHENTICATED',
          user,
          challengeId: null,
          pendingPhone: null,
          isLoading: false,
          error: null,
        });
        return true;
      } catch (err: any) {
        const message =
          err.response?.data?.message ||
          (err.message === 'Network Error'
            ? 'Unable to connect to server. Please check your internet connection.'
            : 'Incorrect security PIN. Please try again.');
        set({
          error: typeof message === 'string' ? message : message[0],
          isLoading: false,
        });
        return false;
      }
    },

    deleteAccount: async (reason?: string) => {
      set({ isLoading: true });
      try {
        await apiClient.delete('/profile/me', { data: { reason } });
      } catch (err: any) {
        console.warn('Backend deletion call warning:', err.message);
      } finally {
        await get().logout();
      }
      return true;
    },

    requestOtp: async (phoneNumber: string) => {
      set({ isLoading: true, error: null });

      try {
        const response = await apiClient.post<{ challengeId: string; expiresIn: number }>(
          '/auth/otp/request',
          { phoneNumber },
        );

        set({
          challengeId: response.data.challengeId,
          pendingPhone: phoneNumber,
          expiresIn: response.data.expiresIn,
          status: 'VERIFYING',
          isLoading: false,
          error: null,
        });
        return true;
      } catch (error: any) {
        const message =
          error.response?.data?.message ||
          (error.message === 'Network Error' || error.code === 'ECONNABORTED'
            ? `Unable to connect to server at ${API_BASE_URL}. Please check your connection and ensure the backend is running.`
            : 'Failed to request OTP. Please try again.');

        set({
          error: typeof message === 'string' ? message : message[0],
          isLoading: false,
        });
        return false;
      }
    },

    verifyOtp: async (otp: string) => {
      const { challengeId } = get();
      if (!challengeId) {
        set({ error: 'No active OTP challenge found. Please request a new OTP.' });
        return false;
      }

      set({ isLoading: true, error: null });

      try {
        const response = await apiClient.post<{
          user: SafeUser;
          accessToken: string;
          refreshToken: string;
          expiresIn: number;
        }>('/auth/otp/verify', {
          challengeId,
          otp,
        });

        const { user, accessToken, refreshToken } = response.data;

        // Securely persist tokens
        await SecureStorage.setAccessToken(accessToken);
        await SecureStorage.setRefreshToken(refreshToken);

        set({
          status: 'AUTHENTICATED',
          user,
          challengeId: null,
          pendingPhone: null,
          isLoading: false,
          error: null,
        });
        return true;
      } catch (error: any) {
        const message =
          error.response?.data?.message ||
          (error.message === 'Network Error'
            ? 'Unable to connect to server. Please check your internet connection.'
            : 'Invalid or expired OTP. Please try again.');

        set({
          error: typeof message === 'string' ? message : message[0],
          isLoading: false,
        });
        return false;
      }
    },

    quickLogin: async (phoneNumber: string) => {
      set({ isLoading: true, error: null });

      try {
        let res: any;
        try {
          res = await apiClient.post<{
            user: SafeUser;
            accessToken: string;
            refreshToken: string;
            expiresIn: number;
          }>('/auth/dev-login', { phoneNumber });
        } catch (devErr: any) {
          // Fallback to OTP challenge + auto-verify 123456
          const otpReq = await apiClient.post<{ challengeId: string; expiresIn: number }>(
            '/auth/otp/request',
            { phoneNumber },
          );
          res = await apiClient.post<{
            user: SafeUser;
            accessToken: string;
            refreshToken: string;
            expiresIn: number;
          }>('/auth/otp/verify', {
            challengeId: otpReq.data.challengeId,
            otp: '123456',
          });
        }

        const { user, accessToken, refreshToken } = res.data;

        // Securely persist tokens
        await SecureStorage.setAccessToken(accessToken);
        await SecureStorage.setRefreshToken(refreshToken);

        set({
          status: 'AUTHENTICATED',
          user,
          challengeId: null,
          pendingPhone: null,
          isLoading: false,
          error: null,
        });
        return true;
      } catch (error: any) {
        const message =
          error.response?.data?.message ||
          (error.message === 'Network Error'
            ? 'Unable to connect to server. Please ensure backend is running.'
            : 'Direct login failed. Please try again.');

        set({
          error: typeof message === 'string' ? message : message[0],
          isLoading: false,
        });
        return false;
      }
    },

    logout: async () => {
      set({ isLoading: true });
      try {
        await unregisterForPushNotificationsAsync();
        await apiClient.post('/auth/logout');
      } catch {
        // Continue with client-side cleanup regardless of network status
      } finally {
        await SecureStorage.clearTokens();
        set({
          status: 'UNAUTHENTICATED',
          user: null,
          challengeId: null,
          pendingPhone: null,
          isLoading: false,
          error: null,
        });
      }
    },

    clearError: () => set({ error: null }),

    resetToUnauthenticated: () => {
      set({
        status: 'UNAUTHENTICATED',
        user: null,
        challengeId: null,
        pendingPhone: null,
        error: null,
        isLoading: false,
      });
    },
  };
});
