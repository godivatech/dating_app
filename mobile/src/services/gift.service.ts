import { apiClient } from './api-client';
import {
  GiftCatalogItem,
  SendGiftResponseDto,
  CreatorWalletDto,
  CreatorPayoutRequestDto,
  GiftType,
} from '../../../shared/src/types';

export interface SendGiftPayload {
  receiverUserId: string;
  giftType: GiftType;
  conversationId?: string;
  callId?: string;
}

export interface RequestPayoutPayload {
  amountInr: number;
  upiId: string;
}

export interface ReceivedGiftItem {
  id: string;
  giftType: GiftType;
  senderDisplayName: string;
  senderAvatarUrl: string | null;
  creatorEarningInr: number;
  createdAt: string;
}

export const giftService = {
  /**
   * Retrieves the catalog of all available virtual gifts.
   */
  async getCatalog(): Promise<GiftCatalogItem[]> {
    const response = await apiClient.get<GiftCatalogItem[]>('/gifts/catalog');
    return response.data;
  },

  /**
   * Sends a virtual gift to another user.
   */
  async sendGift(payload: SendGiftPayload): Promise<SendGiftResponseDto> {
    const response = await apiClient.post<SendGiftResponseDto>('/gifts/send', payload);
    return response.data;
  },

  /**
   * Retrieves creator wallet balance and total earnings.
   */
  async getWallet(): Promise<CreatorWalletDto> {
    const response = await apiClient.get<CreatorWalletDto>('/gifts/wallet');
    return response.data;
  },

  /**
   * Submits a withdrawal request to creator UPI ID.
   */
  async requestPayout(payload: RequestPayoutPayload): Promise<CreatorPayoutRequestDto> {
    const response = await apiClient.post<CreatorPayoutRequestDto>('/gifts/payout', payload);
    return response.data;
  },

  /**
   * Retrieves creator payout history.
   */
  async getPayoutHistory(limit = 20): Promise<CreatorPayoutRequestDto[]> {
    const response = await apiClient.get<CreatorPayoutRequestDto[]>('/gifts/payouts', {
      params: { limit },
    });
    return response.data;
  },

  /**
   * Retrieves gifts received by the user.
   */
  async getGiftsReceived(limit = 20): Promise<ReceivedGiftItem[]> {
    const response = await apiClient.get<ReceivedGiftItem[]>('/gifts/received', {
      params: { limit },
    });
    return response.data;
  },
};
