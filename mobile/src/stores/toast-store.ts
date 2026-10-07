import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'message' | 'like' | 'match';

export interface ToastConfig {
  id?: string;
  type: ToastType;
  title?: string;
  message: string;
  route?: string;
  duration?: number;
}

interface ToastState {
  toast: ToastConfig | null;
  showToast: (config: ToastConfig) => void;
  hideToast: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toast: null,
  showToast: (config) =>
    set({
      toast: {
        ...config,
        id: Date.now().toString(),
        duration: config.duration ?? 3500,
      },
    }),
  hideToast: () => set({ toast: null }),
}));

/**
 * Universal Toast Helper Functions
 * Can be called anywhere in both UI components and background handlers!
 */
export const toast = {
  success: (message: string, title?: string, route?: string) =>
    useToastStore.getState().showToast({
      type: 'success',
      title: title || 'Success',
      message,
      route,
    }),
  error: (message: string, title?: string) =>
    useToastStore.getState().showToast({
      type: 'error',
      title: title || 'Notice',
      message,
    }),
  info: (message: string, title?: string, route?: string) =>
    useToastStore.getState().showToast({
      type: 'info',
      title: title || 'Truelove',
      message,
      route,
    }),
  like: (title: string, message: string, route?: string) =>
    useToastStore.getState().showToast({
      type: 'like',
      title,
      message,
      route: route || '/matches',
    }),
  message: (title: string, message: string, route?: string) =>
    useToastStore.getState().showToast({
      type: 'message',
      title,
      message,
      route,
    }),
  hide: () => useToastStore.getState().hideToast(),
};
