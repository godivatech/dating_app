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
  ProfileStatus,
  ProfileVisibility,
  Gender,
  PreferredGenderMode,
  RelationshipIntent,
  PhotoStatus,
  ActionType,
  MatchStatus,
} from '@prisma/client';

describe('Matching Concurrency Race (e2e)', () => {
  let app: INestApplication;
  let tokenService: TokenService;

  let authTokenUserA: string;
  let authTokenUserB: string;

  const userA: User = {
    id: 'user-race-a',
    phoneNumber: '+919876522221',
    phoneVerifiedAt: new Date(),
    status: UserStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
  };

  const userB: User = {
    id: 'user-race-b',
    phoneNumber: '+919876522222',
    phoneVerifiedAt: new Date(),
    status: UserStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
  };

  const profileA: any = {
    id: 'prof-race-a',
    userId: userA.id,
    displayName: 'Alice Race',
    dateOfBirth: new Date('2000-05-15T00:00:00.000Z'),
    gender: Gender.WOMAN,
    bio: 'Engineer in Bengaluru.',
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
    photos: [{ id: 'p-ra1', status: PhotoStatus.APPROVED, position: 0 }],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const profileB: any = {
    id: 'prof-race-b',
    userId: userB.id,
    displayName: 'Bob Race',
    dateOfBirth: new Date('1998-08-20T00:00:00.000Z'),
    gender: Gender.MAN,
    bio: 'Designer in Bengaluru.',
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
    photos: [{ id: 'p-rb1', status: PhotoStatus.APPROVED, position: 0 }],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const userMap = new Map<string, User>([
    [userA.id, userA],
    [userB.id, userB],
  ]);

  const profileMap = new Map<string, any>([
    [profileA.id, profileA],
    [profileB.id, profileB],
  ]);

  const userActionMap = new Map<string, any>();
  const matchMap = new Map<string, any>();

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
    },
    authSession: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 'session-1', revokedAt: null }),
    },
    block: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    datingProfile: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        let p: any = null;
        if (where.id) p = profileMap.get(where.id);
        else if (where.userId) {
          p = Array.from(profileMap.values()).find(
            (prof) => prof.userId === where.userId,
          );
        }
        if (!p) return Promise.resolve(null);
        const u = userMap.get(p.userId);
        return Promise.resolve({ ...p, user: u });
      }),
    },
    $transaction: jest.fn().mockImplementation((callback) => {
      return callback(mockPrismaService);
    }),
    userAction: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const key = `${where.actorUserId_targetProfileId.actorUserId}_${where.actorUserId_targetProfileId.targetProfileId}`;
        return Promise.resolve(userActionMap.get(key) || null);
      }),
      upsert: jest.fn().mockImplementation(({ where, create, update }) => {
        const key = `${where.actorUserId_targetProfileId.actorUserId}_${where.actorUserId_targetProfileId.targetProfileId}`;
        const existing = userActionMap.get(key);
        if (existing) {
          const updated = { ...existing, ...update, updatedAt: new Date() };
          userActionMap.set(key, updated);
          return Promise.resolve(updated);
        } else {
          const created = {
            id: `act-${Date.now()}-${Math.random()}`,
            ...create,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          userActionMap.set(key, created);
          return Promise.resolve(created);
        }
      }),
    },
    match: {
      upsert: jest.fn().mockImplementation(({ where, create, update }) => {
        const u1 = where.user1Id_user2Id.user1Id;
        const u2 = where.user1Id_user2Id.user2Id;
        const canonicalKey = `${u1}_${u2}`;
        let existing = matchMap.get(canonicalKey);
        if (existing) {
          existing = { ...existing, ...update, updatedAt: new Date() };
          matchMap.set(canonicalKey, existing);
          return Promise.resolve(existing);
        } else {
          const id = `match-${Date.now()}-${Math.random()}`;
          const created = {
            id,
            ...create,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          matchMap.set(canonicalKey, created);
          return Promise.resolve(created);
        }
      }),
      findMany: jest.fn().mockImplementation(() => {
        return Promise.resolve(Array.from(matchMap.values()));
      }),
    },
  };

  const mockRedisService = {
    incrementWithWindow: jest.fn().mockResolvedValue({ current: 1 }),
  };

  const mockStorageService = {
    getPublicUrl: jest
      .fn()
      .mockImplementation((k) => `https://cdn.datingapp.com/${k}`),
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
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();

    tokenService = app.get(TokenService);
    const tokensA = await tokenService.generateTokens(userA.id, 'session-a');
    authTokenUserA = tokensA.accessToken;

    const tokensB = await tokenService.generateTokens(userB.id, 'session-b');
    authTokenUserB = tokensB.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('Concurrent reciprocal LIKEs from User A and User B create exactly 1 Match record', async () => {
    const reqA = request(app.getHttpServer())
      .post('/api/v1/actions')
      .set('Authorization', `Bearer ${authTokenUserA}`)
      .send({
        targetProfileId: profileB.id,
        actionType: ActionType.LIKE,
      });

    const reqB = request(app.getHttpServer())
      .post('/api/v1/actions')
      .set('Authorization', `Bearer ${authTokenUserB}`)
      .send({
        targetProfileId: profileA.id,
        actionType: ActionType.LIKE,
      });

    // Execute concurrently
    const [resA, resB] = await Promise.all([reqA, reqB]);

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);

    // At least one request established the match, and total matches in store is exactly 1
    expect(matchMap.size).toBe(1);

    const canonicalMatch = Array.from(matchMap.values())[0];
    expect(canonicalMatch.status).toBe(MatchStatus.ACTIVE);
    expect(canonicalMatch.user1Id).toBe('user-race-a');
    expect(canonicalMatch.user2Id).toBe('user-race-b');
  });
});
