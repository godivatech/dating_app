import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { EntitlementService } from './entitlement.service';
import {
  SubscriptionProduct,
  UserSubscription,
  SubscriptionStatus,
  SubscriptionTier,
  BillingPeriod,
  DevicePlatform,
  EntitlementKey,
} from '@prisma/client';
import {
  SafeSubscriptionProduct,
  SafeUserSubscription,
  BillingStatusResponse,
} from '../../../../shared/src/types';

export const DAILY_FREE_LIKES_LIMIT = 25;

@Injectable()
export class SubscriptionService implements OnModuleInit {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly entitlementService: EntitlementService,
  ) {}

  async onModuleInit() {
    await this.seedDefaultProducts();
  }

  async seedDefaultProducts(): Promise<void> {
    if (!this.prisma.subscriptionProduct) return;

    try {
      const existing = await this.prisma.subscriptionProduct.count();
      if (existing > 0) return;

      this.logger.log('Seeding initial Subscription Products (INR pricing)...');

    const defaultProducts = [
      {
        productKey: 'SPARK_PLUS_1M',
        displayName: 'Spark Plus (1 Month)',
        description: 'Unlimited likes, rewind passes, and 5 daily super likes.',
        tier: SubscriptionTier.PLUS,
        platform: DevicePlatform.IOS,
        storeProductId: 'com.sparkdating.plus.1m',
        currency: 'INR',
        priceAmount: 29900, // ₹299.00
        billingPeriod: BillingPeriod.MONTHLY,
        isActive: true,
        metadata: {
          features: ['UNLIMITED_LIKES', 'REWIND_PASS'],
          badge: 'Most Popular',
        },
      },
      {
        productKey: 'SPARK_PLUS_3M',
        displayName: 'Spark Plus (3 Months)',
        description: 'Save 22% on Spark Plus with 3-month access.',
        tier: SubscriptionTier.PLUS,
        platform: DevicePlatform.IOS,
        storeProductId: 'com.sparkdating.plus.3m',
        currency: 'INR',
        priceAmount: 69900, // ₹699.00
        billingPeriod: BillingPeriod.QUARTERLY,
        isActive: true,
        metadata: {
          features: ['UNLIMITED_LIKES', 'REWIND_PASS'],
          discount: 'Save 22%',
        },
      },
      {
        productKey: 'SPARK_GOLD_1M',
        displayName: 'Spark Gold (1 Month)',
        description: 'See who liked you, unlimited likes, rewinds, and weekly profile boost.',
        tier: SubscriptionTier.GOLD,
        platform: DevicePlatform.IOS,
        storeProductId: 'com.sparkdating.gold.1m',
        currency: 'INR',
        priceAmount: 49900, // ₹499.00
        billingPeriod: BillingPeriod.MONTHLY,
        isActive: true,
        metadata: {
          features: ['SEE_LIKES', 'UNLIMITED_LIKES', 'REWIND_PASS', 'PROFILE_BOOST'],
          badge: 'Best Value',
        },
      },
      {
        productKey: 'SPARK_GOLD_3M',
        displayName: 'Spark Gold (3 Months)',
        description: 'Ultimate dating experience with full access to see who liked you.',
        tier: SubscriptionTier.GOLD,
        platform: DevicePlatform.IOS,
        storeProductId: 'com.sparkdating.gold.3m',
        currency: 'INR',
        priceAmount: 119900, // ₹1,199.00
        billingPeriod: BillingPeriod.QUARTERLY,
        isActive: true,
        metadata: {
          features: ['SEE_LIKES', 'UNLIMITED_LIKES', 'REWIND_PASS', 'PROFILE_BOOST'],
          discount: 'Save 20%',
        },
      },
      {
        productKey: 'BOOST_PACK_1',
        displayName: 'Profile Boost (1 Pack)',
        description: 'Get 10x more profile views for 30 minutes in your area.',
        tier: SubscriptionTier.A_LA_CARTE,
        platform: DevicePlatform.IOS,
        storeProductId: 'com.sparkdating.boost.1',
        currency: 'INR',
        priceAmount: 9900, // ₹99.00
        billingPeriod: BillingPeriod.ONE_TIME,
        isActive: true,
        metadata: {
          features: ['PROFILE_BOOST'],
        },
      },
    ];

    for (const prod of defaultProducts) {
      await this.prisma.subscriptionProduct.upsert({
        where: { productKey: prod.productKey },
        update: {},
        create: prod,
      });
    }

    this.logger.log('Successfully seeded default Subscription Products.');
    } catch (err: any) {
      this.logger.warn(`Could not seed subscription products: ${err.message}`);
    }
  }

  /**
   * Retrieves all active subscription products.
   */
  async getAvailableProducts(): Promise<SafeSubscriptionProduct[]> {
    const products = await this.prisma.subscriptionProduct.findMany({
      where: { isActive: true },
      orderBy: { priceAmount: 'asc' },
    });

    return products.map((p) => this.mapToSafeProduct(p));
  }

  /**
   * Retrieves user's currently active subscription.
   */
  async getActiveSubscription(userId: string): Promise<SafeUserSubscription | null> {
    const now = new Date();

    const sub = await this.prisma.userSubscription.findFirst({
      where: {
        userId,
        expiresAt: { gt: now },
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELED, SubscriptionStatus.GRACE_PERIOD] },
      },
      include: {
        product: true,
      },
      orderBy: { expiresAt: 'desc' },
    });

    if (!sub) return null;
    return this.mapToSafeSubscription(sub);
  }

  /**
   * Returns complete billing status, active subscription, entitlements, and remaining daily likes.
   */
  async getBillingStatus(userId: string): Promise<BillingStatusResponse> {
    const activeSub = await this.getActiveSubscription(userId);
    const entitlements = await this.entitlementService.getUserEntitlements(userId);

    const hasUnlimitedLikes = await this.entitlementService.hasEntitlement(
      userId,
      EntitlementKey.UNLIMITED_LIKES,
    );

    let dailyLikesRemaining: number | null = null;
    if (!hasUnlimitedLikes) {
      const todayKey = `billing:daily-likes:${userId}:${new Date().toISOString().slice(0, 10)}`;
      const currentLikesStr = await this.redisService.get(todayKey);
      const used = currentLikesStr ? parseInt(currentLikesStr, 10) : 0;
      dailyLikesRemaining = Math.max(0, DAILY_FREE_LIKES_LIMIT - used);
    }

    let tier: SubscriptionTier = SubscriptionTier.FREE;
    if (activeSub) {
      tier = activeSub.product.tier as SubscriptionTier;
    }

    return {
      activeSubscription: activeSub,
      entitlements,
      tier: tier as any,
      dailyLikesRemaining,
      isSubscribed: activeSub !== null,
    };
  }

  /**
   * Cancels auto-renewal of a subscription.
   * Access remains valid until expiresAt.
   */
  async cancelSubscription(userId: string): Promise<SafeUserSubscription> {
    const now = new Date();

    const activeSub = await this.prisma.userSubscription.findFirst({
      where: {
        userId,
        expiresAt: { gt: now },
        status: SubscriptionStatus.ACTIVE,
      },
      include: { product: true },
    });

    if (!activeSub) {
      throw new NotFoundException('No active auto-renewing subscription found to cancel.');
    }

    const updated = await this.prisma.userSubscription.update({
      where: { id: activeSub.id },
      data: {
        status: SubscriptionStatus.CANCELED,
        autoRenewing: false,
        canceledAt: now,
      },
      include: { product: true },
    });

    this.logger.log(`[SUBSCRIPTION_CANCELED] User ${userId} canceled subscription ${updated.id}`);

    return this.mapToSafeSubscription(updated);
  }

  public mapToSafeProduct(product: SubscriptionProduct): SafeSubscriptionProduct {
    const priceFormatted = `₹${(product.priceAmount / 100).toFixed(0)}`;
    const metadata = (product.metadata || {}) as any;

    return {
      id: product.id,
      productKey: product.productKey,
      displayName: product.displayName,
      description: product.description,
      tier: product.tier as any,
      platform: product.platform as any,
      storeProductId: product.storeProductId,
      currency: product.currency,
      priceAmount: product.priceAmount,
      displayPrice: priceFormatted,
      billingPeriod: product.billingPeriod as any,
      isActive: product.isActive,
      features: metadata.features || [],
    };
  }

  public mapToSafeSubscription(sub: UserSubscription & { product: SubscriptionProduct }): SafeUserSubscription {
    return {
      id: sub.id,
      userId: sub.userId,
      productId: sub.productId,
      product: this.mapToSafeProduct(sub.product),
      provider: sub.provider as any,
      status: sub.status as any,
      startedAt: sub.startedAt.toISOString(),
      expiresAt: sub.expiresAt.toISOString(),
      canceledAt: sub.canceledAt ? sub.canceledAt.toISOString() : null,
      autoRenewing: sub.autoRenewing,
      lastVerifiedAt: sub.lastVerifiedAt.toISOString(),
    };
  }
}
