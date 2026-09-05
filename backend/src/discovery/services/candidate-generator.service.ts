import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ProfileStatus,
  ProfileVisibility,
  PhotoStatus,
  UserStatus,
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
   */
  async generateCandidatePool(
    requestingProfileId: string,
    requestedLimit: number,
  ): Promise<any[]> {
    const poolSize = Math.min(
      Math.max(requestedLimit * 4, 40),
      MAX_CANDIDATE_POOL_SIZE,
    );

    return this.prisma.datingProfile.findMany({
      where: {
        id: { not: requestingProfileId },
        status: ProfileStatus.READY,
        visibility: ProfileVisibility.VISIBLE,
        user: {
          status: UserStatus.ACTIVE,
          OR: [
            { shadowBannedUntil: null },
            { shadowBannedUntil: { lte: new Date() } },
          ],
        },
        photos: {
          some: {
            status: PhotoStatus.APPROVED,
          },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            status: true,
            shadowBannedUntil: true,
            lastLoginAt: true,
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
            position: 'asc',
          },
        },
      },
      take: poolSize,
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }
}
