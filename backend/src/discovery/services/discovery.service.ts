import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { DiscoveryEligibilityService } from './discovery-eligibility.service';
import { MutualCompatibilityService } from './mutual-compatibility.service';
import { CandidateGeneratorService } from './candidate-generator.service';
import { ExclusionService } from './exclusion.service';
import {
  RANKING_STRATEGY,
  type RankingStrategy,
} from '../strategies/ranking.strategy.interface';
import { DiversityService } from './diversity.service';
import { DiscoveryPaginationService } from './discovery-pagination.service';
import type { StorageService } from '../../media/storage/storage.interface';
import { STORAGE_SERVICE } from '../../media/storage/storage.interface';
import { calculateAge } from '../../profile/utils/age.util';
import { DiscoveryQueryDto } from '../dto/discovery-query.dto';
import {
  DiscoveryCandidate,
  DiscoveryFeedResponse,
  SafeProfilePhoto,
} from '../../../../shared/src/types';
import { PhotoStatus } from '@prisma/client';
import { calculateRelativeDistance } from '../utils/geo-distance.util';

export const DISCOVERY_RATE_WINDOW_SECONDS = 60;
export const MAX_DISCOVERY_REQUESTS_PER_WINDOW = 60;

@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly eligibilityService: DiscoveryEligibilityService,
    private readonly mutualCompatibility: MutualCompatibilityService,
    private readonly candidateGenerator: CandidateGeneratorService,
    private readonly exclusionService: ExclusionService,
    @Inject(RANKING_STRATEGY)
    private readonly rankingStrategy: RankingStrategy,
    private readonly diversityService: DiversityService,
    private readonly paginationService: DiscoveryPaginationService,
    @Inject(STORAGE_SERVICE)
    private readonly storageService: StorageService,
  ) {}

  /**
   * Generates a safe, mutually compatible, diverse, and ranked discovery feed for the requesting user.
   */
  async getDiscoveryFeed(
    userId: string,
    query: DiscoveryQueryDto,
  ): Promise<DiscoveryFeedResponse> {
    const limit = query.limit || 20;

    // 1. Redis Rate Limiting
    const rateKey = `discovery:feed-rate:${userId}`;
    const rate = await this.redisService.incrementWithWindow(
      rateKey,
      DISCOVERY_RATE_WINDOW_SECONDS,
    );
    if (rate.current > MAX_DISCOVERY_REQUESTS_PER_WINDOW) {
      throw new BadRequestException(
        'Discovery feed rate limit exceeded. Please wait a moment before refreshing.',
      );
    }

    // 2. Fetch requesting user with full profile, preferences, and approved photos
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: {
          include: {
            preferences: true,
            interests: {
              include: {
                interest: true,
              },
            },
            photos: {
              where: { status: PhotoStatus.APPROVED },
              orderBy: { position: 'asc' },
            },
          },
        },
      },
    });

    // 3. Evaluate Requesting User Discovery Eligibility
    const eligibility = this.eligibilityService.evaluateEligibility(user);
    if (!eligibility.eligible || !user?.profile) {
      return {
        candidates: [],
        nextCursor: null,
        hasMore: false,
        algorithmVersion: this.rankingStrategy.version,
        eligibility,
      };
    }

    const userProfile = user.profile;

    // 4. Candidate Generation (Bounded Pool from PostgreSQL)
    const rawPool = await this.candidateGenerator.generateCandidatePool(
      userProfile.id,
      limit,
    );

    // 5. Mutual Preference Compatibility Filtering (Reciprocal Gender & Age)
    const compatibleCandidates = rawPool.filter((candidate) =>
      this.mutualCompatibility.isMutuallyCompatible(userProfile, candidate),
    );

    // 6. Exclusion Filtering (Hard exclusions + Smart Impression Recycling)
    const { hardExcludedIds, recentImpressionIds } =
      await this.exclusionService.getSuppressionData(userId, 30);

    // Filter hard exclusions (self, swiped actions, matches, blocks, shadowbans)
    const unswipedCompatibleCandidates = this.exclusionService.filterExclusions(
      compatibleCandidates,
      userId,
      userProfile.id,
      hardExcludedIds,
    );

    // Apply soft suppression (recently viewed within current session / last 30 min)
    let eligibleCandidates = unswipedCompatibleCandidates.filter(
      (c) => !recentImpressionIds.has(c.id),
    );

    // Smart Deck Recycler: If recent impressions suppressed all candidates, but unswiped candidates exist,
    // recycle unswiped candidates so the user is never prematurely locked out with "You're all caught up"
    if (
      eligibleCandidates.length === 0 &&
      unswipedCompatibleCandidates.length > 0
    ) {
      this.logger.log(
        `[DISCOVERY_RECYCLE] User ${userId} had 0 unseen candidates but ${unswipedCompatibleCandidates.length} unswiped candidates. Recycling deck to maintain discovery flow.`,
      );
      eligibleCandidates = unswipedCompatibleCandidates;
    }

    // 7. Baseline Multi-Criteria Ranking
    const rankedCandidates = this.rankingStrategy.rankCandidates(
      userProfile,
      eligibleCandidates,
    );

    // 8. Diversity Adjustment Pass
    const diverseCandidates =
      this.diversityService.applyDiversity(rankedCandidates);

    // 9. Opaque Cursor Pagination
    const { offset } = this.paginationService.decodeCursor(query.cursor);
    const pageItems = diverseCandidates.slice(offset, offset + limit);
    const hasMore = offset + limit < diverseCandidates.length;
    const nextCursor = hasMore
      ? this.paginationService.createCursor(offset + limit)
      : null;

    // 10. Map Candidates to Safe Public DTOs with Relative Distance Calculation
    const candidates: DiscoveryCandidate[] = pageItems.map((item) =>
      this.mapToSafeCandidate(item.candidate, userProfile),
    );

    this.logger.log(
      `[DISCOVERY_SERVED] User ${userId} served ${candidates.length} candidates (offset: ${offset}, hasMore: ${hasMore})`,
    );

    return {
      candidates,
      nextCursor,
      hasMore,
      algorithmVersion: this.rankingStrategy.version,
      eligibility: { eligible: true },
    };
  }

  /**
   * Helper to map an internal candidate profile record to a safe public DiscoveryCandidate DTO.
   */
  private mapToSafeCandidate(
    candidate: any,
    userProfile?: any,
  ): DiscoveryCandidate {
    const age = calculateAge(candidate.dateOfBirth);
    const photos: SafeProfilePhoto[] = (candidate.photos || []).map(
      (photo: any) => {
        const isApproved = photo.status === PhotoStatus.APPROVED;
        const fallbackUrl =
          isApproved && photo.objectKey && photo.objectKey !== 'pending'
            ? this.storageService.getPublicUrl(photo.objectKey)
            : null;

        return {
          id: photo.id,
          profileId: photo.profileId,
          status: photo.status,
          position: photo.position,
          isPrimary:
            photo.position === 0 && isApproved,
          thumbnailUrl:
            isApproved && photo.thumbnailKey
              ? this.storageService.getPublicUrl(photo.thumbnailKey)
              : fallbackUrl,
          mediumUrl:
            isApproved && photo.mediumKey
              ? this.storageService.getPublicUrl(photo.mediumKey)
              : fallbackUrl,
          largeUrl:
            isApproved && photo.largeKey
              ? this.storageService.getPublicUrl(photo.largeKey)
              : fallbackUrl,
          width: photo.width,
          height: photo.height,
          createdAt: photo.createdAt.toISOString(),
          updatedAt: photo.updatedAt.toISOString(),
        };
      },
    );

    const interests = (candidate.interests || []).map((pi: any) => ({
      id: pi.interest?.id || pi.interestId,
      name: pi.interest?.name || 'Interest',
      category: pi.interest?.category || 'General',
      status: pi.interest?.status || 'ACTIVE',
    }));

    const { distanceKm, distanceDisplay } = calculateRelativeDistance(
      userProfile?.latitude,
      userProfile?.longitude,
      userProfile?.locationCity,
      candidate.latitude,
      candidate.longitude,
      candidate.locationCity,
      candidate.locationRegion,
    );

    return {
      profileId: candidate.id,
      userId: candidate.userId,
      displayName: candidate.displayName,
      age,
      gender: candidate.gender,
      bio: candidate.bio,
      locationCity: candidate.locationCity,
      locationRegion: candidate.locationRegion,
      locationCountry: candidate.locationCountry,
      relationshipIntent: candidate.preferences?.relationshipIntent || null,
      interests,
      photos,
      algorithmVersion: this.rankingStrategy.version,
      distanceKm,
      distanceDisplay,
    };
  }
}
