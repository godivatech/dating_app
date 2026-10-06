import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BillingModule } from '../billing/billing.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ChatModule } from '../chat/chat.module';
import { GiftsController } from './gifts.controller';
import { GiftsService } from './services/gifts.service';

@Module({
  imports: [
    PrismaModule,
    BillingModule,
    NotificationsModule,
    forwardRef(() => ChatModule),
  ],
  controllers: [GiftsController],
  providers: [GiftsService],
  exports: [GiftsService],
})
export class GiftsModule {}
