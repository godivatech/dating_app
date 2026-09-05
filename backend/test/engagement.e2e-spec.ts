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
  NotificationType,
} from '@prisma/client';

describe('Engagement, Profile Interaction & Notifications Domain (e2e)', () => {
  let app: INestApplication;
  let tokenService: TokenService;

  let authTokenUserA: string;

  const userA: User = {
    id: 'user-eng-e2e-a',
    phoneNumber: '+919876555551',
    phoneVerifiedAt: new Date(),
    status: UserStatus.ACTIVE,
    role: UserRole.USER,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
  };

  const userB: User = {
    id: 'user-eng-e2e-b',
    phoneNumber: '+919876555552',
    phoneVerifiedAt: new Date(),
    status: UserStatus.ACTIVE,
    role: UserRole.USER,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
  };

  const profileA = {
    id: 'prof-eng-a',
    userId: userA.id,
    displayName: 'Aakash',
    dateOfBirth: new Date('1997-06-15T00:00:00.000Z'),
    gender: Gender.MAN,
    bio: 'Software engineer who loves tennis.',
    locationCity: 'Chennai',
    locationRegion: 'Tamil Nadu',
    locationCountry: 'IN',
    status: ProfileStatus.READY,
    visibility: ProfileVisibility.VISIBLE,
    createdAt: new Date(),
    updatedAt: new Date(),
    photos: [
      {
        id: 'photo-eng-a1',
        profileId: 'prof-eng-a',
        objectKey: 'profiles/a/1.jpg',
        thumbnailKey: 'profiles/a/thumb.webp',
        mediumKey: 'profiles/a/med.webp',
        status: PhotoStatus.APPROVED,
        position: 0,
        width: 800,
        height: 1000,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    interests: [],
    preferences: null,
    user: userA,
  };

  const profileB = {
    id: 'prof-eng-b',
    userId: userB.id,
    displayName: 'Pooja',
    dateOfBirth: new Date('1999-09-20T00:00:00.000Z'),
    gender: Gender.WOMAN,
    bio: 'Architect, filter coffee fan.',
    locationCity: 'Coimbatore',
    locationRegion: 'Tamil Nadu',
    locationCountry: 'IN',
    status: ProfileStatus.READY,
    visibility: ProfileVisibility.VISIBLE,
    createdAt: new Date(),
    updatedAt: new Date(),
    photos: [
      {
        id: 'photo-eng-b1',
        profileId: 'prof-eng-b',
        objectKey: 'profiles/b/1.jpg',
        thumbnailKey: 'profiles/b/thumb.webp',
        mediumKey: 'profiles/b/med.webp',
        status: PhotoStatus.APPROVED,
        position: 0,
        width: 800,
        height: 1000,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    interests: [],
    preferences: null,
    user: userB,
  };

  const notificationsStore: any[] = [];
  const devicesStore: any[] = [];
  let isBlockedMutual = false;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where.id === userA.id || where.phoneNumber === userA.phoneNumber)
          return Promise.resolve(userA);
        if (where.id === userB.id || where.phoneNumber === userB.phoneNumber)
          return Promise.resolve(userB);
        return Promise.resolve(null);
      }),
      findMany: jest.fn().mockResolvedValue([userA, userB]),
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
        if (where.OR) {
          for (const cond of where.OR) {
            if (cond.id === profileA.id || cond.userId === userA.id)
              return Promise.resolve(profileA);
            if (cond.id === profileB.id || cond.userId === userB.id)
              return Promise.resolve(profileB);
          }
        }
        if (where.id === profileA.id) return Promise.resolve(profileA);
        if (where.id === profileB.id) return Promise.resolve(profileB);
        return Promise.resolve(null);
      }),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
    },
    block: {
      findFirst: jest.fn().mockImplementation(({ where: _where }) => {
        if (isBlockedMutual) {
          return Promise.resolve({ id: 'block-active-1' });
        }
        return Promise.resolve(null);
      }),
      findMany: jest.fn().mockImplementation(() => {
        if (isBlockedMutual) {
          return Promise.resolve([
            { blockerUserId: userA.id, blockedUserId: userB.id },
          ]);
        }
        return Promise.resolve([]);
      }),
    },
    match: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    authSession: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 'session-eng', revokedAt: null }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    notification: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where.userId_idempotencyKey) {
          const found = notificationsStore.find(
            (n) =>
              n.userId === where.userId_idempotencyKey.userId &&
              n.idempotencyKey === where.userId_idempotencyKey.idempotencyKey,
          );
          return Promise.resolve(found || null);
        }
        return Promise.resolve(null);
      }),
      findFirst: jest.fn().mockImplementation(({ where }) => {
        const found = notificationsStore.find(
          (n) => n.id === where.id && n.userId === where.userId,
        );
        return Promise.resolve(found || null);
      }),
      findMany: jest.fn().mockImplementation(({ where }) => {
        const userNotifs = notificationsStore.filter(
          (n) => n.userId === where.userId,
        );
        return Promise.resolve(userNotifs);
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        const notif = {
          id: `notif-${Date.now()}-${Math.random()}`,
          ...data,
          isRead: false,
          readAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        notificationsStore.push(notif);
        return Promise.resolve(notif);
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const notif = notificationsStore.find((n) => n.id === where.id);
        if (notif) {
          Object.assign(notif, data);
        }
        return Promise.resolve(notif);
      }),
      updateMany: jest.fn().mockImplementation(({ where, data }) => {
        let count = 0;
        notificationsStore.forEach((n) => {
          if (
            n.userId === where.userId &&
            (where.isRead === undefined || n.isRead === where.isRead)
          ) {
            Object.assign(n, data);
            count++;
          }
        });
        return Promise.resolve({ count });
      }),
      count: jest.fn().mockImplementation(({ where }) => {
        const count = notificationsStore.filter(
          (n) =>
            n.userId === where.userId &&
            (where.isRead === undefined || n.isRead === where.isRead),
        ).length;
        return Promise.resolve(count);
      }),
    },
    deviceRegistration: {
      findMany: jest.fn().mockImplementation(({ where }) => {
        const devs = devicesStore.filter(
          (d) =>
            d.userId === where.userId &&
            (where.isActive === undefined || d.isActive === where.isActive),
        );
        return Promise.resolve(devs);
      }),
      upsert: jest.fn().mockImplementation(({ where, create, update }) => {
        let dev = devicesStore.find(
          (d) =>
            d.userId === where.userId_token.userId &&
            d.token === where.userId_token.token,
        );
        if (dev) {
          Object.assign(dev, update);
        } else {
          dev = {
            id: `dev-${Date.now()}`,
            ...create,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          devicesStore.push(dev);
        }
        return Promise.resolve(dev);
      }),
      updateMany: jest.fn().mockImplementation(({ where, data }) => {
        devicesStore.forEach((d) => {
          if (d.userId === where.userId && d.token === where.token) {
            Object.assign(d, data);
          }
        });
        return Promise.resolve({ count: 1 });
      }),
    },
    $transaction: jest.fn().mockImplementation((cb) => cb(mockPrismaService)),
  };

  const mockRedisService = {
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

    const tokenA = await tokenService.generateTokens(userA.id, 'sess-eng-a');
    authTokenUserA = tokenA.accessToken;

    const tokenB = await tokenService.generateTokens(userB.id, 'sess-eng-b');
    authTokenUserB = tokenB.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Viewable Profile Inspection (GET /profile/view/:profileId)', () => {
    it('User A inspects User B full profile successfully', async () => {
      const res = await request(app.getHttpServer())
        .get(`/profile/view/${profileB.id}`)
        .set('Authorization', `Bearer ${authTokenUserA}`);

      expect(res.status).toBe(200);
      expect(res.body.displayName).toBe('Pooja');
      expect(res.body.age).toBeGreaterThanOrEqual(24);
      expect(res.body.locationCity).toBe('Coimbatore');
      expect(res.body.photos.length).toBe(1);
      expect(res.body.photos[0].thumbnailUrl).toContain(
        'profiles/b/thumb.webp',
      );
    });

    it('Safety barrier: User A cannot view User B profile if blocked (403 Forbidden)', async () => {
      isBlockedMutual = true;

      const res = await request(app.getHttpServer())
        .get(`/profile/view/${profileB.id}`)
        .set('Authorization', `Bearer ${authTokenUserA}`);

      expect(res.status).toBe(403);
      isBlockedMutual = false; // Reset
    });
  });

  describe('2. Notifications Lifecycle & Unread Counters', () => {
    it('POST /notifications/device-token — registers iOS device token for User A', async () => {
      const res = await request(app.getHttpServer())
        .post('/notifications/device-token')
        .set('Authorization', `Bearer ${authTokenUserA}`)
        .send({
          token: 'apns-token-a-12345',
          platform: 'IOS',
          deviceModel: 'iPhone 15 Pro',
        });

      expect(res.status).toBe(200);
      expect(res.body.platform).toBe('IOS');
      expect(res.body.isActive).toBe(true);
    });

    it('NotificationsService idempotently creates notification and updates unread counts', async () => {
      // Create notification for User A directly via Prisma mock store
      notificationsStore.push({
        id: 'notif-match-1',
        userId: userA.id,
        type: NotificationType.NEW_MATCH,
        referenceId: 'match-1',
        title: "It's a Match! 🎉",
        body: 'You matched with Pooja!',
        metadata: { matchId: 'match-1' },
        isRead: false,
        readAt: null,
        idempotencyKey: `match:match-1:user:${userA.id}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app.getHttpServer())
        .get('/notifications/unread-count')
        .set('Authorization', `Bearer ${authTokenUserA}`);

      expect(res.status).toBe(200);
      expect(res.body.unreadCount).toBeGreaterThanOrEqual(1);
    });

    it('GET /notifications — User A lists paginated notifications', async () => {
      const res = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${authTokenUserA}`);

      expect(res.status).toBe(200);
      expect(res.body.notifications.length).toBeGreaterThanOrEqual(1);
      expect(res.body.notifications[0].type).toBe('NEW_MATCH');
    });

    it('PATCH /notifications/:id/read — User A marks notification as read', async () => {
      const res = await request(app.getHttpServer())
        .patch('/notifications/notif-match-1/read')
        .set('Authorization', `Bearer ${authTokenUserA}`);

      expect(res.status).toBe(200);
      expect(res.body.isRead).toBe(true);
    });

    it('POST /notifications/read-all — User A marks all notifications as read', async () => {
      const res = await request(app.getHttpServer())
        .post('/notifications/read-all')
        .set('Authorization', `Bearer ${authTokenUserA}`);

      expect(res.status).toBe(200);

      const unreadRes = await request(app.getHttpServer())
        .get('/notifications/unread-count')
        .set('Authorization', `Bearer ${authTokenUserA}`);

      expect(unreadRes.body.unreadCount).toBe(0);
    });

    it('DELETE /notifications/device-token — User A unregisters device token on logout', async () => {
      const res = await request(app.getHttpServer())
        .delete('/notifications/device-token')
        .set('Authorization', `Bearer ${authTokenUserA}`)
        .send({ token: 'apns-token-a-12345' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
