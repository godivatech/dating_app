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

describe('Media & Photos Lifecycle (e2e)', () => {
  let app: INestApplication;
  let tokenService: TokenService;
  let authTokenUserA: string;
  let authTokenUserB: string;

  const userA: User = {
    id: 'user-photos-e2e-a',
    phoneNumber: '+919876543211',
    phoneVerifiedAt: new Date(),
    status: UserStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
  };

  const userB: User = {
    id: 'user-photos-e2e-b',
    phoneNumber: '+919876543212',
    phoneVerifiedAt: new Date(),
    status: UserStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
  };

  const profileA = {
    id: 'prof-photos-e2e-a',
    userId: userA.id,
    displayName: 'User A',
  };

  const profileB = {
    id: 'prof-photos-e2e-b',
    userId: userB.id,
    displayName: 'User B',
  };

  const userMap = new Map<string, User>([
    [userA.id, userA],
    [userB.id, userB],
  ]);
  const profileMap = new Map<string, any>([
    [profileA.id, profileA],
    [profileB.id, profileB],
  ]);
  const photoMap = new Map<string, any>();
  const sessionMap = new Map<string, any>();

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
      findUnique: jest.fn().mockImplementation(({ where }) => {
        return Promise.resolve(sessionMap.get(where.id) || null);
      }),
    },
    datingProfile: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        let p: any = null;
        if (where.userId) {
          p = Array.from(profileMap.values()).find(
            (prof) => prof.userId === where.userId,
          );
        } else if (where.id) {
          p = profileMap.get(where.id);
        }
        if (!p) return Promise.resolve(null);
        const photos = Array.from(photoMap.values()).filter(
          (ph) => ph.profileId === p.id && ph.status !== PhotoStatus.DELETED,
        );
        return Promise.resolve({ ...p, photos });
      }),
    },
    profilePhoto: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const photo = photoMap.get(where.id);
        if (!photo) return Promise.resolve(null);
        const profile = profileMap.get(photo.profileId);
        return Promise.resolve({ ...photo, profile });
      }),
      findMany: jest.fn().mockImplementation(({ where }) => {
        let list = Array.from(photoMap.values()).filter(
          (p) => p.profileId === where.profileId,
        );
        if (where.status?.in) {
          list = list.filter((p) => where.status.in.includes(p.status));
        }
        if (where.status?.not) {
          list = list.filter((p) => p.status !== where.status.not);
        }
        if (where.status && typeof where.status === 'string') {
          list = list.filter((p) => p.status === where.status);
        }
        if (where.id?.not) {
          list = list.filter((p) => p.id !== where.id.not);
        }
        if (where.orderBy?.position === 'asc') {
          list.sort((a, b) => a.position - b.position);
        }
        return Promise.resolve(list);
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        const id = `photo_${Date.now()}_${Math.random()}`;
        const p = {
          id,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        photoMap.set(id, p);
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
    createUploadUrl: jest
      .fn()
      .mockResolvedValue('https://r2.storage/signed-upload-url'),
    headObject: jest
      .fn()
      .mockResolvedValue({ contentLength: 50000, contentType: 'image/jpeg' }),
    getObject: jest.fn().mockResolvedValue(Buffer.from('dummy-image-bytes')),
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

    const sessionA = {
      id: 'sess-a',
      userId: userA.id,
      refreshTokenHash: 'hA',
      expiresAt: new Date(Date.now() + 100000),
      revokedAt: null,
    };
    const sessionB = {
      id: 'sess-b',
      userId: userB.id,
      refreshTokenHash: 'hB',
      expiresAt: new Date(Date.now() + 100000),
      revokedAt: null,
    };
    sessionMap.set(sessionA.id, sessionA);
    sessionMap.set(sessionB.id, sessionB);

    const tokensA = await tokenService.generateTokens(userA.id, sessionA.id);
    const tokensB = await tokenService.generateTokens(userB.id, sessionB.id);
    authTokenUserA = tokensA.accessToken;
    authTokenUserB = tokensB.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  let createdPhotoId1: string;
  let createdPhotoId2: string;

  it('1. POST /api/v1/profile/photos/upload-url requests signed upload URL', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/profile/photos/upload-url')
      .set('Authorization', `Bearer ${authTokenUserA}`)
      .send({
        mimeType: 'image/jpeg',
        fileSize: 1024 * 1024,
      })
      .expect(200);

    expect(res.body.photoId).toBeDefined();
    expect(res.body.uploadUrl).toBe('https://r2.storage/signed-upload-url');
    expect(res.body.expiresIn).toBe(900);

    createdPhotoId1 = res.body.photoId;
  });

  it('2. POST /api/v1/profile/photos/:photoId/complete transitions status to PROCESSING and enqueues job', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/profile/photos/${createdPhotoId1}/complete`)
      .set('Authorization', `Bearer ${authTokenUserA}`)
      .expect(200);

    expect(res.body.id).toBe(createdPhotoId1);
    expect(res.body.status).toBe('PROCESSING');
    expect(mockBullQueue.add).toHaveBeenCalled();
  });

  it('3. POST /api/v1/profile/photos/:photoId/moderate moves photo to APPROVED', async () => {
    // Populate thumbnailKey to simulate worker completion
    const photo = photoMap.get(createdPhotoId1);
    photo.thumbnailKey = `profiles/${profileA.id}/photos/${createdPhotoId1}/thumbnail.webp`;
    photo.mediumKey = `profiles/${profileA.id}/photos/${createdPhotoId1}/medium.webp`;
    photo.largeKey = `profiles/${profileA.id}/photos/${createdPhotoId1}/large.webp`;

    const res = await request(app.getHttpServer())
      .post(`/api/v1/profile/photos/${createdPhotoId1}/moderate`)
      .set('Authorization', `Bearer ${authTokenUserA}`)
      .send({ status: 'APPROVED' })
      .expect(200);

    expect(res.body.status).toBe('APPROVED');
    expect(res.body.position).toBe(0);
    expect(res.body.isPrimary).toBe(true);
    expect(res.body.thumbnailUrl).toContain('thumbnail.webp');
  });

  it('4. Upload and approve a second photo for User A', async () => {
    const urlRes = await request(app.getHttpServer())
      .post('/api/v1/profile/photos/upload-url')
      .set('Authorization', `Bearer ${authTokenUserA}`)
      .send({ mimeType: 'image/png', fileSize: 500000 })
      .expect(200);

    createdPhotoId2 = urlRes.body.photoId;

    await request(app.getHttpServer())
      .post(`/api/v1/profile/photos/${createdPhotoId2}/complete`)
      .set('Authorization', `Bearer ${authTokenUserA}`)
      .expect(200);

    const photo2 = photoMap.get(createdPhotoId2);
    photo2.thumbnailKey = `profiles/${profileA.id}/photos/${createdPhotoId2}/thumbnail.webp`;

    const modRes = await request(app.getHttpServer())
      .post(`/api/v1/profile/photos/${createdPhotoId2}/moderate`)
      .set('Authorization', `Bearer ${authTokenUserA}`)
      .send({ status: 'APPROVED' })
      .expect(200);

    expect(modRes.body.status).toBe('APPROVED');
    expect(modRes.body.position).toBe(1);
    expect(modRes.body.isPrimary).toBe(false);
  });

  it('5. PATCH /api/v1/profile/photos/:photoId/primary shifts target photo to position 0', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/profile/photos/${createdPhotoId2}/primary`)
      .set('Authorization', `Bearer ${authTokenUserA}`)
      .expect(200);

    expect(res.body.length).toBe(2);
    const photo2InList = res.body.find((p: any) => p.id === createdPhotoId2);
    expect(photo2InList.position).toBe(0);
    expect(photo2InList.isPrimary).toBe(true);
  });

  it('6. PATCH /api/v1/profile/photos/reorder updates photo order atomically', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/v1/profile/photos/reorder')
      .set('Authorization', `Bearer ${authTokenUserA}`)
      .send({ photoIds: [createdPhotoId1, createdPhotoId2] })
      .expect(200);

    expect(res.body[0].id).toBe(createdPhotoId1);
    expect(res.body[0].position).toBe(0);
    expect(res.body[0].isPrimary).toBe(true);

    expect(res.body[1].id).toBe(createdPhotoId2);
    expect(res.body[1].position).toBe(1);
    expect(res.body[1].isPrimary).toBe(false);
  });

  it('7. DELETE /api/v1/profile/photos/:photoId deletes photo and re-indexes remaining photos', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/profile/photos/${createdPhotoId1}`)
      .set('Authorization', `Bearer ${authTokenUserA}`)
      .expect(200);

    expect(res.body.length).toBe(1);
    expect(res.body[0].id).toBe(createdPhotoId2);
    expect(res.body[0].position).toBe(0);
    expect(res.body[0].isPrimary).toBe(true);
  });

  it('8. Cross-User Security: User B cannot delete User A photos', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/profile/photos/${createdPhotoId2}`)
      .set('Authorization', `Bearer ${authTokenUserB}`)
      .expect(403);
  });
});
