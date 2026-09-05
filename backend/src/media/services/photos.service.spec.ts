import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PhotosService, MAX_PROFILE_PHOTOS } from './photos.service';
import { PhotoStatus, UserStatus } from '@prisma/client';

describe('PhotosService', () => {
  let service: PhotosService;
  let mockPrisma: any;
  let mockRedis: any;
  let mockStorage: any;
  let mockQueue: any;

  const photoStore = new Map<string, any>();
  const userStore = new Map<string, any>();

  beforeEach(() => {
    photoStore.clear();
    userStore.clear();

    const activeUser = {
      id: 'user-1',
      status: UserStatus.ACTIVE,
      profile: {
        id: 'prof-1',
        userId: 'user-1',
      },
    };
    userStore.set(activeUser.id, activeUser);

    mockPrisma = {
      user: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          return Promise.resolve(userStore.get(where.id) || null);
        }),
      },
      datingProfile: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.userId === 'user-1' || where.id === 'prof-1') {
            const list = Array.from(photoStore.values()).filter(
              (p) => p.profileId === 'prof-1',
            );
            return Promise.resolve({
              id: 'prof-1',
              userId: 'user-1',
              photos: list,
            });
          }
          return Promise.resolve(null);
        }),
      },
      profilePhoto: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          const photo = photoStore.get(where.id);
          if (!photo) return Promise.resolve(null);
          return Promise.resolve({
            ...photo,
            profile: { userId: 'user-1' },
          });
        }),
        findMany: jest.fn().mockImplementation(({ where }) => {
          let list = Array.from(photoStore.values()).filter(
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
          return Promise.resolve(list);
        }),
        count: jest.fn().mockImplementation(({ where }) => {
          let list = Array.from(photoStore.values()).filter(
            (p) => p.profileId === where.profileId,
          );
          if (where.status) {
            list = list.filter((p) => p.status === where.status);
          }
          return Promise.resolve(list.length);
        }),
        create: jest.fn().mockImplementation(({ data }) => {
          const id = `photo-${Date.now()}-${Math.random()}`;
          const record = {
            id,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          photoStore.set(id, record);
          return Promise.resolve(record);
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          const record = photoStore.get(where.id);
          if (!record) return Promise.resolve(null);
          Object.assign(record, data, { updatedAt: new Date() });
          photoStore.set(where.id, record);
          return Promise.resolve(record);
        }),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return await callback(mockPrisma);
      }),
    };

    mockRedis = {
      incrementWithWindow: jest
        .fn()
        .mockResolvedValue({ current: 1, isFirst: true }),
    };

    mockStorage = {
      createUploadUrl: jest
        .fn()
        .mockResolvedValue('https://r2.cloudflarestorage.com/signed-url'),
      headObject: jest
        .fn()
        .mockResolvedValue({ contentLength: 50000, contentType: 'image/jpeg' }),
      getObject: jest.fn().mockResolvedValue(Buffer.from('fake-image-buffer')),
      putObject: jest.fn().mockResolvedValue(undefined),
      deleteObject: jest.fn().mockResolvedValue(undefined),
      deleteObjects: jest.fn().mockResolvedValue(undefined),
      getPublicUrl: jest
        .fn()
        .mockImplementation((key) => `https://cdn.dating.local/${key}`),
    };

    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };

    service = new PhotosService(mockPrisma, mockRedis, mockStorage, mockQueue);
  });

  describe('requestUploadUrl', () => {
    it('should generate signed upload URL and create UPLOADING record for active user', async () => {
      const result = await service.requestUploadUrl('user-1', {
        mimeType: 'image/jpeg',
        fileSize: 2 * 1024 * 1024,
      });

      expect(result).toBeDefined();
      expect(result.photoId).toBeDefined();
      expect(result.uploadUrl).toBe(
        'https://r2.cloudflarestorage.com/signed-url',
      );
      expect(result.expiresIn).toBe(900);

      const saved = photoStore.get(result.photoId);
      expect(saved.status).toBe(PhotoStatus.UPLOADING);
      expect(saved.objectKey).toContain('original.jpg');
    });

    it('should reject upload request if user account is BANNED or SUSPENDED', async () => {
      userStore.set('banned-user', {
        id: 'banned-user',
        status: UserStatus.BANNED,
        profile: { id: 'prof-banned', userId: 'banned-user' },
      });

      await expect(
        service.requestUploadUrl('banned-user', {
          mimeType: 'image/jpeg',
          fileSize: 1024 * 1024,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject upload request if active photo quota (6) is exceeded', async () => {
      for (let i = 0; i < MAX_PROFILE_PHOTOS; i++) {
        photoStore.set(`photo-active-${i}`, {
          id: `photo-active-${i}`,
          profileId: 'prof-1',
          status: PhotoStatus.APPROVED,
          position: i,
          objectKey: `key-${i}`,
          mimeType: 'image/jpeg',
          fileSize: 50000,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      await expect(
        service.requestUploadUrl('user-1', {
          mimeType: 'image/jpeg',
          fileSize: 1024 * 1024,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject upload request if more than 2 pending UPLOADING photos exist', async () => {
      for (let i = 0; i < 2; i++) {
        photoStore.set(`photo-pending-${i}`, {
          id: `photo-pending-${i}`,
          profileId: 'prof-1',
          status: PhotoStatus.UPLOADING,
          position: i,
          objectKey: `pending-${i}`,
          mimeType: 'image/jpeg',
          fileSize: 50000,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      await expect(
        service.requestUploadUrl('user-1', {
          mimeType: 'image/jpeg',
          fileSize: 1024 * 1024,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('completeUpload', () => {
    it('should verify R2 object, set status to PROCESSING, and enqueue BullMQ job', async () => {
      const uploadRes = await service.requestUploadUrl('user-1', {
        mimeType: 'image/png',
        fileSize: 1024 * 1024,
      });

      const completeRes = await service.completeUpload(
        'user-1',
        uploadRes.photoId,
      );
      expect(completeRes).toBeDefined();
      expect(completeRes.status).toBe(PhotoStatus.PROCESSING);

      expect(mockStorage.headObject).toHaveBeenCalled();
      expect(mockQueue.add).toHaveBeenCalledWith(
        'process',
        { photoId: uploadRes.photoId },
        expect.objectContaining({
          jobId: `photo-process-${uploadRes.photoId}`,
        }),
      );
    });

    it('should return existing state idempotently if already PROCESSING or APPROVED', async () => {
      const uploadRes = await service.requestUploadUrl('user-1', {
        mimeType: 'image/png',
        fileSize: 1024 * 1024,
      });

      await service.completeUpload('user-1', uploadRes.photoId);
      mockQueue.add.mockClear();

      // Second call (idempotent retry)
      const secondComplete = await service.completeUpload(
        'user-1',
        uploadRes.photoId,
      );
      expect(secondComplete.status).toBe(PhotoStatus.PROCESSING);
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('should reject complete if object was not found in R2 storage', async () => {
      mockStorage.headObject.mockResolvedValueOnce(null);

      const uploadRes = await service.requestUploadUrl('user-1', {
        mimeType: 'image/jpeg',
        fileSize: 1024 * 1024,
      });

      await expect(
        service.completeUpload('user-1', uploadRes.photoId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Ordering & Primary Photo Invariants', () => {
    beforeEach(() => {
      photoStore.set('photo-1', {
        id: 'photo-1',
        profileId: 'prof-1',
        status: PhotoStatus.APPROVED,
        position: 0,
        thumbnailKey: 'thumb-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      photoStore.set('photo-2', {
        id: 'photo-2',
        profileId: 'prof-1',
        status: PhotoStatus.APPROVED,
        position: 1,
        thumbnailKey: 'thumb-2',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      photoStore.set('photo-3', {
        id: 'photo-3',
        profileId: 'prof-1',
        status: PhotoStatus.APPROVED,
        position: 2,
        thumbnailKey: 'thumb-3',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    it('should set primary photo by shifting target photo to position 0', async () => {
      await service.setPrimary('user-1', 'photo-3');

      expect(photoStore.get('photo-3').position).toBe(0);
      expect(photoStore.get('photo-1').position).toBe(1);
      expect(photoStore.get('photo-2').position).toBe(2);
    });

    it('should reorder photos atomically', async () => {
      await service.reorderPhotos('user-1', {
        photoIds: ['photo-2', 'photo-3', 'photo-1'],
      });

      expect(photoStore.get('photo-2').position).toBe(0);
      expect(photoStore.get('photo-3').position).toBe(1);
      expect(photoStore.get('photo-1').position).toBe(2);
    });

    it('should delete photo, re-index remaining photos (0..N-1), and delete R2 keys', async () => {
      await service.deletePhoto('user-1', 'photo-2');

      expect(photoStore.get('photo-2').status).toBe(PhotoStatus.DELETED);
      expect(photoStore.get('photo-1').position).toBe(0);
      expect(photoStore.get('photo-3').position).toBe(1);

      expect(mockStorage.deleteObjects).toHaveBeenCalled();
    });
  });
});
