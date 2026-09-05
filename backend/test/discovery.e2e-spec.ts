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
} from '@prisma/client';

describe('Discovery Domain (e2e)', () => {
  let app: INestApplication;
  let tokenService: TokenService;

  let authTokenUserA: string;
  let authTokenUserIneligible: string;

  const userA: User = {
    id: 'user-discovery-a',
    phoneNumber: '+919876500001',
    phoneVerifiedAt: new Date(),
    status: UserStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
  };

  const userB: User = {
    id: 'user-discovery-b',
    phoneNumber: '+919876500002',
    phoneVerifiedAt: new Date(),
    status: UserStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
  };

  const userC: User = {
    id: 'user-discovery-c',
    phoneNumber: '+919876500003',
    phoneVerifiedAt: new Date(),
    status: UserStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
  };

  const userD: User = {
    id: 'user-discovery-d',
    phoneNumber: '+919876500004',
    phoneVerifiedAt: new Date(),
    status: UserStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
  };

  const profileA: any = {
    id: 'prof-discovery-a',
    userId: userA.id,
    displayName: 'Alice Discovery',
    dateOfBirth: new Date('2000-05-15T00:00:00.000Z'), // 26
    gender: Gender.WOMAN,
    bio: 'Architect in Bengaluru who loves heritage walks and coffee.',
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
    interests: [
      {
        interestId: 'hiking',
        interest: { name: 'Hiking', category: 'Outdoors' },
      },
    ],
    photos: [
      {
        id: 'photo-a1',
        profileId: 'prof-discovery-a',
        status: PhotoStatus.APPROVED,
        position: 0,
        thumbnailKey: 'profiles/a/thumb.webp',
        mediumKey: 'profiles/a/med.webp',
        largeKey: 'profiles/a/large.webp',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const profileB: any = {
    id: 'prof-discovery-b',
    userId: userB.id,
    displayName: 'Bob Discovery',
    dateOfBirth: new Date('1998-08-20T00:00:00.000Z'), // 28
    gender: Gender.MAN,
    bio: 'Founder, runner, and coffee lover in Bengaluru.',
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
    interests: [
      {
        interestId: 'hiking',
        interest: { name: 'Hiking', category: 'Outdoors' },
      },
    ],
    photos: [
      {
        id: 'photo-b1',
        profileId: 'prof-discovery-b',
        status: PhotoStatus.APPROVED,
        position: 0,
        thumbnailKey: 'profiles/b/thumb.webp',
        mediumKey: 'profiles/b/med.webp',
        largeKey: 'profiles/b/large.webp',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const profileC: any = {
    id: 'prof-discovery-c',
    userId: userC.id,
    displayName: 'Charlie Older',
    dateOfBirth: new Date('1980-01-01T00:00:00.000Z'), // 46 (outside age range)
    gender: Gender.MAN,
    bio: 'Senior consultant.',
    locationCity: 'Bengaluru',
    locationRegion: 'Karnataka',
    locationCountry: 'IN',
    visibility: ProfileVisibility.VISIBLE,
    status: ProfileStatus.READY,
    preferences: {
      preferredGenderMode: PreferredGenderMode.ANY,
      preferredGenders: [],
      minAge: 20,
      maxAge: 35,
      relationshipIntent: RelationshipIntent.CASUAL,
    },
    interests: [],
    photos: [
      {
        id: 'photo-c1',
        profileId: 'prof-discovery-c',
        status: PhotoStatus.APPROVED,
        position: 0,
        thumbnailKey: 'profiles/c/thumb.webp',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const profileD: any = {
    id: 'prof-discovery-d',
    userId: userD.id,
    displayName: 'David Hidden',
    dateOfBirth: new Date('1998-01-01T00:00:00.000Z'),
    gender: Gender.MAN,
    bio: 'Hidden user.',
    locationCity: 'Bengaluru',
    locationRegion: 'Karnataka',
    locationCountry: 'IN',
    visibility: ProfileVisibility.HIDDEN,
    status: ProfileStatus.READY,
    preferences: {
      preferredGenderMode: PreferredGenderMode.ANY,
      preferredGenders: [],
      minAge: 20,
      maxAge: 35,
      relationshipIntent: RelationshipIntent.LONG_TERM,
    },
    interests: [],
    photos: [
      {
        id: 'photo-d1',
        profileId: 'prof-discovery-d',
        status: PhotoStatus.APPROVED,
        position: 0,
        thumbnailKey: 'profiles/d/thumb.webp',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const userMap = new Map<string, User>([
    [userA.id, userA],
    [userB.id, userB],
    [userC.id, userC],
    [userD.id, userD],
  ]);

  const profileMap = new Map<string, any>([
    [profileA.id, profileA],
    [profileB.id, profileB],
    [profileC.id, profileC],
    [profileD.id, profileD],
  ]);

  const impressionsList: any[] = [];

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
    },
    authSession: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 'session-1', revokedAt: null }),
    },
    datingProfile: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where.id) return Promise.resolve(profileMap.get(where.id) || null);
        if (where.userId) {
          const p = Array.from(profileMap.values()).find(
            (prof) => prof.userId === where.userId,
          );
          return Promise.resolve(p || null);
        }
        return Promise.resolve(null);
      }),
      findMany: jest.fn().mockImplementation(({ where }) => {
        let list = Array.from(profileMap.values());
        if (where?.id?.in) {
          list = list.filter((p) => where.id.in.includes(p.id));
        }
        if (where?.id?.not) {
          list = list.filter((p) => p.id !== where.id.not);
        }
        if (where?.status) {
          list = list.filter((p) => p.status === where.status);
        }
        if (where?.visibility) {
          list = list.filter((p) => p.visibility === where.visibility);
        }
        if (where?.user?.status) {
          list = list.filter((p) => {
            const u = userMap.get(p.userId);
            return u?.status === where.user.status;
          });
        }
        return Promise.resolve(
          list.map((p) => ({
            ...p,
            user: userMap.get(p.userId),
          })),
        );
      }),
    },
    discoveryImpression: {
      findMany: jest.fn().mockImplementation(({ where }) => {
        let list = [...impressionsList];
        if (where?.requestingUserId) {
          list = list.filter(
            (i) => i.requestingUserId === where.requestingUserId,
          );
        }
        if (where?.candidateProfileId?.in) {
          list = list.filter((i) =>
            where.candidateProfileId.in.includes(i.candidateProfileId),
          );
        }
        return Promise.resolve(list);
      }),
      createMany: jest.fn().mockImplementation(({ data }) => {
        for (const item of data) {
          impressionsList.push({
            id: `imp-${Date.now()}-${Math.random()}`,
            ...item,
            createdAt: new Date(),
          });
        }
        return Promise.resolve({ count: data.length });
      }),
    },
    userAction: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    block: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    match: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  const mockRedisService = {
    incrementWithWindow: jest.fn().mockResolvedValue({ current: 1 }),
  };

  const mockStorageService = {
    getPublicUrl: jest
      .fn()
      .mockImplementation((key) => `https://cdn.datingapp.com/${key}`),
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

    const tokensIneligible = await tokenService.generateTokens(
      userD.id,
      'session-d',
    );
    authTokenUserIneligible = tokensIneligible.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. GET /api/v1/discovery - Should return mutually compatible candidates and exclude age-incompatible and hidden profiles', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/discovery')
      .set('Authorization', `Bearer ${authTokenUserA}`)
      .expect(200);

    expect(res.body.eligibility.eligible).toBe(true);
    expect(res.body.algorithmVersion).toBe('baseline-v1');

    const candidateIds = res.body.candidates.map((c: any) => c.profileId);
    expect(candidateIds).toContain(profileB.id);
    expect(candidateIds).not.toContain(profileA.id); // Not self
    expect(candidateIds).not.toContain(profileC.id); // Not Charlie (age 46 outside A's range 24-32)
    expect(candidateIds).not.toContain(profileD.id); // Not David (HIDDEN)

    const bob = res.body.candidates.find(
      (c: any) => c.profileId === profileB.id,
    );
    expect(bob.displayName).toBe('Bob Discovery');
    expect(bob.age).toBe(28);
    expect(bob.photos[0].isPrimary).toBe(true);
    expect(bob.photos[0].thumbnailUrl).toContain('https://cdn.datingapp.com/');
  });

  it('2. POST /api/v1/discovery/impressions - Should record impressions idempotently', async () => {
    const res1 = await request(app.getHttpServer())
      .post('/api/v1/discovery/impressions')
      .set('Authorization', `Bearer ${authTokenUserA}`)
      .send({
        impressions: [
          {
            candidateProfileId: profileB.id,
            position: 0,
            algorithmVersion: 'baseline-v1',
          },
        ],
      })
      .expect(200);

    expect(res1.body.success).toBe(true);
    expect(res1.body.recordedCount).toBe(1);

    // Duplicate retry from network retry
    const res2 = await request(app.getHttpServer())
      .post('/api/v1/discovery/impressions')
      .set('Authorization', `Bearer ${authTokenUserA}`)
      .send({
        impressions: [
          {
            candidateProfileId: profileB.id,
            position: 0,
            algorithmVersion: 'baseline-v1',
          },
        ],
      })
      .expect(200);

    expect(res2.body.success).toBe(true);
    expect(res2.body.recordedCount).toBe(0); // Safely avoided duplicate
  });

  it('3. Safety Check: If Candidate B becomes HIDDEN, Candidate B must immediately disappear from discovery', async () => {
    profileB.visibility = ProfileVisibility.HIDDEN;

    const res = await request(app.getHttpServer())
      .get('/api/v1/discovery')
      .set('Authorization', `Bearer ${authTokenUserA}`)
      .expect(200);

    const candidateIds = res.body.candidates.map((c: any) => c.profileId);
    expect(candidateIds).not.toContain(profileB.id);

    // Restore visibility
    profileB.visibility = ProfileVisibility.VISIBLE;
  });

  it('4. Safety Check: If Candidate B account is SUSPENDED, Candidate B must immediately disappear', async () => {
    userB.status = UserStatus.SUSPENDED;

    const res = await request(app.getHttpServer())
      .get('/api/v1/discovery')
      .set('Authorization', `Bearer ${authTokenUserA}`)
      .expect(200);

    const candidateIds = res.body.candidates.map((c: any) => c.profileId);
    expect(candidateIds).not.toContain(profileB.id);

    // Restore active
    userB.status = UserStatus.ACTIVE;
  });

  it('5. Ineligible Requester: Requester with HIDDEN visibility receives structured reason', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/discovery')
      .set('Authorization', `Bearer ${authTokenUserIneligible}`)
      .expect(200);

    expect(res.body.eligibility.eligible).toBe(false);
    expect(res.body.eligibility.reason).toBe('PROFILE_HIDDEN');
    expect(res.body.candidates.length).toBe(0);
  });
});
