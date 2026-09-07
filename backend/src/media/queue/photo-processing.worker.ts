import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import type { StorageService } from '../storage/storage.interface';
import { STORAGE_SERVICE } from '../storage/storage.interface';
import { ImageProcessorService } from '../services/image-processor.service';
import { PhotoStatus } from '@prisma/client';
import {
  PHOTO_PROCESSING_QUEUE,
  PhotoProcessingJobData,
} from './photo-processing.constants';

@Injectable()
export class PhotoProcessingWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PhotoProcessingWorker.name);
  private worker: Worker<PhotoProcessingJobData> | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE)
    private readonly storageService: StorageService,
    private readonly imageProcessor: ImageProcessorService,
  ) {}

  onModuleInit(): void {
    const nodeEnv = this.configService.get<string>('NODE_ENV') || 'development';
    if (nodeEnv === 'test') {
      return; // Do not spawn active redis worker threads during Jest unit/e2e testing
    }

    const redisUrl = this.configService.get<string>('REDIS_URL');
    const isCloudWithoutRedis =
      !redisUrl ||
      (redisUrl.includes('localhost') &&
        (Boolean(process.env.RENDER) || nodeEnv === 'production'));

    if (isCloudWithoutRedis) {
      this.logger.warn(
        'REDIS_URL not configured for cloud deployment. PhotoProcessingWorker disabled.',
      );
      return;
    }
    try {
      const parsed = new URL(redisUrl);
      const connection = {
        host: parsed.hostname || 'localhost',
        port: parseInt(parsed.port || '6379', 10),
        password: parsed.password
          ? decodeURIComponent(parsed.password)
          : undefined,
        username: parsed.username
          ? decodeURIComponent(parsed.username)
          : undefined,
        maxRetriesPerRequest: null,
      };

      this.worker = new Worker<PhotoProcessingJobData>(
        PHOTO_PROCESSING_QUEUE,
        async (job) => this.process(job),
        {
          connection,
          concurrency: 2, // Strict concurrency limit to protect server memory
        },
      );

      this.worker.on('failed', (job, err) => {
        this.logger.error(`Job ${job?.id} failed: ${err.message}`);
      });
      this.logger.log(
        `PhotoProcessingWorker initialized on queue ${PHOTO_PROCESSING_QUEUE}`,
      );
    } catch (err: any) {
      this.logger.warn(`Failed to initialize BullMQ Worker: ${err.message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }

  async process(job: Job<PhotoProcessingJobData>): Promise<void> {
    const { photoId } = job.data;
    this.logger.log(`[PHOTO_PROCESSING_STARTED] Processing photo ${photoId}`);

    // 1. Fetch photo from database
    const photo = await this.prisma.profilePhoto.findUnique({
      where: { id: photoId },
    });

    if (!photo) {
      this.logger.warn(`Photo ${photoId} not found in database. Aborting job.`);
      return;
    }

    // 2. Race condition check: If user deleted photo before worker started, abort
    if (photo.status === PhotoStatus.DELETED) {
      this.logger.log(
        `Photo ${photoId} is marked DELETED. Aborting processing.`,
      );
      return;
    }

    const profileId = photo.profileId;
    const thumbnailKey = `profiles/${profileId}/photos/${photoId}/thumbnail.webp`;
    const mediumKey = `profiles/${profileId}/photos/${photoId}/medium.webp`;
    const largeKey = `profiles/${profileId}/photos/${photoId}/large.webp`;

    try {
      // 3. Download original image with memory bounds check
      const originalBuffer = await this.storageService.getObject(
        photo.objectKey,
      );

      // 4. Validate, strip EXIF, and generate multi-resolution derivatives
      const result = await this.imageProcessor.processImage(originalBuffer);

      // 5. Upload derivatives to Cloudflare R2
      await Promise.all([
        this.storageService.putObject(
          thumbnailKey,
          result.thumbnailBuffer,
          'image/webp',
        ),
        this.storageService.putObject(
          mediumKey,
          result.mediumBuffer,
          'image/webp',
        ),
        this.storageService.putObject(
          largeKey,
          result.largeBuffer,
          'image/webp',
        ),
      ]);

      // 6. Race condition check: Check if photo was deleted while Sharp was running
      const currentPhoto = await this.prisma.profilePhoto.findUnique({
        where: { id: photoId },
      });

      if (!currentPhoto || currentPhoto.status === PhotoStatus.DELETED) {
        this.logger.warn(
          `Photo ${photoId} was DELETED during processing. Cleaning up generated derivatives.`,
        );
        await this.storageService.deleteObjects([
          thumbnailKey,
          mediumKey,
          largeKey,
        ]);
        return;
      }

      // 7. Update database record to PENDING_MODERATION (not automatically approved!)
      await this.prisma.profilePhoto.update({
        where: { id: photoId },
        data: {
          thumbnailKey,
          mediumKey,
          largeKey,
          width: result.width,
          height: result.height,
          status: PhotoStatus.PENDING_MODERATION,
        },
      });

      this.logger.log(
        `[PHOTO_PROCESSING_COMPLETED] Photo ${photoId} processed and moved to PENDING_MODERATION.`,
      );
    } catch (err: any) {
      this.logger.error(
        `[PHOTO_PROCESSING_FAILED] Photo ${photoId} failed processing: ${err.message}`,
      );

      // Mark photo as REJECTED in database with reason
      await this.prisma.profilePhoto.update({
        where: { id: photoId },
        data: {
          status: PhotoStatus.REJECTED,
          rejectionReason: err.message || 'Image processing failed',
        },
      });
    }
  }
}
