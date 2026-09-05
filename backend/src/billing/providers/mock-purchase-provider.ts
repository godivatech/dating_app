import { Injectable, Logger } from '@nestjs/common';
import { DevicePlatform, PaymentProvider, TransactionStatus } from '@prisma/client';
import {
  PurchaseProvider,
  VerifiedReceiptResult,
} from './purchase-provider.interface';

@Injectable()
export class MockPurchaseProvider implements PurchaseProvider {
  private readonly logger = new Logger(MockPurchaseProvider.name);

  async verifyReceipt(
    platform: DevicePlatform,
    storeProductId: string,
    receiptToken: string,
    transactionId?: string,
  ): Promise<VerifiedReceiptResult> {
    this.logger.log(
      `[MOCK_IAP_VERIFY] Verifying receipt for ${storeProductId} on ${platform}`,
    );

    if (receiptToken === 'invalid_token' || receiptToken === 'error_token') {
      return {
        isValid: false,
        provider: PaymentProvider.MOCK,
        platform,
        providerTransactionId: transactionId || `mock_tx_failed_${Date.now()}`,
        storeProductId,
        amount: 0,
        currency: 'INR',
        status: TransactionStatus.FAILED,
        errorMessage: 'Invalid or fraudulent receipt token provided.',
      };
    }

    if (receiptToken === 'revoked_token') {
      return {
        isValid: false,
        provider: PaymentProvider.MOCK,
        platform,
        providerTransactionId: transactionId || `mock_tx_revoked_${Date.now()}`,
        storeProductId,
        amount: 29900,
        currency: 'INR',
        status: TransactionStatus.REVOKED,
        errorMessage: 'Purchase was refunded or revoked by store.',
      };
    }

    const providerTransactionId =
      transactionId || `mock_tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Default duration 30 days for monthly, 90 days for quarterly, 365 for annual
    let durationDays = 30;
    if (storeProductId.includes('3m') || storeProductId.includes('quarterly')) {
      durationDays = 90;
    } else if (storeProductId.includes('1y') || storeProductId.includes('annual')) {
      durationDays = 365;
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    return {
      isValid: true,
      provider: PaymentProvider.MOCK,
      platform,
      providerTransactionId,
      originalTransactionId: providerTransactionId,
      storeProductId,
      amount: storeProductId.includes('gold') ? 69900 : 29900,
      currency: 'INR',
      status: TransactionStatus.COMPLETED,
      expiresAt,
      autoRenewing: true,
      rawPayload: {
        sandbox: true,
        receiptToken,
        verifiedAt: now.toISOString(),
      },
    };
  }

  async restorePurchases(
    platform: DevicePlatform,
    receiptTokens: string[],
  ): Promise<VerifiedReceiptResult[]> {
    this.logger.log(
      `[MOCK_IAP_RESTORE] Restoring ${receiptTokens.length} purchases for ${platform}`,
    );

    const results: VerifiedReceiptResult[] = [];
    for (const token of receiptTokens) {
      if (token && token !== 'invalid_token') {
        const verified = await this.verifyReceipt(
          platform,
          'com.sparkdating.plus.1m',
          token,
          `mock_restored_${token}`,
        );
        if (verified.isValid) {
          results.push(verified);
        }
      }
    }

    return results;
  }
}
