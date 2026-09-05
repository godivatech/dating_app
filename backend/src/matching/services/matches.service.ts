import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EntitlementService } from '../../billing/services/entitlement.service';
import type { StorageService } from '../../media/storage/storage.interface';
import { STORAGE_SERVICE } from '../../media/storage/storage.interface';
import { DiscoveryPaginationService } from '../../discovery/services/discovery-pagination.service';
import { calculateAge } from '../../profile/utils/age.util';
import { MatchesQueryDto } from '../dto/matches-query.dto';
import {
  MatchesListResponse,
  SafeMatch,
  UnmatchResponse,
  MatchStatus,
  DiscoveryCandidate,
  SafeProfilePhoto,
  IncomingLikesResponse,
  IncomingLikeCandidate,
} from '../../../../shared/src/types';
import {
  PhotoStatus,
  MatchStatus as PrismaMatchStatus,
  ActionType,
  EntitlementKey,
  UserStatus,
} from '@prisma/client';

@Injectable()
export class MatchesService {
  private readonly logger = new Logger(MatchesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paginationService: DiscoveryPaginationService,
    private readonly entitlementService: EntitlementService,
    @Inject(STORAGE_SERVICE)
    private readonly storageService: StorageService,
  ) {}

  /**
   * Retrieves paginated active matches for the requesting user.
   */
  async getMatches(
    userId: string,
    query: MatchesQueryDto,
  ): Promise<MatchesListResponse> {
    const limit = query.limit || 20;
    const { offset } = this.paginationService.decodeCursor(query.cursor);

    const matches = await this.prisma.match.findMany({
      where: {
        status: MatchStatus.ACTIVE,
        OR: [{ user1Id: userId }, { user2Id: userId }],
      },
      include: {
        user1: {
          include: {
            profile: {
              include: {
                preferences: true,
                interests: { include: { interest: true } },
                photos: {
                  where: { status: PhotoStatus.APPROVED },
                  orderBy: { position: 'asc' },
                },
              },
            },
          },
        },
        user2: {
          include: {
            profile: {
              include: {
                preferences: true,
                interests: { include: { interest: true } },
                photos: {
                  where: { status: PhotoStatus.APPROVED },
                  orderBy: { position: 'asc' },
                },
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      skip: offset,
      take: limit + 1,
    });

    const hasMore = matches.length > limit;
    const items = hasMore ? matches.slice(0, limit) : matches;
    const nextCursor = hasMore
      ? this.paginationService.createCursor(offset + limit)
      : null;

    const safeMatches: SafeMatch[] = items
      .map((m) => {
        const otherUser = m.user1Id === userId ? m.user2 : m.user1;
        if (!otherUser?.profile) return null;

        const matchedProfile = this.mapToSafeCandidate(otherUser.profile);
        return {
          id: m.id,
          matchedProfile,
          matchedAt: (m.createdAt
            ? new Date(m.createdAt)
            : new Date()
          ).toISOString(),
          status: m.status as MatchStatus,
        };
      })
      .filter((m): m is SafeMatch => m !== null);

    return {
      matches: safeMatches,
      nextCursor,
      hasMore,
    };
  }

  /**
   * Retrieves single match detail with participant authorization.
   */
  async getMatchDetail(userId: string, matchId: string): Promise<SafeMatch> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        user1: {
          include: {
            profile: {
              include: {
                preferences: true,
                interests: { include: { interest: true } },
                photos: {
                  where: { status: PhotoStatus.APPROVED },
                  orderBy: { position: 'asc' },
                },
              },
            },
          },
        },
        user2: {
          include: {
            profile: {
              include: {
                preferences: true,
                interests: { include: { interest: true } },
                photos: {
                  where: { status: PhotoStatus.APPROVED },
                  orderBy: { position: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    if (
      !match ||
      (match.user1Id !== userId && match.user2Id !== userId) ||
      match.status !== PrismaMatchStatus.ACTIVE
    ) {
      throw new NotFoundException('Match not found.');
    }

    const otherUser = match.user1Id === userId ? match.user2 : match.user1;
    if (!otherUser?.profile) {
      throw new NotFoundException('Matched profile not found.');
    }

    const matchedProfile = this.mapToSafeCandidate(otherUser.profile);

    return {
      id: match.id,
      matchedProfile,
      matchedAt: (match.createdAt
        ? new Date(match.createdAt)
        : new Date()
      ).toISOString(),
      status: match.status as MatchStatus,
    };
  }

  /**
   * Unmatches a match safely and updates status to UNMATCHED.
   */
  async unmatch(userId: string, matchId: string): Promise<UnmatchResponse> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
    });

    if (
      !match ||
      (match.user1Id !== userId && match.user2Id !== userId) ||
      match.status !== PrismaMatchStatus.ACTIVE
    ) {
      throw new NotFoundException('Match not found.');
    }

    await this.prisma.match.update({
      where: { id: matchId },
      data: {
        status: PrismaMatchStatus.UNMATCHED,
        unmatchedByUserId: userId,
        unmatchedAt: new Date(),
      },
    });

    this.logger.log(
      `[USER_UNMATCHED] User ${userId} unmatched match ${matchId}`,
    );

    return {
      success: true,
      message: 'Successfully unmatched.',
    };
  }

  /**
   * Retrieves pending incoming likes directed to the requesting user.
   * If the user has the SEE_LIKES entitlement, candidates are unmasked.
   * If free, candidates are blurred and total count is returned.
   */
  async getIncomingLikes(
    userId: string,
    query: MatchesQueryDto,
  ): Promise<IncomingLikesResponse> {
    const limit = query.limit || 20;
    const { offset } = this.paginationService.decodeCursor(query.cursor);

    // 1. Get user's profile
    const userProfile = await this.prisma.datingProfile.findUnique({
      where: { userId },
    });

    if (!userProfile) {
      return {
        totalCount: 0,
        unlocked: false,
        likes: [],
        nextCursor: null,
        hasMore: false,
      };
    }

    // 2. Check SEE_LIKES entitlement
    const hasSeeLikes = await this.entitlementService.hasEntitlement(
      userId,
      EntitlementKey.SEE_LIKES,
    );

    // 3. Find actions where target is userProfile and actionType is LIKE
    // Exclude users already matched or already acted upon by requester
    const myActions = await this.prisma.userAction.findMany({
      where: { actorUserId: userId },
      select: { targetProfileId: true },
    });
    const myActedProfileIds = myActions.map((a) => a.targetProfileId);

    let blockedUserIds: string[] = [];
    if (this.prisma.block) {
      const blocks = await this.prisma.block.findMany({
        where: {
          OR: [{ blockerUserId: userId }, { blockedUserId: userId }],
        },
        select: { blockerUserId: true, blockedUserId: true },
      });
      blockedUserIds = blocks.map((b) =>
        b.blockerUserId === userId ? b.blockedUserId : b.blockerUserId,
      );
    }

    const whereClause: any = {
      targetProfileId: userProfile.id,
      actionType: ActionType.LIKE,
      actorUser: {
        status: UserStatus.ACTIVE,
        OR: [
          { shadowBannedUntil: null },
          { shadowBannedUntil: { lte: new Date() } },
        ],
        profile: {
          id: { notIn: myActedProfileIds },
        },
      },
    };

    if (blockedUserIds.length > 0) {
      whereClause.actorUserId = { notIn: blockedUserIds };
    }

    const totalCount = await this.prisma.userAction.count({
      where: whereClause,
    });

    const incomingLikes = await this.prisma.userAction.findMany({
      where: whereClause,
      include: {
        actorUser: {
          include: {
            profile: {
              include: {
                preferences: true,
                interests: { include: { interest: true } },
                photos: {
                  where: { status: PhotoStatus.APPROVED },
                  orderBy: { position: 'asc' },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit + 1,
    });

    const hasMore = incomingLikes.length > limit;
    const items = hasMore ? incomingLikes.slice(0, limit) : incomingLikes;
    const nextCursor = hasMore
      ? this.paginationService.encodeCursor(offset + limit)
      : null;

    const mappedLikes: IncomingLikeCandidate[] = items.map((action) => {
      const actorProfile = action.actorUser?.profile;
      if (!actorProfile) {
        return {
          actionId: action.id,
          createdAt: action.createdAt.toISOString(),
          candidate: {
            profileId: action.actorUserId,
            displayName: 'Someone new',
            age: 25,
            blurred: true,
            photoThumbnailUrl: null,
          },
        };
      }

      if (hasSeeLikes) {
        return {
          actionId: action.id,
          createdAt: action.createdAt.toISOString(),
          candidate: this.mapToSafeCandidate(actorProfile),
        };
      } else {
        const primaryPhoto = actorProfile.photos?.[0];
        return {
          actionId: action.id,
          createdAt: action.createdAt.toISOString(),
          candidate: {
            profileId: actorProfile.id,
            displayName: 'Someone new',
            age: calculateAge(actorProfile.dateOfBirth),
            blurred: true,
            photoThumbnailUrl: primaryPhoto
              ? this.storageService.getPublicUrl(
                  primaryPhoto.thumbnailKey || primaryPhoto.objectKey,
                )
              : null,
          },
        };
      }
    });

    return {
      totalCount,
      unlocked: hasSeeLikes,
      likes: mappedLikes,
      nextCursor,
      hasMore,
    };
  }

  private mapToSafeCandidate(candidate: any): DiscoveryCandidate {
    const age = calculateAge(candidate.dateOfBirth);
    const photos: SafeProfilePhoto[] = (candidate.photos || []).map(
      (photo: any) => ({
        id: photo.id,
        profileId: photo.profileId,
        status: photo.status,
        position: photo.position,
        isPrimary:
          photo.position === 0 && photo.status === PhotoStatus.APPROVED,
        thumbnailUrl: photo.thumbnailKey
          ? this.storageService.getPublicUrl(photo.thumbnailKey)
          : null,
        mediumUrl: photo.mediumKey
          ? this.storageService.getPublicUrl(photo.mediumKey)
          : null,
        largeUrl: photo.largeKey
          ? this.storageService.getPublicUrl(photo.largeKey)
          : null,
        width: photo.width,
        height: photo.height,
        createdAt: (photo.createdAt
          ? new Date(photo.createdAt)
          : new Date()
        ).toISOString(),
        updatedAt: (photo.updatedAt
          ? new Date(photo.updatedAt)
          : new Date()
        ).toISOString(),
      }),
    );

    const interests = (candidate.interests || []).map((pi: any) => ({
      id: pi.interest?.id || pi.interestId,
      name: pi.interest?.name || 'Interest',
      category: pi.interest?.category || 'General',
      status: pi.interest?.status || 'ACTIVE',
    }));

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
      algorithmVersion: 'baseline-v1',
    };
  }

  /**
   * Retrieves pending incoming direct notes/messages sent to the user.
   */
  async getIncomingNotes(userId: string) {
    const userProfile = await this.prisma.datingProfile.findUnique({
      where: { userId },
    });

    if (!userProfile) {
      return { notes: [], totalCount: 0 };
    }

    const myActions = await this.prisma.userAction.findMany({
      where: { actorUserId: userId },
      select: { targetProfileId: true },
    });
    const myActedProfileIds = myActions.map((a) => a.targetProfileId);

    let blockedUserIds: string[] = [];
    if (this.prisma.block) {
      const blocks = await this.prisma.block.findMany({
        where: {
          OR: [{ blockerUserId: userId }, { blockedUserId: userId }],
        },
        select: { blockerUserId: true, blockedUserId: true },
      });
      blockedUserIds = blocks.map((b) =>
        b.blockerUserId === userId ? b.blockedUserId : b.blockerUserId,
      );
    }

    const whereClause: any = {
      targetProfileId: userProfile.id,
      actionType: ActionType.LIKE,
      note: { not: null },
      actorUser: {
        status: UserStatus.ACTIVE,
        OR: [
          { shadowBannedUntil: null },
          { shadowBannedUntil: { lte: new Date() } },
        ],
        profile: {
          id: { notIn: myActedProfileIds },
        },
      },
    };

    if (blockedUserIds.length > 0) {
      whereClause.actorUserId = { notIn: blockedUserIds };
    }

    const incomingNotes = await this.prisma.userAction.findMany({
      where: whereClause,
      include: {
        actorUser: {
          include: {
            profile: {
              include: {
                preferences: true,
                interests: { include: { interest: true } },
                photos: {
                  where: { status: PhotoStatus.APPROVED },
                  orderBy: { position: 'asc' },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return {
      totalCount: incomingNotes.length,
      notes: incomingNotes.map((action) => ({
        actionId: action.id,
        senderProfile: this.mapToSafeCandidate(action.actorUser.profile),
        note: action.note || '',
        createdAt: action.createdAt.toISOString(),
      })),
    };
  }
}
