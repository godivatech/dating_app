import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsService } from './services/notifications.service';
import { RetentionService } from './services/retention.service';
import { RetentionScheduler } from './schedulers/retention.scheduler';
import { NotificationsController } from './notifications.controller';
import {
  PUSH_NOTIFICATION_PROVIDER,
  ExpoPushNotificationProvider,
} from './providers/push-notification.provider';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    RetentionService,
    RetentionScheduler,
    {
      provide: PUSH_NOTIFICATION_PROVIDER,
      useClass: ExpoPushNotificationProvider,
    },
  ],
  exports: [
    NotificationsService,
    RetentionService,
    RetentionScheduler,
    PUSH_NOTIFICATION_PROVIDER,
  ],
})
export class NotificationsModule {}
