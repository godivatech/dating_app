import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { TokenService } from '../src/auth/services/token.service';
import { STORAGE_SERVICE } from '../src/media/storage/storage.interface';
import { PHOTO_QUEUE_TOKEN } from '../src/media/queue/photo-processing.constants';
import { User, UserStatus, PhotoStatus } from '@prisma/client';

describe('Profile & Onboarding Lifecycle (e2e)', () => {
  let app: INestApplication;
  let tokenService: TokenService;
  let authToken: string;

  const testUser: User = {
    id: 'test-user-profile-e2e',
    phoneNumber: '+919876543210',
    phoneVerifiedAt: new Date(),
    status: UserStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
  };

  const userMap = new Map<string, User>([[testUser.id, testUser]]);
  const profileMap = new Map<string, any>();
  const preferenceMap = new Map<string, any>();
  const interestMap = new Map<string, any>([
    [
      'outdoors-hiking',
      {
        id: 'outdoors-hiking',
        name: 'Hiking',
        category: 'Outdoors',
        status: 'ACTIVE',
      },
    ],
    [
      'music-indie',
      {
        id: 'music-indie',
        name: 'Indie Music',
        category: 'Music',
        status: 'ACTIVE',
      },
    ],
    [
      'food-coffee',
      {
        id: 'food-coffee',
        name: 'Coffee',
        category: 'Food & Drink',
        status: 'ACTIVE',
      },
    ],
    [
      'inactive-item',
      {
        id: 'inactive-item',
        name: 'Old Item',
        category: 'Old',
        status: 'INACTIVE',
      },
    ],
  ]);
  const profileInterestMap = new Map<string, any>();
  const photoMap = new Map<string, any>();
  const sessionMap = new Map<string, any>();

  const mockPrismaService = {
    user: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where.id) return Promise.resolve(userMap.get(where.id) || null);
        return Promise.resolve(null);
      }),
    },
    authSession: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where.id) return Promise.resolve(sessionMap.get(where.id) || null);
        return Promise.resolve(null);
      }),
    },
    interest: {
      count: jest
        .fn()
        .mockImplementation(() => Promise.resolve(interestMap.size)),
      upsert: jest.fn().mockImplementation(({ where, create }) => {
        interestMap.set(where.id, create);
        return Promise.resolve(create);
      }),
      findMany: jest.fn().mockImplementation(({ where }) => {
        let list = Array.from(interestMap.values());
        if (where?.status) {
          list = list.filter((i) => i.status === where.status);
        }
        if (where?.id?.in) {
          list = list.filter((i) => where.id.in.includes(i.id));
        }
        return Promise.resolve(list);
      }),
    },
    datingProfile: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        let p: any = null;
        if (where.userId) {
          for (const item of profileMap.values()) {
            if (item.userId === where.userId) {
              p = item;
              break;
            }
          }
        } else if (where.id) {
          p = profileMap.get(where.id);
        }
        if (!p) return Promise.resolve(null);

        const prefs = preferenceMap.get(p.id) || null;
        const piList = Array.from(profileInterestMap.values()).filter(
          (pi) => pi.profileId === p.id,
        );
        const photos = Array.from(photoMap.values()).filter(
          (ph) => ph.profileId === p.id && ph.status !== PhotoStatus.DELETED,
        );

        return Promise.resolve({
          ...p,
          preferences: prefs,
          interests: piList.map((pi) => ({
            interest: interestMap.get(pi.interestId),
          })),
          photos,
        });
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        const p = {
          id: `prof_${Date.now()}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        profileMap.set(p.id, p);
        return Promise.resolve(p);
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const p = profileMap.get(where.id);
        if (!p) return Promise.resolve(null);
        Object.assign(p, data, { updatedAt: new Date() });
        profileMap.set(where.id, p);
        return Promise.resolve(p);
      }),
    },
    datingPreferences: {
      upsert: jest.fn().mockImplementation(({ where, update, create }) => {
        let pref = preferenceMap.get(where.profileId);
        if (pref) {
          Object.assign(pref, update, { updatedAt: new Date() });
        } else {
          pref = {
            id: `pref_${Date.now()}`,
            ...create,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        }
        preferenceMap.set(where.profileId, pref);
        return Promise.resolve(pref);
      }),
    },
    profileInterest: {
      deleteMany: jest.fn().mockImplementation(({ where }) => {
        for (const [k, v] of profileInterestMap.entries()) {
          if (v.profileId === where.profileId) {
            profileInterestMap.delete(k);
          }
        }
        return Promise.resolve({ count: 1 });
      }),
      createMany: jest.fn().mockImplementation(({ data }) => {
        for (const item of data) {
          profileInterestMap.set(`${item.profileId}_${item.interestId}`, {
            id: `pi_${Math.random()}`,
            ...item,
            createdAt: new Date(),
          });
        }
        return Promise.resolve({ count: data.length });
      }),
    },
    profilePhoto: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        return Promise.resolve(photoMap.get(where.id) || null);
      }),
      findMany: jest.fn().mockImplementation(({ where }) => {
        let list = Array.from(photoMap.values()).filter(
          (p) => p.profileId === where.profileId,
        );
        if (where.status) list = list.filter((p) => p.status === where.status);
        return Promise.resolve(list);
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        const p = {
          id: `photo_${Date.now()}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        photoMap.set(p.id, p);
        return Promise.resolve(p);
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const p = photoMap.get(where.id);
        if (!p) return Promise.resolve(null);
        Object.assign(p, data, { updatedAt: new Date() });
        photoMap.set(where.id, p);
        return Promise.resolve(p);
      }),
      count: jest.fn().mockImplementation(({ where }) => {
        let list = Array.from(photoMap.values()).filter(
          (p) => p.profileId === where.profileId,
        );
        if (where.status) list = list.filter((p) => p.status === where.status);
        return Promise.resolve(list.length);
      }),
    },
    $transaction: jest.fn().mockImplementation(async (callback: any) => {
      const res = callback(mockPrismaService);
      return await res;
    }),
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
  };

  const mockRedisService = {
    setWithNx: jest.fn().mockResolvedValue(true),
    incrementWithWindow: jest
      .fn()
      .mockResolvedValue({ current: 1, isFirst: true }),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(undefined),
  };

  const mockStorageService = {
    createUploadUrl: jest.fn().mockResolvedValue('https://r2.storage/signed'),
    headObject: jest
      .fn()
      .mockResolvedValue({ contentLength: 100000, contentType: 'image/jpeg' }),
    getObject: jest.fn().mockResolvedValue(Buffer.from('fake')),
    putObject: jest.fn().mockResolvedValue(undefined),
    deleteObject: jest.fn().mockResolvedValue(undefined),
    deleteObjects: jest.fn().mockResolvedValue(undefined),
    getPublicUrl: jest
      .fn()
      .mockImplementation((key) => `https://cdn.dating.local/${key}`),
  };

  const mockBullQueue = {
    add: jest.fn().mockResolvedValue({ id: 'job-1' }),
  };

  beforeAll(async () => {
    profileMap.clear();
    preferenceMap.clear();
    profileInterestMap.clear();
    photoMap.clear();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideProvider(RedisService)
      .useValue(mockRedisService)
      .overrideProvider(STORAGE_SERVICE)
      .useValue(mockStorageService)
      .overrideProvider(PHOTO_QUEUE_TOKEN)
      .useValue(mockBullQueue)
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
    const session = {
      id: 'sess-profile-e2e-1',
      userId: testUser.id,
      refreshTokenHash: 'hash',
      expiresAt: new Date(Date.now() + 100000),
      revokedAt: null,
    };
    sessionMap.set(session.id, session);

    const tokens = await tokenService.generateTokens(testUser.id, session.id);
    authToken = tokens.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. GET /api/v1/interests returns active reference interests without auth', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/interests')
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.some((i: any) => i.id === 'outdoors-hiking')).toBe(true);
    expect(res.body.some((i: any) => i.id === 'inactive-item')).toBe(false);
  });

  it('2. GET /api/v1/profile/me returns null initially for new account', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/profile/me')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.body).toEqual({});
  });

  it('3. GET /api/v1/profile/completion returns 0 score and NOT_STARTED status', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/profile/completion')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.completionScore).toBe(0);
    expect(res.body.status).toBe('NOT_STARTED');
    expect(res.body.isReady).toBe(false);
  });

  it('4. PUT /api/v1/profile/identity rejects under-18 DOB', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/profile/identity')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        displayName: 'Aarav',
        dateOfBirth: '2020-01-01',
        gender: 'MAN',
      })
      .expect(400);
  });

  it('5. PUT /api/v1/profile/identity saves identity and advances to IN_PROGRESS (20%)', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/v1/profile/identity')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        displayName: 'Aarav Sharma',
        dateOfBirth: '2000-05-15',
        gender: 'MAN',
      })
      .expect(200);

    expect(res.body.displayName).toBe('Aarav Sharma');
    expect(res.body.gender).toBe('MAN');
    expect(res.body.age).toBeGreaterThanOrEqual(18);
    expect(res.body.visibility).toBe('HIDDEN');
    expect(res.body.status).toBe('IN_PROGRESS');
    expect(res.body.completionScore).toBe(20);
  });

  it('6. PUT /api/v1/profile/preferences rejects minAge > maxAge', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/profile/preferences')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        preferredGenderMode: 'SELECTED',
        preferredGenders: ['WOMAN'],
        minAge: 35,
        maxAge: 25,
        relationshipIntent: 'LONG_TERM',
      })
      .expect(400);
  });

  it('7. PUT /api/v1/profile/preferences saves preferences and advances to 40%', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/v1/profile/preferences')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        preferredGenderMode: 'SELECTED',
        preferredGenders: ['WOMAN'],
        minAge: 21,
        maxAge: 30,
        relationshipIntent: 'LONG_TERM',
      })
      .expect(200);

    expect(res.body.preferences).toBeDefined();
    expect(res.body.preferences.preferredGenderMode).toBe('SELECTED');
    expect(res.body.preferences.preferredGenders).toContain('WOMAN');
    expect(res.body.completionScore).toBe(40);
  });

  it('8. PUT /api/v1/profile/interests rejects fewer than 3 interests', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/profile/interests')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        interestIds: ['outdoors-hiking', 'music-indie'],
      })
      .expect(400);
  });

  it('9. PUT /api/v1/profile/interests saves 3 interests and advances to 60%', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/v1/profile/interests')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        interestIds: ['outdoors-hiking', 'music-indie', 'food-coffee'],
      })
      .expect(200);

    expect(res.body.interests.length).toBe(3);
    expect(res.body.completionScore).toBe(60);
  });

  it('10. PUT /api/v1/profile/about-location completes bio & location (advances to 80%, still IN_PROGRESS)', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/v1/profile/about-location')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        bio: 'Software engineer in Bengaluru. Love outdoor adventures and indie concerts.',
        locationCity: 'Bengaluru',
        locationRegion: 'Karnataka',
      })
      .expect(200);

    expect(res.body.bio).toBeDefined();
    expect(res.body.locationCity).toBe('Bengaluru');
    expect(res.body.completionScore).toBe(80);
    expect(res.body.status).toBe('IN_PROGRESS');
  });

  it('11. PATCH /api/v1/profile/visibility rejects VISIBLE toggle while photos milestone is missing', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/profile/visibility')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ visibility: 'VISIBLE' })
      .expect(400);
  });

  it('12. Adding an approved photo advances profile to 100% and READY status', async () => {
    const userProfile = Array.from(profileMap.values()).find(
      (p) => p.userId === testUser.id,
    );

    photoMap.set('photo-e2e-approved', {
      id: 'photo-e2e-approved',
      profileId: userProfile.id,
      status: PhotoStatus.APPROVED,
      position: 0,
      objectKey: `profiles/${userProfile.id}/photos/photo-e2e-approved/original.jpg`,
      thumbnailKey: `profiles/${userProfile.id}/photos/photo-e2e-approved/thumbnail.webp`,
      mimeType: 'image/jpeg',
      fileSize: 100000,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await request(app.getHttpServer())
      .get('/api/v1/profile/me')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.completionScore).toBe(100);
    expect(res.body.status).toBe('READY');
    expect(res.body.photos.length).toBe(1);
    expect(res.body.photos[0].isPrimary).toBe(true);
  });

  it('13. PATCH /api/v1/profile/visibility toggles to VISIBLE when profile is READY (100%)', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/v1/profile/visibility')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ visibility: 'VISIBLE' })
      .expect(200);

    expect(res.body.visibility).toBe('VISIBLE');
    expect(res.body.status).toBe('READY');
  });

  it('14. PATCH /api/v1/profile/visibility toggles back to HIDDEN while staying READY (READY + HIDDEN valid state)', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/v1/profile/visibility')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ visibility: 'HIDDEN' })
      .expect(200);

    expect(res.body.visibility).toBe('HIDDEN');
    expect(res.body.status).toBe('READY');
  });
});
