import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { MediaModule } from '../media/media.module';
import { SafetyModule } from '../safety/safety.module';
import { DiscoveryPaginationService } from '../discovery/services/discovery-pagination.service';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [PrismaModule, RedisModule, MediaModule, SafetyModule],
  controllers: [AdminController],
  providers: [AdminService, DiscoveryPaginationService],
  exports: [AdminService],
})
export class AdminModule {}
