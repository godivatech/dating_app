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
} from '@prisma/client';

describe('Matching Engine Lifecycle (e2e)', () => {
  let app: INestApplication;
  let tokenService: TokenService;

  let authTokenUserA: string;
  let authTokenUserB: string;
  let authTokenUserC: string;

  const userA: User = {
    id: 'user-match-e2e-a',
    phoneNumber: '+919876511111',
    phoneVerifiedAt: new Date(),
    status: UserStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
  };

  const userB: User = {
    id: 'user-match-e2e-b',
    phoneNumber: '+919876511112',
    phoneVerifiedAt: new Date(),
    status: UserStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
  };

  const userC: User = {
    id: 'user-match-e2e-c',
    phoneNumber: '+919876511113',
    phoneVerifiedAt: new Date(),
    status: UserStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
  };

  const profileA: any = {
    id: 'prof-match-e2e-a',
    userId: userA.id,
    displayName: 'Alice Match',
    dateOfBirth: new Date('2000-05-15T00:00:00.000Z'),
    gender: Gender.WOMAN,
    bio: 'Architect in Bengaluru.',
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
    interests: [{ interestId: 'hiking', interest: { name: 'Hiking' } }],
    photos: [
      {
        id: 'photo-ma1',
        profileId: 'prof-match-e2e-a',
        status: PhotoStatus.APPROVED,
        position: 0,
        thumbnailKey: 'profiles/a/thumb.webp',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const profileB: any = {
    id: 'prof-match-e2e-b',
    userId: userB.id,
    displayName: 'Bob Match',
    dateOfBirth: new Date('1998-08-20T00:00:00.000Z'),
    gender: Gender.MAN,
    bio: 'Tech founder in Bengaluru.',
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
    interests: [{ interestId: 'hiking', interest: { name: 'Hiking' } }],
    photos: [
      {
        id: 'photo-mb1',
        profileId: 'prof-match-e2e-b',
        status: PhotoStatus.APPROVED,
        position: 0,
        thumbnailKey: 'profiles/b/thumb.webp',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const profileC: any = {
    id: 'prof-match-e2e-c',
    userId: userC.id,
    displayName: 'Charlie Outsider',
    dateOfBirth: new Date('1999-01-01T00:00:00.000Z'),
    gender: Gender.MAN,
    locationCity: 'Bengaluru',
    visibility: ProfileVisibility.VISIBLE,
    status: ProfileStatus.READY,
    preferences: null,
    interests: [],
    photos: [{ id: 'photo-mc1', status: PhotoStatus.APPROVED, position: 0 }],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const userMap = new Map<string, User>([
    [userA.id, userA],
    [userB.id, userB],
    [userC.id, userC],
  ]);

  const profileMap = new Map<string, any>([
    [profileA.id, profileA],
    [profileB.id, profileB],
    [profileC.id, profileC],
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
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where.id) {
          const m = matchMap.get(where.id);
          if (!m) return Promise.resolve(null);
          return Promise.resolve({
            ...m,
            user1: {
              ...userMap.get(m.user1Id),
              profile: Array.from(profileMap.values()).find(
                (p) => p.userId === m.user1Id,
              ),
            },
            user2: {
              ...userMap.get(m.user2Id),
              profile: Array.from(profileMap.values()).find(
                (p) => p.userId === m.user2Id,
              ),
            },
          });
        }
        if (where.user1Id_user2Id) {
          const m = Array.from(matchMap.values()).find(
            (item) =>
              item.user1Id === where.user1Id_user2Id.user1Id &&
              item.user2Id === where.user1Id_user2Id.user2Id,
          );
          return Promise.resolve(m || null);
        }
        return Promise.resolve(null);
      }),
      findMany: jest.fn().mockImplementation(({ where }) => {
        let list = Array.from(matchMap.values());
        if (where.status) {
          list = list.filter((m) => m.status === where.status);
        }
        if (where.OR) {
          list = list.filter((m) =>
            where.OR.some(
              (cond: any) =>
                cond.user1Id === m.user1Id || cond.user2Id === m.user2Id,
            ),
          );
        }
        return Promise.resolve(
          list.map((m) => ({
            ...m,
            user1: {
              ...userMap.get(m.user1Id),
              profile: Array.from(profileMap.values()).find(
                (p) => p.userId === m.user1Id,
              ),
            },
            user2: {
              ...userMap.get(m.user2Id),
              profile: Array.from(profileMap.values()).find(
                (p) => p.userId === m.user2Id,
              ),
            },
          })),
        );
      }),
      upsert: jest.fn().mockImplementation(({ where, create, update }) => {
        const u1 = where.user1Id_user2Id.user1Id;
        const u2 = where.user1Id_user2Id.user2Id;
        let existing = Array.from(matchMap.values()).find(
          (item) => item.user1Id === u1 && item.user2Id === u2,
        );
        if (existing) {
          existing = { ...existing, ...update, updatedAt: new Date() };
          matchMap.set(existing.id, existing);
          return Promise.resolve(existing);
        } else {
          const id = `match-${Date.now()}-${Math.random()}`;
          const created = {
            id,
            ...create,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          matchMap.set(id, created);
          return Promise.resolve(created);
        }
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const m = matchMap.get(where.id);
        if (!m) return Promise.resolve(null);
        const updated = { ...m, ...data, updatedAt: new Date() };
        matchMap.set(where.id, updated);
        return Promise.resolve(updated);
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

    const tokensC = await tokenService.generateTokens(userC.id, 'session-c');
    authTokenUserC = tokensC.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  let establishedMatchId: string;

  it('1. POST /api/v1/actions - User A likes User B (No reciprocal like yet -> matched: false)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/actions')
      .set('Authorization', `Bearer ${authTokenUserA}`)
      .send({
        targetProfileId: profileB.id,
        actionType: ActionType.LIKE,
      })
      .expect(200);

    expect(res.body.action).toBe('LIKE');
    expect(res.body.matched).toBe(false);
    expect(res.body.match).toBeUndefined();
  });

  it('2. POST /api/v1/actions - User B likes User A (Reciprocal like detected -> matched: true)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/actions')
      .set('Authorization', `Bearer ${authTokenUserB}`)
      .send({
        targetProfileId: profileA.id,
        actionType: ActionType.LIKE,
      })
      .expect(200);

    expect(res.body.action).toBe('LIKE');
    expect(res.body.matched).toBe(true);
    expect(res.body.match).toBeDefined();
    expect(res.body.match.matchedProfile.displayName).toBe('Alice Match');
    expect(res.body.match.status).toBe('ACTIVE');

    establishedMatchId = res.body.match.id;
  });

  it('3. GET /api/v1/matches - User A fetches matches and receives User B', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/matches')
      .set('Authorization', `Bearer ${authTokenUserA}`)
      .expect(200);

    expect(res.body.matches.length).toBe(1);
    expect(res.body.matches[0].id).toBe(establishedMatchId);
    expect(res.body.matches[0].matchedProfile.displayName).toBe('Bob Match');
  });

  it('4. GET /api/v1/matches/:matchId - User A fetches match detail', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/matches/${establishedMatchId}`)
      .set('Authorization', `Bearer ${authTokenUserA}`)
      .expect(200);

    expect(res.body.id).toBe(establishedMatchId);
    expect(res.body.matchedProfile.displayName).toBe('Bob Match');
  });

  it('5. GET /api/v1/matches/:matchId - Unauthorized User C receives 404', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/matches/${establishedMatchId}`)
      .set('Authorization', `Bearer ${authTokenUserC}`)
      .expect(404);
  });

  it('6. DELETE /api/v1/matches/:matchId - User A unmatches User B', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/matches/${establishedMatchId}`)
      .set('Authorization', `Bearer ${authTokenUserA}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Successfully unmatched.');

    // Match list should now be empty (active matches only)
    const listRes = await request(app.getHttpServer())
      .get('/api/v1/matches')
      .set('Authorization', `Bearer ${authTokenUserA}`)
      .expect(200);

    expect(listRes.body.matches.length).toBe(0);
  });
});
