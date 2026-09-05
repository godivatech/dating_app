import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { MediaModule } from '../media/media.module';
import { SafetyModule } from '../safety/safety.module';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './services/discovery.service';
import { DiscoveryEligibilityService } from './services/discovery-eligibility.service';
import { MutualCompatibilityService } from './services/mutual-compatibility.service';
import { CandidateGeneratorService } from './services/candidate-generator.service';
import { ExclusionService } from './services/exclusion.service';
import { FeatureExtractionService } from './services/feature-extraction.service';
import { BaselineRankingStrategy } from './strategies/baseline-ranking.strategy';
import { RANKING_STRATEGY } from './strategies/ranking.strategy.interface';
import { DiversityService } from './services/diversity.service';
import { DiscoveryPaginationService } from './services/discovery-pagination.service';
import { ImpressionService } from './services/impression.service';

@Module({
  imports: [PrismaModule, RedisModule, MediaModule, SafetyModule],
  controllers: [DiscoveryController],
  providers: [
    DiscoveryEligibilityService,
    MutualCompatibilityService,
    CandidateGeneratorService,
    ExclusionService,
    FeatureExtractionService,
    BaselineRankingStrategy,
    {
      provide: RANKING_STRATEGY,
      useClass: BaselineRankingStrategy,
    },
    DiversityService,
    DiscoveryPaginationService,
    ImpressionService,
    DiscoveryService,
  ],
  exports: [
    DiscoveryService,
    ImpressionService,
    MutualCompatibilityService,
    RANKING_STRATEGY,
  ],
})
export class DiscoveryModule {}
