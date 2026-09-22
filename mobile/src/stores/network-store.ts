import { create } from 'zustand';
import { API_BASE_URL } from '../services/api-client';

interface NetworkState {
  isConnected: boolean;
  isChecking: boolean;
  lastCheckedAt: number | null;
  setConnected: (connected: boolean) => void;
  checkConnection: () => Promise<boolean>;
}

export const useNetworkStore = create<NetworkState>((set, get) => ({
  isConnected: true,
  isChecking: false,
  lastCheckedAt: null,

  setConnected: (connected: boolean) => {
    if (get().isConnected !== connected) {
      set({ isConnected: connected, lastCheckedAt: Date.now() });
    }
  },

  checkConnection: async () => {
    set({ isChecking: true });
    try {
      // Direct quick ping to backend health check or lightweight public ping
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      // Extract root host from API_BASE_URL for fast ping
      const pingUrl = `${API_BASE_URL.replace(/\/api\/v1\/?$/, '')}/api/v1/health`;
      
      const response = await fetch(pingUrl, {
        method: 'HEAD',
        headers: { 'Cache-Control': 'no-cache' },
        signal: controller.signal,
      }).catch(async () => {
        // Fallback internet reachability check
        return await fetch('https://clients3.google.com/generate_204', {
          method: 'HEAD',
          headers: { 'Cache-Control': 'no-cache' },
          signal: controller.signal,
        });
      });

      clearTimeout(timeoutId);
      const isOnline = !!response && (response.status >= 200 && response.status < 400 || response.status === 204);
      set({ isConnected: isOnline, isChecking: false, lastCheckedAt: Date.now() });
      return isOnline;
    } catch {
      set({ isConnected: false, isChecking: false, lastCheckedAt: Date.now() });
      return false;
    }
  },
}));
