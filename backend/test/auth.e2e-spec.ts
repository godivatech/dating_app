import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { SMS_SERVICE, ISmsService } from '../src/sms/sms.service.interface';
import { User, UserStatus } from '@prisma/client';

describe('Authentication Lifecycle (e2e)', () => {
  let app: INestApplication;
  let lastDispatchedOtp: string = '';

  const userMap = new Map<string, User>();
  const challengeMap = new Map<string, any>();
  const sessionMap = new Map<string, any>();
  const redisMemory = new Map<string, any>();

  const mockSmsService: ISmsService = {
    sendOtp: jest.fn().mockImplementation((_phone: string, otp: string) => {
      lastDispatchedOtp = otp;
      return Promise.resolve();
    }),
  };

  const mockRedisService = {
    setWithNx: jest.fn().mockImplementation((key: string) => {
      if (redisMemory.has(key)) return Promise.resolve(false);
      redisMemory.set(key, true);
      return Promise.resolve(true);
    }),
    incrementWithWindow: jest.fn().mockImplementation((key: string) => {
      const count = (redisMemory.get(key) || 0) + 1;
      redisMemory.set(key, count);
      return Promise.resolve({ current: count, isFirst: count === 1 });
    }),
    get: jest
      .fn()
      .mockImplementation((key: string) =>
        Promise.resolve(redisMemory.get(key) || null),
      ),
    del: jest.fn().mockImplementation((key: string) => {
      redisMemory.delete(key);
      return Promise.resolve();
    }),
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where.id) return Promise.resolve(userMap.get(where.id) || null);
        if (where.phoneNumber) {
          for (const u of userMap.values()) {
            if (u.phoneNumber === where.phoneNumber)
              return Promise.resolve({ ...u });
          }
        }
        return Promise.resolve(null);
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        const u: User = {
          id: `usr_${Date.now()}_${Math.random()}`,
          phoneNumber: data.phoneNumber,
          phoneVerifiedAt: data.phoneVerifiedAt,
          status: data.status || UserStatus.ACTIVE,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastLoginAt: data.lastLoginAt,
        };
        userMap.set(u.id, u);
        return Promise.resolve({ ...u });
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const u = userMap.get(where.id);
        if (!u) return Promise.resolve(null);
        Object.assign(u, data);
        userMap.set(where.id, u);
        return Promise.resolve({ ...u });
      }),
    },
    otpChallenge: {
      create: jest.fn().mockImplementation(({ data }) => {
        challengeMap.set(data.id, { ...data });
        return Promise.resolve({ ...data });
      }),
      findUnique: jest.fn().mockImplementation(({ where }) => {
        return Promise.resolve(challengeMap.get(where.id) || null);
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const c = challengeMap.get(where.id);
        if (!c) return Promise.resolve(null);
        if (data.attemptsCount?.increment) {
          c.attemptsCount =
            (c.attemptsCount || 0) + data.attemptsCount.increment;
        }
        if (data.isConsumed !== undefined) {
          c.isConsumed = data.isConsumed;
        }
        if (data.consumedAt !== undefined) {
          c.consumedAt = data.consumedAt;
        }
        challengeMap.set(where.id, c);
        return Promise.resolve({ ...c });
      }),
    },
    authSession: {
      create: jest.fn().mockImplementation(({ data }) => {
        const s = {
          id: `sess_${Date.now()}_${Math.random()}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastUsedAt: new Date(),
        };
        sessionMap.set(s.id, s);
        return Promise.resolve({ ...s });
      }),
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where.id) return Promise.resolve(sessionMap.get(where.id) || null);
        if (where.refreshTokenHash) {
          for (const s of sessionMap.values()) {
            if (s.refreshTokenHash === where.refreshTokenHash) {
              const u = userMap.get(s.userId);
              return Promise.resolve({ ...s, user: u });
            }
          }
        }
        return Promise.resolve(null);
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const s = sessionMap.get(where.id);
        if (!s) return Promise.resolve(null);
        Object.assign(s, data);
        sessionMap.set(where.id, s);
        return Promise.resolve({ ...s });
      }),
      updateMany: jest.fn().mockImplementation(({ where, data }) => {
        let count = 0;
        for (const s of sessionMap.values()) {
          if (where.id && s.id === where.id) {
            Object.assign(s, data);
            count++;
          }
          if (where.userId && sessionMap.get(s.id)?.userId === where.userId) {
            Object.assign(s, data);
            count++;
          }
        }
        return Promise.resolve({ count });
      }),
    },
    $transaction: jest.fn().mockImplementation(async (callback: any) => {
      const res = callback(mockPrismaService);
      return await res;
    }),
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    userMap.clear();
    challengeMap.clear();
    sessionMap.clear();
    redisMemory.clear();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideProvider(RedisService)
      .useValue(mockRedisService)
      .overrideProvider(SMS_SERVICE)
      .useValue(mockSmsService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  let challengeId: string;
  let accessToken: string;
  let refreshToken: string;

  it('1. POST /api/v1/auth/otp/request rejects invalid phone number', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/otp/request')
      .send({ phoneNumber: 'invalid123' })
      .expect(400);
  });

  it('2. POST /api/v1/auth/otp/request creates OTP challenge', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/otp/request')
      .send({ phoneNumber: '9876543210' })
      .expect(200);

    expect(res.body.challengeId).toBeDefined();
    expect(res.body.expiresIn).toBe(300);
    challengeId = res.body.challengeId;
    expect(lastDispatchedOtp).toMatch(/^\d{6}$/);
  });

  it('3. POST /api/v1/auth/otp/request enforces cooldown on immediate retry', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/otp/request')
      .send({ phoneNumber: '9876543210' })
      .expect(429);
  });

  it('4. POST /api/v1/auth/otp/verify rejects incorrect OTP', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/otp/verify')
      .send({ challengeId, otp: '000000' })
      .expect(400);

    expect(res.body.message).toContain('2 attempt(s) remaining');
  });

  it('5. POST /api/v1/auth/otp/verify authenticates with valid OTP and creates account', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/otp/verify')
      .send({ challengeId, otp: lastDispatchedOtp })
      .expect(200);

    expect(res.body.user).toBeDefined();
    expect(res.body.user.phoneNumber).toBe('+919876543210');
    expect(res.body.user.status).toBe('ACTIVE');
    expect(res.body.user.lastLoginAt).toBeDefined();
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.expiresIn).toBe(900);

    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it('6. GET /api/v1/auth/me rejects unauthorized request', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });

  it('7. GET /api/v1/auth/me returns current user for valid Bearer token', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.phoneNumber).toBe('+919876543210');
    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.refreshTokenHash).toBeUndefined();
    expect(res.body.otpHash).toBeUndefined();
  });

  it('8. POST /api/v1/auth/refresh rotates tokens', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.refreshToken).not.toBe(refreshToken);

    // Old refresh token must be rejected
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(401);

    // Update active tokens
    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it('9. POST /api/v1/auth/logout revokes session', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    // After logout, token must be rejected
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);
  });
});
