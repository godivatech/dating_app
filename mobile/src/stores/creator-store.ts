import { create } from 'zustand';
import { giftService, ReceivedGiftItem } from '../services/gift.service';
import {
  GiftCatalogItem,
  CreatorWalletDto,
  CreatorPayoutRequestDto,
  GiftType,
} from '../../../shared/src/types';
import { useBillingStore } from './billing-store';

export interface GiftModalConfig {
  visible: boolean;
  receiverUserId: string;
  receiverName: string;
  conversationId?: string;
  callId?: string;
}

export interface GiftAnimationData {
  giftType: GiftType;
  displayName: string;
  icon: string;
  senderDisplayName: string;
  receiverDisplayName?: string;
  isSender?: boolean;
}

interface CreatorState {
  catalog: GiftCatalogItem[];
  wallet: CreatorWalletDto | null;
  payoutHistory: CreatorPayoutRequestDto[];
  receivedGifts: ReceivedGiftItem[];
  isLoading: boolean;
  isSending: boolean;
  isRequestingPayout: boolean;
  error: string | null;

  // Modals & Overlays
  giftModalConfig: GiftModalConfig | null;
  activeGiftAnimation: GiftAnimationData | null;

  // Actions
  fetchCatalog: () => Promise<void>;
  fetchWallet: () => Promise<void>;
  fetchPayoutHistory: () => Promise<void>;
  fetchReceivedGifts: () => Promise<void>;
  sendGift: (
    receiverUserId: string,
    giftType: GiftType,
    conversationId?: string,
    callId?: string,
  ) => Promise<{ success: boolean; remainingCoins?: number; error?: string }>;
  requestPayout: (
    amountInr: number,
    upiId: string,
  ) => Promise<{ success: boolean; error?: string }>;
  openGiftModal: (
    receiverUserId: string,
    receiverName: string,
    conversationId?: string,
    callId?: string,
  ) => void;
  closeGiftModal: () => void;
  triggerGiftAnimation: (data: GiftAnimationData) => void;
  triggerIncomingGiftAnimation: (data: GiftAnimationData & { creatorEarningInr?: number }) => void;
  dismissGiftAnimation: () => void;
}

export const useCreatorStore = create<CreatorState>((set, get) => ({
  catalog: [],
  wallet: null,
  payoutHistory: [],
  receivedGifts: [],
  isLoading: false,
  isSending: false,
  isRequestingPayout: false,
  error: null,

  giftModalConfig: null,
  activeGiftAnimation: null,

  fetchCatalog: async () => {
    try {
      const items = await giftService.getCatalog();
      set({ catalog: items });
    } catch (err: any) {
      console.warn('⚠️ [CreatorStore] Failed to fetch gift catalog:', err?.message);
    }
  },

  fetchWallet: async () => {
    try {
      set({ isLoading: true, error: null });
      const wallet = await giftService.getWallet();
      set({ wallet, isLoading: false });
    } catch (err: any) {
      set({ error: err?.response?.data?.message || err?.message, isLoading: false });
    }
  },

  fetchPayoutHistory: async () => {
    try {
      const history = await giftService.getPayoutHistory();
      set({ payoutHistory: history });
    } catch (err: any) {
      console.warn('⚠️ [CreatorStore] Failed to fetch payout history:', err?.message);
    }
  },

  fetchReceivedGifts: async () => {
    try {
      const gifts = await giftService.getGiftsReceived();
      set({ receivedGifts: gifts });
    } catch (err: any) {
      console.warn('⚠️ [CreatorStore] Failed to fetch received gifts:', err?.message);
    }
  },

  sendGift: async (receiverUserId, giftType, conversationId, callId) => {
    try {
      set({ isSending: true, error: null });
      const res = await giftService.sendGift({
        receiverUserId,
        giftType,
        conversationId,
        callId,
      });

      // Update local coin balance in billing store
      await useBillingStore.getState().fetchCreditBalance();

      set({ isSending: false });
      return { success: true, remainingCoins: res.remainingCoins };
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || err?.message || 'Failed to send gift';
      set({ isSending: false, error: msg });
      return { success: false, error: msg };
    }
  },

  requestPayout: async (amountInr, upiId) => {
    try {
      set({ isRequestingPayout: true, error: null });
      await giftService.requestPayout({ amountInr, upiId });
      // Refresh wallet & payout history
      await Promise.all([get().fetchWallet(), get().fetchPayoutHistory()]);
      set({ isRequestingPayout: false });
      return { success: true };
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || err?.message || 'Failed to request payout';
      set({ isRequestingPayout: false, error: msg });
      return { success: false, error: msg };
    }
  },

  openGiftModal: (receiverUserId, receiverName, conversationId, callId) => {
    set({
      giftModalConfig: {
        visible: true,
        receiverUserId,
        receiverName,
        conversationId,
        callId,
      },
    });
    // Ensure catalog is loaded
    if (get().catalog.length === 0) {
      get().fetchCatalog();
    }
  },

  closeGiftModal: () => {
    set({ giftModalConfig: null });
  },

  triggerGiftAnimation: (data) => {
    set({ activeGiftAnimation: data });
  },

  triggerIncomingGiftAnimation: (data) => {
    set({ activeGiftAnimation: data });
  },

  dismissGiftAnimation: () => {
    set({ activeGiftAnimation: null });
  },
}));
