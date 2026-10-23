import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { TokenService } from '../src/auth/services/token.service';
import { AgoraTokenService } from '../src/call/services/agora-token.service';
import {
  User,
  UserStatus,
  UserRole,
  CallStatus,
  CallType,
} from '@prisma/client';

describe('Call Authorization & Security (e2e)', () => {
  let app: INestApplication;
  let tokenService: TokenService;
  let callerToken: string;
  let receiverToken: string;
  let unrelatedToken: string;

  const callerUser: User = {
    id: 'user-caller-uuid-1',
    phoneNumber: '+919876543201',
    phoneVerifiedAt: new Date(),
    status: UserStatus.ACTIVE,
    role: UserRole.USER,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
  };

  const receiverUser: User = {
    id: 'user-receiver-uuid-2',
    phoneNumber: '+919876543202',
    phoneVerifiedAt: new Date(),
    status: UserStatus.ACTIVE,
    role: UserRole.USER,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
  };

  const unrelatedUser: User = {
    id: 'user-unrelated-uuid-3',
    phoneNumber: '+919876543203',
    phoneVerifiedAt: new Date(),
    status: UserStatus.ACTIVE,
    role: UserRole.USER,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
  };

  const userMap = new Map<string, User>([
    [callerUser.id, callerUser],
    [receiverUser.id, receiverUser],
    [unrelatedUser.id, unrelatedUser],
  ]);

  const sessionMap = new Map<string, any>();

  const activeCallLog = {
    id: 'a1111111-1111-4111-8111-111111111111',
    matchId: 'match-uuid-1',
    callerUserId: callerUser.id,
    receiverUserId: receiverUser.id,
    channelName: 'spark_call_active_123',
    callType: CallType.VIDEO,
    status: CallStatus.ACCEPTED,
    agreedCoins: 50,
    isEscrowHeld: true,
    startedAt: new Date(),
    connectedAt: new Date(),
    endedAt: null,
    endReason: null,
    durationSeconds: 120,
    createdAt: new Date(),
    updatedAt: new Date(),
    callerUser: {
      id: callerUser.id,
      profile: { displayName: 'Caller User', photos: [] },
    },
    receiverUser: {
      id: receiverUser.id,
      profile: { displayName: 'Receiver User', photos: [] },
    },
  };

  const ringingCallLog = {
    ...activeCallLog,
    id: 'b2222222-2222-4222-8222-222222222222',
    channelName: 'spark_call_ringing_123',
    status: CallStatus.RINGING,
    connectedAt: null,
    startedAt: new Date(),
  };

  const endedCallLog = {
    ...activeCallLog,
    id: 'c3333333-3333-4333-8333-333333333333',
    channelName: 'spark_call_ended_123',
    status: CallStatus.ENDED,
  };

  const rejectedCallLog = {
    ...activeCallLog,
    id: 'd4444444-4444-4444-8444-444444444444',
    channelName: 'spark_call_rejected_123',
    status: CallStatus.REJECTED,
  };

  const callLogMap = new Map<string, any>([
    [activeCallLog.id, activeCallLog],
    [ringingCallLog.id, ringingCallLog],
    [endedCallLog.id, endedCallLog],
    [rejectedCallLog.id, rejectedCallLog],
  ]);

  const mockPrismaService = {
    user: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        return Promise.resolve(userMap.get(where.id) || null);
      }),
    },
    authSession: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        return Promise.resolve(sessionMap.get(where.id) || null);
      }),
    },
    callLog: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        return Promise.resolve(callLogMap.get(where.id) || null);
      }),
      findMany: jest.fn().mockImplementation(({ where }) => {
        const callerMatch = where.OR?.find(
          (c: any) => c.callerUserId,
        )?.callerUserId;
        const receiverMatch = where.OR?.find(
          (c: any) => c.receiverUserId,
        )?.receiverUserId;
        const targetUserId = callerMatch || receiverMatch;

        const results = Array.from(callLogMap.values()).filter(
          (log) =>
            log.callerUserId === targetUserId ||
            log.receiverUserId === targetUserId,
        );
        return Promise.resolve(results);
      }),
    },
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
  };

  const mockRedisService = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
  };

  const mockAgoraTokenService = {
    generateRtcToken: jest.fn().mockImplementation((channelName, uid) => ({
      token: `mock_rtc_token_${channelName}_${uid}`,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    })),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideProvider(RedisService)
      .useValue(mockRedisService)
      .overrideProvider(AgoraTokenService)
      .useValue(mockAgoraTokenService)
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

    tokenService = app.get(TokenService);

    const sessionCaller = {
      id: 'sess-caller-1',
      userId: callerUser.id,
      refreshTokenHash: 'hCaller',
      expiresAt: new Date(Date.now() + 100000),
      revokedAt: null,
    };
    const sessionReceiver = {
      id: 'sess-receiver-2',
      userId: receiverUser.id,
      refreshTokenHash: 'hReceiver',
      expiresAt: new Date(Date.now() + 100000),
      revokedAt: null,
    };
    const sessionUnrelated = {
      id: 'sess-unrelated-3',
      userId: unrelatedUser.id,
      refreshTokenHash: 'hUnrelated',
      expiresAt: new Date(Date.now() + 100000),
      revokedAt: null,
    };

    sessionMap.set(sessionCaller.id, sessionCaller);
    sessionMap.set(sessionReceiver.id, sessionReceiver);
    sessionMap.set(sessionUnrelated.id, sessionUnrelated);

    const tokensCaller = await tokenService.generateTokens(
      callerUser.id,
      sessionCaller.id,
    );
    const tokensReceiver = await tokenService.generateTokens(
      receiverUser.id,
      sessionReceiver.id,
    );
    const tokensUnrelated = await tokenService.generateTokens(
      unrelatedUser.id,
      sessionUnrelated.id,
    );

    callerToken = tokensCaller.accessToken;
    receiverToken = tokensReceiver.accessToken;
    unrelatedToken = tokensUnrelated.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/calls/history (SEC-08)', () => {
    it('retrieves authenticated caller own history using JWT userId', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/calls/history')
        .set('Authorization', `Bearer ${callerToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      for (const log of res.body) {
        expect(
          log.callerUserId === callerUser.id ||
          log.receiverUserId === callerUser.id,
        ).toBe(true);
      }
    });

    it('retrieves authenticated receiver own history using JWT userId', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/calls/history')
        .set('Authorization', `Bearer ${receiverToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      for (const log of res.body) {
        expect(
          log.callerUserId === receiverUser.id ||
          log.receiverUserId === receiverUser.id,
        ).toBe(true);
      }
    });

    it('cannot access another user history by supplying ?userId parameter', async () => {
      // Unrelated user has 0 calls in history. Attempting to pass ?userId=callerUser.id
      // must NOT return callerUser's call history!
      const res = await request(app.getHttpServer())
        .get(`/api/v1/calls/history?userId=${callerUser.id}`)
        .set('Authorization', `Bearer ${unrelatedToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0);
    });

    it('rejects unauthenticated requests with 401', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/calls/history')
        .expect(401);
    });
  });

  describe('POST /api/v1/calls/token/refresh (SEC-01)', () => {
    it('allows authorized caller in an active call to refresh token with trusted server records', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/calls/token/refresh')
        .set('Authorization', `Bearer ${callerToken}`)
        .send({ callId: activeCallLog.id })
        .expect(200);

      expect(res.body.callId).toBe(activeCallLog.id);
      expect(res.body.channelName).toBe(activeCallLog.channelName);
      expect(res.body.uid).toBe(1001);
      expect(res.body.token).toContain(
        'mock_rtc_token_spark_call_active_123_1001',
      );
      expect(res.body.expiresAt).toBeDefined();
    });

    it('allows authorized receiver in an active call to refresh token with trusted server records', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/calls/token/refresh')
        .set('Authorization', `Bearer ${receiverToken}`)
        .send({ callId: activeCallLog.id })
        .expect(200);

      expect(res.body.callId).toBe(activeCallLog.id);
      expect(res.body.channelName).toBe(activeCallLog.channelName);
      expect(res.body.uid).toBe(2002);
      expect(res.body.token).toContain(
        'mock_rtc_token_spark_call_active_123_2002',
      );
      expect(res.body.expiresAt).toBeDefined();
    });

    it('allows authorized participant to refresh token during RINGING call status', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/calls/token/refresh')
        .set('Authorization', `Bearer ${callerToken}`)
        .send({ callId: ringingCallLog.id })
        .expect(200);

      expect(res.body.callId).toBe(ringingCallLog.id);
      expect(res.body.uid).toBe(1001);
    });

    it('denies a non-participant from refreshing token on a call (403 Forbidden)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/calls/token/refresh')
        .set('Authorization', `Bearer ${unrelatedToken}`)
        .send({ callId: activeCallLog.id })
        .expect(403);

      expect(res.body.message).toContain(
        'You are not a participant in this call.',
      );
    });

    it('denies a participant sending client-supplied channelName (400 Bad Request via ValidationPipe)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/calls/token/refresh')
        .set('Authorization', `Bearer ${callerToken}`)
        .send({
          callId: activeCallLog.id,
          channelName: 'attacker_controlled_channel',
        })
        .expect(400);

      expect(JSON.stringify(res.body.message)).toContain(
        'property channelName should not exist',
      );
    });

    it('denies a participant sending client-supplied Agora UID (400 Bad Request via ValidationPipe)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/calls/token/refresh')
        .set('Authorization', `Bearer ${callerToken}`)
        .send({
          callId: activeCallLog.id,
          uid: 9999,
        })
        .expect(400);

      expect(JSON.stringify(res.body.message)).toContain(
        'property uid should not exist',
      );
    });

    it('denies token refresh when call duration limit has been reached (403 Forbidden)', async () => {
      const expiredCallId = 'e5555555-5555-4555-8555-555555555555';
      const expiredCallLog = {
        ...activeCallLog,
        id: expiredCallId,
        connectedAt: new Date(Date.now() - 950 * 1000), // 950s elapsed (> 900s max)
      };
      callLogMap.set(expiredCallId, expiredCallLog);

      const res = await request(app.getHttpServer())
        .post('/api/v1/calls/token/refresh')
        .set('Authorization', `Bearer ${callerToken}`)
        .send({ callId: expiredCallId })
        .expect(403);

      expect(res.body.message).toContain(
        'Cannot refresh token: call duration limit has been reached.',
      );
    });

    it('denies token refresh when call has connectedAt = null but startedAt exceeded duration limit (403 Forbidden)', async () => {
      const nullConnectedCallId = 'f6666666-6666-4666-8666-666666666666';
      const nullConnectedCallLog = {
        ...activeCallLog,
        id: nullConnectedCallId,
        connectedAt: null,
        startedAt: new Date(Date.now() - 950 * 1000), // 950s elapsed (> 900s max)
      };
      callLogMap.set(nullConnectedCallId, nullConnectedCallLog);

      const res = await request(app.getHttpServer())
        .post('/api/v1/calls/token/refresh')
        .set('Authorization', `Bearer ${callerToken}`)
        .send({ callId: nullConnectedCallId })
        .expect(403);

      expect(res.body.message).toContain(
        'Cannot refresh token: call duration limit has been reached.',
      );
    });

    it('denies token refresh when call is in RINGING state and ringing window has expired (403 Forbidden)', async () => {
      const expiredRingingId = '77777777-7777-4777-8777-777777777777';
      const expiredRingingLog = {
        ...activeCallLog,
        id: expiredRingingId,
        status: CallStatus.RINGING,
        connectedAt: null,
        startedAt: new Date(Date.now() - 70 * 1000), // 70s elapsed (> 60s max)
      };
      callLogMap.set(expiredRingingId, expiredRingingLog);

      const res = await request(app.getHttpServer())
        .post('/api/v1/calls/token/refresh')
        .set('Authorization', `Bearer ${callerToken}`)
        .send({ callId: expiredRingingId })
        .expect(403);

      expect(res.body.message).toContain(
        'Cannot refresh token: call ringing window has expired.',
      );
    });

    it('denies token refresh for an ENDED call (403 Forbidden)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/calls/token/refresh')
        .set('Authorization', `Bearer ${callerToken}`)
        .send({ callId: endedCallLog.id })
        .expect(403);

      expect(res.body.message).toContain(
        'Cannot refresh token for call with status ENDED',
      );
    });

    it('denies token refresh for a REJECTED call (403 Forbidden)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/calls/token/refresh')
        .set('Authorization', `Bearer ${callerToken}`)
        .send({ callId: rejectedCallLog.id })
        .expect(403);

      expect(res.body.message).toContain(
        'Cannot refresh token for call with status REJECTED',
      );
    });

    it('rejects a non-existent call ID with 404 Not Found', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/calls/token/refresh')
        .set('Authorization', `Bearer ${callerToken}`)
        .send({ callId: '00000000-0000-0000-0000-000000000000' })
        .expect(404);
    });

    it('rejects malformed callId with 400 Bad Request via ValidationPipe', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/calls/token/refresh')
        .set('Authorization', `Bearer ${callerToken}`)
        .send({ callId: 'not-a-valid-uuid' })
        .expect(400);
    });

    it('rejects empty body with 400 Bad Request', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/calls/token/refresh')
        .set('Authorization', `Bearer ${callerToken}`)
        .send({})
        .expect(400);
    });
  });
});
