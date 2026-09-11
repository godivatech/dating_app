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
  UserCreditBalanceDto,
  ActivateBoostResponse,
  EntitlementKey,
  DevicePlatform,
} from '../../../shared/src/types';

export type PaywallTab = 'SUBSCRIPTIONS' | 'PACKS';
export type PaywallPackCategory = 'ALL' | 'DIRECT_NOTES' | 'BOOST' | 'CALL';

interface BillingState {
  products: SafeSubscriptionProduct[];
  billingStatus: BillingStatusResponse | null;
  entitlements: SafeUserEntitlement[];
  creditBalance: UserCreditBalanceDto | null;
  isLoading: boolean;
  isPurchasing: boolean;
  isRestoring: boolean;
  paywallVisible: boolean;
  paywallTriggerReason: string | null;
  paywallActiveTab: PaywallTab;
  paywallPackCategory: PaywallPackCategory;
  error: string | null;

  // Actions
  fetchProducts: () => Promise<void>;
  fetchBillingStatus: () => Promise<void>;
  fetchCreditBalance: () => Promise<void>;
  activateBoost: () => Promise<ActivateBoostResponse | null>;
  purchaseProduct: (storeProductId: string) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  cancelSubscription: () => Promise<boolean>;
  setPaywallActiveTab: (tab: PaywallTab) => void;
  setPaywallPackCategory: (category: PaywallPackCategory) => void;
  openPaywall: (reason?: string, packCategory?: PaywallPackCategory) => void;
  closePaywall: () => void;
  hasEntitlement: (key: EntitlementKey) => boolean;
}

export const useBillingStore = create<BillingState>((set, get) => ({
  products: [],
  billingStatus: null,
  entitlements: [],
  creditBalance: null,
  isLoading: false,
  isPurchasing: false,
  isRestoring: false,
  paywallVisible: false,
  paywallTriggerReason: null,
  paywallActiveTab: 'SUBSCRIPTIONS',
  paywallPackCategory: 'ALL',
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
        creditBalance: response.data.creditBalance || get().creditBalance,
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

  fetchCreditBalance: async () => {
    try {
      const response = await apiClient.get<UserCreditBalanceDto>('/billing/credits');
      set({ creditBalance: response.data });
    } catch (err: any) {
      console.warn('Failed to fetch credit balance:', err.message);
    }
  },

  activateBoost: async () => {
    try {
      const response = await apiClient.post<ActivateBoostResponse>('/discovery/boost/activate');
      if (response.data.success) {
        set((state) => ({
          creditBalance: state.creditBalance
            ? {
                ...state.creditBalance,
                profileBoosts: response.data.remainingBoosts,
                boostExpiresAt: response.data.expiresAt,
              }
            : null,
        }));
      }
      return response.data;
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to activate boost.';
      throw new Error(Array.isArray(msg) ? msg[0] : msg);
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
        // Refresh billing status and credit balance
        await get().fetchBillingStatus();
        await get().fetchCreditBalance();
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
        await get().fetchCreditBalance();
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

  setPaywallActiveTab: (tab: PaywallTab) => {
    set({ paywallActiveTab: tab });
  },

  setPaywallPackCategory: (category: PaywallPackCategory) => {
    set({ paywallPackCategory: category });
  },

  openPaywall: (
    reasonOrTab?: string,
    packCategory?: PaywallPackCategory,
  ) => {
    let tab: PaywallTab = 'SUBSCRIPTIONS';
    let cat: PaywallPackCategory = packCategory || 'ALL';

    if (reasonOrTab === 'DIRECT_NOTES' || reasonOrTab === 'direct_notes_exceeded') {
      tab = 'PACKS';
      cat = 'DIRECT_NOTES';
    } else if (reasonOrTab === 'BOOST' || reasonOrTab === 'profile_boost') {
      tab = 'PACKS';
      cat = 'BOOST';
    } else if (
      reasonOrTab === 'CALL' ||
      reasonOrTab === 'vibe_check_complete' ||
      reasonOrTab === 'call_pass'
    ) {
      tab = 'PACKS';
      cat = 'CALL';
    } else if (reasonOrTab === 'PACKS') {
      tab = 'PACKS';
    }

    set({
      paywallVisible: true,
      paywallTriggerReason: reasonOrTab || null,
      paywallActiveTab: tab,
      paywallPackCategory: cat,
    });
    // Proactively refresh products and credit balances
    get().fetchProducts();
    get().fetchCreditBalance();
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

