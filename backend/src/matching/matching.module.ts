import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { MediaModule } from '../media/media.module';
import { SafetyModule } from '../safety/safety.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BillingModule } from '../billing/billing.module';
import { ChatModule } from '../chat/chat.module';
import { DiscoveryPaginationService } from '../discovery/services/discovery-pagination.service';
import { ActionsController } from './actions.controller';
import { MatchesController } from './matches.controller';
import { ActionsService } from './services/actions.service';
import { MatchesService } from './services/matches.service';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    MediaModule,
    SafetyModule,
    NotificationsModule,
    BillingModule,
    forwardRef(() => ChatModule),
  ],
  controllers: [ActionsController, MatchesController],
  providers: [DiscoveryPaginationService, ActionsService, MatchesService],
  exports: [ActionsService, MatchesService],
})
export class MatchingModule {}
