import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import Constants from 'expo-constants';
import { SecureStorage } from './secure-storage';

declare const process: { env: Record<string, string | undefined> };

const getApiBaseUrl = (): string => {
  if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL;
  }
  // Web browser context
  if (typeof window !== 'undefined' && (window as any).location?.hostname) {
    const hostname = (window as any).location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3000/api/v1';
    }
    return `http://${hostname}:3000/api/v1`;
  }
  // Mobile / Expo Go context
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ||
    (Constants as any).manifest?.debuggerHost;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) {
      return `http://${host}:3000/api/v1`;
    }
  }
  // Fallback to cloud production backend
  return 'https://dating-app-ez5c.onrender.com/api/v1';
};

export const API_BASE_URL = getApiBaseUrl();
console.log('🌐 [API Client] Base URL configured as:', API_BASE_URL);

// Main authenticated API client
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Bypass-Tunnel-Reminder': 'true',
  },
});

// Dedicated isolated client for refresh requests (No 401 interceptor to prevent infinite loops)
const refreshClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Bypass-Tunnel-Reminder': 'true',
  },
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

let onAuthFailureCallback: (() => void) | null = null;

export const setOnAuthFailure = (callback: () => void) => {
  onAuthFailureCallback = callback;
};

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

// 1. Request Interceptor: Attach Bearer Access Token
apiClient.interceptors.request.use(
  async (config) => {
    const token = await SecureStorage.getAccessToken();
    if (token && config.headers && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// 2. Response Interceptor: Mutex-Guarded Single-Flight 401 Refresh Queue
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    // Do not attempt refresh on auth endpoints (login, verify, refresh itself)
    const isAuthEndpoint =
      originalRequest?.url?.includes('/auth/otp/') ||
      originalRequest?.url?.includes('/auth/refresh');

    if (!error.response || error.response.status !== 401 || isAuthEndpoint) {
      return Promise.reject(error);
    }

    if (originalRequest._retry) {
      // Already retried once and still failed
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Another request is already performing a refresh; queue this request
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((newToken) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }
          return apiClient(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = await SecureStorage.getRefreshToken();

      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      // Execute single-flight refresh call using isolated client
      const response = await refreshClient.post('/auth/refresh', {
        refreshToken,
      });

      const { accessToken, refreshToken: newRefreshToken } = response.data;

      // Update stored tokens
      await SecureStorage.setAccessToken(accessToken);
      await SecureStorage.setRefreshToken(newRefreshToken);

      // Process queued requests
      processQueue(null, accessToken);

      // Retry original request
      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      }
      return apiClient(originalRequest);
    } catch (refreshError) {
      // Refresh failed: reject queued requests, clear storage, notify auth failure
      processQueue(refreshError, null);
      await SecureStorage.clearTokens();
      if (onAuthFailureCallback) {
        onAuthFailureCallback();
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);
