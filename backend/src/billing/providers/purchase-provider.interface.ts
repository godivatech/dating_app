import { DevicePlatform, PaymentProvider, TransactionStatus } from '@prisma/client';

export interface VerifiedReceiptResult {
  isValid: boolean;
  provider: PaymentProvider;
  platform: DevicePlatform;
  providerTransactionId: string;
  originalTransactionId?: string;
  storeProductId: string;
  amount: number;
  currency: string;
  status: TransactionStatus;
  expiresAt?: Date;
  autoRenewing?: boolean;
  rawPayload?: any;
  errorMessage?: string;
}

export interface PurchaseProvider {
  /**
   * Validates a store receipt or purchase token.
   */
  verifyReceipt(
    platform: DevicePlatform,
    storeProductId: string,
    receiptToken: string,
    transactionId?: string,
  ): Promise<VerifiedReceiptResult>;

  /**
   * Restores historical purchases from platform tokens.
   */
  restorePurchases(
    platform: DevicePlatform,
    receiptTokens: string[],
  ): Promise<VerifiedReceiptResult[]>;
}

export const PURCHASE_PROVIDER = 'PURCHASE_PROVIDER';
