import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DiscoveryPaginationService } from '../../discovery/services/discovery-pagination.service';
import type { StorageService } from '../../media/storage/storage.interface';
import { STORAGE_SERVICE } from '../../media/storage/storage.interface';
import { calculateAge } from '../../profile/utils/age.util';
import { BlocksQueryDto } from '../dto/blocks-query.dto';
import {
  SafeBlock,
  BlocksListResponse,
  DiscoveryCandidate,
  SafeProfilePhoto,
} from '../../../../shared/src/types';
import { MatchStatus, PhotoStatus } from '@prisma/client';

@Injectable()
export class BlocksService {
  private readonly logger = new Logger(BlocksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paginationService: DiscoveryPaginationService,
    @Inject(STORAGE_SERVICE)
    private readonly storageService: StorageService,
  ) {}

  /**
   * Durably records a user block, deactivating any active match between the participants.
   */
  async blockUser(
    blockerUserId: string,
    targetUserId: string,
    reason?: string,
  ): Promise<SafeBlock> {
    if (blockerUserId === targetUserId) {
      throw new BadRequestException('You cannot block yourself.');
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: {
        profile: {
          include: {
            photos: {
              where: { status: PhotoStatus.APPROVED },
              orderBy: { position: 'asc' },
            },
            interests: { include: { interest: true } },
            preferences: true,
          },
        },
      },
    });

    if (!targetUser) {
      throw new NotFoundException('Target user not found.');
    }

    // Transactional block creation and match termination
    const block = await this.prisma.$transaction(async (tx) => {
      const b = await tx.block.upsert({
        where: {
          blockerUserId_blockedUserId: {
            blockerUserId,
            blockedUserId: targetUserId,
          },
        },
        create: {
          blockerUserId,
          blockedUserId: targetUserId,
          reason,
        },
        update: {
          reason,
        },
      });

      // Deactivate any existing match
      const [u1, u2] = [blockerUserId, targetUserId].sort();
      await tx.match.updateMany({
        where: {
          user1Id: u1,
          user2Id: u2,
          status: MatchStatus.ACTIVE,
        },
        data: {
          status: MatchStatus.UNMATCHED,
          unmatchedByUserId: blockerUserId,
          unmatchedAt: new Date(),
        },
      });

      return b;
    });

    this.logger.log(
      `[USER_BLOCKED] User ${blockerUserId} blocked user ${targetUserId}`,
    );

    const safeProfile = targetUser.profile
      ? this.mapToSafeCandidate(targetUser.profile)
      : undefined;

    return {
      id: block.id,
      blockedUserId: block.blockedUserId,
      blockedProfile: safeProfile,
      createdAt: (block.createdAt
        ? new Date(block.createdAt)
        : new Date()
      ).toISOString(),
    };
  }

  /**
   * Removes a user block. Does NOT recreate past matches or conversation history.
   */
  async unblockUser(
    blockerUserId: string,
    targetUserId: string,
  ): Promise<{ success: boolean; message: string }> {
    if (blockerUserId === targetUserId) {
      throw new BadRequestException('Invalid unblock request.');
    }

    await this.prisma.block.deleteMany({
      where: {
        blockerUserId,
        blockedUserId: targetUserId,
      },
    });

    this.logger.log(
      `[USER_UNBLOCKED] User ${blockerUserId} unblocked user ${targetUserId}`,
    );

    return {
      success: true,
      message: 'User unblocked successfully.',
    };
  }

  /**
   * Lists users blocked by the requesting user with cursor pagination.
   */
  async listBlocks(
    blockerUserId: string,
    query: BlocksQueryDto,
  ): Promise<BlocksListResponse> {
    const limit = query.limit || 20;
    const { offset } = this.paginationService.decodeCursor(query.cursor);

    const blocks = await this.prisma.block.findMany({
      where: { blockerUserId },
      include: {
        blockedUser: {
          include: {
            profile: {
              include: {
                photos: {
                  where: { status: PhotoStatus.APPROVED },
                  orderBy: { position: 'asc' },
                },
                interests: { include: { interest: true } },
                preferences: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit + 1,
    });

    const hasMore = blocks.length > limit;
    const items = hasMore ? blocks.slice(0, limit) : blocks;
    const nextCursor = hasMore
      ? this.paginationService.createCursor(offset + limit)
      : null;

    const mappedBlocks: SafeBlock[] = items.map((b) => ({
      id: b.id,
      blockedUserId: b.blockedUserId,
      blockedProfile: b.blockedUser?.profile
        ? this.mapToSafeCandidate(b.blockedUser.profile)
        : undefined,
      createdAt: (b.createdAt
        ? new Date(b.createdAt)
        : new Date()
      ).toISOString(),
    }));

    return {
      blocks: mappedBlocks,
      nextCursor,
      hasMore,
    };
  }

  private mapToSafeCandidate(candidate: any): DiscoveryCandidate {
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
          createdAt: (photo.createdAt
            ? new Date(photo.createdAt)
            : new Date()
          ).toISOString(),
          updatedAt: (photo.updatedAt
            ? new Date(photo.updatedAt)
            : new Date()
          ).toISOString(),
        };
      },
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
}
