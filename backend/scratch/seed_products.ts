import { PrismaClient, SubscriptionTier, BillingPeriod, DevicePlatform } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const defaultProducts = [
    {
      productKey: 'TRUELOVE_PLUS_1M',
      displayName: 'Truelove Plus (1 Month)',
      description: 'Unlimited likes, rewind passes, 5 daily direct notes, and 5 super likes.',
      tier: SubscriptionTier.PLUS,
      platform: DevicePlatform.IOS,
      storeProductId: 'com.truelove.plus.1m',
      currency: 'INR',
      priceAmount: 29900,
      billingPeriod: BillingPeriod.MONTHLY,
      isActive: true,
      metadata: { features: ['UNLIMITED_LIKES', 'REWIND_PASS'], badge: 'Most Popular' },
    },
    {
      productKey: 'TRUELOVE_PLUS_3M',
      displayName: 'Truelove Plus (3 Months)',
      description: 'Save 22% on Truelove Plus with 3-month access.',
      tier: SubscriptionTier.PLUS,
      platform: DevicePlatform.IOS,
      storeProductId: 'com.truelove.plus.3m',
      currency: 'INR',
      priceAmount: 69900,
      billingPeriod: BillingPeriod.QUARTERLY,
      isActive: true,
      metadata: { features: ['UNLIMITED_LIKES', 'REWIND_PASS'], discount: 'Save 22%' },
    },
    {
      productKey: 'TRUELOVE_GOLD_1M',
      displayName: 'Truelove Gold (1 Month)',
      description: 'See who liked you, unlimited direct notes, rewinds, and VIP video calling.',
      tier: SubscriptionTier.GOLD,
      platform: DevicePlatform.IOS,
      storeProductId: 'com.truelove.gold.1m',
      currency: 'INR',
      priceAmount: 49900,
      billingPeriod: BillingPeriod.MONTHLY,
      isActive: true,
      metadata: {
        features: [
          'SEE_LIKES',
          'UNLIMITED_LIKES',
          'REWIND_PASS',
          'PROFILE_BOOST',
          'UNLIMITED_DIRECT_NOTES',
          'VIDEO_CALL',
        ],
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
      priceAmount: 119900,
      billingPeriod: BillingPeriod.QUARTERLY,
      isActive: true,
      metadata: {
        features: [
          'SEE_LIKES',
          'UNLIMITED_LIKES',
          'REWIND_PASS',
          'PROFILE_BOOST',
          'UNLIMITED_DIRECT_NOTES',
          'VIDEO_CALL',
        ],
        discount: 'Save 20%',
      },
    },
    {
      productKey: 'DIRECT_NOTES_5',
      displayName: '5 Direct Notes',
      description: 'Attach personal 150-char messages to likes. 3x higher match rate.',
      tier: SubscriptionTier.A_LA_CARTE,
      platform: DevicePlatform.IOS,
      storeProductId: 'com.truelove.notes.5',
      currency: 'INR',
      priceAmount: 9900,
      billingPeriod: BillingPeriod.ONE_TIME,
      isActive: true,
      metadata: { notesCount: 5, costPerNote: '₹19.8' },
    },
    {
      productKey: 'DIRECT_NOTES_15',
      displayName: '15 Direct Notes',
      description: 'Best value for active daters. Stand out instantly in the direct notes shelf.',
      tier: SubscriptionTier.A_LA_CARTE,
      platform: DevicePlatform.IOS,
      storeProductId: 'com.truelove.notes.15',
      currency: 'INR',
      priceAmount: 19900,
      billingPeriod: BillingPeriod.ONE_TIME,
      isActive: true,
      metadata: { notesCount: 15, costPerNote: '₹13.2', badge: 'Popular' },
    },
    {
      productKey: 'DIRECT_NOTES_30',
      displayName: '35 Direct Notes',
      description: 'Maximum response rate for serious daters.',
      tier: SubscriptionTier.A_LA_CARTE,
      platform: DevicePlatform.IOS,
      storeProductId: 'com.truelove.notes.30',
      currency: 'INR',
      priceAmount: 34900,
      billingPeriod: BillingPeriod.ONE_TIME,
      isActive: true,
      metadata: { notesCount: 35, costPerNote: '₹9.9', badge: 'Best Value' },
    },
    {
      productKey: 'BOOST_PACK_1',
      displayName: 'Profile Boost (1 Pack)',
      description: 'Get 10x more profile views for 30 minutes in your area.',
      tier: SubscriptionTier.A_LA_CARTE,
      platform: DevicePlatform.IOS,
      storeProductId: 'com.sparkdating.boost.1',
      currency: 'INR',
      priceAmount: 9900,
      billingPeriod: BillingPeriod.ONE_TIME,
      isActive: true,
      metadata: { boostsCount: 1, durationMinutes: 30 },
    },
    {
      productKey: 'BOOST_PACK_3',
      displayName: 'Profile Boost (3 Packs)',
      description: 'Save 33% on 3 profile boosts for weekend peak hours.',
      tier: SubscriptionTier.A_LA_CARTE,
      platform: DevicePlatform.IOS,
      storeProductId: 'com.truelove.boost.3',
      currency: 'INR',
      priceAmount: 19900,
      billingPeriod: BillingPeriod.ONE_TIME,
      isActive: true,
      metadata: { boostsCount: 3, durationMinutes: 30, discount: 'Save 33%' },
    },
    {
      productKey: 'CALL_PASS_15M',
      displayName: '15-Minute Call Pass',
      description: 'Unlock 15 minutes of high-definition audio and video calling.',
      tier: SubscriptionTier.A_LA_CARTE,
      platform: DevicePlatform.IOS,
      storeProductId: 'com.truelove.call.15m',
      currency: 'INR',
      priceAmount: 4900,
      billingPeriod: BillingPeriod.ONE_TIME,
      isActive: true,
      metadata: { callMinutes: 15 },
    },
    {
      productKey: 'CALL_PASS_45M',
      displayName: '45-Minute Call Pass',
      description: 'Unlock 45 minutes of high-definition audio and video calling.',
      tier: SubscriptionTier.A_LA_CARTE,
      platform: DevicePlatform.IOS,
      storeProductId: 'com.truelove.call.45m',
      currency: 'INR',
      priceAmount: 9900,
      billingPeriod: BillingPeriod.ONE_TIME,
      isActive: true,
      metadata: { callMinutes: 45, badge: 'Popular' },
    },
  ];

  for (const prod of defaultProducts) {
    await prisma.subscriptionProduct.upsert({
      where: { productKey: prod.productKey },
      update: {
        displayName: prod.displayName,
        description: prod.description,
        priceAmount: prod.priceAmount,
        tier: prod.tier,
        billingPeriod: prod.billingPeriod,
        metadata: prod.metadata,
        isActive: true,
      },
      create: prod,
    });
  }

  const all = await prisma.subscriptionProduct.findMany({ where: { isActive: true } });
  console.log(`Successfully seeded! Total active products in database: ${all.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
