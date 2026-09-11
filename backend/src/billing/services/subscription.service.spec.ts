import { SubscriptionService } from './subscription.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { EntitlementService } from './entitlement.service';
import {
  SubscriptionTier,
  SubscriptionStatus,
  BillingPeriod,
  DevicePlatform,
  EntitlementKey,
} from '@prisma/client';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let mockPrisma: any;
  let mockRedis: any;
  let mockEntitlement: any;

  const mockProduct = {
    id: 'prod-1',
    productKey: 'SPARK_PLUS_1M',
    displayName: 'Spark Plus (1 Month)',
    description: 'Unlimited likes & rewinds',
    tier: SubscriptionTier.PLUS,
    platform: DevicePlatform.IOS,
    storeProductId: 'com.sparkdating.plus.1m',
    currency: 'INR',
    priceAmount: 29900,
    billingPeriod: BillingPeriod.MONTHLY,
    isActive: true,
    metadata: { features: ['UNLIMITED_LIKES', 'REWIND_PASS'] },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockPrisma = {
      subscriptionProduct: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([mockProduct]),
        upsert: jest.fn(),
      },
      userSubscription: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    mockRedis = {
      get: jest.fn().mockResolvedValue('5'),
    };

    mockEntitlement = {
      getUserEntitlements: jest.fn().mockResolvedValue([]),
      hasEntitlement: jest.fn().mockResolvedValue(false),
    };

    const mockCredit = {
      getUserCreditDto: jest.fn().mockResolvedValue({
        directNotes: 5,
        profileBoosts: 0,
        callPassMinutes: 0,
        boostExpiresAt: null,
      }),
    };

    service = new SubscriptionService(
      mockPrisma as PrismaService,
      mockRedis as RedisService,
      mockEntitlement as EntitlementService,
      mockCredit as any,
    );
  });

  it('should list available products formatted with INR displayPrice', async () => {
    const products = await service.getAvailableProducts();
    expect(products.length).toBe(1);
    expect(products[0].displayPrice).toBe('₹299');
    expect(products[0].tier).toBe(SubscriptionTier.PLUS);
  });

  it('should return billing status for free user with remaining daily likes', async () => {
    const status = await service.getBillingStatus('user-1');

    expect(status.isSubscribed).toBe(false);
    expect(status.tier).toBe(SubscriptionTier.FREE);
    expect(status.dailyLikesRemaining).toBe(20); // 25 - 5
  });

  it('should cancel subscription and retain access until expiration', async () => {
    const futureDate = new Date(Date.now() + 1000000);
    mockPrisma.userSubscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      userId: 'user-1',
      productId: 'prod-1',
      product: mockProduct,
      status: SubscriptionStatus.ACTIVE,
      autoRenewing: true,
      startedAt: new Date(),
      expiresAt: futureDate,
      lastVerifiedAt: new Date(),
    });

    mockPrisma.userSubscription.update.mockResolvedValue({
      id: 'sub-1',
      userId: 'user-1',
      productId: 'prod-1',
      product: mockProduct,
      status: SubscriptionStatus.CANCELED,
      autoRenewing: false,
      canceledAt: new Date(),
      startedAt: new Date(),
      expiresAt: futureDate,
      lastVerifiedAt: new Date(),
    });

    const canceled = await service.cancelSubscription('user-1');
    expect(canceled.status).toBe(SubscriptionStatus.CANCELED);
    expect(canceled.autoRenewing).toBe(false);
  });
});
