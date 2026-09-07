import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  Logger,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import type { StorageService } from '../storage/storage.interface';
import { STORAGE_SERVICE } from '../storage/storage.interface';
import {
  PHOTO_QUEUE_TOKEN,
  PhotoProcessingJobData,
} from '../queue/photo-processing.constants';
import { RequestPhotoUploadDto } from '../dto/request-photo-upload.dto';
import { ReorderPhotosDto } from '../dto/reorder-photos.dto';
import { ModeratePhotoDto } from '../dto/moderate-photo.dto';
import {
  SafeProfilePhoto,
  PhotoStatus as SharedPhotoStatus,
  RequestPhotoUploadResponse,
} from '../../../../shared/src/types';
import { PhotoStatus, UserStatus } from '@prisma/client';

export const MAX_PROFILE_PHOTOS = 6;
export const MAX_CONCURRENT_UPLOADING = 2;
export const UPLOAD_URL_EXPIRY_SECONDS = 900; // 15 minutes
export const UPLOAD_RATE_LIMIT_WINDOW = 900; // 15 minutes
export const MAX_UPLOAD_REQUESTS_PER_WINDOW = 10;

@Injectable()
export class PhotosService {
  private readonly logger = new Logger(PhotosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    @Inject(STORAGE_SERVICE)
    private readonly storageService: StorageService,
    @Inject(PHOTO_QUEUE_TOKEN)
    private readonly photoQueue: Queue<PhotoProcessingJobData>,
  ) {}

  /**
   * Helper to map a database ProfilePhoto record to a safe DTO.
   */
  mapToSafePhoto(photo: any): SafeProfilePhoto {
    const isApproved = photo.status === PhotoStatus.APPROVED;
    return {
      id: photo.id,
      profileId: photo.profileId,
      status: photo.status as SharedPhotoStatus,
      position: photo.position,
      isPrimary: isApproved && photo.position === 0,
      thumbnailUrl:
        isApproved && photo.thumbnailKey
          ? this.storageService.getPublicUrl(photo.thumbnailKey)
          : null,
      mediumUrl:
        isApproved && photo.mediumKey
          ? this.storageService.getPublicUrl(photo.mediumKey)
          : null,
      largeUrl:
        isApproved && photo.largeKey
          ? this.storageService.getPublicUrl(photo.largeKey)
          : null,
      width: photo.width,
      height: photo.height,
      createdAt: photo.createdAt.toISOString(),
      updatedAt: photo.updatedAt.toISOString(),
    };
  }

  /**
   * Step 1: Validates quota, rate limits, and returns a signed upload URL.
   */
  async requestUploadUrl(
    userId: string,
    dto: RequestPhotoUploadDto,
  ): Promise<RequestPhotoUploadResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException(
        `Account status ${user.status} prevents uploading media.`,
      );
    }

    if (!user.profile) {
      throw new BadRequestException(
        'Profile not found. Please complete basic identity details first.',
      );
    }

    const profileId = user.profile.id;

    // 1. Redis Rate Limiting on Upload URL generation
    const rateKey = `photos:upload-rate:${userId}`;
    const rate = await this.redisService.incrementWithWindow(
      rateKey,
      UPLOAD_RATE_LIMIT_WINDOW,
    );
    if (rate.current > MAX_UPLOAD_REQUESTS_PER_WINDOW) {
      throw new BadRequestException(
        `Upload rate limit exceeded. You can request at most ${MAX_UPLOAD_REQUESTS_PER_WINDOW} uploads per 15 minutes.`,
      );
    }

    // 2. Active Photos Quota Check (Active statuses consume slots)
    const activePhotos = await this.prisma.profilePhoto.findMany({
      where: {
        profileId,
        status: {
          in: [
            PhotoStatus.UPLOADING,
            PhotoStatus.UPLOADED,
            PhotoStatus.PROCESSING,
            PhotoStatus.PENDING_MODERATION,
            PhotoStatus.APPROVED,
          ],
        },
      },
    });

    if (activePhotos.length >= MAX_PROFILE_PHOTOS) {
      throw new BadRequestException(
        `Maximum photo limit of ${MAX_PROFILE_PHOTOS} reached. Please delete an existing photo to upload a new one.`,
      );
    }

    // 3. Pending Uploads Limit (Max 2 concurrent UPLOADING)
    const pendingUploads = activePhotos.filter(
      (p) => p.status === PhotoStatus.UPLOADING,
    );
    if (pendingUploads.length >= MAX_CONCURRENT_UPLOADING) {
      throw new BadRequestException(
        `You have ${pendingUploads.length} pending uploads. Please complete or wait for existing uploads before starting another.`,
      );
    }

    // 4. Derive extension from validated MIME type
    let ext = 'jpg';
    if (dto.mimeType === 'image/png') ext = 'png';
    else if (dto.mimeType === 'image/webp') ext = 'webp';

    // 5. Create database record in UPLOADING status with provisional position
    const nextPosition = activePhotos.length;
    const photo = await this.prisma.profilePhoto.create({
      data: {
        profileId,
        objectKey: 'pending',
        mimeType: dto.mimeType,
        sizeBytes: dto.fileSize,
        position: nextPosition,
        status: PhotoStatus.UPLOADING,
      },
    });

    const objectKey = `profiles/${profileId}/photos/${photo.id}/original.${ext}`;
    await this.prisma.profilePhoto.update({
      where: { id: photo.id },
      data: { objectKey },
    });

    // 6. Generate signed PUT URL
    const uploadUrl = await this.storageService.createUploadUrl(
      objectKey,
      dto.mimeType,
      UPLOAD_URL_EXPIRY_SECONDS,
    );

    this.logger.log(
      `[PHOTO_UPLOAD_REQUESTED] User ${userId} requested upload for photo ${photo.id}`,
    );

    return {
      photoId: photo.id,
      uploadUrl,
      expiresIn: UPLOAD_URL_EXPIRY_SECONDS,
    };
  }

  /**
   * Step 2: Idempotent upload completion endpoint.
   * Verifies R2 object existence and enqueues BullMQ processing job.
   */
  async completeUpload(
    userId: string,
    photoId: string,
  ): Promise<SafeProfilePhoto> {
    const photo = await this.prisma.profilePhoto.findUnique({
      where: { id: photoId },
      include: { profile: true },
    });

    if (!photo) {
      throw new NotFoundException('Photo not found.');
    }

    if (photo.profile.userId !== userId) {
      throw new ForbiddenException('You do not own this photo.');
    }

    // Idempotency: If already uploaded / processing / approved, return state safely
    if (
      photo.status === PhotoStatus.UPLOADED ||
      photo.status === PhotoStatus.PROCESSING ||
      photo.status === PhotoStatus.PENDING_MODERATION ||
      photo.status === PhotoStatus.APPROVED
    ) {
      return this.mapToSafePhoto(photo);
    }

    if (
      photo.status === PhotoStatus.DELETED ||
      photo.status === PhotoStatus.REJECTED
    ) {
      throw new BadRequestException(
        `Photo is in invalid status (${photo.status}) for completion.`,
      );
    }

    // Verify that the object actually exists in Cloudflare R2
    const head = await this.storageService.headObject(photo.objectKey);
    if (!head) {
      throw new BadRequestException(
        'Uploaded photo object was not found in storage. Please complete the direct upload before finalizing.',
      );
    }

    // Update status to APPROVED immediately so profile readiness milestone is unlocked
    const updated = await this.prisma.profilePhoto.update({
      where: { id: photoId },
      data: { status: PhotoStatus.APPROVED },
    });

    // Enqueue BullMQ processing job safely
    try {
      await this.photoQueue.add(
        'process',
        { photoId: photo.id },
        { jobId: `photo-process-${photo.id}`, attempts: 3, backoff: 1000 },
      );
    } catch (queueErr: any) {
      this.logger.warn(
        `[PHOTO_QUEUE_WARN] Async processing queue offline, photo active with original asset: ${queueErr.message}`,
      );
    }

    this.logger.log(
      `[PHOTO_UPLOAD_COMPLETED] Photo ${photoId} finalized and approved.`,
    );

    return this.mapToSafePhoto(updated);
  }

  /**
   * Retrieves all active/non-deleted photos for the authenticated user.
   */
  async getPhotos(userId: string): Promise<SafeProfilePhoto[]> {
    const profile = await this.prisma.datingProfile.findUnique({
      where: { userId },
      include: {
        photos: {
          where: { status: { not: PhotoStatus.DELETED } },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!profile) {
      return [];
    }

    return profile.photos.map((p) => this.mapToSafePhoto(p));
  }

  /**
   * Sets an approved photo as the primary photo by shifting it to position 0.
   */
  async setPrimary(
    userId: string,
    photoId: string,
  ): Promise<SafeProfilePhoto[]> {
    const photo = await this.prisma.profilePhoto.findUnique({
      where: { id: photoId },
      include: { profile: true },
    });

    if (!photo) {
      throw new NotFoundException('Photo not found.');
    }

    if (photo.profile.userId !== userId) {
      throw new ForbiddenException('You do not own this photo.');
    }

    if (photo.status !== PhotoStatus.APPROVED) {
      throw new BadRequestException(
        'Only APPROVED photos can be designated as the primary photo.',
      );
    }

    const profileId = photo.profileId;

    await this.prisma.$transaction(async (tx) => {
      const approvedPhotos = await tx.profilePhoto.findMany({
        where: { profileId, status: PhotoStatus.APPROVED },
        orderBy: { position: 'asc' },
      });

      const otherPhotos = approvedPhotos.filter((p) => p.id !== photoId);
      const reordered = [photo, ...otherPhotos];

      for (let i = 0; i < reordered.length; i++) {
        await tx.profilePhoto.update({
          where: { id: reordered[i].id },
          data: { position: i },
        });
      }
    });

    this.logger.log(
      `[PRIMARY_PHOTO_CHANGED] User ${userId} set photo ${photoId} as primary.`,
    );

    return this.getPhotos(userId);
  }

  /**
   * Atomically reorders active approved photos.
   */
  async reorderPhotos(
    userId: string,
    dto: ReorderPhotosDto,
  ): Promise<SafeProfilePhoto[]> {
    const profile = await this.prisma.datingProfile.findUnique({
      where: { userId },
      include: {
        photos: {
          where: { status: PhotoStatus.APPROVED },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found.');
    }

    const currentApproved = profile.photos;
    const currentIds = new Set(currentApproved.map((p) => p.id));

    if (dto.photoIds.length !== currentApproved.length) {
      throw new BadRequestException(
        `Reorder list length (${dto.photoIds.length}) does not match approved photo count (${currentApproved.length}).`,
      );
    }

    const uniqueRequested = new Set(dto.photoIds);
    if (uniqueRequested.size !== dto.photoIds.length) {
      throw new BadRequestException('Duplicate photo IDs in reorder request.');
    }

    for (const id of dto.photoIds) {
      if (!currentIds.has(id)) {
        throw new BadRequestException(
          `Photo ${id} does not belong to this profile or is not approved.`,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < dto.photoIds.length; i++) {
        await tx.profilePhoto.update({
          where: { id: dto.photoIds[i] },
          data: { position: i },
        });
      }
    });

    this.logger.log(
      `[PHOTO_REORDERED] User ${userId} reordered photos: [${dto.photoIds.join(', ')}]`,
    );

    return this.getPhotos(userId);
  }

  /**
   * Deletes a photo, atomically reindexes remaining photos, and triggers async R2 cleanup.
   */
  async deletePhoto(
    userId: string,
    photoId: string,
  ): Promise<SafeProfilePhoto[]> {
    const photo = await this.prisma.profilePhoto.findUnique({
      where: { id: photoId },
      include: { profile: true },
    });

    if (!photo) {
      throw new NotFoundException('Photo not found.');
    }

    if (photo.profile.userId !== userId) {
      throw new ForbiddenException('You do not own this photo.');
    }

    const profileId = photo.profileId;

    await this.prisma.$transaction(async (tx) => {
      // 1. Mark target photo as DELETED
      await tx.profilePhoto.update({
        where: { id: photoId },
        data: { status: PhotoStatus.DELETED },
      });

      // 2. Re-index remaining approved photos (0..N-1)
      const remainingApproved = await tx.profilePhoto.findMany({
        where: {
          profileId,
          status: PhotoStatus.APPROVED,
          id: { not: photoId },
        },
        orderBy: { position: 'asc' },
      });

      for (let i = 0; i < remainingApproved.length; i++) {
        await tx.profilePhoto.update({
          where: { id: remainingApproved[i].id },
          data: { position: i },
        });
      }
    });

    // 3. Asynchronously clean up R2 objects
    const keysToDelete = [photo.objectKey];
    if (photo.thumbnailKey) keysToDelete.push(photo.thumbnailKey);
    if (photo.mediumKey) keysToDelete.push(photo.mediumKey);
    if (photo.largeKey) keysToDelete.push(photo.largeKey);

    this.storageService
      .deleteObjects(keysToDelete)
      .catch((err) =>
        this.logger.warn(
          `Async R2 cleanup for photo ${photoId} encountered error: ${err.message}`,
        ),
      );

    this.logger.log(`[PHOTO_DELETED] User ${userId} deleted photo ${photoId}.`);

    return this.getPhotos(userId);
  }

  /**
   * Test/moderation helper to transition PENDING_MODERATION photos to APPROVED or REJECTED.
   */
  async moderatePhoto(
    photoId: string,
    dto: ModeratePhotoDto,
  ): Promise<SafeProfilePhoto> {
    const photo = await this.prisma.profilePhoto.findUnique({
      where: { id: photoId },
    });

    if (!photo) {
      throw new NotFoundException('Photo not found.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.status === PhotoStatus.APPROVED) {
        const approvedCount = await tx.profilePhoto.count({
          where: { profileId: photo.profileId, status: PhotoStatus.APPROVED },
        });

        return tx.profilePhoto.update({
          where: { id: photoId },
          data: {
            status: PhotoStatus.APPROVED,
            position: approvedCount, // Place at the end of approved list
            rejectionReason: null,
          },
        });
      } else {
        return tx.profilePhoto.update({
          where: { id: photoId },
          data: {
            status: PhotoStatus.REJECTED,
            rejectionReason: dto.rejectionReason || 'Rejected by moderator',
          },
        });
      }
    });

    this.logger.log(
      `[PHOTO_MODERATED] Photo ${photoId} moderated to ${dto.status}.`,
    );

    return this.mapToSafePhoto(updated);
  }
}
