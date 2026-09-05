import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS_TOKEN_KEY = 'dating_app_access_token';
const REFRESH_TOKEN_KEY = 'dating_app_refresh_token';

export class SecureStorage {
  /**
   * Retrieves the access token from SecureStore (or localStorage on Web).
   */
  static async getAccessToken(): Promise<string | null> {
    if (Platform.OS === 'web') {
      try {
        return typeof localStorage !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null;
      } catch {
        return null;
      }
    }
    try {
      return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    } catch (error) {
      return null;
    }
  }

  /**
   * Persists the access token to SecureStore (or localStorage on Web).
   */
  static async setAccessToken(token: string): Promise<boolean> {
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
      return false;
    }
  }

  /**
   * Retrieves the opaque refresh token from SecureStore (or localStorage on Web).
   */
  static async getRefreshToken(): Promise<string | null> {
    if (Platform.OS === 'web') {
      try {
        return typeof localStorage !== 'undefined' ? localStorage.getItem(REFRESH_TOKEN_KEY) : null;
      } catch {
        return null;
      }
    }
    try {
      return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    } catch (error) {
      return null;
    }
  }

  /**
   * Persists the opaque refresh token to SecureStore (or localStorage on Web).
   */
  static async setRefreshToken(token: string): Promise<boolean> {
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
      return false;
    }
  }

  /**
   * Clears both access and refresh tokens from SecureStore (or localStorage on Web).
   */
  static async clearTokens(): Promise<void> {
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
