import { create } from 'zustand';
import { apiClient, setOnAuthFailure, API_BASE_URL } from '../services/api-client';
import { SecureStorage } from '../services/secure-storage';

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
  isLoading: boolean;
  error: string | null;

  // Actions
  checkSession: () => Promise<void>;
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
        const response = await apiClient.get<SafeUser>('/auth/me', { timeout: 6000 });
        set({
          status: 'AUTHENTICATED',
          user: response.data,
          isLoading: false,
          error: null,
        });
      } catch (error: any) {
        // If /auth/me fails or times out, clear and set unauthenticated
        await SecureStorage.clearTokens();
        set({
          status: 'UNAUTHENTICATED',
          user: null,
          isLoading: false,
        });
      }
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
