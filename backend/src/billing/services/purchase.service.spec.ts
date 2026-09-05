import { PurchaseService } from './purchase.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionService } from './subscription.service';
import { EntitlementService } from './entitlement.service';
import { PurchaseProvider } from '../providers/purchase-provider.interface';
import {
  SubscriptionTier,
  TransactionStatus,
  DevicePlatform,
  PaymentProvider,
  EntitlementKey,
  BillingPeriod,
} from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('PurchaseService', () => {
  let service: PurchaseService;
  let mockPrisma: any;
  let mockSubscription: any;
  let mockEntitlement: any;
  let mockProvider: any;

  const mockProduct = {
    id: 'prod-plus',
    productKey: 'SPARK_PLUS_1M',
    displayName: 'Spark Plus (1 Month)',
    tier: SubscriptionTier.PLUS,
    platform: DevicePlatform.IOS,
    storeProductId: 'com.sparkdating.plus.1m',
    currency: 'INR',
    priceAmount: 29900,
    billingPeriod: BillingPeriod.MONTHLY,
    isActive: true,
  };

  beforeEach(() => {
    mockPrisma = {
      purchaseTransaction: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'tx-1',
          userId: 'user-1',
          status: TransactionStatus.COMPLETED,
        }),
      },
      subscriptionProduct: {
        findFirst: jest.fn().mockResolvedValue(mockProduct),
      },
      userSubscription: {
        create: jest.fn().mockResolvedValue({
          id: 'sub-1',
          userId: 'user-1',
          productId: 'prod-plus',
          product: mockProduct,
          startedAt: new Date(),
          expiresAt: new Date(Date.now() + 30 * 86400000),
          autoRenewing: true,
          lastVerifiedAt: new Date(),
        }),
      },
      $transaction: jest.fn().mockImplementation((callback) => callback(mockPrisma)),
    };

    mockSubscription = {
      getActiveSubscription: jest.fn(),
      mapToSafeSubscription: jest.fn().mockImplementation((s) => ({
        id: s.id,
        productId: s.productId,
        product: mockProduct,
      })),
    };

    mockEntitlement = {
      grantEntitlement: jest.fn().mockResolvedValue({ id: 'ent-1' }),
      getUserEntitlements: jest.fn().mockResolvedValue([]),
    };

    mockProvider = {
      verifyReceipt: jest.fn().mockResolvedValue({
        isValid: true,
        provider: PaymentProvider.MOCK,
        platform: DevicePlatform.IOS,
        providerTransactionId: 'tx-store-123',
        storeProductId: 'com.sparkdating.plus.1m',
        amount: 29900,
        currency: 'INR',
        status: TransactionStatus.COMPLETED,
        expiresAt: new Date(Date.now() + 30 * 86400000),
        autoRenewing: true,
      }),
      restorePurchases: jest.fn(),
    };

    service = new PurchaseService(
      mockPrisma as PrismaService,
      mockSubscription as SubscriptionService,
      mockEntitlement as EntitlementService,
      mockProvider as PurchaseProvider,
    );
  });

  it('should verify receipt and grant PLUS capabilities', async () => {
    const res = await service.verifyPurchase('user-1', {
      platform: DevicePlatform.IOS,
      storeProductId: 'com.sparkdating.plus.1m',
      receiptToken: 'valid_token_123',
    });

    expect(res.success).toBe(true);
    expect(res.grantedEntitlements).toContain(EntitlementKey.UNLIMITED_LIKES);
    expect(res.grantedEntitlements).toContain(EntitlementKey.REWIND_PASS);
    expect(mockEntitlement.grantEntitlement).toHaveBeenCalledTimes(2);
  });

  it('should reject purchase if receipt token is invalid', async () => {
    mockProvider.verifyReceipt.mockResolvedValue({
      isValid: false,
      errorMessage: 'Fraudulent receipt.',
    });

    await expect(
      service.verifyPurchase('user-1', {
        platform: DevicePlatform.IOS,
        storeProductId: 'com.sparkdating.plus.1m',
        receiptToken: 'invalid_token',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should handle replay attacks idempotently without duplicate records', async () => {
    mockPrisma.purchaseTransaction.findUnique.mockResolvedValue({
      id: 'tx-existing',
      userId: 'user-1',
      status: TransactionStatus.COMPLETED,
    });

    const res = await service.verifyPurchase('user-1', {
      platform: DevicePlatform.IOS,
      storeProductId: 'com.sparkdating.plus.1m',
      receiptToken: 'replay_token',
    });

    expect(res.success).toBe(true);
    expect(res.transactionId).toBe('tx-existing');
    expect(mockPrisma.purchaseTransaction.create).not.toHaveBeenCalled();
  });
});
