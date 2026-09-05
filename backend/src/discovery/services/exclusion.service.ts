import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SafetyPolicyService } from '../../safety/services/safety-policy.service';

export const IMPRESSION_SUPPRESSION_DAYS = 7;

@Injectable()
export class ExclusionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly safetyPolicyService: SafetyPolicyService,
  ) {}

  /**
   * Retrieves profile IDs that must be excluded from discovery for the requesting user:
   * 1. Profiles presented within the recent impression suppression window (7 days)
   * 2. Profiles the user has already acted upon (LIKE or PASS)
   * 3. Profiles of users with whom a Match exists (ACTIVE or UNMATCHED)
   * 4. Profiles of users mutually blocked via SafetyPolicyService
   */
  async getSuppressedProfileIds(
    requestingUserId: string,
    suppressionDays: number = IMPRESSION_SUPPRESSION_DAYS,
  ): Promise<Set<string>> {
    const cutoffDate = new Date(
      Date.now() - suppressionDays * 24 * 60 * 60 * 1000,
    );

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

    const excludedIds = new Set<string>();

    for (const imp of recentImpressions) {
      excludedIds.add(imp.targetProfileId);
    }

    for (const action of existingActions) {
      excludedIds.add(action.targetProfileId);
    }

    for (const match of existingMatches) {
      if (match.user1?.profile?.id) excludedIds.add(match.user1.profile.id);
      if (match.user2?.profile?.id) excludedIds.add(match.user2.profile.id);
    }

    if (blockedUserIds.size > 0) {
      const blockedProfiles = await this.prisma.datingProfile.findMany({
        where: {
          userId: { in: Array.from(blockedUserIds) },
        },
        select: { id: true },
      });
      for (const bp of blockedProfiles) {
        excludedIds.add(bp.id);
      }
    }

    return excludedIds;
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
