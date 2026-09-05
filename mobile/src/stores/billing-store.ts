import { create } from 'zustand';
import { Platform } from 'react-native';
import { apiClient } from '../services/api-client';
import {
  SafeSubscriptionProduct,
  SafeUserSubscription,
  SafeUserEntitlement,
  BillingStatusResponse,
  VerifyPurchaseDto,
  VerifyPurchaseResponse,
  RestorePurchasesDto,
  RestorePurchasesResponse,
  EntitlementKey,
  DevicePlatform,
} from '../../../shared/src/types';

interface BillingState {
  products: SafeSubscriptionProduct[];
  billingStatus: BillingStatusResponse | null;
  entitlements: SafeUserEntitlement[];
  isLoading: boolean;
  isPurchasing: boolean;
  isRestoring: boolean;
  paywallVisible: boolean;
  paywallTriggerReason: string | null;
  error: string | null;

  // Actions
  fetchProducts: () => Promise<void>;
  fetchBillingStatus: () => Promise<void>;
  purchaseProduct: (storeProductId: string) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  cancelSubscription: () => Promise<boolean>;
  openPaywall: (reason?: string) => void;
  closePaywall: () => void;
  hasEntitlement: (key: EntitlementKey) => boolean;
}

export const useBillingStore = create<BillingState>((set, get) => ({
  products: [],
  billingStatus: null,
  entitlements: [],
  isLoading: false,
  isPurchasing: false,
  isRestoring: false,
  paywallVisible: false,
  paywallTriggerReason: null,
  error: null,

  fetchProducts: async () => {
    try {
      const response = await apiClient.get<SafeSubscriptionProduct[]>('/billing/products');
      set({ products: response.data });
    } catch (err: any) {
      console.warn('Failed to fetch billing products:', err.message);
    }
  },

  fetchBillingStatus: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.get<BillingStatusResponse>('/billing/status');
      set({
        billingStatus: response.data,
        entitlements: response.data.entitlements,
        isLoading: false,
      });
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to fetch billing status';
      set({
        error: Array.isArray(msg) ? msg[0] : msg,
        isLoading: false,
      });
    }
  },

  purchaseProduct: async (storeProductId: string) => {
    set({ isPurchasing: true, error: null });
    try {
      const currentPlatform: DevicePlatform =
        Platform.OS === 'ios' ? DevicePlatform.IOS : DevicePlatform.ANDROID;

      const payload: VerifyPurchaseDto = {
        platform: currentPlatform,
        storeProductId,
        receiptToken: `mock_receipt_token_${Date.now()}_${storeProductId}`,
        transactionId: `mock_tx_${Date.now()}`,
      };

      const response = await apiClient.post<VerifyPurchaseResponse>(
        '/billing/verify-purchase',
        payload,
      );

      if (response.data.success) {
        // Refresh billing status
        await get().fetchBillingStatus();
        set({ isPurchasing: false, paywallVisible: false, paywallTriggerReason: null });
        return true;
      }

      set({ isPurchasing: false, error: 'Purchase verification was unsuccessful.' });
      return false;
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Purchase failed.';
      set({
        error: Array.isArray(msg) ? msg[0] : msg,
        isPurchasing: false,
      });
      return false;
    }
  },

  restorePurchases: async () => {
    set({ isRestoring: true, error: null });
    try {
      const currentPlatform: DevicePlatform =
        Platform.OS === 'ios' ? DevicePlatform.IOS : DevicePlatform.ANDROID;

      const payload: RestorePurchasesDto = {
        platform: currentPlatform,
        receiptTokens: [`mock_restore_receipt_${Date.now()}`],
      };

      const response = await apiClient.post<RestorePurchasesResponse>(
        '/billing/restore-purchases',
        payload,
      );

      if (response.data.restored) {
        await get().fetchBillingStatus();
        set({ isRestoring: false, paywallVisible: false });
        return true;
      }

      set({ isRestoring: false, error: 'No previous active purchases found to restore.' });
      return false;
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Restore failed.';
      set({
        error: Array.isArray(msg) ? msg[0] : msg,
        isRestoring: false,
      });
      return false;
    }
  },

  cancelSubscription: async () => {
    set({ isLoading: true, error: null });
    try {
      await apiClient.post<SafeUserSubscription>('/billing/cancel');
      await get().fetchBillingStatus();
      set({ isLoading: false });
      return true;
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to cancel subscription.';
      set({
        error: Array.isArray(msg) ? msg[0] : msg,
        isLoading: false,
      });
      return false;
    }
  },

  openPaywall: (reason?: string) => {
    set({ paywallVisible: true, paywallTriggerReason: reason || null });
    // Proactively refresh products
    get().fetchProducts();
  },

  closePaywall: () => {
    set({ paywallVisible: false, paywallTriggerReason: null, error: null });
  },

  hasEntitlement: (key: EntitlementKey): boolean => {
    const { entitlements } = get();
    const now = new Date();
    return entitlements.some(
      (e) =>
        e.entitlementKey === key &&
        e.isActive &&
        (!e.expiresAt || new Date(e.expiresAt) > now),
    );
  },
}));
