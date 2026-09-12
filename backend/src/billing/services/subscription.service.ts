import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { EntitlementService } from './entitlement.service';
import { CreditService } from './credit.service';
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
    private readonly creditService: CreditService,
  ) {}

  async onModuleInit() {
    await this.seedDefaultProducts();
  }

  async seedDefaultProducts(): Promise<void> {
    if (!this.prisma.subscriptionProduct) return;

    try {
      this.logger.log('Seeding initial Subscription Products (INR pricing)...');

      const defaultProducts = [
        // High-Converting Coin Recharge Wallet Packs
        {
          productKey: 'COIN_PACK_100',
          displayName: '100 Coins (Starter)',
          description: 'Instant recharge: send direct notes, boost profile, or call matches.',
          tier: SubscriptionTier.A_LA_CARTE,
          platform: DevicePlatform.IOS,
          storeProductId: 'com.truelove.coins.100',
          currency: 'INR',
          priceAmount: 9900, // ₹99.00
          billingPeriod: BillingPeriod.ONE_TIME,
          isActive: true,
          metadata: {
            coinsCount: 100,
            bonusPercentage: 0,
            badge: 'Starter',
            type: 'COINS',
          },
        },
        {
          productKey: 'COIN_PACK_250',
          displayName: '250 Coins (+25% Extra)',
          description: 'Best value for active daters: 200 + 50 free bonus coins.',
          tier: SubscriptionTier.A_LA_CARTE,
          platform: DevicePlatform.IOS,
          storeProductId: 'com.truelove.coins.250',
          currency: 'INR',
          priceAmount: 19900, // ₹199.00
          billingPeriod: BillingPeriod.ONE_TIME,
          isActive: true,
          metadata: {
            coinsCount: 250,
            bonusPercentage: 25,
            badge: 'Most Popular',
            type: 'COINS',
          },
        },
        {
          productKey: 'COIN_PACK_700',
          displayName: '700 Coins (+40% Extra)',
          description: 'Maximum dating power: 500 + 200 free bonus coins for serious daters.',
          tier: SubscriptionTier.A_LA_CARTE,
          platform: DevicePlatform.IOS,
          storeProductId: 'com.truelove.coins.700',
          currency: 'INR',
          priceAmount: 49900, // ₹499.00
          billingPeriod: BillingPeriod.ONE_TIME,
          isActive: true,
          metadata: {
            coinsCount: 700,
            bonusPercentage: 40,
            badge: 'Best Value',
            type: 'COINS',
          },
        },
        // Subscriptions
        {
          productKey: 'TRUELOVE_PLUS_1M',
          displayName: 'Truelove Plus (1 Month)',
          description: 'Unlimited likes, rewind passes, 5 daily direct notes, and 5 super likes.',
          tier: SubscriptionTier.PLUS,
          platform: DevicePlatform.IOS,
          storeProductId: 'com.truelove.plus.1m',
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
          productKey: 'TRUELOVE_PLUS_3M',
          displayName: 'Truelove Plus (3 Months)',
          description: 'Save 22% on Truelove Plus with 3-month access.',
          tier: SubscriptionTier.PLUS,
          platform: DevicePlatform.IOS,
          storeProductId: 'com.truelove.plus.3m',
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
          productKey: 'TRUELOVE_GOLD_1M',
          displayName: 'Truelove Gold (1 Month)',
          description: 'See who liked you, unlimited direct notes, rewinds, and VIP video calling.',
          tier: SubscriptionTier.GOLD,
          platform: DevicePlatform.IOS,
          storeProductId: 'com.truelove.gold.1m',
          currency: 'INR',
          priceAmount: 49900, // ₹499.00
          billingPeriod: BillingPeriod.MONTHLY,
          isActive: true,
          metadata: {
            features: ['SEE_LIKES', 'UNLIMITED_LIKES', 'REWIND_PASS', 'PROFILE_BOOST', 'UNLIMITED_DIRECT_NOTES', 'VIDEO_CALL'],
            badge: 'Best Value',
          },
        },
        {
          productKey: 'TRUELOVE_GOLD_3M',
          displayName: 'Truelove Gold (3 Months)',
          description: 'Ultimate dating experience with full access to see who liked you and unlimited notes.',
          tier: SubscriptionTier.GOLD,
          platform: DevicePlatform.IOS,
          storeProductId: 'com.truelove.gold.3m',
          currency: 'INR',
          priceAmount: 119900, // ₹1,199.00
          billingPeriod: BillingPeriod.QUARTERLY,
          isActive: true,
          metadata: {
            features: ['SEE_LIKES', 'UNLIMITED_LIKES', 'REWIND_PASS', 'PROFILE_BOOST', 'UNLIMITED_DIRECT_NOTES', 'VIDEO_CALL'],
            discount: 'Save 20%',
          },
        },
        // Backward-compatibility keys
        {
          productKey: 'SPARK_PLUS_1M',
          displayName: 'Truelove Plus (1 Month)',
          description: 'Unlimited likes, rewind passes, and 5 daily direct notes.',
          tier: SubscriptionTier.PLUS,
          platform: DevicePlatform.IOS,
          storeProductId: 'com.sparkdating.plus.1m',
          currency: 'INR',
          priceAmount: 29900,
          billingPeriod: BillingPeriod.MONTHLY,
          isActive: true,
          metadata: { features: ['UNLIMITED_LIKES', 'REWIND_PASS'] },
        },
        {
          productKey: 'SPARK_PLUS_3M',
          displayName: 'Truelove Plus (3 Months)',
          description: 'Save 22% on Truelove Plus.',
          tier: SubscriptionTier.PLUS,
          platform: DevicePlatform.IOS,
          storeProductId: 'com.sparkdating.plus.3m',
          currency: 'INR',
          priceAmount: 69900,
          billingPeriod: BillingPeriod.QUARTERLY,
          isActive: true,
          metadata: { features: ['UNLIMITED_LIKES', 'REWIND_PASS'] },
        },
        {
          productKey: 'SPARK_GOLD_1M',
          displayName: 'Truelove Gold (1 Month)',
          description: 'See who liked you, unlimited direct notes, rewinds.',
          tier: SubscriptionTier.GOLD,
          platform: DevicePlatform.IOS,
          storeProductId: 'com.sparkdating.gold.1m',
          currency: 'INR',
          priceAmount: 49900,
          billingPeriod: BillingPeriod.MONTHLY,
          isActive: true,
          metadata: { features: ['SEE_LIKES', 'UNLIMITED_LIKES', 'REWIND_PASS', 'PROFILE_BOOST', 'UNLIMITED_DIRECT_NOTES', 'VIDEO_CALL'] },
        },
        {
          productKey: 'SPARK_GOLD_3M',
          displayName: 'Truelove Gold (3 Months)',
          description: 'Ultimate dating experience.',
          tier: SubscriptionTier.GOLD,
          platform: DevicePlatform.IOS,
          storeProductId: 'com.sparkdating.gold.3m',
          currency: 'INR',
          priceAmount: 119900,
          billingPeriod: BillingPeriod.QUARTERLY,
          isActive: true,
          metadata: { features: ['SEE_LIKES', 'UNLIMITED_LIKES', 'REWIND_PASS', 'PROFILE_BOOST', 'UNLIMITED_DIRECT_NOTES', 'VIDEO_CALL'] },
        },
        // Direct Note Packs
        {
          productKey: 'DIRECT_NOTES_5',
          displayName: '5 Direct Notes',
          description: 'Attach personal 150-char messages to likes. 3x higher match rate.',
          tier: SubscriptionTier.A_LA_CARTE,
          platform: DevicePlatform.IOS,
          storeProductId: 'com.truelove.notes.5',
          currency: 'INR',
          priceAmount: 9900, // ₹99.00
          billingPeriod: BillingPeriod.ONE_TIME,
          isActive: true,
          metadata: { notesCount: 5, costPerNote: '₹20' },
        },
        {
          productKey: 'DIRECT_NOTES_15',
          displayName: '15 Direct Notes',
          description: 'Best value for active daters. Stand out instantly in the direct notes shelf.',
          tier: SubscriptionTier.A_LA_CARTE,
          platform: DevicePlatform.IOS,
          storeProductId: 'com.truelove.notes.15',
          currency: 'INR',
          priceAmount: 19900, // ₹199.00
          billingPeriod: BillingPeriod.ONE_TIME,
          isActive: true,
          metadata: { notesCount: 15, costPerNote: '₹13', badge: 'Popular' },
        },
        {
          productKey: 'DIRECT_NOTES_30',
          displayName: '30 Direct Notes',
          description: 'Maximum response rate for serious daters.',
          tier: SubscriptionTier.A_LA_CARTE,
          platform: DevicePlatform.IOS,
          storeProductId: 'com.truelove.notes.30',
          currency: 'INR',
          priceAmount: 34900, // ₹349.00
          billingPeriod: BillingPeriod.ONE_TIME,
          isActive: true,
          metadata: { notesCount: 30, costPerNote: '₹11', badge: 'Best Value' },
        },
        // Profile Boost Packs
        {
          productKey: 'BOOST_PACK_1',
          displayName: 'Profile Boost (1 Pack)',
          description: 'Get 10x more profile views for 30 minutes in your area.',
          tier: SubscriptionTier.A_LA_CARTE,
          platform: DevicePlatform.IOS,
          storeProductId: 'com.truelove.boost.1',
          currency: 'INR',
          priceAmount: 9900, // ₹99.00
          billingPeriod: BillingPeriod.ONE_TIME,
          isActive: true,
          metadata: { boostsCount: 1, durationMinutes: 30 },
        },
        {
          productKey: 'BOOST_PACK_3',
          displayName: 'Profile Boost (3 Packs)',
          description: 'Save 16% on 3 profile boosts for weekend peak hours.',
          tier: SubscriptionTier.A_LA_CARTE,
          platform: DevicePlatform.IOS,
          storeProductId: 'com.truelove.boost.3',
          currency: 'INR',
          priceAmount: 24900, // ₹249.00
          billingPeriod: BillingPeriod.ONE_TIME,
          isActive: true,
          metadata: { boostsCount: 3, durationMinutes: 30, discount: 'Save 16%' },
        },
        // Call Passes
        {
          productKey: 'CALL_PASS_30M',
          displayName: '30-Minute Call Pass',
          description: 'Unlock 30 minutes of high-definition audio and video calling.',
          tier: SubscriptionTier.A_LA_CARTE,
          platform: DevicePlatform.IOS,
          storeProductId: 'com.truelove.call.30m',
          currency: 'INR',
          priceAmount: 4900, // ₹49.00
          billingPeriod: BillingPeriod.ONE_TIME,
          isActive: true,
          metadata: { callMinutes: 30 },
        },
        {
          productKey: 'CALL_PASS_SPONSOR',
          displayName: 'Sponsor Call Pass (15 Mins)',
          description: 'Gift a call pass to your match so they can join free.',
          tier: SubscriptionTier.A_LA_CARTE,
          platform: DevicePlatform.IOS,
          storeProductId: 'com.truelove.call.sponsor',
          currency: 'INR',
          priceAmount: 2900, // ₹29.00
          billingPeriod: BillingPeriod.ONE_TIME,
          isActive: true,
          metadata: { callMinutes: 15 },
        },
      ];

      for (const prod of defaultProducts) {
        await this.prisma.subscriptionProduct.upsert({
          where: { productKey: prod.productKey },
          update: {
            displayName: prod.displayName,
            description: prod.description,
            priceAmount: prod.priceAmount,
            metadata: prod.metadata,
          },
          create: prod,
        });
      }

      this.logger.log(`Successfully seeded ${defaultProducts.length} default products.`);
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
      const istDate = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
      const todayKey = `billing:daily-likes:${userId}:${istDate}`;
      const currentLikesStr = await this.redisService.get(todayKey);
      const used = currentLikesStr ? parseInt(currentLikesStr, 10) : 0;
      dailyLikesRemaining = Math.max(0, DAILY_FREE_LIKES_LIMIT - used);
    }

    let tier: SubscriptionTier = SubscriptionTier.FREE;
    if (activeSub) {
      tier = activeSub.product.tier as SubscriptionTier;
    }

    const creditBalance = await this.creditService.getUserCreditDto(userId);

    return {
      activeSubscription: activeSub,
      entitlements,
      tier: tier as any,
      dailyLikesRemaining,
      isSubscribed: activeSub !== null,
      creditBalance,
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
