import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsService } from './services/notifications.service';
import { NotificationsController } from './notifications.controller';
import {
  PUSH_NOTIFICATION_PROVIDER,
  ConsolePushNotificationProvider,
} from './providers/push-notification.provider';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    {
      provide: PUSH_NOTIFICATION_PROVIDER,
      useClass: ConsolePushNotificationProvider,
    },
  ],
  exports: [NotificationsService, PUSH_NOTIFICATION_PROVIDER],
})
export class NotificationsModule {}
