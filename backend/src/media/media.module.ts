import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { PhotosController } from './photos.controller';
import { PhotosService } from './services/photos.service';
import { ImageProcessorService } from './services/image-processor.service';
import { PhotoProcessingWorker } from './queue/photo-processing.worker';
import {
  PHOTO_PROCESSING_QUEUE,
  PHOTO_QUEUE_TOKEN,
} from './queue/photo-processing.constants';
import { R2StorageService } from './storage/r2-storage.service';
import { STORAGE_SERVICE } from './storage/storage.interface';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [PhotosController],
  providers: [
    R2StorageService,
    {
      provide: STORAGE_SERVICE,
      useClass: R2StorageService,
    },
    ImageProcessorService,
    PhotoProcessingWorker,
    {
      provide: PHOTO_QUEUE_TOKEN,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const nodeEnv = config.get<string>('NODE_ENV') || 'development';
        if (nodeEnv === 'test') {
          return {
            add: (name: string, data: any, opts?: any) =>
              Promise.resolve({
                id: `job-test-${Date.now()}`,
                name,
                data,
                opts,
              }),
            close: () => Promise.resolve(),
          };
        }

        const redisUrl =
          config.get<string>('REDIS_URL') || 'redis://localhost:6379';
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
          return new Queue(PHOTO_PROCESSING_QUEUE, { connection });
        } catch {
          return new Queue(PHOTO_PROCESSING_QUEUE, {
            connection: {
              host: 'localhost',
              port: 6379,
              maxRetriesPerRequest: null,
            },
          });
        }
      },
    },
    PhotosService,
  ],
  exports: [
    PhotosService,
    STORAGE_SERVICE,
    ImageProcessorService,
    PHOTO_QUEUE_TOKEN,
  ],
})
export class MediaModule {}
