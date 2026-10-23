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
    if (get().isChecking) return get().isConnected;
    set({ isChecking: true });

    // 1. Primary Check: Direct public internet reachability (Google 204)
    try {
      const googleController = new AbortController();
      const googleTimeout = setTimeout(() => googleController.abort(), 5000);

      const googleRes = await fetch('https://www.google.com/generate_204', {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
        signal: googleController.signal,
      });

      clearTimeout(googleTimeout);

      if (googleRes && (googleRes.status === 204 || (googleRes.status >= 200 && googleRes.status < 400))) {
        set({ isConnected: true, isChecking: false, lastCheckedAt: Date.now() });
        return true;
      }
    } catch {
      // Continue to secondary check if Google ping failed
    }

    // 2. Secondary Check: Cloudflare DNS / CDN Trace
    try {
      const cfController = new AbortController();
      const cfTimeout = setTimeout(() => cfController.abort(), 5000);

      const cfRes = await fetch('https://1.1.1.1/cdn-cgi/trace', {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
        signal: cfController.signal,
      });

      clearTimeout(cfTimeout);

      if (cfRes && cfRes.status >= 200 && cfRes.status < 400) {
        set({ isConnected: true, isChecking: false, lastCheckedAt: Date.now() });
        return true;
      }
    } catch {
      // Continue to backend health check
    }

    // 3. Tertiary Check: Backend Health Check
    try {
      const backendController = new AbortController();
      const backendTimeout = setTimeout(() => backendController.abort(), 6000);
      const pingUrl = `${API_BASE_URL.replace(/\/api\/v1\/?$/, '')}/api/v1/health`;

      const backendRes = await fetch(pingUrl, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
        signal: backendController.signal,
      });

      clearTimeout(backendTimeout);

      if (backendRes && backendRes.status >= 200 && backendRes.status < 400) {
        set({ isConnected: true, isChecking: false, lastCheckedAt: Date.now() });
        return true;
      }
    } catch {
      // Backend check failed
    }

    // Only if all three global & backend checks fail is the device truly offline
    set({ isConnected: false, isChecking: false, lastCheckedAt: Date.now() });
    return false;
  },
}));
