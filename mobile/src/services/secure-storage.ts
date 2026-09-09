import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS_TOKEN_KEY = 'dating_app_access_token';
const REFRESH_TOKEN_KEY = 'dating_app_refresh_token';

let memoryAccessToken: string | null = null;
let memoryRefreshToken: string | null = null;

export class SecureStorage {
  /**
   * Retrieves the access token from memory cache, then SecureStore (or localStorage on Web).
   */
  static async getAccessToken(): Promise<string | null> {
    if (memoryAccessToken) {
      return memoryAccessToken;
    }

    if (Platform.OS === 'web') {
      try {
        const token = typeof localStorage !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null;
        if (token) memoryAccessToken = token;
        return token;
      } catch {
        return null;
      }
    }

    try {
      let token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
      // Fallback retry for older Android devices with slower KeyStore initialization
      if (!token) {
        token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
      }
      if (token) {
        memoryAccessToken = token;
      }
      return token;
    } catch (error) {
      console.warn('[SecureStorage] Error getting access token:', error);
      return memoryAccessToken;
    }
  }

  /**
   * Persists the access token to memory cache and SecureStore (or localStorage on Web).
   */
  static async setAccessToken(token: string): Promise<boolean> {
    memoryAccessToken = token;

    if (Platform.OS === 'web') {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(ACCESS_TOKEN_KEY, token);
        }
        return true;
      } catch {
        return false;
      }
    }
    try {
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
      return true;
    } catch (error) {
      console.warn('[SecureStorage] Error setting access token:', error);
      return true; // Still preserved in memory
    }
  }

  /**
   * Retrieves the opaque refresh token from memory cache, then SecureStore (or localStorage on Web).
   */
  static async getRefreshToken(): Promise<string | null> {
    if (memoryRefreshToken) {
      return memoryRefreshToken;
    }

    if (Platform.OS === 'web') {
      try {
        const token = typeof localStorage !== 'undefined' ? localStorage.getItem(REFRESH_TOKEN_KEY) : null;
        if (token) memoryRefreshToken = token;
        return token;
      } catch {
        return null;
      }
    }

    try {
      let token = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      // Fallback retry for older Android devices with slower KeyStore initialization
      if (!token) {
        token = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      }
      if (token) {
        memoryRefreshToken = token;
      }
      return token;
    } catch (error) {
      console.warn('[SecureStorage] Error getting refresh token:', error);
      return memoryRefreshToken;
    }
  }

  /**
   * Persists the opaque refresh token to memory cache and SecureStore (or localStorage on Web).
   */
  static async setRefreshToken(token: string): Promise<boolean> {
    memoryRefreshToken = token;

    if (Platform.OS === 'web') {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(REFRESH_TOKEN_KEY, token);
        }
        return true;
      } catch {
        return false;
      }
    }
    try {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
      return true;
    } catch (error) {
      console.warn('[SecureStorage] Error setting refresh token:', error);
      return true; // Still preserved in memory
    }
  }

  /**
   * Clears both access and refresh tokens from memory cache and SecureStore (or localStorage on Web).
   */
  static async clearTokens(): Promise<void> {
    memoryAccessToken = null;
    memoryRefreshToken = null;

    if (Platform.OS === 'web') {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(ACCESS_TOKEN_KEY);
          localStorage.removeItem(REFRESH_TOKEN_KEY);
        }
      } catch {}
      return;
    }
    try {
      await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    } catch {}

    try {
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    } catch {}
  }
}
