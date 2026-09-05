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
  PreferredGenderMode,
  RelationshipIntent,
  PhotoStatus,
} from '@prisma/client';

describe('Admin Operations & Management Domain (e2e)', () => {
  let app: INestApplication;
  let tokenService: TokenService;

  let regularUserToken: string;
  let moderatorToken: string;
  let adminToken: string;

  const regularUser: User = {
    id: 'user-admin-e2e-regular',
    phoneNumber: '+919900000001',
    phoneVerifiedAt: new Date(),
    status: UserStatus.ACTIVE,
    role: UserRole.USER,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
  };

  const moderatorUser: User = {
    id: 'user-admin-e2e-moderator',
    phoneNumber: '+919900000002',
    phoneVerifiedAt: new Date(),
    status: UserStatus.ACTIVE,
    role: UserRole.MODERATOR,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
  };

  const adminUser: User = {
    id: 'user-admin-e2e-admin',
    phoneNumber: '+919900000003',
    phoneVerifiedAt: new Date(),
    status: UserStatus.ACTIVE,
    role: UserRole.ADMIN,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
  };

  const targetUser: User = {
    id: 'user-admin-e2e-target',
    phoneNumber: '+919900000004',
    phoneVerifiedAt: new Date(),
    status: UserStatus.ACTIVE,
    role: UserRole.USER,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
  };

  const userMap = new Map<string, User>([
    [regularUser.id, regularUser],
    [moderatorUser.id, moderatorUser],
    [adminUser.id, adminUser],
    [targetUser.id, targetUser],
  ]);

  const targetProfile: any = {
    id: 'prof-admin-target',
    userId: targetUser.id,
    displayName: 'Target Persona',
    dateOfBirth: new Date('1998-05-15T00:00:00.000Z'),
    gender: Gender.MAN,
    bio: 'Test bio for admin testing',
    locationCity: 'Bengaluru',
    locationRegion: 'Karnataka',
    locationCountry: 'IN',
    visibility: ProfileVisibility.VISIBLE,
    status: ProfileStatus.READY,
    preferences: {
      preferredGenderMode: PreferredGenderMode.SELECTED,
      preferredGenders: [Gender.WOMAN],
      minAge: 21,
      maxAge: 30,
      relationshipIntent: RelationshipIntent.LONG_TERM,
    },
    interests: ['Coffee', 'Music'],
    photos: [
      {
        id: 'photo-admin-pending-1',
        profileId: 'prof-admin-target',
        status: PhotoStatus.PENDING_REVIEW,
        position: 0,
        thumbnailKey: 'pending1.webp',
        createdAt: new Date(),
      },
    ],
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const u = userMap.get(where.id);
        if (!u) return Promise.resolve(null);
        return Promise.resolve({
          ...u,
          profile: u.id === targetUser.id ? targetProfile : null,
          safetyStrikes: [],
          reportsReceived: [],
          subscriptions: [],
          coinLedger: [],
        });
      }),
      findMany: jest.fn().mockImplementation(() => {
        return Promise.resolve(
          Array.from(userMap.values()).map((u) => ({
            ...u,
            profile: u.id === targetUser.id ? targetProfile : null,
            _count: { safetyStrikes: 0, reportsReceived: 0 },
            safetyStrikes: [],
            subscriptions: [],
          })),
        );
      }),
      count: jest.fn().mockImplementation(() => Promise.resolve(userMap.size)),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const u = userMap.get(where.id);
        if (u) {
          Object.assign(u, data);
        }
        return Promise.resolve(u);
      }),
    },
    profilePhoto: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'photo-admin-pending-1',
          profileId: targetProfile.id,
          status: PhotoStatus.PENDING_REVIEW,
          position: 0,
          thumbnailKey: 'pending1.webp',
          createdAt: new Date(),
          profile: {
            userId: targetUser.id,
            displayName: 'Target Persona',
            user: { phoneNumber: targetUser.phoneNumber },
          },
        },
      ]),
      findUnique: jest.fn().mockResolvedValue({
        id: 'photo-admin-pending-1',
        profileId: targetProfile.id,
        status: PhotoStatus.PENDING_REVIEW,
        position: 0,
        thumbnailKey: 'pending1.webp',
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        return Promise.resolve({
          id: where.id,
          status: data.status,
        });
      }),
    },
    report: {
      count: jest.fn().mockResolvedValue(2),
    },
    match: {
      count: jest.fn().mockResolvedValue(42),
    },
    coinLedger: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 120 } }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    subscription: {
      count: jest.fn().mockResolvedValue(5),
      findMany: jest.fn().mockResolvedValue([]),
    },
    userSubscription: {
      count: jest.fn().mockResolvedValue(5),
      findMany: jest.fn().mockResolvedValue([]),
    },
    userAction: {
      count: jest.fn().mockResolvedValue(10),
      findMany: jest.fn().mockResolvedValue([]),
    },
    purchaseTransaction: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'tx-admin-1',
          userId: targetUser.id,
          productId: 'direct_notes_15',
          amountCents: 19900,
          currency: 'INR',
          status: 'COMPLETED',
          store: 'RAZORPAY',
          createdAt: new Date('2026-03-01T10:00:00.000Z'),
          user: {
            id: targetUser.id,
            phoneNumber: targetUser.phoneNumber,
            profile: { displayName: 'Target Persona' },
          },
        },
      ]),
    },
    userSafetyStrike: {
      create: jest.fn().mockResolvedValue({ id: 'strike-1' }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    authSession: {
      findUnique: jest.fn().mockResolvedValue({ id: 'sess-1', revokedAt: null }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    moderationAuditLog: {
      create: jest.fn().mockResolvedValue({ id: 'mod-audit-1' }),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    },
    $transaction: jest.fn().mockImplementation((cb) => cb(mockPrismaService)),
  };

  const mockRedisService = {
    incrementWithWindow: jest.fn().mockResolvedValue({ current: 1, ttl: 60 }),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
  };

  const mockStorageService = {
    getPublicUrl: jest.fn((k) => `https://r2.datingapp.com/${k}`),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideProvider(RedisService)
      .useValue(mockRedisService)
      .overrideProvider(STORAGE_SERVICE)
      .useValue(mockStorageService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    tokenService = app.get<TokenService>(TokenService);

    const tokenReg = await tokenService.generateTokens(regularUser.id, 'sess-reg');
    regularUserToken = tokenReg.accessToken;

    const tokenMod = await tokenService.generateTokens(moderatorUser.id, 'sess-mod');
    moderatorToken = tokenMod.accessToken;

    const tokenAdm = await tokenService.generateTokens(adminUser.id, 'sess-adm');
    adminToken = tokenAdm.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Role-Based Access Control on Admin Endpoints', () => {
    it('GET /admin/analytics/overview — Returns 401 when no token is supplied', async () => {
      const res = await request(app.getHttpServer()).get('/admin/analytics/overview');
      expect(res.status).toBe(401);
    });

    it('GET /admin/analytics/overview — Returns 403 Forbidden for regular USER role', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/analytics/overview')
        .set('Authorization', `Bearer ${regularUserToken}`);
      expect(res.status).toBe(403);
    });

    it('GET /admin/analytics/overview — Returns 200 for MODERATOR role', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/analytics/overview')
        .set('Authorization', `Bearer ${moderatorToken}`);
      expect(res.status).toBe(200);
      expect(res.body.totalUsers).toBeDefined();
      expect(res.body.pendingPhotosCount).toBe(1);
      expect(res.body.pendingReportsCount).toBe(2);
    });

    it('GET /admin/analytics/overview — Returns 200 with full KPI metrics for ADMIN role', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/analytics/overview')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.totalUsers).toBe(4);
      expect(res.body.totalMatches).toBe(42);
      expect(res.body.directNotePacksCount).toBe(10);
    });
  });

  describe('2. Admin User Directory & Deep Dossier Inspection', () => {
    it('GET /admin/users — Lists users with pagination and counts', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/users?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.users).toHaveLength(4);
      expect(res.body.totalCount).toBe(4);
    });

    it('GET /admin/users/:id — Retrieves full profile, safety strikes, reports, and ledger', async () => {
      const res = await request(app.getHttpServer())
        .get(`/admin/users/${targetUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(targetUser.id);
      expect(res.body.profile.displayName).toBe('Target Persona');
      expect(res.body.profile.photos).toHaveLength(1);
    });
  });

  describe('3. Admin Discipline & Sanctions Execution', () => {
    it('PATCH /admin/users/:id/discipline — Admin issues 24h Mute sanction', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/admin/users/${targetUser.id}/discipline`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          action: 'MUTE_24H',
          reason: 'Inappropriate chat behavior observed',
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('MUTE_24H');
    });

    it('PATCH /admin/users/:id/discipline — Admin applies permanent BAN', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/admin/users/${targetUser.id}/discipline`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          action: 'BAN',
          reason: 'Severe violation of community guidelines',
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('BAN');
    });
  });

  describe('4. Admin Photo Moderation Queue', () => {
    it('GET /admin/photos/pending — Retrieves pending photo queue', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/photos/pending')
        .set('Authorization', `Bearer ${moderatorToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].photoId).toBe('photo-admin-pending-1');
    });

    it('PATCH /admin/photos/:id/review — Approves pending photo', async () => {
      const res = await request(app.getHttpServer())
        .patch('/admin/photos/photo-admin-pending-1/review')
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send({
          action: 'APPROVE',
        });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe(PhotoStatus.APPROVED);
    });
  });

  describe('5. Admin Revenue & Coin Ledger', () => {
    it('GET /admin/transactions — Returns financial records', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/transactions')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe('tx-admin-1');
    });
  });
});
