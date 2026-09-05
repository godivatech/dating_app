import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { MediaModule } from '../media/media.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DiscoveryPaginationService } from '../discovery/services/discovery-pagination.service';
import { SafetyPolicyService } from './services/safety-policy.service';
import { BlocksService } from './services/blocks.service';
import { ReportsService } from './services/reports.service';
import { ModerationService } from './services/moderation.service';
import { RolesGuard } from './guards/roles.guard';
import { BlocksController } from './blocks.controller';
import { ReportsController } from './reports.controller';
import { ModerationController } from './moderation.controller';
import { SafetyController } from './safety.controller';

import { ContentFilterService } from './services/content-filter.service';
import { SpamDetectionService } from './services/spam-detection.service';
import { DisciplineService } from './services/discipline.service';

@Module({
  imports: [PrismaModule, RedisModule, MediaModule, NotificationsModule],
  controllers: [
    BlocksController,
    ReportsController,
    ModerationController,
    SafetyController,
  ],
  providers: [
    DiscoveryPaginationService,
    SafetyPolicyService,
    BlocksService,
    ReportsService,
    ModerationService,
    ContentFilterService,
    SpamDetectionService,
    DisciplineService,
    RolesGuard,
  ],
  exports: [
    SafetyPolicyService,
    BlocksService,
    ReportsService,
    ModerationService,
    ContentFilterService,
    SpamDetectionService,
    DisciplineService,
  ],
})
export class SafetyModule {}
