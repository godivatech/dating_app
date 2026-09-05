import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { TokenService } from '../src/auth/services/token.service';
import { STORAGE_SERVICE } from '../src/media/storage/storage.interface';
import {
  User,
  UserStatus,
  UserRole,
  ProfileStatus,
  ProfileVisibility,
  Gender,
  PhotoStatus,
  DevicePlatform,
  SubscriptionTier,
  BillingPeriod,
  SubscriptionStatus,
  TransactionStatus,
  EntitlementKey,
  EntitlementSource,
  ActionType,
} from '@prisma/client';

describe('Billing & Monetization Domain (e2e)', () => {
  let app: INestApplication;
  let tokenService: TokenService;

  let authTokenUserA: string;
  let authTokenUserB: string;

  const userA: User = {
    id: 'user-bill-e2e-a',
    phoneNumber: '+919876541111',
    phoneVerifiedAt: new Date(),
    status: UserStatus.ACTIVE,
    role: UserRole.USER,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
  };

  const userB: User = {
    id: 'user-bill-e2e-b',
    phoneNumber: '+919876542222',
    phoneVerifiedAt: new Date(),
    status: UserStatus.ACTIVE,
    role: UserRole.USER,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
  };

  const profileA = {
    id: 'prof-bill-a',
    userId: userA.id,
    displayName: 'Ravi',
    dateOfBirth: new Date('1996-06-15T00:00:00.000Z'),
    gender: Gender.MAN,
    bio: 'Software engineer in Chennai.',
    locationCity: 'Chennai',
    locationRegion: 'Tamil Nadu',
    locationCountry: 'IN',
    status: ProfileStatus.READY,
    visibility: ProfileVisibility.VISIBLE,
    createdAt: new Date(),
    updatedAt: new Date(),
    photos: [
      {
        id: 'photo-bill-a1',
        profileId: 'prof-bill-a',
        objectKey: 'profiles/a/1.jpg',
        thumbnailKey: 'profiles/a/thumb.webp',
        status: PhotoStatus.APPROVED,
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    interests: [],
    preferences: null,
    user: userA,
  };

  const profileB = {
    id: 'prof-bill-b',
    userId: userB.id,
    displayName: 'Priya',
    dateOfBirth: new Date('1998-08-20T00:00:00.000Z'),
    gender: Gender.WOMAN,
    bio: 'Designer in Coimbatore.',
    locationCity: 'Coimbatore',
    locationRegion: 'Tamil Nadu',
    locationCountry: 'IN',
    status: ProfileStatus.READY,
    visibility: ProfileVisibility.VISIBLE,
    createdAt: new Date(),
    updatedAt: new Date(),
    photos: [
      {
        id: 'photo-bill-b1',
        profileId: 'prof-bill-b',
        objectKey: 'profiles/b/1.jpg',
        thumbnailKey: 'profiles/b/thumb.webp',
        status: PhotoStatus.APPROVED,
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    interests: [],
    preferences: null,
    user: userB,
  };

  const productsStore = [
    {
      id: 'prod-plus-1m',
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
    },
    {
      id: 'prod-gold-1m',
      productKey: 'SPARK_GOLD_1M',
      displayName: 'Spark Gold (1 Month)',
      description: 'See who liked you & unlimited perks',
      tier: SubscriptionTier.GOLD,
      platform: DevicePlatform.IOS,
      storeProductId: 'com.sparkdating.gold.1m',
      currency: 'INR',
      priceAmount: 49900,
      billingPeriod: BillingPeriod.MONTHLY,
      isActive: true,
      metadata: { features: ['SEE_LIKES', 'UNLIMITED_LIKES', 'REWIND_PASS', 'PROFILE_BOOST'] },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const subscriptionsStore: any[] = [];
  const transactionsStore: any[] = [];
  const entitlementsStore: any[] = [];
  const actionsStore: any[] = [];

  const mockPrismaService = {
    authSession: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        return Promise.resolve({
          id: where.id,
          expiresAt: new Date(Date.now() + 86400000),
          revokedAt: null,
        });
      }),
    },
    user: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where.id === userA.id || where.phoneNumber === userA.phoneNumber)
          return Promise.resolve({ ...userA, profile: profileA });
        if (where.id === userB.id || where.phoneNumber === userB.phoneNumber)
          return Promise.resolve({ ...userB, profile: profileB });
        return Promise.resolve(null);
      }),
      findMany: jest.fn().mockImplementation(({ where }) => {
        return Promise.resolve([userA, userB]);
      }),
    },
    datingProfile: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where.userId === userA.id || where.id === profileA.id)
          return Promise.resolve(profileA);
        if (where.userId === userB.id || where.id === profileB.id)
          return Promise.resolve(profileB);
        return Promise.resolve(null);
      }),
      findFirst: jest.fn().mockImplementation(({ where }) => {
        if (where.userId === userA.id || where.id === profileA.id)
          return Promise.resolve(profileA);
        if (where.userId === userB.id || where.id === profileB.id)
          return Promise.resolve(profileB);
        return Promise.resolve(null);
      }),
    },
    subscriptionProduct: {
      findMany: jest.fn().mockImplementation(() => Promise.resolve(productsStore)),
      findFirst: jest.fn().mockImplementation(({ where }) => {
        const p = productsStore.find(
          (prod) =>
            prod.storeProductId === where.storeProductId ||
            prod.productKey === where.productKey ||
            (where.OR && where.OR.some((c: any) => c.storeProductId === prod.storeProductId || c.productKey === prod.productKey)),
        );
        return Promise.resolve(p || null);
      }),
      count: jest.fn().mockResolvedValue(productsStore.length),
      upsert: jest.fn().mockImplementation(({ create }) => {
        return Promise.resolve(create);
      }),
    },
    userSubscription: {
      findFirst: jest.fn().mockImplementation(({ where }) => {
        const now = new Date();
        const sub = subscriptionsStore.find((s) => {
          if (s.userId !== where.userId) return false;
          if (where.expiresAt?.gt && s.expiresAt <= where.expiresAt.gt) return false;
          if (where.status?.in && !where.status.in.includes(s.status)) return false;
          if (typeof where.status === 'string' && s.status !== where.status) return false;
          return true;
        });
        if (sub) {
          const product = productsStore.find((p) => p.id === sub.productId);
          return Promise.resolve({ ...sub, product });
        }
        return Promise.resolve(null);
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        const product = productsStore.find((p) => p.id === data.productId) || productsStore[0];
        const sub = {
          id: `sub-${Date.now()}-${Math.random()}`,
          ...data,
          product,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        subscriptionsStore.push(sub);
        return Promise.resolve(sub);
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const sub = subscriptionsStore.find((s) => s.id === where.id);
        if (sub) {
          Object.assign(sub, data);
          const product = productsStore.find((p) => p.id === sub.productId);
          return Promise.resolve({ ...sub, product });
        }
        return Promise.resolve(null);
      }),
    },
    purchaseTransaction: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const tx = transactionsStore.find(
          (t) => t.providerTransactionId === where.providerTransactionId,
        );
        return Promise.resolve(tx || null);
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        const tx = {
          id: `tx-${Date.now()}-${Math.random()}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        transactionsStore.push(tx);
        return Promise.resolve(tx);
      }),
    },
    userEntitlement: {
      findFirst: jest.fn().mockImplementation(({ where }) => {
        const now = new Date();
        const ent = entitlementsStore.find(
          (e) =>
            e.userId === where.userId &&
            e.entitlementKey === where.entitlementKey &&
            e.isActive &&
            (!e.expiresAt || e.expiresAt > now),
        );
        return Promise.resolve(ent || null);
      }),
      findMany: jest.fn().mockImplementation(({ where }) => {
        const now = new Date();
        const list = entitlementsStore.filter(
          (e) =>
            e.userId === where.userId &&
            e.isActive &&
            (!e.expiresAt || e.expiresAt > now),
        );
        return Promise.resolve(list);
      }),
      upsert: jest.fn().mockImplementation(({ create, update, where }) => {
        const existing = entitlementsStore.find(
          (e) =>
            e.userId === where.userId_entitlementKey_sourceReferenceId.userId &&
            e.entitlementKey === where.userId_entitlementKey_sourceReferenceId.entitlementKey &&
            e.sourceReferenceId === where.userId_entitlementKey_sourceReferenceId.sourceReferenceId,
        );
        if (existing) {
          Object.assign(existing, update);
          return Promise.resolve(existing);
        }
        const created = {
          id: `ent-${Date.now()}-${Math.random()}`,
          startsAt: new Date(),
          ...create,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        entitlementsStore.push(created);
        return Promise.resolve(created);
      }),
      updateMany: jest.fn().mockImplementation(({ where, data }) => {
        let count = 0;
        entitlementsStore.forEach((e) => {
          if (e.source === where.source && e.sourceReferenceId === where.sourceReferenceId) {
            Object.assign(e, data);
            count++;
          }
        });
        return Promise.resolve({ count });
      }),
    },
    userAction: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where.actorUserId_targetProfileId) {
          const found = actionsStore.find(
            (a) =>
              a.actorUserId === where.actorUserId_targetProfileId.actorUserId &&
              a.targetProfileId === where.actorUserId_targetProfileId.targetProfileId,
          );
          return Promise.resolve(found || null);
        }
        return Promise.resolve(null);
      }),
      findFirst: jest.fn().mockImplementation(({ where }) => {
        const action = actionsStore
          .slice()
          .reverse()
          .find((a) => a.actorUserId === where.actorUserId && a.actionType === where.actionType);
        return Promise.resolve(action || null);
      }),
      findMany: jest.fn().mockImplementation(({ where }) => {
        const actions = actionsStore
          .filter((a) => {
            if (where.targetProfileId && a.targetProfileId !== where.targetProfileId) return false;
            if (where.actionType && a.actionType !== where.actionType) return false;
            return true;
          })
          .map((a) => ({
            ...a,
            actorUser: a.actorUserId === userA.id ? { ...userA, profile: profileA } : { ...userB, profile: profileB },
          }));
        return Promise.resolve(actions);
      }),
      count: jest.fn().mockImplementation(({ where }) => {
        const count = actionsStore.filter((a) => {
          if (where.targetProfileId && a.targetProfileId !== where.targetProfileId) return false;
          if (where.actionType && a.actionType !== where.actionType) return false;
          return true;
        }).length;
        return Promise.resolve(count);
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        const act = {
          id: `act-${Date.now()}`,
          ...data,
          actorUser: data.actorUserId === userA.id ? { ...userA, profile: profileA } : { ...userB, profile: profileB },
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        actionsStore.push(act);
        return Promise.resolve(act);
      }),
      upsert: jest.fn().mockImplementation(({ create }) => {
        const act = {
          id: `act-${Date.now()}`,
          ...create,
          actorUser: create.actorUserId === userA.id ? { ...userA, profile: profileA } : { ...userB, profile: profileB },
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        actionsStore.push(act);
        return Promise.resolve(act);
      }),
      delete: jest.fn().mockImplementation(({ where }) => {
        const idx = actionsStore.findIndex((a) => a.id === where.id);
        if (idx >= 0) {
          const removed = actionsStore.splice(idx, 1)[0];
          return Promise.resolve(removed);
        }
        return Promise.resolve(null);
      }),
    },
    block: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    report: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    match: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({ id: 'match-e2e-1', status: 'ACTIVE' }),
    },
    $transaction: jest.fn().mockImplementation((cb) => cb(mockPrismaService)),
  };

  const mockRedisService = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    incrementWithWindow: jest.fn().mockResolvedValue({ current: 1 }),
  };

  const mockStorageService = {
    getPublicUrl: jest
      .fn()
      .mockImplementation((key) => `https://cdn.dating.local/${key}`),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideProvider(RedisService)
      .useValue(mockRedisService)
      .overrideProvider(STORAGE_SERVICE)
      .useValue(mockStorageService)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    tokenService = app.get<TokenService>(TokenService);

    const tokenA = await tokenService.generateTokens(userA.id, 'session-bill-a');
    authTokenUserA = tokenA.accessToken;

    const tokenB = await tokenService.generateTokens(userB.id, 'session-bill-b');
    authTokenUserB = tokenB.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Product Catalog & Status (GET /billing/products & GET /billing/status)', () => {
    it('GET /billing/products should return available products with INR currency and display price', async () => {
      const res = await request(app.getHttpServer())
        .get('/billing/products')
        .set('Authorization', `Bearer ${authTokenUserA}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
      const plusProduct = res.body.find((p: any) => p.productKey === 'SPARK_PLUS_1M');
      expect(plusProduct).toBeDefined();
      expect(plusProduct.currency).toBe('INR');
      expect(plusProduct.displayPrice).toBe('₹299');
    });

    it('GET /billing/status should return free status for new user with 25 remaining likes', async () => {
      const res = await request(app.getHttpServer())
        .get('/billing/status')
        .set('Authorization', `Bearer ${authTokenUserA}`)
        .expect(200);

      expect(res.body.isSubscribed).toBe(false);
      expect(res.body.tier).toBe('FREE');
      expect(res.body.dailyLikesRemaining).toBe(25);
    });
  });

  describe('2. In-App Purchase Verification & Replay Protection (POST /billing/verify-purchase)', () => {
    it('POST /billing/verify-purchase should verify receipt, activate subscription and grant entitlements', async () => {
      const res = await request(app.getHttpServer())
        .post('/billing/verify-purchase')
        .set('Authorization', `Bearer ${authTokenUserA}`)
        .send({
          platform: DevicePlatform.IOS,
          storeProductId: 'com.sparkdating.plus.1m',
          receiptToken: 'valid_mock_token_plus',
          transactionId: `test_tx_${Date.now()}`,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.subscription).toBeDefined();
      expect(res.body.grantedEntitlements).toContain(EntitlementKey.UNLIMITED_LIKES);
      expect(res.body.grantedEntitlements).toContain(EntitlementKey.REWIND_PASS);

      // Verify status endpoint reflects new subscription
      const statusRes = await request(app.getHttpServer())
        .get('/billing/status')
        .set('Authorization', `Bearer ${authTokenUserA}`)
        .expect(200);

      expect(statusRes.body.isSubscribed).toBe(true);
      expect(statusRes.body.tier).toBe('PLUS');
      expect(statusRes.body.dailyLikesRemaining).toBeNull(); // Unlimited
    });

    it('POST /billing/verify-purchase should handle replay attack idempotently without duplicate records', async () => {
      const fixedTxId = `fixed_tx_${Date.now()}`;

      // First call
      const firstRes = await request(app.getHttpServer())
        .post('/billing/verify-purchase')
        .set('Authorization', `Bearer ${authTokenUserA}`)
        .send({
          platform: DevicePlatform.IOS,
          storeProductId: 'com.sparkdating.plus.1m',
          receiptToken: 'mock_receipt_1',
          transactionId: fixedTxId,
        })
        .expect(200);

      // Replay call with exact same transactionId
      const replayRes = await request(app.getHttpServer())
        .post('/billing/verify-purchase')
        .set('Authorization', `Bearer ${authTokenUserA}`)
        .send({
          platform: DevicePlatform.IOS,
          storeProductId: 'com.sparkdating.plus.1m',
          receiptToken: 'mock_receipt_1',
          transactionId: fixedTxId,
        })
        .expect(200);

      expect(replayRes.body.success).toBe(true);
      expect(replayRes.body.transactionId).toBe(firstRes.body.transactionId);
    });

    it('POST /billing/verify-purchase should reject invalid receipt token with 400', async () => {
      await request(app.getHttpServer())
        .post('/billing/verify-purchase')
        .set('Authorization', `Bearer ${authTokenUserA}`)
        .send({
          platform: DevicePlatform.IOS,
          storeProductId: 'com.sparkdating.plus.1m',
          receiptToken: 'invalid_token',
        })
        .expect(400);
    });
  });

  describe('3. Pass Rewind & Who Liked You Entitlements', () => {
    it('POST /actions/undo should rewind last pass when holding REWIND_PASS entitlement', async () => {
      // User A records a PASS on User B
      await request(app.getHttpServer())
        .post('/actions')
        .set('Authorization', `Bearer ${authTokenUserA}`)
        .send({
          targetProfileId: profileB.id,
          actionType: ActionType.PASS,
        })
        .expect(200);

      // User A undos the pass
      const undoRes = await request(app.getHttpServer())
        .post('/actions/undo')
        .set('Authorization', `Bearer ${authTokenUserA}`)
        .expect(200);

      expect(undoRes.body.success).toBe(true);
      expect(undoRes.body.rewoundProfileId).toBe(profileB.id);
    });

    it('GET /matches/incoming-likes should return blurred teasers for free users and full unmasked data for GOLD users', async () => {
      // User A likes User B
      await request(app.getHttpServer())
        .post('/actions')
        .set('Authorization', `Bearer ${authTokenUserA}`)
        .send({
          targetProfileId: profileB.id,
          actionType: ActionType.LIKE,
        })
        .expect(200);

      // User B (Free) inspects incoming likes -> blurred teaser
      const freeRes = await request(app.getHttpServer())
        .get('/matches/incoming-likes')
        .set('Authorization', `Bearer ${authTokenUserB}`)
        .expect(200);

      expect(freeRes.body.totalCount).toBeGreaterThanOrEqual(1);
      expect(freeRes.body.unlocked).toBe(false);
      expect(freeRes.body.likes[0].candidate.blurred).toBe(true);

      // Upgrade User B to SPARK_GOLD_1M
      await request(app.getHttpServer())
        .post('/billing/verify-purchase')
        .set('Authorization', `Bearer ${authTokenUserB}`)
        .send({
          platform: DevicePlatform.IOS,
          storeProductId: 'com.sparkdating.gold.1m',
          receiptToken: 'gold_token_user_b',
          transactionId: `tx_gold_${Date.now()}`,
        })
        .expect(200);

      // User B inspects incoming likes again -> fully unlocked profile!
      const goldRes = await request(app.getHttpServer())
        .get('/matches/incoming-likes')
        .set('Authorization', `Bearer ${authTokenUserB}`)
        .expect(200);

      expect(goldRes.body.totalCount).toBeGreaterThanOrEqual(1);
      expect(goldRes.body.unlocked).toBe(true);
      expect(goldRes.body.likes[0].candidate.displayName).toBe('Ravi');
      expect(goldRes.body.likes[0].candidate.blurred).toBeUndefined();
    });
  });

  describe('4. Subscription Cancellation & Purchase Restoration', () => {
    it('POST /billing/cancel should cancel auto-renewal without revoking immediate access', async () => {
      const cancelRes = await request(app.getHttpServer())
        .post('/billing/cancel')
        .set('Authorization', `Bearer ${authTokenUserB}`)
        .expect(200);

      expect(cancelRes.body.status).toBe('CANCELED');
      expect(cancelRes.body.autoRenewing).toBe(false);

      // User B still has active entitlement until expiresAt
      const statusRes = await request(app.getHttpServer())
        .get('/billing/status')
        .set('Authorization', `Bearer ${authTokenUserB}`)
        .expect(200);

      expect(statusRes.body.isSubscribed).toBe(true);
    });

    it('POST /billing/restore-purchases should restore previous active purchases', async () => {
      const restoreRes = await request(app.getHttpServer())
        .post('/billing/restore-purchases')
        .set('Authorization', `Bearer ${authTokenUserA}`)
        .send({
          platform: DevicePlatform.IOS,
          receiptTokens: ['restored_token_1'],
        })
        .expect(200);

      expect(restoreRes.body.restored).toBe(true);
      expect(restoreRes.body.activeSubscription).toBeDefined();
    });
  });
});
