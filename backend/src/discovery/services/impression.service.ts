import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import {
  RecordImpressionDto,
  RecordImpressionResponse,
} from '../../../../shared/src/types';

export const IMPRESSION_RATE_WINDOW_SECONDS = 60;
export const MAX_IMPRESSION_REQUESTS_PER_WINDOW = 60;
export const IMPRESSION_IDEMPOTENCY_WINDOW_MS = 60 * 60 * 1000; // 1 hour

@Injectable()
export class ImpressionService {
  private readonly logger = new Logger(ImpressionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Records discovery candidate presentation impressions idempotently with anti-abuse rate limits.
   */
  async recordImpressions(
    userId: string,
    dto: RecordImpressionDto,
  ): Promise<RecordImpressionResponse> {
    // 1. Anti-abuse Rate Limiting
    const rateKey = `discovery:impressions-rate:${userId}`;
    const rate = await this.redisService.incrementWithWindow(
      rateKey,
      IMPRESSION_RATE_WINDOW_SECONDS,
    );
    if (rate.current > MAX_IMPRESSION_REQUESTS_PER_WINDOW) {
      throw new BadRequestException(
        'Impression recording rate limit exceeded. Please slow down.',
      );
    }

    const candidateProfileIds: string[] = Array.from(
      new Set(dto.impressions.map((item) => item.candidateProfileId)),
    );

    // 2. Validate candidate profiles exist
    const existingProfiles = await this.prisma.datingProfile.findMany({
      where: {
        id: { in: candidateProfileIds },
      },
      select: { id: true },
    });

    const validProfileIds = new Set(existingProfiles.map((p) => p.id));
    if (validProfileIds.size === 0) {
      return { recordedCount: 0, success: true };
    }

    // 3. Check for recent impressions within idempotency window
    const recentCutoff = new Date(
      Date.now() - IMPRESSION_IDEMPOTENCY_WINDOW_MS,
    );
    const existingRecent = await this.prisma.discoveryImpression.findMany({
      where: {
        viewerUserId: userId,
        targetProfileId: { in: Array.from(validProfileIds) },
        createdAt: { gte: recentCutoff },
      },
      select: { targetProfileId: true },
    });

    const recentlyRecorded = new Set(
      existingRecent.map((imp) => imp.targetProfileId),
    );

    const itemsToInsert = dto.impressions.filter(
      (item) =>
        validProfileIds.has(item.candidateProfileId) &&
        !recentlyRecorded.has(item.candidateProfileId),
    );

    if (itemsToInsert.length === 0) {
      return { recordedCount: 0, success: true };
    }

    await this.prisma.discoveryImpression.createMany({
      data: itemsToInsert.map((item) => ({
        viewerUserId: userId,
        targetProfileId: item.candidateProfileId,
        position: item.position,
        algorithmVersion: item.algorithmVersion || 'baseline-v1',
      })),
    });

    this.logger.log(
      `[IMPRESSIONS_RECORDED] Recorded ${itemsToInsert.length} impressions for user ${userId}`,
    );

    return {
      recordedCount: itemsToInsert.length,
      success: true,
    };
  }
}
