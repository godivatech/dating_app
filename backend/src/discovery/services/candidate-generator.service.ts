import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ProfileStatus,
  ProfileVisibility,
  PhotoStatus,
  UserStatus,
  EntitlementKey,
} from '@prisma/client';

export const MAX_CANDIDATE_POOL_SIZE = 150;

@Injectable()
export class CandidateGeneratorService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates a bounded candidate pool of profiles satisfying hard database-level eligibility.
   *
   * Hard SQL Constraints:
   * - Different user/profile than requester
   * - Profile status == READY
   * - Profile visibility == VISIBLE
   * - User account status == ACTIVE
   * - Contains at least one APPROVED photo
   * - Dating preferences configured
   *
   * Boosted profiles with active PROFILE_BOOST entitlements are fetched first to
   * guarantee visibility without being dropped by candidate limits.
   */
  async generateCandidatePool(
    requestingProfileId: string,
    requestedLimit: number,
  ): Promise<any[]> {
    const poolSize = Math.min(
      Math.max(requestedLimit * 4, 40),
      MAX_CANDIDATE_POOL_SIZE,
    );

    const now = new Date();

    const baseWhere = {
      id: { not: requestingProfileId },
      status: ProfileStatus.READY,
      visibility: ProfileVisibility.VISIBLE,
      user: {
        status: UserStatus.ACTIVE,
        OR: [
          { shadowBannedUntil: null },
          { shadowBannedUntil: { lte: now } },
        ],
      },
      photos: {
        some: {
          status: PhotoStatus.APPROVED,
        },
      },
    };

    const includeClause = {
      user: {
        select: {
          id: true,
          status: true,
          shadowBannedUntil: true,
          lastLoginAt: true,
          entitlements: {
            where: {
              entitlementKey: EntitlementKey.PROFILE_BOOST,
              isActive: true,
              OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            },
            select: {
              expiresAt: true,
            },
          },
        },
      },
      preferences: true,
      interests: {
        include: {
          interest: true,
        },
      },
      photos: {
        where: {
          status: PhotoStatus.APPROVED,
        },
        orderBy: {
          position: 'asc' as const,
        },
      },
    };

    // 1. Prioritize active boosted candidates (guarantees boost monetization value)
    const boostedCandidates = await this.prisma.datingProfile.findMany({
      where: {
        ...baseWhere,
        user: {
          ...baseWhere.user,
          entitlements: {
            some: {
              entitlementKey: EntitlementKey.PROFILE_BOOST,
              isActive: true,
              OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            },
          },
        },
      },
      include: includeClause,
      take: 20,
    });

    const boostedIds = boostedCandidates.map((c) => c.id);
    const remainingSlots = Math.max(0, poolSize - boostedCandidates.length);

    // 2. Fetch regular candidate pool
    const regularCandidates = await this.prisma.datingProfile.findMany({
      where: {
        ...baseWhere,
        id: {
          notIn: [requestingProfileId, ...boostedIds],
        },
      },
      include: includeClause,
      take: Math.max(remainingSlots, 20),
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return [...boostedCandidates, ...regularCandidates];
  }
}

