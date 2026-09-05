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
  MatchStatus,
  ReportStatus,
} from '@prisma/client';
import {
  ReportTargetType,
  ReportReason,
  ModerationActionType,
} from '../src/../../shared/src/types';

describe('Safety, Blocking, Reporting & Moderation Domain (e2e)', () => {
  let app: INestApplication;
  let tokenService: TokenService;

  let authTokenUserA: string;
  let authTokenUserB: string;
  let authTokenModerator: string;

  const userA: User = {
    id: 'user-safety-e2e-a',
    phoneNumber: '+919876544441',
    phoneVerifiedAt: new Date(),
    status: UserStatus.ACTIVE,
    role: UserRole.USER,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
  };

  const userB: User = {
    id: 'user-safety-e2e-b',
    phoneNumber: '+919876544442',
    phoneVerifiedAt: new Date(),
    status: UserStatus.ACTIVE,
    role: UserRole.USER,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
  };

  const moderatorUser: User = {
    id: 'user-safety-e2e-mod',
    phoneNumber: '+919876544449',
    phoneVerifiedAt: new Date(),
    status: UserStatus.ACTIVE,
    role: UserRole.MODERATOR,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
  };

  const profileA: any = {
    id: 'prof-safety-e2e-a',
    userId: userA.id,
    displayName: 'Alice Safety',
    dateOfBirth: new Date('2000-05-15T00:00:00.000Z'),
    gender: Gender.WOMAN,
    bio: 'Software engineer in Bengaluru.',
    locationCity: 'Bengaluru',
    locationRegion: 'Karnataka',
    locationCountry: 'IN',
    visibility: ProfileVisibility.VISIBLE,
    status: ProfileStatus.READY,
    preferences: {
      preferredGenderMode: PreferredGenderMode.SELECTED,
      preferredGenders: [Gender.MAN],
      minAge: 24,
      maxAge: 32,
      relationshipIntent: RelationshipIntent.LONG_TERM,
    },
    interests: [],
    photos: [
      {
        id: 'p-sa1',
        profileId: 'prof-safety-e2e-a',
        status: PhotoStatus.APPROVED,
        position: 0,
        thumbnailKey: 'sa.webp',
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const profileB: any = {
    id: 'prof-safety-e2e-b',
    userId: userB.id,
    displayName: 'Bob Safety',
    dateOfBirth: new Date('1998-08-20T00:00:00.000Z'),
    gender: Gender.MAN,
    bio: 'Photographer in Bengaluru.',
    locationCity: 'Bengaluru',
    locationRegion: 'Karnataka',
    locationCountry: 'IN',
    visibility: ProfileVisibility.VISIBLE,
    status: ProfileStatus.READY,
    preferences: {
      preferredGenderMode: PreferredGenderMode.SELECTED,
      preferredGenders: [Gender.WOMAN],
      minAge: 22,
      maxAge: 30,
      relationshipIntent: RelationshipIntent.LONG_TERM,
    },
    interests: [],
    photos: [
      {
        id: 'p-sb1',
        profileId: 'prof-safety-e2e-b',
        status: PhotoStatus.APPROVED,
        position: 0,
        thumbnailKey: 'sb.webp',
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const userMap = new Map<string, User>([
    [userA.id, userA],
    [userB.id, userB],
    [moderatorUser.id, moderatorUser],
  ]);

  const profileMap = new Map<string, any>([
    [profileA.id, profileA],
    [profileB.id, profileB],
  ]);

  const matchRecord: any = {
    id: 'match-safety-e2e-1',
    user1Id: userA.id,
    user2Id: userB.id,
    status: MatchStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const blockMap = new Map<string, any>();
  const reportMap = new Map<string, any>();
  const auditLogMap = new Map<string, any>();

  const mockPrismaService = {
    user: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const u = userMap.get(where.id);
        if (!u) return Promise.resolve(null);
        const p = Array.from(profileMap.values()).find(
          (prof) => prof.userId === u.id,
        );
        return Promise.resolve({ ...u, profile: p || null });
      }),
      findMany: jest.fn().mockImplementation(({ where }) => {
        if (where?.id?.in) {
          const matched = where.id.in
            .map((id: string) => userMap.get(id))
            .filter(Boolean);
          return Promise.resolve(matched);
        }
        return Promise.resolve(Array.from(userMap.values()));
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const u = userMap.get(where.id);
        if (!u) throw new Error('User not found');
        Object.assign(u, data);
        return Promise.resolve(u);
      }),
    },
    datingProfile: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where.userId) {
          return Promise.resolve(
            Array.from(profileMap.values()).find(
              (p) => p.userId === where.userId,
            ) || null,
          );
        }
        return Promise.resolve(profileMap.get(where.id) || null);
      }),
      findMany: jest.fn().mockImplementation(({ where }) => {
        let results = Array.from(profileMap.values());
        if (where?.userId?.in) {
          results = results.filter((p) => where.userId.in.includes(p.userId));
        }
        return Promise.resolve(results);
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const p = Array.from(profileMap.values()).find(
          (prof) => prof.userId === where.userId || prof.id === where.id,
        );
        if (p) Object.assign(p, data);
        return Promise.resolve(p);
      }),
    },
    block: {
      findMany: jest.fn().mockImplementation(({ where }) => {
        let results = Array.from(blockMap.values());
        if (where?.blockerUserId) {
          results = results.filter(
            (b) => b.blockerUserId === where.blockerUserId,
          );
        } else if (where?.OR) {
          const userId = where.OR[0].blockerUserId || where.OR[0].blockedUserId;
          results = results.filter(
            (b) => b.blockerUserId === userId || b.blockedUserId === userId,
          );
        }
        return Promise.resolve(results);
      }),
      findFirst: jest.fn().mockImplementation(({ where }) => {
        for (const b of blockMap.values()) {
          for (const cond of where.OR || []) {
            if (
              b.blockerUserId === cond.blockerUserId &&
              b.blockedUserId === cond.blockedUserId
            ) {
              return Promise.resolve(b);
            }
          }
        }
        return Promise.resolve(null);
      }),
      upsert: jest.fn().mockImplementation(({ where, create, update }) => {
        const key = `${where.blockerUserId_blockedUserId.blockerUserId}:${where.blockerUserId_blockedUserId.blockedUserId}`;
        let b = blockMap.get(key);
        if (b) {
          Object.assign(b, update);
        } else {
          b = { id: `block-${Date.now()}`, ...create, createdAt: new Date() };
          blockMap.set(key, b);
        }
        return Promise.resolve(b);
      }),
      deleteMany: jest.fn().mockImplementation(({ where }) => {
        const key = `${where.blockerUserId}:${where.blockedUserId}`;
        const existed = blockMap.delete(key);
        return Promise.resolve({ count: existed ? 1 : 0 });
      }),
    },
    report: {
      create: jest.fn().mockImplementation(({ data }) => {
        const r = {
          id: `rep-${Date.now()}-${Math.random()}`,
          ...data,
          status: ReportStatus.OPEN,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        reportMap.set(r.id, r);
        return Promise.resolve(r);
      }),
      findMany: jest.fn().mockImplementation(() => {
        return Promise.resolve(Array.from(reportMap.values()));
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const r = reportMap.get(where.id);
        if (r) Object.assign(r, data);
        return Promise.resolve(r);
      }),
    },
    moderationAuditLog: {
      create: jest.fn().mockImplementation(({ data }) => {
        const log = {
          id: `audit-${Date.now()}-${Math.random()}`,
          ...data,
          createdAt: new Date(),
        };
        auditLogMap.set(log.id, log);
        return Promise.resolve(log);
      }),
      findMany: jest.fn().mockImplementation(() => {
        return Promise.resolve(Array.from(auditLogMap.values()));
      }),
    },
    match: {
      findMany: jest.fn().mockImplementation(() => {
        return Promise.resolve([matchRecord]);
      }),
      updateMany: jest.fn().mockImplementation(({ data }) => {
        if (matchRecord.status === MatchStatus.ACTIVE) {
          Object.assign(matchRecord, data);
          return Promise.resolve({ count: 1 });
        }
        return Promise.resolve({ count: 0 });
      }),
    },
    conversation: {
      findUnique: jest.fn().mockImplementation(() => {
        return Promise.resolve({
          id: 'conv-safety-1',
          matchId: matchRecord.id,
          match: {
            ...matchRecord,
            user1: userA,
            user2: userB,
          },
        });
      }),
    },
    authSession: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 'session-1', revokedAt: null }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    discoveryImpression: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    userAction: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    message: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    profilePhoto: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    userSafetyStrike: {
      count: jest.fn().mockResolvedValue(0),
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

    const tokenA = await tokenService.generateTokens(userA.id, 'sess-a');
    authTokenUserA = tokenA.accessToken;

    const tokenB = await tokenService.generateTokens(userB.id, 'sess-b');
    authTokenUserB = tokenB.accessToken;

    const tokenMod = await tokenService.generateTokens(
      moderatorUser.id,
      'sess-mod',
    );
    authTokenModerator = tokenMod.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. User Blocking & Mutual Safety Suppression Lifecycle', () => {
    it('POST /blocks/:targetUserId — User A blocks User B successfully', async () => {
      const res = await request(app.getHttpServer())
        .post(`/blocks/${userB.id}`)
        .set('Authorization', `Bearer ${authTokenUserA}`)
        .send({ reason: 'Unwanted advances' });

      expect(res.status).toBe(200);
      expect(res.body.blockedUserId).toBe(userB.id);
      expect(matchRecord.status).toBe(MatchStatus.UNMATCHED);
    });

    it('GET /blocks — User A lists blocked users', async () => {
      const res = await request(app.getHttpServer())
        .get('/blocks')
        .set('Authorization', `Bearer ${authTokenUserA}`);

      expect(res.status).toBe(200);
      expect(res.body.blocks.length).toBeGreaterThanOrEqual(1);
      expect(res.body.blocks[0].blockedUserId).toBe(userB.id);
    });

    it('POST /conversations/:id/messages — User B sending a message to User A is rejected with 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/conversations/conv-safety-1/messages')
        .set('Authorization', `Bearer ${authTokenUserB}`)
        .send({
          clientMessageId: 'cli-fail-after-block',
          body: 'Hello? Why did you disappear?',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('2. User Reporting Lifecycle', () => {
    it('POST /reports — User B reports User A for Harassment', async () => {
      const res = await request(app.getHttpServer())
        .post('/reports')
        .set('Authorization', `Bearer ${authTokenUserB}`)
        .send({
          targetUserId: userA.id,
          targetType: ReportTargetType.USER,
          targetId: userA.id,
          reason: ReportReason.HARASSMENT,
          description: 'Spamming repeatedly',
        });

      expect(res.status).toBe(200);
      expect(res.body.reportedUserId).toBe(userA.id);
      expect(res.body.reason).toBe(ReportReason.HARASSMENT);
    });

    it('POST /reports — Reject self reporting with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/reports')
        .set('Authorization', `Bearer ${authTokenUserB}`)
        .send({
          targetUserId: userB.id,
          targetType: ReportTargetType.USER,
          targetId: userB.id,
          reason: ReportReason.HARASSMENT,
        });

      expect(res.status).toBe(400);
    });
  });

  describe('3. Moderator Authorization & Action Lifecycle', () => {
    it('GET /moderation/reports — Regular user B is rejected with 403 Forbidden', async () => {
      const res = await request(app.getHttpServer())
        .get('/moderation/reports')
        .set('Authorization', `Bearer ${authTokenUserB}`);

      expect(res.status).toBe(403);
    });

    it('GET /moderation/reports — Moderator lists pending reports', async () => {
      const res = await request(app.getHttpServer())
        .get('/moderation/reports')
        .set('Authorization', `Bearer ${authTokenModerator}`);

      expect(res.status).toBe(200);
      expect(res.body.reports.length).toBeGreaterThanOrEqual(1);
    });

    it('POST /moderation/actions — Moderator suspends User A and writes immutable audit log', async () => {
      const report = Array.from(reportMap.values())[0];
      const res = await request(app.getHttpServer())
        .post('/moderation/actions')
        .set('Authorization', `Bearer ${authTokenModerator}`)
        .send({
          targetUserId: userA.id,
          actionType: ModerationActionType.SUSPEND_ACCOUNT,
          reason: 'Severe violation of terms',
          reportId: report?.id,
        });

      expect(res.status).toBe(200);
      expect(res.body.actionType).toBe(ModerationActionType.SUSPEND_ACCOUNT);
      expect(res.body.moderatorUserId).toBe(moderatorUser.id);
      expect(userA.status).toBe(UserStatus.SUSPENDED);
    });

    it('GET /moderation/audit-logs — Moderator lists audit logs', async () => {
      const res = await request(app.getHttpServer())
        .get('/moderation/audit-logs')
        .set('Authorization', `Bearer ${authTokenModerator}`);

      expect(res.status).toBe(200);
      expect(res.body.logs.length).toBeGreaterThanOrEqual(1);
      expect(res.body.logs[0].actionType).toBe(
        ModerationActionType.SUSPEND_ACCOUNT,
      );
    });
  });

  describe('4. Member Safety Standing Lifecycle', () => {
    it('GET /safety/my-status — User B checks account safety standing', async () => {
      const res = await request(app.getHttpServer())
        .get('/safety/my-status')
        .set('Authorization', `Bearer ${authTokenUserB}`);

      expect(res.status).toBe(200);
      expect(res.body.standing).toBe('GOOD');
      expect(res.body.activeStrikes).toBe(0);
      expect(res.body.isMuted).toBe(false);
      expect(res.body.isShadowBanned).toBe(false);
    });
  });
});
