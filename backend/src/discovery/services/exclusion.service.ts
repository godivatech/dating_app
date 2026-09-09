import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SafetyPolicyService } from '../../safety/services/safety-policy.service';

export const IMPRESSION_SUPPRESSION_DAYS = 7;
export const IMPRESSION_SUPPRESSION_MINUTES = 30;

export interface SuppressionData {
  hardExcludedIds: Set<string>;
  recentImpressionIds: Set<string>;
  allSuppressedIds: Set<string>;
}

@Injectable()
export class ExclusionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly safetyPolicyService: SafetyPolicyService,
  ) {}

  /**
   * Retrieves profile IDs categorized into hard exclusions (permanent) and soft recent impressions.
   *
   * Hard Exclusions:
   * 1. Profiles the user has already acted upon (LIKE or PASS)
   * 2. Profiles of users with whom a Match exists (ACTIVE or UNMATCHED)
   * 3. Profiles of users mutually blocked via SafetyPolicyService
   *
   * Soft Exclusions:
   * 4. Profiles presented within the short recent impression window (default 30 min)
   */
  async getSuppressionData(
    requestingUserId: string,
    suppressionMinutes: number = IMPRESSION_SUPPRESSION_MINUTES,
  ): Promise<SuppressionData> {
    const cutoffDate = new Date(Date.now() - suppressionMinutes * 60 * 1000);

    const [
      recentImpressions,
      existingActions,
      existingMatches,
      blockedUserIds,
    ] = await Promise.all([
      this.prisma.discoveryImpression.findMany({
        where: {
          viewerUserId: requestingUserId,
          createdAt: {
            gte: cutoffDate,
          },
        },
        select: {
          targetProfileId: true,
        },
      }),
      this.prisma.userAction.findMany({
        where: {
          actorUserId: requestingUserId,
        },
        select: {
          targetProfileId: true,
        },
      }),
      this.prisma.match.findMany({
        where: {
          OR: [{ user1Id: requestingUserId }, { user2Id: requestingUserId }],
        },
        include: {
          user1: { select: { profile: { select: { id: true } } } },
          user2: { select: { profile: { select: { id: true } } } },
        },
      }),
      this.safetyPolicyService.getMutualBlockedUserIds(requestingUserId),
    ]);

    const hardExcludedIds = new Set<string>();
    const recentImpressionIds = new Set<string>();
    const allSuppressedIds = new Set<string>();

    for (const action of existingActions) {
      hardExcludedIds.add(action.targetProfileId);
      allSuppressedIds.add(action.targetProfileId);
    }

    for (const match of existingMatches) {
      if (match.user1?.profile?.id) {
        hardExcludedIds.add(match.user1.profile.id);
        allSuppressedIds.add(match.user1.profile.id);
      }
      if (match.user2?.profile?.id) {
        hardExcludedIds.add(match.user2.profile.id);
        allSuppressedIds.add(match.user2.profile.id);
      }
    }

    if (blockedUserIds.size > 0) {
      const blockedProfiles = await this.prisma.datingProfile.findMany({
        where: {
          userId: { in: Array.from(blockedUserIds) },
        },
        select: { id: true },
      });
      for (const bp of blockedProfiles) {
        hardExcludedIds.add(bp.id);
        allSuppressedIds.add(bp.id);
      }
    }

    for (const imp of recentImpressions) {
      recentImpressionIds.add(imp.targetProfileId);
      allSuppressedIds.add(imp.targetProfileId);
    }

    return {
      hardExcludedIds,
      recentImpressionIds,
      allSuppressedIds,
    };
  }

  /**
   * Retrieves profile IDs that must be excluded from discovery for the requesting user (all combined).
   */
  async getSuppressedProfileIds(
    requestingUserId: string,
    suppressionDays: number = IMPRESSION_SUPPRESSION_DAYS,
  ): Promise<Set<string>> {
    const suppressionMinutes = suppressionDays * 24 * 60;
    const data = await this.getSuppressionData(requestingUserId, suppressionMinutes);
    return data.allSuppressedIds;
  }

  /**
   * Filters out self, recently seen candidates, acted upon candidates, and matches.
   */
  filterExclusions(
    candidates: any[],
    requestingUserId: string,
    requestingProfileId: string,
    suppressedProfileIds: Set<string>,
  ): any[] {
    return candidates.filter((candidate) => {
      // 1. Exclude self (by profileId and userId)
      if (
        candidate.id === requestingProfileId ||
        candidate.userId === requestingUserId
      ) {
        return false;
      }

      // 2. Exclude suppressed profiles (impressions, likes, passes, matches)
      if (suppressedProfileIds.has(candidate.id)) {
        return false;
      }

      // 3. Exclude shadowbanned candidate profiles
      if (
        candidate.user?.shadowBannedUntil &&
        new Date(candidate.user.shadowBannedUntil) > new Date()
      ) {
        return false;
      }

      return true;
    });
  }
}
